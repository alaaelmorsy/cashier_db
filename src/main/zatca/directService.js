'use strict';

// خدمة الإرسال المباشر لبوابة ZATCA — منقولة من برنامج المغاسل
// (server/services/zatca/directService.js) بتكييف مستندات الكاشير.

const crypto = require('crypto');
const { BrowserWindow } = require('electron');
const {
  ZatcaApiClient,
  asCertificatePem,
  generateCreditNoteXml,
  generateInvoiceXml,
  isCreditNoteData,
} = require('@talha7k/zatca');
const db = require('./db');
const { dbAdapter } = require('../../db/db-adapter');
const { decryptSecret } = require('./vault');
const { classifyInvoice } = require('./index');
const { mapCreditNote, mapSale } = require('./mapper');
const { ensureRequiredCustomerParty, injectZeroRateReason } = require('./xml');
const { runCryptoAction } = require('./crypto-runtime');

const ACCEPTED_STATUSES = new Set(['reported', 'cleared', 'accepted_with_warnings']);
const DEVELOPER_URL = 'https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal';
const SIMULATION_URL = 'https://gw-fatoora.zatca.gov.sa/e-invoicing/simulation';
const PRODUCTION_URL = 'https://gw-fatoora.zatca.gov.sa/e-invoicing/core';

function credentials(settings) {
  if (settings.onboarding_status !== 'production_ready') throw new Error('تهيئة ZATCA غير مكتملة');
  if (settings.certificate_expires_at && new Date(settings.certificate_expires_at).getTime() < Date.now()) {
    throw new Error('شهادة ZATCA منتهية الصلاحية — يجب إعادة خطوات التهيئة لإصدار شهادة جديدة');
  }
  // Reporting/clearance endpoints only accept the production CSID credentials
  // (the compliance CSID gets 401 there), even when signing falls back to the
  // compliance certificate on the developer portal.
  return {
    binarySecurityToken: decryptSecret(settings.production_token_enc),
    secret: decryptSecret(settings.production_secret_enc),
  };
}

function apiConfig(settings) {
  const testUrls = { sandbox: DEVELOPER_URL, simulation: SIMULATION_URL };
  return {
    environment: settings.environment,
    sandboxUrl: testUrls[settings.environment],
    productionUrl: settings.environment === 'production' ? PRODUCTION_URL : undefined,
    timeout: 30000,
  };
}

function retryable(error) {
  return /API_CONN_ERR|API_TIMEOUT_ERR|ZATCA_CHAIN_BUSY|429|HTTP_5\d\d|timed out|connection failed/i.test(String(error?.code || '') + ' ' + String(error?.message || ''));
}

function retryDate(attempts) {
  const minutes = Math.min(360, 2 ** Math.min(8, attempts));
  return new Date(Date.now() + minutes * 60000);
}

// The library's XML generator has no supply-date field (KSA-5), so it is
// injected into the UBL right after the customer party before signing.
function injectDeliveryDate(xml, deliveryDate) {
  if (!deliveryDate) return xml;
  const marker = '</cac:AccountingCustomerParty>';
  if (!xml.includes(marker)) {
    throw new Error('تعذر إدراج تاريخ التوريد (KSA-5) في XML — تغيّر تنسيق المكتبة');
  }
  const delivery = `<cac:Delivery><cbc:ActualDeliveryDate>${deliveryDate}</cbc:ActualDeliveryDate></cac:Delivery>`;
  return xml.replace(marker, `${marker}${delivery}`);
}

// The developer-portal (sandbox) issues a canned production certificate that
// does not match the EGS private key, so signing must use whichever stored
// certificate actually pairs with the key (production first, then compliance).
async function signingCertificate(settings, privateKeyPem) {
  const candidates = [settings.production_certificate_pem];
  try {
    if (settings.compliance_token_enc) candidates.push(asCertificatePem(decryptSecret(settings.compliance_token_enc)));
  } catch (_) {}
  const selected = await runCryptoAction('selectSigningCertificate', { privateKeyPem, candidates });
  if (selected) return selected;
  throw new Error('لا توجد شهادة ZATCA مطابقة للمفتاح الخاص — أعد خطوات التهيئة');
}

async function getAppSettings() {
  const conn = await dbAdapter.getConnection();
  try {
    const [[row]] = await conn.query('SELECT vat_percent, prices_include_vat FROM app_settings WHERE id = 1');
    return row || { vat_percent: 15, prices_include_vat: 1 };
  } finally {
    conn.release();
  }
}

async function submitMappedDocument(document, settings, submission) {
  const privateKeyPem = decryptSecret(settings.private_key_enc);
  const certificatePem = await signingCertificate(settings, privateKeyPem);
  const { deliveryDate, ...invoice } = document;
  const generatedXml = isCreditNoteData(invoice)
    ? generateCreditNoteXml(invoice)
    : generateInvoiceXml(invoice);
  let compatibleXml = ensureRequiredCustomerParty(generatedXml);
  const zeroSubtotal = invoice.taxSubtotals?.find((subtotal) => subtotal.taxCategoryId === 'Z');
  if (zeroSubtotal) {
    compatibleXml = injectZeroRateReason(
      compatibleXml,
      zeroSubtotal.taxExemptionReasonCode,
      zeroSubtotal.taxExemptionReason
    );
  }
  const xml = injectDeliveryDate(
    compatibleXml,
    deliveryDate
  );
  const timestamp = `${invoice.issueDate}T${invoice.issueTime.replace(/Z$/, '')}`;
  // qrData makes signInvoice embed the phase-2 QR inside the XML (KSA-14)
  const { signedXml, invoiceHash, qrCodeBase64 } = await runCryptoAction('signingArtifacts', {
    signParams: {
      xml,
      privateKeyPem,
      certificatePem,
      qrData: {
        sellerName: invoice.supplier.nameAr,
        vatNumber: invoice.supplier.vatNumber,
        timestamp,
        totalWithVat: invoice.payableAmount.toFixed(2),
        vatTotal: invoice.taxAmount.toFixed(2),
      },
    },
    qrParams: {
      sellerName: invoice.supplier.nameAr,
      vatNumber: invoice.supplier.vatNumber,
      timestamp,
      totalWithVat: invoice.payableAmount.toFixed(2),
      vatTotal: invoice.taxAmount.toFixed(2),
    },
  });
  // يُحفظ المستند الموقّع قبل النداء الشبكي: لو وصل الطلب للهيئة وضاع الرد
  // (انقطاع/إعادة تشغيل) تعاد المحاولة بنفس الـ XML حرفيًا بدل إعادة التوقيع
  // بعدّاد ICV جديد — وإلا انكسرت سلسلة الفواتير لدى الهيئة.
  await db.updateZatcaSubmission(submission.id, {
    status: 'sent_unconfirmed',
    invoice_hash: invoiceHash,
    qr_code: qrCodeBase64,
    signed_xml: signedXml,
  });
  let zatcaResult;
  try {
    zatcaResult = await transmit(settings, submission, { invoiceHash, uuid: invoice.uuid, signedXml });
  } catch (error) {
    // الطلب ربما وصل الهيئة رغم فشل استلام الرد — يمنع إعادة التوقيع لاحقًا
    error.sentToZatca = true;
    throw error;
  }
  return { success: zatcaResult.success, signedXml, invoiceHash, qrCodeBase64, zatcaResult };
}

async function transmit(settings, submission, { invoiceHash, uuid, signedXml }) {
  const creds = credentials(settings);
  const client = new ZatcaApiClient(apiConfig(settings));
  const request = { invoiceHash, uuid, invoice: Buffer.from(signedXml).toString('base64') };
  return submission.submission_type === 'CLEARANCE'
    ? await client.submitForClearance(creds, request)
    : await client.submitForReporting(creds, request);
}

// إعادة إرسال مستند سبق توقيعه وإرساله دون تأكيد الرد — بنفس الحمولة المخزنة تمامًا
async function resubmitUnconfirmed(settings, submission) {
  const zatcaResult = await transmit(settings, submission, {
    invoiceHash: submission.invoice_hash,
    uuid: submission.uuid,
    signedXml: submission.signed_xml,
  });
  return {
    success: zatcaResult.success,
    signedXml: submission.signed_xml,
    invoiceHash: submission.invoice_hash,
    qrCodeBase64: submission.qr_code,
    zatcaResult,
  };
}

// The raw ZATCA response (pretty JSON, XML payloads stripped) — this is what
// the response modal in the invoices screen displays.
function rawResponseText(response, invoiceHash) {
  const { clearedInvoice: _clearedInvoice, ...meta } = response || {};
  if (invoiceHash) meta.invoiceHash = invoiceHash;
  return JSON.stringify(meta, null, 2);
}

function failureResponseText(error) {
  if (error?.details) return rawResponseText(error.details);
  return JSON.stringify({ status: 'ERROR', message: error.message }, null, 2);
}

async function updateDisplayedStatus(saleId, statusFields) {
  await db.updateSaleZatcaStatus(saleId, statusFields);
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('sales:changed', { action: 'zatca_status_changed', sale_id: saleId });
    }
  }
}

async function storeFailure(submission, error, saleId, wasSent) {
  const attempts = Number(submission.attempts || 0) + 1;
  const canRetry = retryable(error);
  await db.updateZatcaSubmission(submission.id, {
    // فشل شبكي بعد الإرسال دون رد: تبقى الحالة sent_unconfirmed حتى تُعاد
    // المحاولة بنفس الـ XML الموقّع ولا يُعاد التوقيع بعدّاد جديد.
    status: canRetry ? (wasSent ? 'sent_unconfirmed' : 'retry_wait') : 'manual_review',
    attempts,
    next_attempt_at: canRetry ? retryDate(attempts) : null,
    errors_json: JSON.stringify([{ code: error.code || 'SUBMISSION_FAILED', message: error.message }]),
  });
  if (canRetry) return;
  // لا تُمس zatca_hash / zatca_qr هنا: رمز QR المخزن عند إنشاء الفاتورة
  // يبقى صالحًا لإعادة الطباعة حتى لو رُفض الإرسال.
  await updateDisplayedStatus(saleId, {
    uuid: submission.uuid,
    status: 'rejected',
    rejectionReason: error.message,
    response: failureResponseText(error),
  });
}

async function trackAutomaticFailure(saleId, submitDocument) {
  try {
    return await submitDocument();
  } catch (error) {
    if (!error.zatcaStatusStored && !retryable(error)) {
      await updateDisplayedStatus(saleId, {
        status: 'rejected',
        rejectionReason: error.message,
        response: failureResponseText(error),
      });
    }
    throw error;
  }
}

async function storeSuccess(submission, submitted, saleId) {
  const response = submitted.zatcaResult.response || {};
  const validation = response.validationResults || {};
  const hasWarnings = (response.warnings?.length || 0) + (validation.warningMessages?.length || 0) > 0;
  const status = hasWarnings ? 'accepted_with_warnings' : (submission.submission_type === 'CLEARANCE' ? 'cleared' : 'reported');
  const { clearedInvoice: _clearedInvoice, ...responseMeta } = response;
  await db.acceptZatcaSubmission(submission.id, {
    invoiceHash: submitted.invoiceHash,
    qrCode: submitted.qrCodeBase64,
    signedXml: submitted.signedXml,
    clearedXml: response.clearedInvoice || null,
    status,
    attempts: Number(submission.attempts || 0) + 1,
    httpStatus: submitted.zatcaResult.httpStatus,
    warningsJson: JSON.stringify(validation.warningMessages || response.warnings || []),
    responseJson: JSON.stringify(responseMeta),
  });
  const zatcaStatus = status === 'accepted_with_warnings' ? 'accepted' : 'submitted';
  await updateDisplayedStatus(saleId, {
    uuid: submission.uuid,
    hash: submitted.invoiceHash,
    qr: submitted.qrCodeBase64,
    status: zatcaStatus,
    rejectionReason: null,
    response: rawResponseText(response, submitted.invoiceHash),
  });
  return { success: true, status, hash: submitted.invoiceHash, qr: submitted.qrCodeBase64 };
}

// مزامنة صف الفاتورة مع سجل إرسال مقبول سابقًا — يغطي انقطاعًا حدث بعد قبول
// الهيئة وقبل تحديث الفاتورة، حتى لا تبقى حالتها «قيد الانتظار» رغم القبول.
async function syncAcceptedDocument(submission, saleId) {
  let response = submission.response_json || null;
  try { response = rawResponseText(JSON.parse(submission.response_json), submission.invoice_hash); } catch (_) {}
  await updateDisplayedStatus(saleId, {
    uuid: submission.uuid,
    hash: submission.invoice_hash,
    qr: submission.qr_code,
    status: submission.status === 'accepted_with_warnings' ? 'accepted' : 'submitted',
    rejectionReason: null,
    response,
  });
  return { success: true, status: submission.status, hash: submission.invoice_hash, qr: submission.qr_code };
}

async function submitSaleDocument(saleId) {
  const settings = await db.getZatcaDirectSettings();
  credentials(settings);
  const saleData = await db.getSaleForZatca(saleId);
  if (!saleData?.sale) throw new Error('الفاتورة غير موجودة');
  if (saleData.sale.doc_type === 'credit_note') return submitCreditNoteDocument(saleId);
  const appSettings = await getAppSettings();
  const kind = classifyInvoice(saleData.sale);
  const submission = await db.reserveZatcaSubmission('sale', saleId, kind, saleData.sale.zatca_uuid || crypto.randomUUID());
  if (ACCEPTED_STATUSES.has(submission.status)) {
    return syncAcceptedDocument(submission, saleId);
  }
  const unconfirmed = submission.status === 'sent_unconfirmed' && submission.signed_xml;
  try {
    const submitted = unconfirmed
      ? await resubmitUnconfirmed(settings, submission)
      : await submitMappedDocument(mapSale(saleData, settings, submission, appSettings), settings, submission);
    if (!submitted.success) {
      const error = new Error(submitted.zatcaResult.error?.message || 'رفضت الهيئة الفاتورة');
      error.details = submitted.zatcaResult.response || submitted.zatcaResult.error?.details || null;
      throw error;
    }
    return storeSuccess(submission, submitted, saleId);
  } catch (error) {
    await storeFailure(submission, error, saleId, Boolean(unconfirmed || error.sentToZatca));
    error.zatcaStatusStored = true;
    throw error;
  }
}

async function submitCreditNoteDocument(saleId) {
  const settings = await db.getZatcaDirectSettings();
  credentials(settings);
  const noteData = await db.getSaleForZatca(saleId);
  if (!noteData?.sale || noteData.sale.doc_type !== 'credit_note') throw new Error('الإشعار الدائن غير موجود');
  const originalData = noteData.sale.ref_base_sale_id
    ? await db.getSaleForZatca(noteData.sale.ref_base_sale_id)
    : null;
  if (!originalData?.sale?.zatca_uuid) throw new Error('يجب إرسال الفاتورة الأصلية قبل الإشعار الدائن');
  // الإشعار يرث تصنيف عميله من الفاتورة الأصلية إن لم تكن لقطته مكتملة
  if (!String(noteData.sale.customer_vat || '').trim()) {
    noteData.sale.customer_vat = originalData.sale.customer_vat;
    noteData.sale.customer_name = noteData.sale.customer_name || originalData.sale.customer_name;
  }
  if (!noteData.customer && originalData.customer) noteData.customer = originalData.customer;
  const appSettings = await getAppSettings();
  const kind = classifyInvoice(originalData.sale);
  const submission = await db.reserveZatcaSubmission('credit_note', saleId, kind, noteData.sale.zatca_uuid || crypto.randomUUID());
  if (ACCEPTED_STATUSES.has(submission.status)) {
    return syncAcceptedDocument(submission, saleId);
  }
  const unconfirmed = submission.status === 'sent_unconfirmed' && submission.signed_xml;
  try {
    const submitted = unconfirmed
      ? await resubmitUnconfirmed(settings, submission)
      : await submitMappedDocument(mapCreditNote(noteData, originalData.sale, settings, submission, appSettings), settings, submission);
    if (!submitted.success) {
      const error = new Error(submitted.zatcaResult.error?.message || 'رفضت الهيئة الإشعار الدائن');
      error.details = submitted.zatcaResult.response || submitted.zatcaResult.error?.details || null;
      throw error;
    }
    return storeSuccess(submission, submitted, saleId);
  } catch (error) {
    await storeFailure(submission, error, saleId, Boolean(unconfirmed || error.sentToZatca));
    error.zatcaStatusStored = true;
    throw error;
  }
}

function submitSale(saleId) {
  return trackAutomaticFailure(saleId, () => submitSaleDocument(saleId));
}

function submitCreditNote(saleId) {
  return trackAutomaticFailure(saleId, () => submitCreditNoteDocument(saleId));
}

module.exports = { retryable, submitCreditNote, submitSale };
