'use strict';

// قنوات IPC للربط المباشر مع ZATCA — العقد في specs/002-zatca-direct-integration/contracts/ipc-api.md
// كل الردود { success, message? } بالعربية، والأسرار لا تعبر IPC إطلاقًا.

const { ipcMain } = require('electron');
const { isSecondaryDevice } = require('../api-client');
const db = require('./db');
const onboarding = require('./onboarding');
const router = require('./router');

let registered = false;

function fail(message) {
  return { success: false, message };
}

function guardSecondary() {
  if (isSecondaryDevice()) {
    throw new Error('إدارة الربط الإلكتروني متاحة على الجهاز الرئيسي فقط');
  }
}

async function guardDirectMode() {
  const mode = await router.getMode();
  if (mode === 'legacy') {
    throw new Error('الجهاز يعمل بالوضع القديم (الوسيط المحلي) — استخدم شاشة الربط المباشر للانتقال أولًا');
  }
  if (mode !== 'direct') {
    throw new Error('الربط المباشر غير مكتمل — أكمل خطوات التهيئة أولًا');
  }
}

function handle(channel, worker) {
  ipcMain.handle(channel, async (_event, payload) => {
    try {
      return await worker(payload || {});
    } catch (error) {
      console.error(`[${channel}]`, error && error.message);
      return fail(error && error.message ? error.message : 'حدث خطأ غير متوقع');
    }
  });
}

function registerZatcaDirectIPC() {
  if (registered) return;
  registered = true;

  handle('zatca-direct:get-status', async () => {
    const status = await onboarding.onboardingStatus();
    const mode = await router.getMode();
    const counts = await db.getZatcaDocumentCounts();
    return { success: true, mode, ...status, counts };
  });

  handle('zatca-direct:get-settings', async () => {
    guardSecondary();
    const settings = await db.getZatcaSettings();
    // تعبئة افتراضية من إعدادات المنشأة الحالية عند أول استخدام
    if (settings && !settings.companyName) {
      try {
        const { dbAdapter } = require('../../db/db-adapter');
        const conn = await dbAdapter.getConnection();
        try {
          const [[app]] = await conn.query(
            'SELECT seller_legal_name, seller_vat_number, commercial_register FROM app_settings WHERE id = 1'
          );
          if (app) {
            settings.companyName = settings.companyName || app.seller_legal_name || '';
            settings.vatNumber = settings.vatNumber || app.seller_vat_number || '';
            settings.commercialRegistration = settings.commercialRegistration || app.commercial_register || '';
          }
        } finally { conn.release(); }
      } catch (_) {}
    }
    return { success: true, settings };
  });

  handle('zatca-direct:save-settings', async (payload) => {
    guardSecondary();
    await db.saveZatcaSettings(payload);
    return { success: true };
  });

  handle('zatca-direct:generate-csr', async (payload) => {
    guardSecondary();
    const result = await onboarding.generateOnboardingCsr(payload);
    return { success: true, ...result };
  });

  handle('zatca-direct:request-compliance-csid', async (payload) => {
    guardSecondary();
    const result = await onboarding.requestComplianceCsid(payload.otp);
    return { success: true, ...result };
  });

  handle('zatca-direct:run-compliance-checks', async () => {
    guardSecondary();
    const checks = await onboarding.runComplianceChecks();
    return { success: true, checks };
  });

  handle('zatca-direct:request-production-csid', async () => {
    guardSecondary();
    const result = await onboarding.requestProductionCsid();
    return { success: true, ...result };
  });

  // التبديل اليدوي بين الوضعين من شاشة الربط الإلكتروني (قرار مستخدم صريح):
  //  - 'legacy': يعيد الجهاز للوسيط المحلي (ويفعّل zatca_enabled حتى يعمل المسار القديم).
  //  - 'direct': يعيد تفعيل الربط المباشر — فقط إذا كانت شهادة الإنتاج قائمة؛
  //    وإلا فالطريق الوحيد هو إكمال خطوات الربط (FR-003).
  handle('zatca-direct:set-mode', async (payload) => {
    guardSecondary();
    const target = String(payload.mode || '');
    if (target === 'direct') {
      const settings = await db.getZatcaDirectSettings();
      if (settings.onboarding_status !== 'production_ready') {
        throw new Error('لا يمكن التحويل إلى الربط المباشر قبل إكمال خطوات الربط حتى شهادة الإنتاج');
      }
      await db.saveZatcaOnboardingState({ integration_mode: 'direct' });
    } else if (target === 'legacy') {
      await db.saveZatcaOnboardingState({ integration_mode: 'legacy' });
      const { dbAdapter } = require('../../db/db-adapter');
      const conn = await dbAdapter.getConnection();
      try {
        await conn.query('UPDATE app_settings SET zatca_enabled = 1 WHERE id = 1');
      } finally { conn.release(); }
    } else {
      throw new Error('وضع غير معروف — المسموح: legacy أو direct');
    }
    return { success: true, mode: await router.getMode() };
  });

  handle('zatca-direct:submit-sale', async (payload) => {
    guardSecondary();
    await guardDirectMode();
    const queue = require('./queue');
    const result = await queue.submitSale(Number(payload.saleId));
    return { success: true, ...result };
  });

  handle('zatca-direct:submit-credit-note', async (payload) => {
    guardSecondary();
    await guardDirectMode();
    const queue = require('./queue');
    const result = await queue.submitCreditNote(Number(payload.saleId));
    return { success: true, ...result };
  });

  handle('zatca-direct:retry-unsent', async (payload) => {
    guardSecondary();
    await guardDirectMode();
    const { outcomes } = await router.retryUnsent(Number(payload.limit) || 500);
    return { success: true, outcomes };
  });

  handle('zatca-direct:get-document-status', async (payload) => {
    const documentType = payload.documentType === 'credit_note' ? 'credit_note' : 'sale';
    const submission = await db.getZatcaSubmission(documentType, Number(payload.documentId));
    if (!submission) return fail('لا يوجد سجل إرسال لهذا المستند');
    // بلا XML كامل افتراضيًا (العقد)
    const { signed_xml: _s, cleared_xml: _c, ...summary } = submission;
    return { success: true, submission: summary };
  });

  handle('zatca-direct:download-xml', async (payload) => {
    guardSecondary();
    const documentType = payload.documentType === 'credit_note' ? 'credit_note' : 'sale';
    const submission = await db.getZatcaSubmission(documentType, Number(payload.documentId));
    if (!submission || !(submission.cleared_xml || submission.signed_xml)) {
      return fail('لا يوجد XML موقّع لهذا المستند');
    }
    return {
      success: true,
      fileName: `zatca-${documentType}-${payload.documentId}.xml`,
      xml: submission.cleared_xml || submission.signed_xml,
    };
  });
}

module.exports = { registerZatcaDirectIPC };
