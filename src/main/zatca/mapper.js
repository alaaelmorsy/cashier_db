'use strict';

// تحويل مستندات الكاشير (sales + sales_items) إلى مستند UBL لمكتبة ZATCA —
// منقول من mapper المغاسل بتكييف مصدر البيانات (research.md R3).

const { classifyInvoice, effectiveVatNumber } = require('./index');

// أقصى فرق مسموح بين إجمالي المستند المحفوظ والإجمالي المعاد حسابه للهيئة (فروق تقريب فقط)
const TOTAL_MISMATCH_TOLERANCE = 0.1;

function amount(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function pad(value) {
  return String(value).padStart(2, '0');
}

// التاريخ/الوقت بالتوقيت المحلي (وليس UTC) حتى يطابق تاريخ الفاتورة المطبوعة
// وفلتر send_start_date — toISOString كان يُرجِع اليوم السابق للفواتير قبل 3 صباحًا.
function issueParts(value) {
  const date = value ? new Date(value) : new Date();
  return {
    issueDate: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    issueTime: `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`,
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

// في وضع الأسعار الشاملة (app_settings.prices_include_vat) يكون سعر البند
// شاملًا للضريبة — يُستخرج الأساس قبل الضريبة.
function priceDivisor(pricesIncludeVat, taxRate) {
  return pricesIncludeVat && taxRate > 0 ? 1 + taxRate / 100 : 1;
}

function invoicePriceDivisor(sale, items, taxRate, configuredInclusive) {
  const configured = priceDivisor(configuredInclusive, taxRate);
  const storedTotal = Math.abs(Number(sale.grand_total || 0));
  const storedTax = Math.abs(Number(sale.vat_total || 0));
  const recordedDiscount = Math.abs(Number(sale.discount_amount || 0));
  const expectedBeforeDiscount = amount(storedTotal - storedTax + recordedDiscount);
  const storedSubtotal = Math.abs(Number(sale.sub_total || 0));
  if (!expectedBeforeDiscount || taxRate <= 0) return configured;
  const rawItems = items.reduce(
    (sum, item) => sum + Math.abs(Number(item.price || 0) * Number(item.qty || 1)), 0
  );
  const extras = Math.abs(Number(sale.extra_value || 0)) + Math.abs(Number(sale.tobacco_fee || 0));
  const inclusive = 1 + taxRate / 100;
  const targets = [expectedBeforeDiscount, storedSubtotal].filter((target) => target > 0);
  const difference = (candidate) => Math.min(...targets.map((target) => Math.abs(candidate - target)));
  const exclusiveDifference = difference(rawItems + extras);
  const inclusiveDifference = difference(rawItems / inclusive + extras);
  return inclusiveDifference < exclusiveDifference ? inclusive : 1;
}

function extraLine(id, itemName, value, taxRate) {
  return {
    id,
    quantity: 1,
    unitCode: 'C62',
    lineExtensionAmount: amount(value),
    taxAmount: amount(value * taxRate / 100),
    itemName,
    taxCategoryId: 'S',
    taxPercent: taxRate,
    priceAmount: amount(value),
  };
}

function invoiceLines(items, taxRate, totalDiscount, divisor, extras) {
  const netUnit = (item) => Number(item.price || 0) / divisor;
  const gross = items.reduce((sum, item) => sum + netUnit(item) * Number(item.qty || 1), 0);
  const lines = items.map((item, index) => {
    const quantity = Number(item.qty || 1);
    const lineGross = netUnit(item) * quantity;
    const lineDiscount = gross > 0 ? totalDiscount * lineGross / gross : 0;
    const lineNet = amount(lineGross - lineDiscount);
    return {
      id: index + 1,
      quantity,
      unitCode: 'C62',
      lineExtensionAmount: lineNet,
      taxAmount: amount(lineNet * taxRate / 100),
      itemName: item.name || 'صنف',
      taxCategoryId: 'S',
      taxPercent: taxRate,
      priceAmount: amount(netUnit(item)),
    };
  });
  // الرسوم الإضافية مبالغ قبل الضريبة — تُبلَّغ كبنود مستقلة حتى يطابق
  // إجمالي المستند لدى الهيئة إجمالي الفاتورة الفعلي.
  for (const [name, value] of extras) {
    if (value > 0) lines.push(extraLine(lines.length + 1, name, value, taxRate));
  }
  return lines;
}

// فاتورة ضريبية (standard): تتطلب رقمًا ضريبيًا وعنوانًا نظاميًا مكتملًا للعميل
// من أعمدة customers.zatca_* (data-model.md).
function customer(sale, customerRow) {
  if (classifyInvoice(sale) !== 'standard') return undefined;
  const row = customerRow || {};
  const address = {
    street: row.zatca_street,
    building: row.zatca_building,
    district: row.zatca_district,
    city: row.zatca_city,
    postalCode: row.postal_code,
  };
  if (Object.values(address).some((field) => !String(field || '').trim())) {
    throw new Error('العنوان النظامي لعميل الشركة غير مكتمل — أكمل حقول عنوان ZATCA في بطاقة العميل');
  }
  return {
    name: sale.customer_name || row.name,
    vatNumber: sale.customer_vat,
    address: { ...address, countryCode: 'SA' },
  };
}

function commonDocument(saleData, settings, submission, appSettings) {
  const { sale, items, customer: customerRow } = saleData;
  if (!items.length) throw new Error('لا يمكن إرسال مستند بدون بنود إلى الهيئة (BR-16)');
  const kind = classifyInvoice(sale);
  const taxRate = Number(appSettings.vat_percent || 0);
  // الفئة Z/E/O تتطلب رمز سبب إعفاء (BT-121) لا تدعمه المكتبة — والمنشأة
  // المسجلة في الهيئة ملزمة بنسبة ضريبة قياسية، فنسبة 0% تعني خطأ إعدادات.
  if (taxRate <= 0) {
    throw new Error('لا يمكن الإرسال إلى الهيئة بنسبة ضريبة 0% — راجع إعداد نسبة الضريبة');
  }
  if (items.some((item) => Number(item.is_vat_exempt) === 1)) {
    throw new Error('المستند يحوي أصنافًا معفاة من الضريبة — الأصناف المعفاة غير مدعومة في الربط المباشر');
  }
  const divisor = invoicePriceDivisor(
    sale, items, taxRate, Number(appSettings.prices_include_vat) === 1
  );
  const extra = amount(Math.abs(Number(sale.extra_value || 0)));
  const tobacco = amount(Math.abs(Number(sale.tobacco_fee || 0)));
  // الخصم الفعلي يُستنتج من المجاميع المحفوظة (يغطي الخصم اليدوي والكوبونات
  // والعروض معًا): إجمالي البنود قبل الخصم − صافي الفاتورة قبل الضريبة.
  const storedNet = amount(Math.abs(Number(sale.grand_total || 0)) - Math.abs(Number(sale.vat_total || 0)));
  const grossItems = items.reduce(
    (sum, item) => sum + (Number(item.price || 0) / divisor) * Number(item.qty || 1), 0
  );
  let totalDiscount = amount(grossItems + extra + tobacco - storedNet);
  const storedTotal = sale.grand_total == null ? null : Math.abs(Number(sale.grand_total));
  const recordedDiscount = Math.abs(Number(sale.discount_amount || 0));
  const expectedStoredTax = amount(storedNet * taxRate / 100);
  const hasLegacyPostTaxDiscount = settings.environment !== 'production'
    && recordedDiscount > 0
    && storedTotal != null
    && Math.abs(expectedStoredTax - Math.abs(Number(sale.vat_total || 0))) > TOTAL_MISMATCH_TOLERANCE;
  if (hasLegacyPostTaxDiscount) {
    const zatcaNet = amount(storedTotal / (1 + taxRate / 100));
    totalDiscount = amount(grossItems + extra + tobacco - zatcaNet);
  }
  if (totalDiscount < 0 && totalDiscount >= -TOTAL_MISMATCH_TOLERANCE) totalDiscount = 0;
  if (totalDiscount < 0) {
    throw new Error(`إجمالي بنود المستند أقل من صافي الفاتورة المحفوظ — لن يتم الإرسال (فرق ${Math.abs(totalDiscount).toFixed(2)})`);
  }
  const lines = invoiceLines(items, taxRate, totalDiscount, divisor, [
    ['رسوم إضافية', extra],
    ['رسوم التبغ', tobacco],
  ]);
  const net = amount(lines.reduce((sum, line) => sum + line.lineExtensionAmount, 0));
  const tax = amount(lines.reduce((sum, line) => sum + line.taxAmount, 0));
  const total = amount(net + tax);
  // شبكة أمان: المبلغ المُبلَّغ للهيئة يجب أن يطابق إجمالي الفاتورة المحفوظ
  if (storedTotal != null && Math.abs(total - amount(storedTotal)) > TOTAL_MISMATCH_TOLERANCE) {
    throw new Error(`إجمالي المستند المحسوب للهيئة (${total.toFixed(2)}) لا يطابق إجمالي الفاتورة (${amount(storedTotal).toFixed(2)}) — لن يتم الإرسال`);
  }
  return {
    invoiceNumber: String(sale.invoice_no || sale.id),
    uuid: submission.uuid,
    ...issueParts(sale.created_at),
    invoiceTypeCodeName: kind === 'standard' ? '0100000' : '0200000',
    // ZATCA BT-23: ProfileID is always reporting:1.0 (clearance is signaled by the type-code name)
    profileId: 'reporting:1.0',
    // KSA-5: supply date is mandatory for standard invoices
    deliveryDate: kind === 'standard' ? issueParts(sale.created_at).issueDate : undefined,
    currencyCode: 'SAR',
    invoiceCounter: Number(submission.icv),
    previousInvoiceHash: submission.previous_invoice_hash,
    supplier: supplier(settings),
    customer: customer(sale, customerRow),
    lineExtensionAmount: net,
    taxExclusiveAmount: net,
    taxInclusiveAmount: total,
    payableAmount: total,
    taxAmount: tax,
    taxSubtotals: [{ taxableAmount: net, taxAmount: tax, percent: taxRate, taxCategoryId: 'S' }],
    invoiceLines: lines,
  };
}

function mapSale(saleData, settings, submission, appSettings) {
  if (saleData.sale.doc_type === 'credit_note') {
    throw new Error('الإشعار الدائن لا يُرسل كفاتورة مبيعات — يُبلَّغ الهيئة عبر مسار الإشعارات');
  }
  return { ...commonDocument(saleData, settings, submission, appSettings), invoiceTypeCode: '388' };
}

function positiveCreditNoteData(noteData) {
  return {
    ...noteData,
    items: noteData.items.map((creditItem) => ({
      ...creditItem,
      price: Math.abs(Number(creditItem.price || 0)),
      qty: Math.abs(Number(creditItem.qty || 0)),
      line_total: Math.abs(Number(creditItem.line_total || 0)),
    })),
  };
}

function mapCreditNote(noteData, originalSale, settings, submission, appSettings) {
  const note = noteData.sale;
  if (note.doc_type !== 'credit_note') {
    throw new Error('المستند ليس إشعارًا دائنًا');
  }
  return {
    ...commonDocument(positiveCreditNoteData(noteData), settings, submission, appSettings),
    invoiceTypeCode: '381',
    originalInvoiceNumber: String(originalSale.invoice_no || originalSale.id),
    originalInvoiceUuid: originalSale.zatca_uuid,
    originalInvoiceDate: issueParts(originalSale.created_at).issueDate,
    reason: note.notes || 'إلغاء أو استرجاع الفاتورة',
  };
}

module.exports = { mapCreditNote, mapSale, TOTAL_MISMATCH_TOLERANCE };
