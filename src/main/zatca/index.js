'use strict';

const {
  DEFAULT_COMPLIANCE_PREVIOUS_INVOICE_HASH,
  generatePhase1QRCodeData,
} = require('@talha7k/zatca');

// The developer portal only accepts ZATCA's sample VAT number; the merchant's
// real VAT stays stored for simulation/production.
const SANDBOX_SAMPLE_VAT = '399999999900003';

function effectiveVatNumber(settings) {
  return settings.environment === 'sandbox' ? SANDBOX_SAMPLE_VAT : settings.vat_number;
}

// في الكاشير: فاتورة ضريبية (standard) لكل مستند لعميل له رقم ضريبي مسجَّل
// في لقطة الفاتورة (sales.customer_vat)، وإلا فهي مبسطة (simplified).
function classifyInvoice(sale) {
  return String(sale.customer_vat || '').trim() ? 'standard' : 'simplified';
}

function initialPreviousInvoiceHash() {
  return DEFAULT_COMPLIANCE_PREVIOUS_INVOICE_HASH;
}

function buildPhaseOneQr(input) {
  return generatePhase1QRCodeData({
    sellerName: input.sellerName,
    vatNumber: input.vatNumber,
    timestamp: input.timestamp,
    totalWithVat: input.totalAmount,
    vatTotal: input.vatAmount,
  });
}

module.exports = {
  buildPhaseOneQr,
  classifyInvoice,
  effectiveVatNumber,
  initialPreviousInvoiceHash,
};
