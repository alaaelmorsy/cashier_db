'use strict';

// تهيئة الربط المباشر مع ZATCA — منقول من برنامج المغاسل
// (server/services/zatca/onboarding.js) بتكييف مصدر البيانات فقط.

const crypto = require('crypto');
const {
  DEFAULT_COMPLIANCE_PREVIOUS_INVOICE_HASH,
  ZatcaApiClient,
  asCertificatePem,
  buildComplianceInvoiceXml,
  extractInvoiceTimestamp,
  extractXmlValue,
} = require('@talha7k/zatca');
const db = require('./db');
const { effectiveVatNumber } = require('./index');
const { encryptSecret, decryptSecret } = require('./vault');
const { runCryptoAction } = require('./crypto-runtime');

const DEVELOPER_URL = 'https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal';
const SIMULATION_URL = 'https://gw-fatoora.zatca.gov.sa/e-invoicing/simulation';
const PRODUCTION_URL = 'https://gw-fatoora.zatca.gov.sa/e-invoicing/core';
const ENVIRONMENTS = new Set(['sandbox', 'simulation', 'production']);
const COMPLIANCE_CHECKS = [
  'SIMPLIFIED_INVOICE',
  'SIMPLIFIED_CREDIT_NOTE',
  'SIMPLIFIED_DEBIT_NOTE',
  'STANDARD_INVOICE',
  'STANDARD_CREDIT_NOTE',
  'STANDARD_DEBIT_NOTE',
];

function apiClient(environment) {
  const testUrls = { sandbox: DEVELOPER_URL, simulation: SIMULATION_URL };
  return new ZatcaApiClient({
    environment,
    sandboxUrl: testUrls[environment],
    productionUrl: environment === 'production' ? PRODUCTION_URL : undefined,
    timeout: 30000,
  });
}

function csrInput(settings, egsSerialNumber) {
  return {
    organizationNameAr: settings.company_name,
    organizationNameEn: settings.company_name,
    vatNumber: effectiveVatNumber(settings),
    crNumber: settings.commercial_registration,
    country: 'SA',
    commonName: settings.branch_name || settings.company_name,
    invoiceType: '1100',
    businessCategory: settings.business_category,
    location: {
      city: settings.city,
      district: settings.district,
      street: settings.street,
      buildingNumber: settings.building,
      postalCode: settings.postal_code,
    },
    egsSerialNumber,
  };
}

function supplier(settings) {
  return {
    nameAr: settings.company_name,
    nameEn: settings.company_name,
    vatNumber: effectiveVatNumber(settings),
    crNumber: settings.commercial_registration,
    address: {
      street: settings.street,
      building: settings.building,
      district: settings.district,
      city: settings.city,
      postalCode: settings.postal_code,
      countryCode: 'SA',
    },
  };
}

function requiredSettings(settings) {
  const fields = ['company_name', 'vat_number', 'commercial_registration', 'street', 'building', 'district', 'city', 'postal_code'];
  const missing = fields.filter((field) => !String(settings[field] || '').trim());
  if (missing.length) throw new Error('بيانات المنشأة والعنوان الوطني غير مكتملة');
}

async function generateOnboardingCsr({ environment = 'sandbox', egsSerialNumber }) {
  if (!ENVIRONMENTS.has(environment)) throw new Error('بيئة ZATCA غير معروفة');
  const settings = await db.getZatcaDirectSettings();
  requiredSettings(settings);
  // ZATCA requires the EGS serial in the form 1-<solution>|2-<model>|3-<unique-id>
  const rawSerial = String(egsSerialNumber || '').trim();
  const serial = /^1-.+\|2-.+\|3-.+$/.test(rawSerial)
    ? rawSerial
    : `1-PLUSCashier|2-POS|3-${rawSerial || crypto.randomUUID()}`;
  const generated = await runCryptoAction('generateCSR', {
    params: csrInput({ ...settings, environment }, serial),
    environment,
  });
  const state = {
    environment,
    onboarding_status: 'csr_generated',
    egs_serial_number: serial,
    private_key_enc: encryptSecret(generated.privateKey),
    public_key_pem: generated.publicKey,
    csr_pem: generated.csr,
    // مفتاح جديد = الشهادات القديمة لم تعد تطابقه — تُمسح لمنع أي خلط
    compliance_token_enc: null,
    compliance_secret_enc: null,
    compliance_request_id: null,
    production_token_enc: null,
    production_secret_enc: null,
    production_certificate_pem: null,
    certificate_expires_at: null,
  };
  // تبديل البيئة (مثل simulation → production) يبدأ سلسلة فواتير جديدة:
  // يُصفَّر عدّاد ICV وسلسلة PIH حتى لا تختلط سلاسل البيئتين لدى الهيئة.
  if (settings.environment !== environment) {
    state.current_icv = 0;
    state.current_pih = null;
  }
  await db.saveZatcaOnboardingState(state);
  return { environment, egsSerialNumber: serial, csr: generated.csr };
}

async function requestComplianceCsid(otp) {
  const settings = await db.getZatcaDirectSettings();
  if (!settings.csr_pem || !settings.private_key_enc) throw new Error('يجب إنشاء CSR أولاً');
  const response = await apiClient(settings.environment).requestComplianceCSID(settings.csr_pem, String(otp || '').trim());
  if (response.status !== 'ACCEPTED') throw new Error(response.error?.message || 'رفضت الهيئة طلب شهادة الامتثال');
  await db.saveZatcaOnboardingState({
    onboarding_status: 'compliance_issued',
    compliance_token_enc: encryptSecret(response.binarySecurityToken),
    compliance_secret_enc: encryptSecret(response.secret),
    compliance_request_id: response.requestId,
  });
  return { requestId: response.requestId };
}

async function runComplianceChecks() {
  const settings = await db.getZatcaDirectSettings();
  const credentials = complianceCredentials(settings);
  const certificatePem = asCertificatePem(credentials.binarySecurityToken);
  const privateKeyPem = decryptSecret(settings.private_key_enc);
  const customer = { name: 'ZATCA Compliance Buyer', vatNumber: '300000000000003', address: supplier(settings).address };
  let certificateSignature = '';
  try {
    certificateSignature = await runCryptoAction('extractCertificateSignature', { certificatePem });
  } catch (_) {}
  const messages = [];
  for (const [index, checkType] of COMPLIANCE_CHECKS.entries()) {
    const built = buildComplianceInvoiceXml({
      checkType,
      // @talha7k/zatca 0.11.1 falls back to an undeclared `crypto` global
      // when either UUID is omitted. Supply both from Node explicitly so all
      // six compliance documents work consistently in Electron.
      uuid: crypto.randomUUID(),
      originalInvoiceUuid: crypto.randomUUID(),
      supplier: supplier(settings),
      customer,
      invoiceCounter: index + 1,
      previousInvoiceHash: DEFAULT_COMPLIANCE_PREVIOUS_INVOICE_HASH,
    });
    // ZATCA BT-23: ProfileID must always be reporting:1.0, and standard
    // documents require a supply date (KSA-5) the library does not emit.
    let xml = built.invoiceXml.replace('clearance:1.0', 'reporting:1.0');
    if (checkType.startsWith('STANDARD')) {
      const delivery = `<cac:Delivery><cbc:ActualDeliveryDate>${new Date().toISOString().slice(0, 10)}</cbc:ActualDeliveryDate></cac:Delivery>`;
      xml = xml.replace('</cac:AccountingCustomerParty>', `</cac:AccountingCustomerParty>${delivery}`);
    }
    const signed = await runCryptoAction('signInvoice', {
      xml,
      privateKeyPem,
      certificatePem,
      qrData: {
        sellerName: settings.company_name,
        vatNumber: effectiveVatNumber(settings),
        timestamp: extractInvoiceTimestamp(xml),
        totalWithVat: extractXmlValue(xml, 'TaxInclusiveAmount') || '115.00',
        vatTotal: extractXmlValue(xml, 'TaxAmount') || '15.00',
        certificateSignature,
      },
    });
    const response = await apiClient(settings.environment).verifyCompliance(
      credentials,
      signed.invoiceHash,
      built.uuid,
      Buffer.from(signed.signedXml).toString('base64')
    );
    messages.push({ checkType, valid: response.valid, messages: response.messages });
    if (!response.valid) throw new Error(`فشل اختبار الامتثال ${checkType}: ${response.messages.join(' | ')}`);
  }
  await db.saveZatcaOnboardingState({ onboarding_status: 'compliance_passed' });
  return messages;
}

function complianceCredentials(settings) {
  if (!settings.compliance_token_enc || !settings.compliance_secret_enc) throw new Error('شهادة الامتثال غير متاحة');
  return {
    binarySecurityToken: decryptSecret(settings.compliance_token_enc),
    secret: decryptSecret(settings.compliance_secret_enc),
  };
}

async function requestProductionCsid() {
  const settings = await db.getZatcaDirectSettings();
  if (settings.onboarding_status !== 'compliance_passed') throw new Error('يجب اجتياز اختبارات الامتثال أولاً');
  const response = await apiClient(settings.environment).requestProductionCSID(
    complianceCredentials(settings),
    settings.compliance_request_id
  );
  if (response.status !== 'ACCEPTED') throw new Error(response.error?.message || 'رفضت الهيئة شهادة الإنتاج');
  const certificatePem = asCertificatePem(response.binarySecurityToken);
  // Electron 28 exposes X.509 validity as strings (`validTo`). The library's
  // parser expects the newer `validToDate` property and crashes on this runtime.
  const certificate = await runCryptoAction('certificateValidity', { certificatePem });
  const expiresAt = new Date(certificate.validTo);
  await db.saveZatcaOnboardingState({
    onboarding_status: 'production_ready',
    // اكتمال شهادة الإنتاج هو نقطة التحول الوحيدة إلى الوضع المباشر —
    // قرار مستخدم صريح (أكمل كل خطوات الربط بنفسه).
    integration_mode: 'direct',
    production_token_enc: encryptSecret(response.binarySecurityToken),
    production_secret_enc: encryptSecret(response.secret),
    production_certificate_pem: certificatePem,
    certificate_expires_at: Number.isNaN(expiresAt.getTime()) ? null : expiresAt,
    last_tested_at: new Date(),
  });
  return { expiresAt: certificate.validTo };
}

const CERTIFICATE_WARNING_DAYS = 30;

async function onboardingStatus() {
  const settings = await db.getZatcaSettings();
  const expiresAt = settings.certificateExpiresAt ? new Date(settings.certificateExpiresAt) : null;
  const daysLeft = expiresAt ? Math.floor((expiresAt.getTime() - Date.now()) / 86400000) : null;
  return {
    integrationMode: settings.integrationMode,
    environment: settings.environment,
    status: settings.onboardingStatus,
    egsSerialNumber: settings.egsSerialNumber,
    certificateExpiresAt: settings.certificateExpiresAt,
    certificateExpired: daysLeft != null && daysLeft < 0,
    certificateExpiresSoon: daysLeft != null && daysLeft >= 0 && daysLeft <= CERTIFICATE_WARNING_DAYS,
    certificateDaysLeft: daysLeft,
    currentIcv: settings.currentIcv,
    lastTestedAt: settings.lastTestedAt,
  };
}

module.exports = {
  generateOnboardingCsr,
  onboardingStatus,
  requestComplianceCsid,
  requestProductionCsid,
  runComplianceChecks,
};
