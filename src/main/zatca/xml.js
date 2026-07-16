'use strict';

const CUSTOMER_PARTY_OPEN = '<cac:AccountingCustomerParty>';
const SUPPLIER_PARTY_CLOSE = '</cac:AccountingSupplierParty>';

function ensureRequiredCustomerParty(xml) {
  if (xml.includes(CUSTOMER_PARTY_OPEN)) return xml;
  if (!xml.includes(SUPPLIER_PARTY_CLOSE)) {
    throw new Error('تعذر استكمال XML: عنصر المورد غير موجود');
  }
  const emptyCustomerParty = '  <cac:AccountingCustomerParty>\n  </cac:AccountingCustomerParty>';
  return xml.replace(SUPPLIER_PARTY_CLOSE, `${SUPPLIER_PARTY_CLOSE}\n${emptyCustomerParty}`);
}

function escapeXml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function injectIntoZeroSubtotal(subtotal, reasonCode, reason) {
  if (!subtotal.includes('<cbc:ID>Z</cbc:ID>')) return subtotal;
  if (subtotal.includes('<cbc:TaxExemptionReasonCode>')) return subtotal;
  const taxScheme = '<cac:TaxScheme>';
  if (!subtotal.includes(taxScheme)) {
    throw new Error('تعذر إدراج سبب النسبة الصفرية: TaxScheme غير موجود في فئة Z');
  }
  const metadata = [
    `<cbc:TaxExemptionReasonCode>${escapeXml(reasonCode)}</cbc:TaxExemptionReasonCode>`,
    `<cbc:TaxExemptionReason>${escapeXml(reason)}</cbc:TaxExemptionReason>`,
  ].join('');
  return subtotal.replace(taxScheme, `${metadata}${taxScheme}`);
}

function injectZeroRateReason(xml, reasonCode, reason) {
  if (!String(reasonCode || '').trim() || !String(reason || '').trim()) {
    throw new Error('تعذر إدراج سبب النسبة الصفرية: الرمز والنص مطلوبان');
  }
  let foundZeroSubtotal = false;
  const updated = xml.replace(/<cac:TaxSubtotal>[\s\S]*?<\/cac:TaxSubtotal>/g, (subtotal) => {
    if (!subtotal.includes('<cbc:ID>Z</cbc:ID>')) return subtotal;
    foundZeroSubtotal = true;
    return injectIntoZeroSubtotal(subtotal, reasonCode, reason);
  });
  if (!foundZeroSubtotal) throw new Error('تعذر إدراج سبب النسبة الصفرية: فئة Z غير موجودة');
  return updated;
}

module.exports = { ensureRequiredCustomerParty, injectZeroRateReason };
