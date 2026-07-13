require('dotenv').config();
const mysql = require('mysql2/promise');

async function main() {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER, password: process.env.DB_PASS, database: process.env.DB_NAME,
  });
  for (const inv of ['38280', '37784', '39065', '37000']) {
    const [[base]] = await db.query('SELECT id, invoice_no, created_at, sub_total, discount_amount, discount_cash, discount_percentage, coupon_value, cust_discount_value, global_offer_value, vat_total, grand_total, payment_method FROM sales WHERE invoice_no=? AND doc_type<>"credit_note"', [inv]);
    const [cns] = await db.query('SELECT id, invoice_no, created_at, sub_total, discount_amount, vat_total, grand_total FROM sales WHERE ref_base_sale_id=?', [base.id]);
    const [baseItems] = await db.query('SELECT name, price, qty, line_total FROM sales_items WHERE sale_id=?', [base.id]);
    console.log('=== base', inv, JSON.stringify(base));
    console.log('base items:', JSON.stringify(baseItems));
    for (const cn of cns) {
      const [cnItems] = await db.query('SELECT name, price, qty, line_total FROM sales_items WHERE sale_id=?', [cn.id]);
      console.log('CN', cn.invoice_no, JSON.stringify(cn));
      console.log('CN items:', JSON.stringify(cnItems));
    }
  }
  await db.end();
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
