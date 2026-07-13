require('dotenv').config();

const mysql = require('mysql2/promise');
const ReportAccounting = require('../src/shared/report-accounting');
const StatementAccounting = require('../src/shared/statement-accounting');
const PurchaseAccounting = require('../src/shared/purchase-report-accounting');

const FROM = process.argv[2] || '2000-01-01 00:00:00';
const TO = process.argv[3] || '2099-12-31 23:59:59';
const money = (value) => Number(Number(value || 0).toFixed(2));
const reconciles = (amounts) => money(amounts.pre + amounts.vat) === money(amounts.grand);

async function audit() {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
  });
  try {
    const [sales] = await db.query('SELECT * FROM sales WHERE created_at BETWEEN ? AND ?', [FROM, TO]);
    const [purchaseInvoices] = await db.query('SELECT * FROM purchase_invoices WHERE COALESCE(invoice_at, created_at) BETWEEN ? AND ?', [FROM, TO]);
    const [vouchers] = await db.query('SELECT * FROM vouchers WHERE created_at BETWEEN ? AND ?', [FROM, TO]);

    const salesRows = sales.map(ReportAccounting.documentAmounts);
    const purchaseRows = purchaseInvoices.map(PurchaseAccounting.purchaseAmounts);
    const salesSummary = ReportAccounting.summarizeDocuments(sales);
    const purchaseSummary = PurchaseAccounting.summarizePurchaseLedger(purchaseInvoices);

    const customerIds = [...new Set(sales.map((row) => Number(row.customer_id || 0)).filter(Boolean))];
    const customerChecks = customerIds.map((customerId) => {
      const documents = sales.filter((row) => Number(row.customer_id) === customerId);
      const receipts = vouchers.filter((row) => Number(row.entity_id) === customerId && String(row.voucher_type || '').toLowerCase() === 'receipt');
      const statement = StatementAccounting.summarizeCustomerStatement({ documents, vouchers: receipts });
      return reconciles(statement.invoices) && reconciles(statement.returns) && reconciles(statement.netDocuments)
        && reconciles(statement.deferred) && reconciles(statement.vouchers) && reconciles(statement.balance);
    });

    const supplierIds = [...new Set(purchaseInvoices.map((row) => Number(row.supplier_id || 0)).filter(Boolean))];
    const supplierChecks = supplierIds.map((supplierId) => {
      const documents = purchaseInvoices.filter((row) => Number(row.supplier_id) === supplierId);
      const payments = vouchers.filter((row) => Number(row.entity_id) === supplierId && String(row.voucher_type || '').toLowerCase() === 'payment');
      const statement = StatementAccounting.summarizeSupplierStatement({
        invoices: documents.filter((row) => String(row.doc_type || '').toLowerCase() !== 'return'),
        returns: documents.filter((row) => String(row.doc_type || '').toLowerCase() === 'return'),
        vouchers: payments,
      });
      return reconciles(statement.invoices) && reconciles(statement.returns) && reconciles(statement.net)
        && reconciles(statement.credit) && reconciles(statement.vouchers) && reconciles(statement.balance);
    });

    const checks = {
      everySalesRowReconciles: salesRows.every(reconciles),
      salesSummaryReconciles: money(salesSummary.subTotal + salesSummary.vatTotal) === salesSummary.grandTotal,
      everyPurchaseRowReconciles: purchaseRows.every(reconciles),
      purchaseSummaryReconciles: money(purchaseSummary.pre + purchaseSummary.vat) === purchaseSummary.grand,
      everyCustomerStatementReconciles: customerChecks.every(Boolean),
      everySupplierStatementReconciles: supplierChecks.every(Boolean),
    };
    const output = {
      period: { from: FROM, to: TO },
      counts: { sales: sales.length, purchaseInvoices: purchaseInvoices.length, vouchers: vouchers.length, customers: customerIds.length, suppliers: supplierIds.length },
      summaries: { sales: salesSummary, purchases: purchaseSummary },
      historicalRawMismatchesCorrectedAtReportTime: {
        sales: sales.filter((row) => money(Math.abs(Number(row.sub_total || 0)) + Math.abs(Number(row.vat_total || 0))) !== money(Math.abs(Number(row.grand_total || 0)))).length,
        purchases: purchaseInvoices.filter((row) => String(row.price_mode || '') !== 'zero_vat' && money(Math.abs(Number(row.sub_total || 0)) + Math.abs(Number(row.vat_total || 0))) !== money(Math.abs(Number(row.grand_total || 0)))).length,
      },
      checks,
      allChecksPass: Object.values(checks).every(Boolean),
    };
    console.log(JSON.stringify(output, null, 2));
    if (!output.allChecksPass) process.exitCode = 2;
  } finally {
    await db.end();
  }
}

audit().catch((error) => { console.error(error); process.exitCode = 1; });
