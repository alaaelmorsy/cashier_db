'use strict';

const { mapSale, mapCreditNote } = require('../../src/main/zatca/mapper');

const settings = {
  environment: 'simulation',
  company_name: 'مؤسسة الاختبار',
  vat_number: '300123456700003',
  commercial_registration: '1010101010',
  street: 'العليا', building: '7235', district: 'العليا', city: 'الرياض', postal_code: '12244',
};
const submission = { uuid: 'uuid-1', icv: 5, previous_invoice_hash: 'PIH==' };
const appExclusive = { vat_percent: 15, prices_include_vat: 0 };
const appInclusive = { vat_percent: 15, prices_include_vat: 1 };

function sale(over = {}) {
  return {
    id: 10, invoice_no: 'INV-10', doc_type: 'invoice', customer_vat: null, customer_name: null,
    sub_total: 100, vat_total: 15, grand_total: 115, extra_value: 0, tobacco_fee: 0,
    created_at: '2026-07-14T10:00:00', ...over,
  };
}
const item = (over = {}) => ({ name: 'صنف', price: 100, qty: 1, is_vat_exempt: 0, ...over });

describe('zatca mapper — فواتير الكاشير', () => {
  test('فاتورة مبسطة (أسعار غير شاملة): المجاميع صحيحة', () => {
    const doc = mapSale({ sale: sale(), items: [item()], customer: null }, settings, submission, appExclusive);
    expect(doc.invoiceTypeCode).toBe('388');
    expect(doc.invoiceTypeCodeName).toBe('0200000');
    expect(doc.taxExclusiveAmount).toBe(100);
    expect(doc.taxAmount).toBe(15);
    expect(doc.payableAmount).toBe(115);
    expect(doc.invoiceCounter).toBe(5);
    expect(doc.previousInvoiceHash).toBe('PIH==');
    expect(doc.customer).toBeUndefined();
    expect(doc.deliveryDate).toBeUndefined();
  });

  test('أسعار شاملة الضريبة: يستخرج الأساس قبل الضريبة', () => {
    const doc = mapSale(
      { sale: sale({ sub_total: 100, vat_total: 15, grand_total: 115 }), items: [item({ price: 115 })], customer: null },
      settings, submission, appInclusive
    );
    expect(doc.taxExclusiveAmount).toBe(100);
    expect(doc.payableAmount).toBe(115);
  });

  test('فاتورة قديمة غير شاملة لا تتأثر بتغيير الإعداد الحالي إلى أسعار شاملة', () => {
    const doc = mapSale({
      sale: sale({ sub_total: 21.79, vat_total: 3.27, grand_total: 25.06 }),
      items: [
        item({ price: 1.31, qty: 4 }),
        item({ price: 12.2, qty: 1 }),
        item({ price: 4.35, qty: 1 }),
      ],
      customer: null,
    }, settings, submission, appInclusive);

    expect(doc.taxExclusiveAmount).toBe(21.79);
    expect(doc.taxAmount).toBe(3.27);
    expect(doc.payableAmount).toBe(25.06);
  });

  test('الخصم يوزع على البنود ليطابق الإجمالي المحفوظ (كوبونات/عروض مشمولة)', () => {
    // بندان 60+40، خصم كلي 10 → صافي 90، ضريبة 13.5، إجمالي 103.5
    const doc = mapSale(
      { sale: sale({ vat_total: 13.5, grand_total: 103.5 }), items: [item({ price: 60 }), item({ price: 40 })], customer: null },
      settings, submission, appExclusive
    );
    expect(doc.taxExclusiveAmount).toBeCloseTo(90, 2);
    expect(doc.payableAmount).toBeCloseTo(103.5, 2);
  });

  test('فاتورة قديمة بخصم بعد الضريبة تحافظ على المدفوع وتعيد حساب ضريبة ZATCA', () => {
    const doc = mapSale({
      sale: sale({
        sub_total: 16,
        total_after_discount: 13.6,
        discount_type: 'percentage',
        discount_value: 15,
        discount_amount: 2.4,
        vat_total: 2.4,
        grand_total: 16,
      }),
      items: [item({ price: 8, qty: 2 })],
      customer: null,
    }, settings, submission, appExclusive);

    expect(doc.taxExclusiveAmount).toBe(13.91);
    expect(doc.taxAmount).toBe(2.09);
    expect(doc.payableAmount).toBe(16);
  });

  test('لا يعاد توزيع ضريبة فاتورة قديمة غير متسقة في بيئة الإنتاج', () => {
    expect(() => mapSale({
      sale: sale({
        sub_total: 16, total_after_discount: 13.6, discount_type: 'percentage',
        discount_value: 15, discount_amount: 2.4, vat_total: 2.4, grand_total: 16,
      }),
      items: [item({ price: 8, qty: 2 })],
      customer: null,
    }, { ...settings, environment: 'production' }, submission, appExclusive)).toThrow(/لا يطابق إجمالي الفاتورة/);
  });

  test('extra_value يظهر كبند مستقل "رسوم إضافية"', () => {
    const doc = mapSale(
      { sale: sale({ extra_value: 20, vat_total: 18, grand_total: 138 }), items: [item()], customer: null },
      settings, submission, appExclusive
    );
    expect(doc.invoiceLines).toHaveLength(2);
    expect(doc.invoiceLines[1].itemName).toBe('رسوم إضافية');
    expect(doc.payableAmount).toBeCloseTo(138, 2);
  });

  test('إجمالي غير مطابق يرمي خطأ عربيًا (شبكة الأمان)', () => {
    // بند 100، صافي محفوظ 95 (خصم 5) لكن الإجمالي المحفوظ 110 ≠ المحسوب 109.25
    expect(() => mapSale(
      { sale: sale({ vat_total: 15, grand_total: 110 }), items: [item()], customer: null },
      settings, submission, appExclusive
    )).toThrow(/لا يطابق إجمالي الفاتورة/);
    // بنود أقل من صافي الفاتورة (خصم سالب) ترفض أيضًا
    expect(() => mapSale(
      { sale: sale({ grand_total: 999 }), items: [item()], customer: null },
      settings, submission, appExclusive
    )).toThrow(/أقل من صافي الفاتورة/);
  });

  test('مستند بلا بنود يرفض (BR-16)', () => {
    expect(() => mapSale({ sale: sale(), items: [], customer: null }, settings, submission, appExclusive))
      .toThrow(/بدون بنود/);
  });

  test('ضريبة 0% ترفض', () => {
    expect(() => mapSale({ sale: sale(), items: [item()], customer: null }, settings, submission, { vat_percent: 0, prices_include_vat: 0 }))
      .toThrow(/0%/);
  });

  test('صنف معفى من الضريبة يرفض برسالة واضحة', () => {
    expect(() => mapSale({ sale: sale(), items: [item({ is_vat_exempt: 1 })], customer: null }, settings, submission, appExclusive))
      .toThrow(/معفاة/);
  });

  test('عميل شركة بعنوان مكتمل → فاتورة ضريبية (standard/clearance)', () => {
    const customer = { zatca_street: 'شارع', zatca_building: '1234', zatca_district: 'حي', zatca_city: 'الرياض', postal_code: '12244' };
    const doc = mapSale(
      { sale: sale({ customer_vat: '311111111100003', customer_name: 'شركة' }), items: [item()], customer },
      settings, submission, appExclusive
    );
    expect(doc.invoiceTypeCodeName).toBe('0100000');
    expect(doc.customer.vatNumber).toBe('311111111100003');
    expect(doc.deliveryDate).toBe('2026-07-14'); // KSA-5
  });

  test('عميل شركة بعنوان ناقص يرفض قبل الإرسال', () => {
    const customer = { zatca_street: 'شارع', zatca_building: '', zatca_district: 'حي', zatca_city: 'الرياض', postal_code: '12244' };
    expect(() => mapSale(
      { sale: sale({ customer_vat: '311111111100003' }), items: [item()], customer },
      settings, submission, appExclusive
    )).toThrow(/العنوان النظامي/);
  });

  test('sandbox يستبدل الرقم الضريبي برقم الهيئة التجريبي', () => {
    const doc = mapSale({ sale: sale(), items: [item()], customer: null }, { ...settings, environment: 'sandbox' }, submission, appExclusive);
    expect(doc.supplier.vatNumber).toBe('399999999900003');
  });

  test('إشعار دائن يرتبط بفاتورته الأصلية (381)', () => {
    const original = sale({ invoice_no: 'INV-9', zatca_uuid: 'orig-uuid', created_at: '2026-07-01T09:00:00' });
    const note = sale({
      doc_type: 'credit_note', invoice_no: 'CN-1', notes: 'مرتجع',
      sub_total: -100, vat_total: -15, grand_total: -115,
    });
    const doc = mapCreditNote({
      sale: note,
      items: [item({ price: -100, qty: -1 })],
      customer: null,
    }, original, settings, submission, appExclusive);
    expect(doc.invoiceTypeCode).toBe('381');
    expect(doc.originalInvoiceNumber).toBe('INV-9');
    expect(doc.originalInvoiceUuid).toBe('orig-uuid');
    expect(doc.originalInvoiceDate).toBe('2026-07-01');
    expect(doc.reason).toBe('مرتجع');
    expect(doc.invoiceLines[0]).toMatchObject({
      quantity: 1,
      priceAmount: 100,
      lineExtensionAmount: 100,
      taxAmount: 15,
    });
    expect(doc).toMatchObject({
      taxExclusiveAmount: 100,
      taxAmount: 15,
      payableAmount: 115,
    });
  });

  test('إرسال إشعار دائن عبر mapSale يرفض', () => {
    expect(() => mapSale({ sale: sale({ doc_type: 'credit_note' }), items: [item()], customer: null }, settings, submission, appExclusive))
      .toThrow(/الإشعار الدائن/);
  });
});
