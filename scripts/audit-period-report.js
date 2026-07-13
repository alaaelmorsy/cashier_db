require('dotenv').config();

const mysql = require('mysql2/promise');
const { calculateReportTotals, summarizeDocuments, selectNonCreditPeriodDocuments } = require('../src/shared/report-accounting');
const { calcProfitabilityTotals, buildPaidBySale } = require('../src/renderer/reports/profit-utils');

const FROM = process.argv[2] || '2026-07-01 00:00:00';
const TO = process.argv[3] || '2026-07-13 19:46:00';
const money = (amount) => Number(Number(amount || 0).toFixed(2));

async function auditPeriodReport() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306), user: process.env.DB_USER,
    password: process.env.DB_PASS, database: process.env.DB_NAME,
  });
  try {
    const documentClause = 's.created_at BETWEEN ? AND ?';
    const rangeParams = [FROM, TO];
    const [documents] = await connection.query(`SELECT s.* FROM sales s WHERE ${documentClause}`, rangeParams);
    const [payments] = await connection.query('SELECT * FROM payment_transactions WHERE created_at BETWEEN ? AND ?', [FROM, TO]);
    const [detailedItems] = await connection.query(`
      SELECT si.*, s.doc_type, s.invoice_no, COALESCE(p.cost,0) cost_price, COALESCE(p.is_vat_exempt,0) is_vat_exempt
      FROM sales_items si INNER JOIN sales s ON s.id=si.sale_id LEFT JOIN products p ON p.id=si.product_id
      WHERE ${documentClause}
    `, rangeParams);
    const [[settings]] = await connection.query('SELECT vat_percent, cost_includes_vat FROM app_settings WHERE id=1');

    const { sales: normalSales, creditNotes } = selectNonCreditPeriodDocuments(documents);
    const reportDocuments = [...normalSales, ...creditNotes];
    const totals = calculateReportTotals({ basis: 'document', sales: normalSales, creditNotes, payments, purchases: [] });
    const paymentTotals = summarizeDocuments(documents).paymentTotals;
    const paidBySale = buildPaidBySale(payments);
    const profitability = calcProfitabilityTotals({
      basis: 'document', allSales: reportDocuments, creditNotes, soldItemsDetailed: detailedItems, paidBySale,
      vatPercent: settings?.vat_percent, costIncludesVat: settings?.cost_includes_vat,
    });
    const immediateTransactionDuplicates = payments.filter((payment) => {
      const sale = normalSales.find((candidate) => Number(candidate.id) === Number(payment.sale_id));
      return sale && String(sale.payment_method).toLowerCase() !== 'credit' && !sale.settled_at;
    });
    const countedPayments = money(Object.entries(paymentTotals).filter(([method]) => method !== 'credit').reduce((sum, [, amount]) => sum + amount, 0));
    const checks = {
      salesReconciles: money(totals.sales.pre + totals.sales.tobacco + totals.sales.vat) === totals.sales.after,
      afterDiscountReconciles: money(totals.salesAfterDiscount.pre + totals.salesAfterDiscount.tobacco + totals.salesAfterDiscount.vat) === totals.salesAfterDiscount.after,
      returnsReconcile: money(totals.returns.pre + totals.returns.tobacco + totals.returns.vat) === totals.returns.after,
      netReconciles: money(totals.net.pre + totals.net.tobacco + totals.net.vat) === totals.net.after,
      nonCreditPaymentsEqualNetSales: countedPayments === money(totals.salesAfterDiscount.after - totals.returns.after),
      profitWithVatReconciles: money(profitability.salesTotalWithVat - profitability.costTotalWithVat) === profitability.profitNetWithVat,
      profitExVatReconciles: money(profitability.salesTotalExVat - profitability.costTotalExVat) === profitability.profitNetExVat,
    };
    console.log(JSON.stringify({
      period: { from: FROM, to: TO }, counts: { documents: documents.length, invoices: normalSales.length, creditNotes: creditNotes.length, payments: payments.length },
      totals, paymentTotals, countedPayments, profitability,
      duplicateImmediateTransactionsIgnored: { count: immediateTransactionDuplicates.length, amount: money(immediateTransactionDuplicates.reduce((sum, payment) => sum + Number(payment.amount || 0), 0)) },
      checks, allChecksPass: Object.values(checks).every(Boolean),
    }, null, 2));
    if (!Object.values(checks).every(Boolean)) process.exitCode = 2;
  } finally {
    await connection.end();
  }
}

auditPeriodReport().catch((error) => { console.error(error); process.exitCode = 1; });
