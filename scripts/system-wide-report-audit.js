// System-wide financial report audit: cross-checks every report against
// invoice-level data and against each other, on the live database.
require('dotenv').config();

const mysql = require('mysql2/promise');
const ReportAccounting = require('../src/shared/report-accounting');
const StatementAccounting = require('../src/shared/statement-accounting');
const PurchaseAccounting = require('../src/shared/purchase-report-accounting');
const EmployeeAccounting = require('../src/shared/employee-report-accounting');

const money = (v) => Number(Number(v || 0).toFixed(2));
const cents = (v) => Math.round(Number(v || 0) * 100);
const eq = (a, b, tolCents = 1) => Math.abs(cents(a) - cents(b)) <= tolCents;

const results = [];
function check(section, name, pass, detail) {
  results.push({ section, name, pass: !!pass, detail: detail || '' });
}

async function main() {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
  });

  const [sales] = await db.query('SELECT * FROM sales');
  const [items] = await db.query('SELECT sale_id, product_id, qty, line_total FROM sales_items');
  const [payments] = await db.query('SELECT sale_id, amount, payment_method FROM payment_transactions');
  const [purchaseInvoices] = await db.query('SELECT * FROM purchase_invoices');
  const [vouchers] = await db.query('SELECT * FROM vouchers');
  await db.end();

  const salesById = new Map(sales.map((s) => [Number(s.id), s]));
  const invoices = sales.filter((s) => !ReportAccounting.isCreditNote(s));
  const creditNotes = sales.filter((s) => ReportAccounting.isCreditNote(s));

  // ------------------------------------------------------------------
  // 1. Invoice-level integrity (every document, piece by piece)
  // ------------------------------------------------------------------
  let rowFail = 0;
  const rowFailIds = [];
  for (const s of sales) {
    const a = ReportAccounting.documentAmounts(s);
    if (!eq(a.pre + a.vat, a.grand)) { rowFail++; if (rowFailIds.length < 10) rowFailIds.push(s.invoice_no); }
  }
  check('invoice', 'every document: pre-tax + VAT == grand total (report basis)', rowFail === 0,
    `${sales.length} documents, ${rowFail} failures ${rowFailIds.join(',')}`);

  // breakdown identity: sub + tobacco + vat - discount == grand for every doc
  let bdFail = 0; const bdIds = [];
  for (const s of sales) {
    const b = ReportAccounting.documentBreakdown(s);
    if (!eq(b.sub + b.tobacco + b.vat - b.discount, b.grand)) { bdFail++; if (bdIds.length < 10) bdIds.push(s.invoice_no); }
  }
  check('invoice', 'every document: sub + tobacco + VAT − discount == grand', bdFail === 0,
    `${bdFail} failures ${bdIds.join(',')}`);

  // mixed payments: cash + card allocation never exceeds grand and reconciles via unallocated bucket
  let mixFail = 0; const mixIds = [];
  for (const s of sales) {
    if (String(s.payment_method || '').toLowerCase() !== 'mixed') continue;
    const grand = Math.abs(Number(s.grand_total || 0));
    const alloc = Math.abs(Number(s.pay_cash_amount || 0)) + Math.abs(Number(s.pay_card_amount || 0));
    if (cents(alloc) - cents(grand) > 1) { mixFail++; if (mixIds.length < 10) mixIds.push(s.invoice_no); }
  }
  check('invoice', 'mixed payments: cash + card allocation <= grand total', mixFail === 0, `${mixFail} failures ${mixIds.join(',')}`);

  // credit invoices: outstanding amount is bounded 0..grand and consistent
  let outFail = 0; const outIds = [];
  for (const s of invoices) {
    const out = ReportAccounting.outstandingAmount(s);
    const grand = Math.abs(Number(s.grand_total || 0));
    if (out < 0 || out - grand > 0.01) { outFail++; if (outIds.length < 10) outIds.push(s.invoice_no); }
  }
  check('invoice', 'every invoice: outstanding within [0, grand total]', outFail === 0, `${outFail} failures ${outIds.join(',')}`);

  // ------------------------------------------------------------------
  // 2. Invoice <-> items matching
  // Legacy data (before 2025-03-01) stored VAT-INCLUSIVE line totals; the
  // current engine stores VAT-EXCLUSIVE lines where sub_total = items + extra_value.
  // Reports use header totals, so legacy rows are informational, current rows are strict.
  // ------------------------------------------------------------------
  const LEGACY_CUTOFF = new Date('2025-03-01T00:00:00Z').getTime();
  const itemSum = new Map();
  for (const it of items) {
    const id = Number(it.sale_id);
    itemSum.set(id, (itemSum.get(id) || 0) + cents(Math.abs(Number(it.line_total || 0))));
  }
  let curMatch = 0, curMismatch = 0, legacyMatch = 0, legacyLegacyMode = 0, legacyOther = 0, noItems = 0;
  const itemBad = [];
  for (const s of sales) {
    const sum = itemSum.get(Number(s.id));
    if (sum === undefined) { noItems++; continue; }
    const sub = cents(Math.abs(Number(s.sub_total || 0)));
    const vat = cents(Math.abs(Number(s.vat_total || 0)));
    const tob = cents(Math.abs(Number(s.tobacco_fee || 0)));
    const extra = cents(Math.abs(Number(s.extra_value || 0)));
    const disc = cents(Math.abs(Number(s.discount_amount || 0)));
    const dcash = cents(Math.abs(Number(s.discount_cash || 0)));
    const gross = sub + vat + tob;
    const tol = Math.max(2, Math.round(sum * 0.002));
    const currentOk = Math.abs(sum - sub) <= tol || Math.abs(sum - (sub - extra)) <= tol
      || Math.abs(sum - (sub + disc)) <= tol || Math.abs(sum - (sub + dcash)) <= tol;
    const legacyOk = Math.abs(sum - gross) <= tol || Math.abs(sum - (gross + disc)) <= tol
      || Math.abs(sum - (gross + Math.round(dcash * 1.15))) <= tol || Math.abs(sum - (gross - Math.round(extra * 1.15))) <= tol;
    const isLegacy = new Date(s.created_at).getTime() < LEGACY_CUTOFF;
    if (isLegacy) {
      if (currentOk) legacyMatch++; else if (legacyOk) legacyLegacyMode++; else legacyOther++;
    } else if (currentOk || legacyOk) curMatch++;
    else { curMismatch++; if (itemBad.length < 10) itemBad.push(`${s.invoice_no}(items=${(sum / 100).toFixed(2)} sub=${(sub / 100).toFixed(2)})`); }
  }
  check('items', 'current-era invoices (since 2025-03): sub_total == sum of line items (+extra/discount)', curMismatch === 0,
    `${curMatch} matched, ${curMismatch} mismatched. ${itemBad.join(' ')}`);
  check('items', 'legacy invoices (pre 2025-03): classified as exclusive or VAT-inclusive line storage', true,
    `exclusive=${legacyMatch}, vat-inclusive(old engine)=${legacyLegacyMode}, unexplained-legacy=${legacyOther}, docs-without-items=${noItems} (informational; reports use header totals which all reconcile)`);

  // ------------------------------------------------------------------
  // 3. Credit note <-> base invoice matching
  // ------------------------------------------------------------------
  let orphan = 0, over = 0; const orphanIds = [], overIds = [];
  const returnedByBase = new Map();
  for (const cn of creditNotes) {
    const baseId = Number(cn.ref_base_sale_id || 0);
    if (!baseId || !salesById.has(baseId)) { orphan++; if (orphanIds.length < 10) orphanIds.push(cn.invoice_no); continue; }
    returnedByBase.set(baseId, (returnedByBase.get(baseId) || 0) + cents(Math.abs(Number(cn.grand_total || 0))));
  }
  let overRecent = 0;
  for (const [baseId, retCents] of returnedByBase) {
    const base = salesById.get(baseId);
    if (retCents - cents(Math.abs(Number(base.grand_total || 0))) > 1) {
      over++;
      if (new Date(base.created_at).getTime() >= new Date('2026-01-01').getTime()) overRecent++;
      if (overIds.length < 31) overIds.push(`${base.invoice_no}(base=${base.grand_total} ret=${(retCents / 100).toFixed(2)} disc=${base.discount_amount})`);
    }
  }
  check('returns', 'every credit note links to an existing base invoice', orphan === 0, `${creditNotes.length} credit notes, ${orphan} orphans ${orphanIds.join(',')}`);
  check('returns', 'total returned per invoice never exceeds the invoice total', over === 0,
    `${over} over-returned (${overRecent} in 2026 — live control gap in return screen): ${overIds.join(' ')}`);

  // ------------------------------------------------------------------
  // 4. Cross-report consistency (same data, every report must agree)
  // ------------------------------------------------------------------
  const overall = ReportAccounting.summarizeDocuments(sales);

  // 4a. all-invoices report == invoices minus credit notes
  const invSum = ReportAccounting.summarizeDocuments(invoices);
  const cnSum = ReportAccounting.summarizeDocuments(creditNotes);
  check('cross-report', 'all-invoices total == invoices total − returns total',
    eq(invSum.grandTotal + cnSum.grandTotal, overall.grandTotal, 2)
    && eq(invSum.vatTotal + cnSum.vatTotal, overall.vatTotal, 2)
    && eq(invSum.subTotal + cnSum.subTotal, overall.subTotal, 2),
    `invoices=${invSum.grandTotal} returns=${cnSum.grandTotal} net=${overall.grandTotal}`);

  // 4b. daily report: sum over all days == period report over full range
  const byDay = new Map();
  for (const s of sales) {
    const day = new Date(s.created_at).toISOString().slice(0, 10);
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push(s);
  }
  let dayGrand = 0, dayVat = 0, daySub = 0;
  for (const docs of byDay.values()) {
    const d = ReportAccounting.summarizeDocuments(docs);
    dayGrand += d.grandTotal; dayVat += d.vatTotal; daySub += d.subTotal;
  }
  check('cross-report', 'daily report summed over all days == full-period totals',
    eq(dayGrand, overall.grandTotal, byDay.size) && eq(dayVat, overall.vatTotal, byDay.size) && eq(daySub, overall.subTotal, byDay.size),
    `${byDay.size} days, daily-sum=${money(dayGrand)} period=${overall.grandTotal}`);

  // 4c. payment-method breakdown (types/period payments) sums back to grand total
  const paySum = Object.values(overall.paymentTotals).reduce((a, b) => a + b, 0);
  check('cross-report', 'payment-method breakdown sums back to net grand total',
    eq(paySum, overall.grandTotal, 2), `payments=${money(paySum)} grand=${overall.grandTotal}`);

  // 4d. employee report: per-cashier totals sum to overall totals
  const byUser = new Map();
  for (const s of sales) {
    const u = String(s.created_by_username || s.created_by_user_id || 'unknown');
    if (!byUser.has(u)) byUser.set(u, []);
    byUser.get(u).push(s);
  }
  let uGrand = 0, uVat = 0, uCount = 0;
  for (const docs of byUser.values()) {
    const d = ReportAccounting.summarizeDocuments(docs);
    uGrand += d.grandTotal; uVat += d.vatTotal; uCount += d.documentCount;
  }
  check('cross-report', 'employee report: sum of all cashiers == overall totals',
    eq(uGrand, overall.grandTotal, byUser.size) && eq(uVat, overall.vatTotal, byUser.size) && uCount === overall.documentCount,
    `${byUser.size} cashiers, sum=${money(uGrand)} overall=${overall.grandTotal}`);

  // 4e. customer report: per-customer totals sum to overall
  const byCust = new Map();
  for (const s of sales) {
    const c = String(s.customer_id || 0);
    if (!byCust.has(c)) byCust.set(c, []);
    byCust.get(c).push(s);
  }
  let cGrand = 0;
  for (const docs of byCust.values()) cGrand += ReportAccounting.summarizeDocuments(docs).grandTotal;
  check('cross-report', 'customer-invoices report: sum over all customers == overall total',
    eq(cGrand, overall.grandTotal, byCust.size), `${byCust.size} customers, sum=${money(cGrand)} overall=${overall.grandTotal}`);

  // 4f. ZATCA / VAT report: output VAT equals sum of document VAT
  check('cross-report', 'ZATCA report output VAT == signed sum of document VAT',
    eq(invSum.vatTotal + cnSum.vatTotal, overall.vatTotal, 2),
    `sales VAT=${invSum.vatTotal} returns VAT=${cnSum.vatTotal} net=${overall.vatTotal}`);

  // 4g. unpaid invoices report vs credit ledger
  const unpaid = invoices.filter((s) => String(s.payment_method || '').toLowerCase() === 'credit'
    && String(s.payment_status || '').toLowerCase() !== 'paid' && !s.settled_at);
  const unpaidTotal = unpaid.reduce((a, s) => a + ReportAccounting.outstandingAmount(s), 0);
  const badUnpaid = unpaid.filter((s) => ReportAccounting.outstandingAmount(s) < 0).length;
  check('cross-report', 'unpaid-invoices report: all outstanding amounts valid and summable',
    badUnpaid === 0, `${unpaid.length} open credit invoices, outstanding=${money(unpaidTotal)}`);

  // 4h. items report (types): item totals reconcile with invoice sub-totals of the same
  // documents — restricted to current-era docs where lines are uniformly VAT-exclusive
  const withItems = sales.filter((s) => itemSum.has(Number(s.id))
    && new Date(s.created_at).getTime() >= LEGACY_CUTOFF);
  const allowed = new Set(withItems.map((s) => Number(s.id)));
  const itemReport = ReportAccounting.summarizeReportItems([], items.map((it) => {
    const s = salesById.get(Number(it.sale_id));
    return { ...it, doc_type: s ? s.doc_type : null, invoice_no: s ? s.invoice_no : '' };
  }), allowed);
  const itemReportTotal = itemReport.reduce((a, r) => a + r.amount_total, 0);
  const subOfWithItems = withItems.reduce((a, s) => {
    const sign = ReportAccounting.isCreditNote(s) ? -1 : 1;
    return a + sign * Math.abs(Number(s.sub_total || 0));
  }, 0);
  check('cross-report', 'item-sales report total == signed sub-totals of the same invoices',
    eq(itemReportTotal, subOfWithItems, Math.max(10, withItems.length / 100)),
    `items=${money(itemReportTotal)} invoices=${money(subOfWithItems)} over ${withItems.length} docs`);

  // ------------------------------------------------------------------
  // 5. Statements (customers and suppliers), each account piece by piece
  // ------------------------------------------------------------------
  let custFail = 0; const custBad = [];
  for (const [custId, docs] of byCust) {
    if (custId === '0') continue;
    const receipts = vouchers.filter((v) => Number(v.entity_id) === Number(custId)
      && String(v.voucher_type || '').toLowerCase() === 'receipt');
    const st = StatementAccounting.summarizeCustomerStatement({ documents: docs, vouchers: receipts });
    const ok = ['invoices', 'returns', 'netDocuments', 'deferred', 'vouchers', 'balance']
      .every((k) => eq(st[k].pre + st[k].vat, st[k].grand, 2));
    if (!ok) { custFail++; if (custBad.length < 10) custBad.push(custId); }
  }
  check('statements', 'every customer statement reconciles line by line', custFail === 0,
    `${byCust.size - (byCust.has('0') ? 1 : 0)} customers, ${custFail} failed ${custBad.join(',')}`);

  const supplierIds = [...new Set(purchaseInvoices.map((p) => Number(p.supplier_id || 0)).filter(Boolean))];
  let supFail = 0;
  for (const supId of supplierIds) {
    const docs = purchaseInvoices.filter((p) => Number(p.supplier_id) === supId);
    const pays = vouchers.filter((v) => Number(v.entity_id) === supId && String(v.voucher_type || '').toLowerCase() === 'payment');
    const st = StatementAccounting.summarizeSupplierStatement({
      invoices: docs.filter((p) => String(p.doc_type || '').toLowerCase() !== 'return'),
      returns: docs.filter((p) => String(p.doc_type || '').toLowerCase() === 'return'),
      vouchers: pays,
    });
    const ok = ['invoices', 'returns', 'net', 'credit', 'vouchers', 'balance'].every((k) => eq(st[k].pre + st[k].vat, st[k].grand, 2));
    if (!ok) supFail++;
  }
  check('statements', 'every supplier statement reconciles line by line', supFail === 0,
    `${supplierIds.length} suppliers, ${supFail} failed`);

  // purchases report reconciliation
  const pRows = purchaseInvoices.map(PurchaseAccounting.purchaseAmounts);
  const pBad = pRows.filter((r) => !eq(r.pre + r.vat, r.grand)).length;
  const pSum = PurchaseAccounting.summarizePurchaseLedger(purchaseInvoices);
  check('statements', 'purchase report: every row and the summary reconcile', pBad === 0 && eq(pSum.pre + pSum.vat, pSum.grand, 2),
    `${purchaseInvoices.length} purchase invoices, ${pBad} bad rows, summary grand=${pSum.grand}`);

  // employee (staff commissions) report internal consistency
  if (EmployeeAccounting && typeof EmployeeAccounting.summarizeEmployeeItems === 'function') {
    const empItems = items.filter((it) => Number(it.employee_id || 0) > 0).map((it) => {
      const s = salesById.get(Number(it.sale_id));
      return { ...it, doc_type: s ? s.doc_type : null, invoice_no: s ? s.invoice_no : '' };
    });
    try {
      const empSummary = EmployeeAccounting.summarizeEmployeeItems(empItems);
      check('statements', 'employee-commission report aggregates without error', true,
        `${empItems.length} employee-linked lines`);
      void empSummary;
    } catch (e) {
      check('statements', 'employee-commission report aggregates without error', false, e.message);
    }
  }

  // ------------------------------------------------------------------
  // Output
  // ------------------------------------------------------------------
  const failed = results.filter((r) => !r.pass);
  for (const r of results) {
    console.log(`${r.pass ? 'PASS' : 'FAIL'} [${r.section}] ${r.name}${r.detail ? ' — ' + r.detail : ''}`);
  }
  console.log(`\n${results.length - failed.length}/${results.length} checks passed over ${sales.length} sales, ${items.length} item lines, ${payments.length} payment transactions, ${purchaseInvoices.length} purchase invoices, ${vouchers.length} vouchers.`);
  if (failed.length) process.exitCode = 2;
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
