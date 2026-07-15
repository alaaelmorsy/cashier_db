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

module.exports = { ensureRequiredCustomerParty };
