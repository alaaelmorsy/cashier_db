require('dotenv').config();

const mysql = require('mysql2/promise');
const { summarizeDocuments } = require('../src/shared/report-accounting');

async function auditReportAccounting() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
  });

  try {
    const [documents] = await connection.query(`
      SELECT invoice_no, doc_type, payment_method, sub_total, vat_total,
             grand_total, pay_cash_amount, pay_card_amount
      FROM sales
      ORDER BY id DESC
    `);
    const [[settlements]] = await connection.query(`
      SELECT COUNT(*) AS settled,
             SUM(CASE WHEN NOT EXISTS (
               SELECT 1 FROM payment_transactions pt WHERE pt.sale_id = s.id
             ) THEN 1 ELSE 0 END) AS legacy_without_tx
      FROM sales s
      WHERE s.settled_at IS NOT NULL
        AND COALESCE(s.settled_method, '') <> 'refund'
    `);
    const [[documentSigns]] = await connection.query(`
      SELECT
        SUM(CASE WHEN doc_type = 'credit_note' AND grand_total > 0 THEN 1 ELSE 0 END) AS positive_credit_notes,
        SUM(CASE WHEN (doc_type IS NULL OR doc_type = 'invoice') AND grand_total < 0 THEN 1 ELSE 0 END) AS negative_invoices
      FROM sales
    `);
    const [[itemSigns]] = await connection.query(`
      SELECT
        SUM(CASE WHEN s.doc_type = 'credit_note' AND si.qty < 0 THEN 1 ELSE 0 END) AS negative_credit_note_items,
        SUM(CASE WHEN s.doc_type = 'credit_note' AND si.qty > 0 THEN 1 ELSE 0 END) AS positive_credit_note_items,
        SUM(CASE WHEN (s.doc_type IS NULL OR s.doc_type = 'invoice') AND si.qty < 0 THEN 1 ELSE 0 END) AS negative_invoice_items
      FROM sales_items si
      INNER JOIN sales s ON s.id = si.sale_id
    `);
    const [[salesIntegrity]] = await connection.query(`
      SELECT COUNT(*) AS documents,
        SUM(CASE WHEN ABS(ABS(grand_total) - (ABS(sub_total) - ABS(COALESCE(discount_amount,0)) + ABS(COALESCE(tobacco_fee,0)) + ABS(vat_total))) > 0.02 THEN 1 ELSE 0 END) AS total_mismatches,
        SUM(CASE WHEN payment_status='partial' AND (remaining_amount < 0 OR remaining_amount > ABS(grand_total)) THEN 1 ELSE 0 END) AS invalid_remaining,
        SUM(CASE WHEN payment_status='paid' AND ABS(COALESCE(remaining_amount,0)) > 0.02 THEN 1 ELSE 0 END) AS paid_with_balance
      FROM sales
    `);
    const [[salesItemIntegrity]] = await connection.query(`
      SELECT COUNT(*) AS items,
        SUM(CASE WHEN ABS(ABS(line_total) - ABS(price * qty)) > 0.02 THEN 1 ELSE 0 END) AS line_mismatches,
        SUM(CASE WHEN COALESCE(unit_multiplier,1) <= 0 THEN 1 ELSE 0 END) AS invalid_multipliers
      FROM sales_items
    `);
    const [[purchaseIntegrity]] = await connection.query(`
      SELECT COUNT(*) AS invoices,
        SUM(CASE WHEN price_mode='zero_vat' AND ABS(COALESCE(vat_total,0)) > 0.02 THEN 1 ELSE 0 END) AS zero_vat_stored_tax,
        SUM(CASE WHEN price_mode<>'zero_vat' AND ABS(ABS(grand_total) - (ABS(sub_total) + ABS(vat_total))) > 0.02 THEN 1 ELSE 0 END) AS total_mismatches,
        SUM(CASE WHEN COALESCE(amount_paid,0) < 0 OR COALESCE(amount_paid,0) > ABS(grand_total) + 0.02 THEN 1 ELSE 0 END) AS invalid_paid_amount
      FROM purchase_invoices
    `);
    const [salesMismatchSamples] = await connection.query(`
      SELECT invoice_no, doc_type, sub_total, discount_amount, tobacco_fee, extra_value, vat_total, grand_total, total_after_discount
      FROM sales
      WHERE ABS(ABS(grand_total) - (ABS(sub_total) - ABS(COALESCE(discount_amount,0)) + ABS(COALESCE(tobacco_fee,0)) + ABS(vat_total))) > 0.02
      LIMIT 5
    `);
    const [inventorySold] = await connection.query(`
      SELECT p.id,
        COALESCE(SUM(CASE WHEN si.sale_id IN (SELECT id FROM sales WHERE doc_type='credit_note') THEN -ABS(si.qty) ELSE ABS(si.qty) END), 0) AS qty_sold
      FROM products p
      INNER JOIN sales_items si ON si.product_id = p.id
        AND si.sale_id IN (SELECT id FROM sales WHERE doc_type IS NULL OR doc_type IN ('invoice','credit_note'))
      WHERE p.is_active = 1
      GROUP BY p.id
      HAVING qty_sold > 0
    `);
    const [[normalizedItemTotals]] = await connection.query(`
      SELECT
        ROUND(SUM(CASE WHEN s.doc_type='credit_note' THEN -ABS(si.qty) ELSE ABS(si.qty) END), 3) AS qty,
        ROUND(SUM(CASE WHEN s.doc_type='credit_note' THEN -ABS(si.line_total) ELSE ABS(si.line_total) END), 2) AS amount
      FROM sales_items si INNER JOIN sales s ON s.id=si.sale_id
    `);

    console.log(JSON.stringify({
      connected: true,
      sampledDocuments: documents.length,
      sampleSummary: summarizeDocuments(documents),
      settlements,
      documentSigns,
      itemSigns,
      salesIntegrity,
      salesItemIntegrity,
      purchaseIntegrity,
      salesMismatchSamples,
      reportQueries: { inventorySoldProducts: inventorySold.length, normalizedItemTotals },
    }, null, 2));
  } finally {
    await connection.end();
  }
}

auditReportAccounting().catch((error) => {
  console.error(`DB_CHECK_FAILED: ${error.code || error.message}`);
  process.exitCode = 1;
});
