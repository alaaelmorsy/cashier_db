const fs = require('fs');
const path = require('path');
const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

describe('financial report completeness', () => {
  test.each(['all_invoices.js', 'customer_invoices.js', 'purchase_invoices_report.js'])(
    '%s does not calculate or export only the first 100 rows',
    (file) => expect(read(`src/renderer/reports/${file}`)).toMatch(/const PAGE_SIZE = 50000/)
  );

  test('statement reports contain no fixed 15% voucher split or invented mixed split', () => {
    const source = read('src/renderer/reports/customer_statement.js') + read('src/renderer/reports/supplier_statement.js');
    expect(source).not.toMatch(/\/\s*1\.15/);
    expect(source).not.toMatch(/grand\s*\/\s*2/);
  });

  test('every financial report loads its tested shared accounting engine', () => {
    const mappings = {
      'all_invoices.html': 'report-accounting.js', 'daily.html': 'report-accounting.js', 'period.html': 'report-accounting.js',
      'customer_invoices.html': 'report-accounting.js', 'unpaid_invoices.html': 'report-accounting.js',
      'customer_statement.html': 'statement-accounting.js', 'supplier_statement.html': 'statement-accounting.js',
      'purchases.html': 'report-accounting.js', 'purchase_invoices_report.html': 'purchase-report-accounting.js',
      'zatca_report.html': 'purchase-report-accounting.js', 'employee_report.html': 'employee-report-accounting.js',
      'types.html': 'report-accounting.js', 'municipality.html': 'report-accounting.js',
    };
    for (const [html, engine] of Object.entries(mappings)) expect(read(`src/renderer/reports/${html}`)).toContain(engine);
  });

  test.each(['daily.js', 'period.js'])(
    '%s prevents an older asynchronous load from overwriting newer report totals',
    (file) => {
      const source = read(`src/renderer/reports/${file}`);
      expect(source).toMatch(/let reportLoadSequence = 0/);
      expect(source).toMatch(/const loadSequence = \+\+reportLoadSequence/);
      expect(source).toMatch(/if\s*\(loadSequence !== reportLoadSequence\)\s*return/);
    }
  );

  test.each([
    ['all_invoices.js', 'ReportAccounting.documentAmounts'],
    ['customer_invoices.js', 'ReportAccounting.documentAmounts'],
    ['customer_statement.js', 'StatementAccounting.documentAmounts'],
    ['supplier_statement.js', 'StatementAccounting.documentAmounts'],
    ['purchase_invoices_report.js', 'PurchaseReportAccounting.purchaseAmounts'],
    ['zatca_report.js', 'ReportAccounting.documentAmounts'],
    ['zatca_report.js', 'PurchaseReportAccounting.purchaseAmounts'],
    ['credit_invoices.js', 'ReportAccounting.documentAmounts'],
    ['municipality.js', 'ReportAccounting.documentBreakdown'],
    ['purchases.js', 'ReportAccounting.calculateReportTotals({ purchases: [p] })'],
  ])('%s renders row amounts through the legal-total accounting helper', (file, helper) => {
    expect(read(`src/renderer/reports/${file}`)).toContain(helper);
  });
});

describe('purchase invoice screen accounting integration', () => {
  test('quick-print does not subtract the stored general discount twice', () => {
    const source = read('src/renderer/purchase_invoices/renderer.js');
    expect(source).toContain('const netExclusive = subExclusive;');
    expect(source).not.toContain('const netExclusive = (subExclusive - discExclusive);');
  });

  test('period excludes credit invoices from accounting but shows them in payment methods', () => {
    const source = read('src/renderer/reports/period.js');
    expect(source).toContain("date_basis: 'document'");
    expect(source).toContain('ReportAccounting.selectNonCreditPeriodDocuments(allSales)');
    expect(source).toContain('sales: reportSales, creditNotes: reportCreditNotes');
    expect(source).toContain('ReportAccounting.summarizeDocuments(allSales).paymentTotals');
    expect(source).toContain("collectedTotal: 'إجمالي المحصل'");
  });

  test('backend protects paid and returned purchase invoices during edits and deletes', () => {
    const source = read('src/main/purchase_invoices.js');
    expect(source).toContain('calculateEditedSettlement');
    expect(source).toContain('const oldSupplierDue = supplierDue(old)');
    expect(source).toContain('const invoiceSupplierDue = supplierDue(inv)');
    expect(source).toContain('ref_base_purchase_id=? AND doc_type=?');
    expect(source).toContain('لا يمكن تغيير المورد أو طريقة الدفع بعد تسجيل سداد');
    expect(source).toContain('لا يمكن حذف فاتورة شراء تم تسجيل سداد عليها');
  });
});
