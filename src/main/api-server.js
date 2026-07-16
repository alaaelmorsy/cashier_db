const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const fs = require('fs');
const path = require('path');
const { dbAdapter } = require('../db/db-adapter');
const { buildReportDateFilter } = require('../shared/report-date-filter');

const DEFAULT_API_PORT = 4310;
const DEFAULT_API_HOST = '0.0.0.0';

let server = null;

// ═══════════════════════════════════════════════════════════════
// Invoice creation helpers (used by POST /api/invoices)
// ═══════════════════════════════════════════════════════════════
let __apiInvoiceCounterChecked = false;
let __apiSaleColumnsEnsured = false;

async function _apiGetNextSeq(conn) {
  await conn.query(`CREATE TABLE IF NOT EXISTS app_counters (name VARCHAR(64) PRIMARY KEY, value INT NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await conn.query(`INSERT IGNORE INTO app_counters (name, value) VALUES ('invoice_seq', 0)`);
  if (!__apiInvoiceCounterChecked) {
    const [[maxRow]] = await conn.query(`SELECT COALESCE(MAX(CAST(invoice_no AS UNSIGNED)),0) AS m FROM sales WHERE invoice_no REGEXP '^[0-9]+$'`);
    await conn.query(`UPDATE app_counters SET value = GREATEST(value, ?) WHERE name='invoice_seq'`, [Number(maxRow.m || 0)]);
    __apiInvoiceCounterChecked = true;
  }
  await conn.query(`UPDATE app_counters SET value = value + 1 WHERE name='invoice_seq'`);
  const [[row]] = await conn.query(`SELECT value FROM app_counters WHERE name='invoice_seq'`);
  return Number(row.value || 1);
}

function _apiGenInvoiceNo(seq) { return String(seq); }

async function _apiGetNextOrderNo(conn) {
  await conn.query(`CREATE TABLE IF NOT EXISTS app_state (k VARCHAR(64) PRIMARY KEY, sval TEXT NULL, ival BIGINT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  const [rows] = await conn.query(`SELECT k, sval, ival FROM app_state WHERE k IN ('order_seq_anchor','order_seq_value') FOR UPDATE`);
  const byKey = {};
  rows.forEach(r => { byKey[r.k] = r; });
  const [[cfg]] = await conn.query(`SELECT closing_hour FROM app_settings WHERE id=1 LIMIT 1`).catch(() => [[{}]]);
  const closingHour = Number((cfg && cfg.closing_hour) || 0);
  const now = new Date();
  const anchorDate = new Date(now);
  if (now.getHours() < closingHour) anchorDate.setDate(anchorDate.getDate() - 1);
  const anchor = `${anchorDate.getFullYear()}-${String(anchorDate.getMonth()+1).padStart(2,'0')}-${String(anchorDate.getDate()).padStart(2,'0')}`;
  const prevAnchor = byKey['order_seq_anchor'] ? byKey['order_seq_anchor'].sval : null;
  let curVal = byKey['order_seq_value'] ? Number(byKey['order_seq_value'].ival || 0) : 0;
  if (prevAnchor !== anchor) {
    curVal = 0;
    await conn.query(`INSERT INTO app_state (k,sval,ival) VALUES ('order_seq_anchor',?,NULL) ON DUPLICATE KEY UPDATE sval=VALUES(sval)`, [anchor]);
    await conn.query(`INSERT INTO app_state (k,sval,ival) VALUES ('order_seq_value',NULL,0) ON DUPLICATE KEY UPDATE ival=VALUES(ival)`);
  }
  curVal += 1;
  await conn.query(`INSERT INTO app_state (k,sval,ival) VALUES ('order_seq_value',NULL,?) ON DUPLICATE KEY UPDATE ival=VALUES(ival)`, [curVal]);
  return curVal;
}

function startAPIServer(port = DEFAULT_API_PORT, host = DEFAULT_API_HOST) {
  if (server) {
    console.log('API Server already running');
    return server;
  }

  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(compression());
  app.use(express.json({ limit: '5mb' }));

  app.get('/api/health', (req, res) => {
    res.json({ ok: true, message: 'API Server is running' });
  });

  // ═══════════════════════════════════════════════════════════════
  // Sales Endpoints
  // ═══════════════════════════════════════════════════════════════
  app.get('/api/invoices', async (req, res) => {
    let conn;
    try {
      const {
        limit = 20,
        offset = 0,
        before_id,
        search,
        customer_q,
        payment_status,
        date_from,
        date_to,
        user_id,
        type,
        customers_only,
        zatca_status,
        date_basis,
      } = req.query;

      const rawLim = req.query.limit;
      let lim;
      if (rawLim === '0' || rawLim === 0 || rawLim === 'all') {
        lim = 999999;
      } else {
        lim = Math.min(parseInt(rawLim) || 20, 999999);
      }

      conn = await dbAdapter.getConnection();

      const SELECT_COLS = `s.*, c.name AS disp_customer_name, c.phone AS disp_customer_phone`;

      const whereClauses = [];
      const params = [];

      if (type === 'invoice') {
        whereClauses.push("(s.doc_type IS NULL OR s.doc_type='invoice')");
      } else if (type === 'credit_note' || type === 'credit') {
        whereClauses.push("s.doc_type='credit_note'");
      }

      if (search) {
        whereClauses.push('(s.invoice_no LIKE ? OR s.customer_name LIKE ? OR s.customer_phone LIKE ? OR s.customer_vat LIKE ?)');
        const s = `%${search}%`;
        params.push(s, s, s, s);
      }
      if (customer_q) {
        whereClauses.push('(s.customer_phone LIKE ? OR s.customer_vat LIKE ? OR s.customer_name LIKE ? OR c.phone LIKE ? OR c.name LIKE ? OR c.vat_number LIKE ?)');
        const cq = `%${customer_q}%`;
        params.push(cq, cq, cq, cq, cq, cq);
      }
      if (payment_status) {
        whereClauses.push('s.payment_status = ?');
        params.push(payment_status);
      }
      if (user_id) {
        whereClauses.push('s.created_by_user_id = ?');
        params.push(Number(user_id));
      }
      if (customers_only) {
        whereClauses.push('(s.customer_id IS NOT NULL OR s.customer_name IS NOT NULL)');
      }
      if (zatca_status === 'rejected') {
        whereClauses.push("s.zatca_status='rejected'");
      } else if (zatca_status === 'sent') {
        whereClauses.push("s.zatca_status<>'rejected' AND (s.zatca_status IN ('submitted','accepted') OR s.zatca_submitted IS NOT NULL)");
      } else if (zatca_status === 'not_sent') {
        whereClauses.push("(s.zatca_status IS NULL OR s.zatca_status NOT IN ('rejected','submitted','accepted')) AND s.zatca_submitted IS NULL");
      }

      const dateFilter = buildReportDateFilter({
        tableAlias: 's', from: date_from, to: date_to, basis: date_basis || 'document'
      });
      if (dateFilter.clause) { whereClauses.push(dateFilter.clause); params.push(...dateFilter.params); }

      const where = whereClauses.length ? ('WHERE ' + whereClauses.join(' AND ')) : '';

      let total = 0;
      const needsJoinForCount = !!customer_q;
      if (needsJoinForCount) {
        const [[countRow]] = await conn.query(
          `SELECT COUNT(DISTINCT s.id) AS total FROM sales s LEFT JOIN customers c ON c.id = s.customer_id ${where}`,
          params
        );
        total = Number(countRow.total || 0);
      } else if (!whereClauses.length) {
        const [cntRows] = await conn.query(`SELECT COUNT(*) AS total FROM sales`);
        total = Number(cntRows[0]?.total || 0);
      } else {
        const [[countRow]] = await conn.query(`SELECT COUNT(*) AS total FROM sales s ${where}`, params);
        total = Number(countRow.total || 0);
      }

      let rows;
      const beforeId = before_id ? Number(before_id) : null;
      if (beforeId) {
        const ksWhere = 'WHERE ' + [...whereClauses, 's.id < ?'].join(' AND ');
        const [ksRows] = await conn.query(
          `SELECT ${SELECT_COLS}
             FROM sales s LEFT JOIN customers c ON c.id = s.customer_id
             ${ksWhere}
             ORDER BY s.id DESC LIMIT ?`,
          [...params, beforeId, lim]
        );
        rows = ksRows;
      } else {
        const off = parseInt(offset) || 0;
        const [offRows] = await conn.query(
          `SELECT ${SELECT_COLS}
             FROM sales s LEFT JOIN customers c ON c.id = s.customer_id
             ${where}
             ORDER BY s.id DESC LIMIT ? OFFSET ?`,
          [...params, lim, off]
        );
        rows = offRows;
      }

      res.json({ ok: true, invoices: rows, total, limit: lim });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    } finally {
      if (conn) conn.release();
    }
  });

  app.get('/api/invoices/:id', async (req, res) => {
    let conn;
    try {
      const { id } = req.params;
      conn = await dbAdapter.getConnection();
      const [[saleRow], items] = await Promise.all([
        conn.query('SELECT * FROM sales WHERE id=? LIMIT 1', [id]),
        conn.query(
          `SELECT si.id, si.sale_id, si.product_id, si.name, si.description, si.unit_name, si.unit_multiplier,
                  si.price, si.qty, si.line_total, si.is_vat_exempt, si.operation_id, si.operation_name,
                  si.employee_id, p.is_tobacco, p.is_vat_exempt AS product_is_vat_exempt, p.category, p.name_en,
                  COALESCE(pv.barcode, p.barcode) AS barcode, e.name AS employee_name
           FROM sales_items si
           LEFT JOIN products p ON p.id = si.product_id
           LEFT JOIN product_variants pv ON pv.id = si.operation_id
           LEFT JOIN employees e ON e.id = si.employee_id
           WHERE si.sale_id=? ORDER BY si.id`,
          [id]
        ),
      ]);
      if (!saleRow || !saleRow.length) {
        return res.status(404).json({ ok: false, error: 'Invoice not found' });
      }
      const normalizedItems = (items[0] || []).map(it => ({
        ...it,
        is_vat_exempt: Number(it.is_vat_exempt||0) === 1 ? 1 : (Number(it.product_is_vat_exempt||0) === 1 ? 1 : 0)
      }));
      res.json({ ok: true, sale: saleRow[0], invoice: saleRow[0], items: normalizedItems });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    } finally {
      if (conn) conn.release();
    }
  });

  app.get('/api/invoices/by-no/:no', async (req, res) => {
    let conn;
    try {
      const { no } = req.params;
      conn = await dbAdapter.getConnection();
      const [[saleRow], items] = await Promise.all([
        conn.query('SELECT * FROM sales WHERE invoice_no = ? LIMIT 1', [no]),
        conn.query(
          `SELECT si.id, si.sale_id, si.product_id, si.name, si.description, si.unit_name, si.unit_multiplier,
                  si.price, si.qty, si.line_total, si.is_vat_exempt, si.operation_id, si.operation_name,
                  si.employee_id, p.is_tobacco, p.is_vat_exempt AS product_is_vat_exempt, p.category, p.name_en,
                  COALESCE(pv.barcode, p.barcode) AS barcode, e.name AS employee_name
           FROM sales_items si
           LEFT JOIN products p ON p.id = si.product_id
           LEFT JOIN product_variants pv ON pv.id = si.operation_id
           LEFT JOIN employees e ON e.id = si.employee_id
           WHERE si.sale_id = (SELECT id FROM sales WHERE invoice_no = ? LIMIT 1) ORDER BY si.id`,
          [no]
        ),
      ]);
      if (!saleRow || !saleRow.length) {
        return res.status(404).json({ ok: false, error: 'Invoice not found' });
      }
      const normalizedItems = (items[0] || []).map(it => ({
        ...it,
        is_vat_exempt: Number(it.is_vat_exempt||0) === 1 ? 1 : (Number(it.product_is_vat_exempt||0) === 1 ? 1 : 0)
      }));
      res.json({ ok: true, sale: saleRow[0], invoice: saleRow[0], items: normalizedItems });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    } finally {
      if (conn) conn.release();
    }
  });

  app.get('/api/credit-invoices', async (req, res) => {
    let conn;
    try {
      const { limit = 200, offset = 0 } = req.query;
      conn = await dbAdapter.getConnection();
      const sql = 'SELECT * FROM sales WHERE payment_status="unpaid" AND doc_type="invoice" ORDER BY id DESC LIMIT ? OFFSET ?';
      const [rows] = await conn.query(sql, [parseInt(limit), parseInt(offset)]);
      res.json({ ok: true, invoices: rows });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    } finally {
      if (conn) conn.release();
    }
  });

  app.get('/api/credit-notes', async (req, res) => {
    let conn;
    try {
      const { limit = 999999, offset = 0, date_from, date_to } = req.query;
      conn = await dbAdapter.getConnection();
      const terms = ["doc_type='credit_note'"];
      const params = [];
      if (date_from && date_to) {
        terms.push('((settled_at IS NULL AND created_at >= ? AND created_at <= ?) OR (settled_at IS NOT NULL AND settled_at >= ? AND settled_at <= ?))');
        params.push(date_from, date_to, date_from, date_to);
      } else if (date_from) {
        terms.push('((settled_at IS NULL AND created_at >= ?) OR (settled_at IS NOT NULL AND settled_at >= ?))');
        params.push(date_from, date_from);
      } else if (date_to) {
        terms.push('((settled_at IS NULL AND created_at <= ?) OR (settled_at IS NOT NULL AND settled_at <= ?))');
        params.push(date_to, date_to);
      }
      const where = 'WHERE ' + terms.join(' AND ');
      const lim = Math.min(parseInt(limit) || 999999, 999999);
      const [rows] = await conn.query(`SELECT * FROM sales ${where} ORDER BY id DESC LIMIT ? OFFSET ?`, [...params, lim, parseInt(offset) || 0]);
      res.json({ ok: true, credit_notes: rows });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    } finally {
      if (conn) conn.release();
    }
  });

  app.get('/api/period-summary', async (req, res) => {
    let conn;
    try {
      const { from, to } = req.query;
      conn = await dbAdapter.getConnection();
      const sql = `
        SELECT 
          COUNT(*) as total_invoices,
          SUM(grand_total) as total_sales,
          SUM(sub_total) as total_subtotal,
          SUM(vat_total) as total_vat
        FROM sales 
        WHERE doc_type="invoice" 
        AND created_at BETWEEN ? AND ?
      `;
      const [rows] = await conn.query(sql, [from, to]);
      res.json({ ok: true, summary: rows[0] });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    } finally {
      if (conn) conn.release();
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // Sales Items Summary Endpoint
  // ═══════════════════════════════════════════════════════════════
  app.get('/api/sales-items-summary', async (req, res) => {
    let conn;
    try {
      const { date_from, date_to, from_at, to_at, exclude_unpaid_credit, date_basis } = req.query;
      const from = date_from || from_at || null;
      const to = date_to || to_at || null;
      
      conn = await dbAdapter.getConnection();
      const terms = [];
      const params = [];
      const dateFilter = buildReportDateFilter({ tableAlias: 's', from, to, basis: date_basis || 'document' });
      if (dateFilter.clause) { terms.push(dateFilter.clause); params.push(...dateFilter.params); }
      terms.push("(s.doc_type IS NULL OR s.doc_type IN ('invoice','credit_note'))");
      // For profitability: exclude credit (آجل) invoices that are not yet fully paid.
      if (exclude_unpaid_credit) {
        terms.push("NOT ((s.doc_type IS NULL OR s.doc_type='invoice') AND LOWER(COALESCE(s.payment_method,''))='credit' AND s.payment_status IN ('unpaid','partial'))");
      }
      const where = terms.length ? ('WHERE ' + terms.join(' AND ')) : '';
      
      const sql = `SELECT si.product_id, si.name,
                          SUM(CASE WHEN s.doc_type='credit_note' THEN -ABS(si.qty) ELSE ABS(si.qty) END) AS qty_total,
                          SUM(CASE WHEN s.doc_type='credit_note' THEN -ABS(si.line_total) ELSE ABS(si.line_total) END) AS amount_total,
                          SUM(CASE WHEN COALESCE(s.tax_treatment,'standard')='standard' THEN CASE WHEN s.doc_type='credit_note' THEN -ABS(si.line_total) ELSE ABS(si.line_total) END ELSE 0 END) AS standard_amount_total,
                          SUM(CASE WHEN s.tax_treatment='international_transport_zero_rate' THEN CASE WHEN s.doc_type='credit_note' THEN -ABS(si.line_total) ELSE ABS(si.line_total) END ELSE 0 END) AS international_transport_zero_rate_amount_total,
                          COALESCE(p.cost, 0) AS cost_price, COALESCE(si.price, p.price, 0) AS sale_price,
                          COALESCE(p.stock, 0) AS stock_qty, COALESCE(p.is_vat_exempt, 0) AS is_vat_exempt
                   FROM sales_items si 
                   INNER JOIN sales s ON s.id = si.sale_id
                   LEFT JOIN products p ON p.id = si.product_id
                   ${where}
                   GROUP BY si.product_id, si.name, p.cost, p.price, p.stock, p.is_vat_exempt
                   ORDER BY qty_total DESC, si.product_id ASC, si.name ASC`;
      
      const [rows] = await conn.query(sql, params);
      res.json({ ok: true, items: rows });
    } catch (err) {
      console.error('sales-items-summary error:', err);
      res.status(500).json({ ok: false, error: err.message });
    } finally {
      if (conn) conn.release();
    }
  });

  // GET /api/sales-items-detailed — detailed sold items for profitability (secondary device)
  app.get('/api/sales-items-detailed', async (req, res) => {
    let conn;
    try {
      const { date_from, date_to, from_at, to_at, only_tobacco, product_id, date_basis } = req.query;
      const from = date_from || from_at || null;
      const to = date_to || to_at || null;
      const onlyTobacco = only_tobacco === '1' || only_tobacco === 'true';
      conn = await dbAdapter.getConnection();
      const terms = [];
      const params = [];
      const dateFilter = buildReportDateFilter({ tableAlias: 's', from, to, basis: date_basis || 'document' });
      if (dateFilter.clause) { terms.push(dateFilter.clause); params.push(...dateFilter.params); }
      terms.push("(s.doc_type IS NULL OR s.doc_type IN ('invoice','credit_note'))");
      if (onlyTobacco) { terms.push('(p.is_tobacco = 1)'); }
      if (product_id) { terms.push('si.product_id = ?'); params.push(Number(product_id)); }
      const where = terms.length ? ('WHERE ' + terms.join(' AND ')) : '';
      const sql = `
        SELECT si.id, si.sale_id, s.invoice_no, s.created_at, s.doc_type, s.payment_method, COALESCE(s.tax_treatment,'standard') AS tax_treatment,
               si.product_id, si.name, si.description, si.operation_name, si.unit_multiplier, si.price, si.qty, si.line_total,
               p.category, p.is_tobacco,
               COALESCE(p.cost, 0) AS cost_price, COALESCE(p.is_vat_exempt, 0) AS is_vat_exempt
        FROM sales_items si
        INNER JOIN sales s ON s.id = si.sale_id
        LEFT JOIN products p ON p.id = si.product_id
        ${where}
        ORDER BY s.created_at DESC, s.id DESC, si.id ASC`;
      const [rows] = await conn.query(sql, params);
      res.json({ ok: true, items: rows });
    } catch (err) {
      console.error('sales-items-detailed error:', err);
      res.status(500).json({ ok: false, error: err.message });
    } finally {
      if (conn) conn.release();
    }
  });

  // GET /api/sales-payments — payment transactions for profitability (secondary device)
  app.get('/api/sales-payments', async (req, res) => {
    let conn;
    try {
      const { date_from, date_to, sale_id } = req.query;
      conn = await dbAdapter.getConnection();
      const terms = [];
      const params = [];
      if (date_from) { terms.push('created_at >= ?'); params.push(date_from); }
      if (date_to) { terms.push('created_at <= ?'); params.push(date_to); }
      if (sale_id) { terms.push('sale_id = ?'); params.push(Number(sale_id)); }
      const where = terms.length ? ('WHERE ' + terms.join(' AND ')) : '';
      const [rows] = await conn.query(`SELECT * FROM payment_transactions ${where} ORDER BY created_at ASC`, params);
      res.json({ ok: true, items: rows });
    } catch (err) {
      console.error('sales-payments error:', err);
      res.status(500).json({ ok: false, error: err.message });
    } finally {
      if (conn) conn.release();
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // Products Endpoints
  // ═══════════════════════════════════════════════════════════════
  app.get('/api/products', async (req, res) => {
    let conn;
    try {
      const { q, active, hide_from_sales, category, sort, limit = 500, offset = 0, skip_count, starts_with } = req.query;
      conn = await dbAdapter.getConnection();
      const SELECT_COLS = `id,name,name_en,barcode,price,min_price,cost,stock,category,is_tobacco,is_vat_exempt,is_international_transport_service,is_active,hide_from_sales,expiry_date,sort_order,allow_manual_price,(image_blob IS NOT NULL OR (image_path IS NOT NULL AND image_path != '')) AS has_image`;
      const where = [];
      const whereParams = [];
      const orderParams = [];

      if (q) {
        const searchTerm = String(q).trim();
        if (starts_with) {
          where.push('(name LIKE ? OR name_en LIKE ? OR barcode LIKE ?)');
          whereParams.push(`${searchTerm}%`, `${searchTerm}%`, `${searchTerm}%`);
        } else {
          where.push('(name LIKE ? OR name_en LIKE ? OR barcode LIKE ?)');
          whereParams.push(`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`);
        }
      }
      if (active === '1' || active === '0') { where.push('is_active=?'); whereParams.push(Number(active)); }
      if (category) { where.push('category=?'); whereParams.push(category); }
      if (hide_from_sales === '0' || hide_from_sales === '1') { where.push('hide_from_sales=?'); whereParams.push(Number(hide_from_sales)); }

      let order = 'ORDER BY id DESC';
      if (sort === 'custom') order = 'ORDER BY sort_order ASC, is_active DESC, name ASC';
      else if (sort === 'name_asc') order = 'ORDER BY name ASC';
      else if (sort === 'price_asc') order = 'ORDER BY price ASC';
      else if (sort === 'price_desc') order = 'ORDER BY price DESC';
      else if (sort === 'stock_desc') order = 'ORDER BY stock DESC';
      if (q && !/^\d+$/.test(String(q).trim())) {
        order = 'ORDER BY (name LIKE ?) DESC, name ASC';
        orderParams.push(`${String(q).trim()}%`);
      }

      const whereSql = where.length ? ('WHERE ' + where.join(' AND ')) : '';
      const lim = Math.min(parseInt(limit) || 500, 1000);
      const off = Math.max(parseInt(offset) || 0, 0);

      let total = 0;
      if (!skip_count) {
        const [[cntRow]] = await conn.query(`SELECT COUNT(*) AS total FROM products ${whereSql}`, whereParams);
        total = Number(cntRow.total || 0);
      }

      const params = [...whereParams, ...orderParams];
      let sql = `SELECT ${SELECT_COLS} FROM products ${whereSql} ${order} LIMIT ? OFFSET ?`;
      params.push(lim, off);
      const [rows] = await conn.query(sql, params);
      res.json({ ok: true, items: rows, total });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    } finally {
      if (conn) conn.release();
    }
  });

  app.get('/api/products/:id', async (req, res) => {
    let conn;
    try {
      const { id } = req.params;
      conn = await dbAdapter.getConnection();
      const [rows] = await conn.query('SELECT * FROM products WHERE id=? LIMIT 1', [id]);
      if (!rows.length) {
        return res.status(404).json({ ok: false, error: 'Product not found' });
      }
      res.json({ ok: true, product: rows[0] });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    } finally {
      if (conn) conn.release();
    }
  });

  app.get('/api/products/barcode/:code', async (req, res) => {
    let conn;
    try {
      const { code } = req.params;
      conn = await dbAdapter.getConnection();
      const [rows] = await conn.query('SELECT * FROM products WHERE barcode=? LIMIT 1', [code]);
      if (!rows.length) {
        return res.json({ ok: true, product: null });
      }
      res.json({ ok: true, product: rows[0] });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    } finally {
      if (conn) conn.release();
    }
  });

  app.get('/api/products-images-batch', async (req, res) => {
    let conn;
    try {
      const { ids } = req.query;
      if (!ids) return res.json({ ok: true, images: [] });
      const idArray = String(ids).split(',').map(x => parseInt(x)).filter(x => x > 0);
      if (!idArray.length) return res.json({ ok: true, images: [] });

      conn = await dbAdapter.getConnection();
      const placeholders = idArray.map(() => '?').join(',');
      const [rows] = await conn.query(`SELECT id, image_blob AS image_data, image_mime FROM products WHERE id IN (${placeholders})`, idArray);
      const images = rows.map(r => ({
        id: r.id,
        image_data: r.image_data ? Buffer.from(r.image_data).toString('base64') : null,
        image_mime: r.image_mime || 'image/png',
      }));
      res.json({ ok: true, images });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    } finally {
      if (conn) conn.release();
    }
  });

  app.get('/api/products/:id/image', async (req, res) => {
    let conn;
    try {
      const { id } = req.params;
      conn = await dbAdapter.getConnection();
      const [rows] = await conn.query('SELECT image_blob, image_mime, image_path FROM products WHERE id=? LIMIT 1', [id]);
      if (!rows.length) return res.status(404).end();
      const row = rows[0];
      if (row.image_blob) {
        const mime = row.image_mime || 'image/png';
        res.set('Content-Type', mime);
        return res.send(Buffer.from(row.image_blob));
      }
      if (row.image_path) {
        try {
          const fs = require('fs');
          const path = require('path');
          const absPath = path.isAbsolute(row.image_path) ? row.image_path : path.join(__dirname, '..', '..', row.image_path);
          const buf = fs.readFileSync(absPath);
          const ext = path.extname(row.image_path).toLowerCase().replace('.', '');
          const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext || 'png'}`;
          res.set('Content-Type', mime);
          return res.send(buf);
        } catch(_) { return res.status(404).end(); }
      }
      return res.status(404).end();
    } catch (err) {
      res.status(500).end();
    } finally {
      if (conn) conn.release();
    }
  });

  app.get('/api/products-ops-batch', async (req, res) => {
    let conn;
    try {
      const { ids } = req.query;
      if (!ids) return res.json({ ok: true, operations: [] });
      const idArray = String(ids).split(',').map(x => parseInt(x)).filter(x => x > 0);
      if (!idArray.length) return res.json({ ok: true, operations: [] });

      conn = await dbAdapter.getConnection();
      const placeholders = idArray.map(() => '?').join(',');
      const [rows] = await conn.query(
        `SELECT po.product_id, po.operation_id, po.price, o.name, o.is_active, o.sort_order
         FROM product_operations po
         JOIN operations o ON o.id = po.operation_id
         WHERE po.product_id IN (${placeholders})
         ORDER BY po.product_id ASC, o.sort_order ASC, o.name ASC`,
        idArray
      );
      res.json({ ok: true, operations: rows });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    } finally {
      if (conn) conn.release();
    }
  });

  app.get('/api/prod-ops', async (req, res) => {
    let conn;
    try {
      const { product_id } = req.query;
      if (!product_id) return res.json({ ok: true, items: [] });
      conn = await dbAdapter.getConnection();
      const [rows] = await conn.query(`
        SELECT po.operation_id, po.price, o.name, o.is_active, o.sort_order
        FROM product_operations po
        JOIN operations o ON o.id = po.operation_id
        WHERE po.product_id = ?
        ORDER BY o.sort_order ASC, o.name ASC
      `, [product_id]);
      res.json({ ok: true, items: rows });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    } finally {
      if (conn) conn.release();
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // Customers Endpoints
  // ═══════════════════════════════════════════════════════════════
  app.get('/api/customers', async (req, res) => {
    let conn;
    try {
      const { limit = 20, offset = 0, search } = req.query;
      conn = await dbAdapter.getConnection();
      let sql = 'SELECT * FROM customers WHERE 1=1';
      const params = [];

      if (search) {
        sql += ' AND (name LIKE ? OR phone LIKE ? OR vat_number LIKE ?)';
        const s = `%${search}%`;
        params.push(s, s, s);
      }

      sql += ' ORDER BY id DESC LIMIT ? OFFSET ?';
      params.push(parseInt(limit), parseInt(offset));

      const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) AS total').replace(/ ORDER BY[\s\S]*$/, '');
      const [[countRow]] = await conn.query(countSql, params);
      const [rows] = await conn.query(sql, params);
      res.json({ ok: true, customers: rows, total: Number(countRow.total || 0) });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    } finally {
      if (conn) conn.release();
    }
  });

  app.get('/api/customers/:id', async (req, res) => {
    let conn;
    try {
      const { id } = req.params;
      conn = await dbAdapter.getConnection();
      const [rows] = await conn.query('SELECT * FROM customers WHERE id=? LIMIT 1', [id]);
      if (!rows.length) {
        return res.status(404).json({ ok: false, error: 'Customer not found' });
      }
      res.json({ ok: true, customer: rows[0] });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    } finally {
      if (conn) conn.release();
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // Operations Endpoints
  // ═══════════════════════════════════════════════════════════════
  app.get('/api/operations', async (req, res) => {
    let conn;
    try {
      conn = await dbAdapter.getConnection();
      const [rows] = await conn.query('SELECT * FROM operations ORDER BY id');
      res.json({ ok: true, operations: rows });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    } finally {
      if (conn) conn.release();
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // Types/Categories Endpoints
  // ═══════════════════════════════════════════════════════════════
  app.get('/api/types', async (req, res) => {
    let conn;
    try {
      conn = await dbAdapter.getConnection();
      const [rows] = await conn.query('SELECT id, name FROM main_types WHERE is_active=1 ORDER BY sort_order ASC, name ASC');
      res.json({ ok: true, items: rows });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    } finally {
      if (conn) conn.release();
    }
  });

  app.get('/api/types/for-display', async (req, res) => {
    let conn;
    try {
      conn = await dbAdapter.getConnection();
      const [rows] = await conn.query('SELECT id, name FROM main_types WHERE is_active=1 AND hidden_from_sales=0 ORDER BY sort_order ASC, name ASC');
      res.json({ ok: true, items: rows });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    } finally {
      if (conn) conn.release();
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // Settings Endpoints
  // ═══════════════════════════════════════════════════════════════
  app.get('/api/settings', async (req, res) => {
    let conn;
    try {
      conn = await dbAdapter.getConnection();
      const [rows] = await conn.query('SELECT * FROM app_settings WHERE id=1 LIMIT 1');
      if (!rows.length) {
        return res.json({ ok: true, settings: {} });
      }
      const item = rows[0];
      // Normalize support_end_date to YYYY-MM-DD (MySQL may return datetime/Buffer)
      if (item.support_end_date !== null && item.support_end_date !== undefined) {
        const raw = String(item.support_end_date).trim();
        if (raw) {
          try {
            const d = new Date(raw);
            if (!isNaN(d)) item.support_end_date = d.toISOString().slice(0, 10);
          } catch (_) { item.support_end_date = raw; }
        } else { item.support_end_date = null; }
      }
      // Normalize boolean/toggle fields so secondary device reads them as 0/1
      const boolFields = [
        'show_shifts', 'show_appointments', 'show_whatsapp_controls',
        'weight_mode_enabled', 'electronic_scale_enabled', 'silent_print',
        'prices_include_vat', 'allow_sell_zero_stock', 'allow_negative_inventory',
        'op_price_manual', 'cart_separate_duplicate_lines', 'zatca_enabled',
        'hide_product_images', 'show_quotation_button', 'show_selling_units',
        'show_employee_selector', 'show_cart_item_description', 'show_held_available_columns', 'quotation_hide_prices', 'recovery_unlocked', 'require_payment_before_print',
        'daily_email_enabled', 'db_backup_enabled', 'db_backup_local_enabled',
        'smtp_secure', 'show_trial_notice', 'show_email_in_invoice', 'show_barcode_in_a4',
        'print_show_change', 'allow_discount', 'barcode_show_shop_name',
        'barcode_show_product_name', 'barcode_show_price', 'barcode_show_barcode_text',
      ];
      boolFields.forEach(f => {
        if (f in item) item[f] = item[f] ? 1 : 0;
      });
      // Normalize payment_methods to array
      try {
        if (item.payment_methods && typeof item.payment_methods === 'string') {
          item.payment_methods = JSON.parse(item.payment_methods);
        } else if (!Array.isArray(item.payment_methods)) {
          item.payment_methods = [];
        }
      } catch (_) { item.payment_methods = []; }
      item.international_transport_zero_rate_enabled = item.international_transport_zero_rate_enabled ? 1 : 0;
      item.international_transport_zero_rate_can_mutate = false;
      res.json({ ok: true, settings: item });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    } finally {
      if (conn) conn.release();
    }
  });

  app.post('/api/settings', async (req, res) => {
    let conn;
    try {
      const p = req.body || {};
      conn = await dbAdapter.getConnection();
      const [curRows] = await conn.query('SELECT whatsapp_on_print, show_whatsapp_controls, support_end_date FROM app_settings WHERE id=1 LIMIT 1');
      const cur = curRows[0] || {};
      const hasOwn = (obj, k) => Object.prototype.hasOwnProperty.call(obj, k);
      const wop = hasOwn(p, 'whatsapp_on_print') ? (p.whatsapp_on_print ? 1 : 0) : (cur.whatsapp_on_print ? 1 : 0);
      const showW = hasOwn(p, 'show_whatsapp_controls') ? (p.show_whatsapp_controls ? 1 : 0) : (cur.show_whatsapp_controls ? 1 : 0);
      const methods = Array.isArray(p.payment_methods) ? JSON.stringify(p.payment_methods) : null;
      let supportEndToSave = cur.support_end_date || null;
      if (hasOwn(p, 'support_end_date')) {
        const raw = String(p.support_end_date || '').trim();
        if (raw) {
          const m = raw.match(/^(\d{4})[-\/.](\d{2})[-\/.](\d{2})$/);
          if (m) supportEndToSave = `${m[1]}-${m[2]}-${m[3]}`;
          else { try { const d = new Date(raw); if (!isNaN(d)) supportEndToSave = d.toISOString().slice(0,10); } catch(_){} }
        } else { supportEndToSave = null; }
      }
      await conn.query(`UPDATE app_settings SET
        seller_legal_name=?, seller_legal_name_en=?, seller_vat_number=?, company_site=?,
        company_location=?, company_location_en=?, mobile=?, email=?, show_email_in_invoice=?,
        logo_path=?, vat_percent=?, prices_include_vat=?, cost_includes_vat=?, payment_methods=?,
        default_payment_method=?, currency_code=?, currency_symbol=?, currency_symbol_position=?,
        app_locale=?, default_print_format=?, print_copies=?, silent_print=?, print_show_change=?,
        show_barcode_in_a4=?, unit_price_label=?, quantity_label=?, op_price_manual=?,
        allow_sell_zero_stock=?, allow_negative_inventory=?, cart_separate_duplicate_lines=?,
        logo_width_px=?, logo_height_px=?, invoice_footer_note=?, hide_product_images=?,
        closing_hour=?, zatca_enabled=?, recovery_unlocked=?,
        tobacco_fee_percent=?, tobacco_min_fee_amount=?,
        daily_email_enabled=?, daily_email_time=?, db_backup_enabled=?, db_backup_time=?,
        db_backup_local_enabled=?, db_backup_local_time=?, db_backup_local_path=?,
        smtp_host=?, smtp_port=?, smtp_secure=?, smtp_user=?, smtp_pass=?,
        support_end_date=?, whatsapp_on_print=?, whatsapp_auto_connect=?, whatsapp_message=?,
        commercial_register=?, national_number=?, show_whatsapp_controls=?,
        print_margin_right_mm=?, print_margin_left_mm=?,
        low_stock_threshold=?, show_low_stock_alerts=?, low_stock_email_enabled=?,
        low_stock_email_per_item=?, low_stock_email_cooldown_hours=?,
        weight_mode_enabled=?, electronic_scale_enabled=?, electronic_scale_type=?,
        show_quotation_button=?, show_selling_units=?, show_employee_selector=?,
        show_cart_item_description=?, show_held_available_columns=?, quotation_hide_prices=?,
        require_payment_before_print=?, require_customer_before_print=?, require_phone_min_10=?,
        customer_display_enabled=?, customer_display_simulator=?, customer_display_port=?,
        customer_display_baud_rate=?, customer_display_columns=?, customer_display_rows=?,
        customer_display_protocol=?, customer_display_encoding=?, customer_display_brightness=?,
        customer_display_welcome_msg=?, customer_display_thankyou_msg=?,
        appointment_reminder_minutes=?, app_theme=?,
        barcode_printer_device_name=?, barcode_paper_width_mm=?, barcode_paper_height_mm=?,
        barcode_show_shop_name=?, barcode_show_product_name=?, barcode_show_price=?,
        barcode_show_barcode_text=?, barcode_font_size_shop=?, barcode_font_size_product=?,
        barcode_font_size_price=?, barcode_font_size_barcode_text=?,
        barcode_height_px=?, barcode_label_offset_right_mm=?, barcode_label_offset_left_mm=?,
        barcode_label_offset_top_mm=?, barcode_label_offset_bottom_mm=?,
        branch_name=?, show_shifts=?, show_appointments=?
        WHERE id=1`,
        [
          p.seller_legal_name||null, p.seller_legal_name_en||null, p.seller_vat_number||null,
          p.company_site||null, p.company_location||null, p.company_location_en||null,
          p.mobile||null, p.email||null, p.show_email_in_invoice ? 1 : 0,
          p.logo_path||null,
          (p.vat_percent===''||p.vat_percent===null||p.vat_percent===undefined) ? 15.00 : Number(p.vat_percent),
          p.prices_include_vat ? 1 : 0,
          p.cost_includes_vat ? 1 : 0,
          methods,
          p.default_payment_method||null,
          p.currency_code||'SAR', p.currency_symbol||'﷼', p.currency_symbol_position||'after',
          p.app_locale||'ar', p.default_print_format||'thermal', Math.max(1, Number(p.print_copies||1)),
          p.silent_print ? 1 : 0, p.print_show_change===0 ? 0 : 1,
          p.show_barcode_in_a4 ? 1 : 0, p.unit_price_label||'سعر القطعة',
          p.quantity_label||'عدد', p.op_price_manual ? 1 : 0,
          p.allow_sell_zero_stock ? 1 : 0, p.allow_negative_inventory ? 1 : 0,
          p.cart_separate_duplicate_lines ? 1 : 0,
          Number(p.logo_width_px)||null, Number(p.logo_height_px)||null,
          p.invoice_footer_note||null, p.hide_product_images ? 1 : 0,
          p.closing_hour ? String(p.closing_hour).slice(0,5)+':00' : null,
          p.zatca_enabled ? 1 : 0, p.recovery_unlocked ? 1 : 0,
          (p.tobacco_fee_percent===''||p.tobacco_fee_percent===null||p.tobacco_fee_percent===undefined) ? null : Number(p.tobacco_fee_percent),
          (p.tobacco_min_fee_amount===''||p.tobacco_min_fee_amount===null||p.tobacco_min_fee_amount===undefined) ? null : Number(p.tobacco_min_fee_amount),
          p.daily_email_enabled ? 1 : 0, p.daily_email_time ? String(p.daily_email_time).slice(0,5)+':00' : null,
          p.db_backup_enabled ? 1 : 0, p.db_backup_time ? String(p.db_backup_time).slice(0,5)+':00' : null,
          p.db_backup_local_enabled ? 1 : 0, p.db_backup_local_time ? String(p.db_backup_local_time).slice(0,5)+':00' : null,
          p.db_backup_local_path||null,
          p.smtp_host||null, p.smtp_port ? Number(p.smtp_port) : null,
          p.smtp_secure ? 1 : 0, p.smtp_user||null, p.smtp_pass||null,
          supportEndToSave, wop,
          p.whatsapp_auto_connect ? 1 : 0, p.whatsapp_message||null,
          p.commercial_register||null, p.national_number||null, showW,
          (p.print_margin_right_mm===''||p.print_margin_right_mm===null||p.print_margin_right_mm===undefined) ? null : Number(p.print_margin_right_mm),
          (p.print_margin_left_mm===''||p.print_margin_left_mm===null||p.print_margin_left_mm===undefined) ? null : Number(p.print_margin_left_mm),
          Math.max(0, Number(p.low_stock_threshold===''||p.low_stock_threshold===null||p.low_stock_threshold===undefined ? 5 : p.low_stock_threshold)),
          p.show_low_stock_alerts ? 1 : 0, p.low_stock_email_enabled ? 1 : 0,
          p.low_stock_email_per_item ? 1 : 0,
          Math.max(1, Number(p.low_stock_email_cooldown_hours===''||p.low_stock_email_cooldown_hours===null||p.low_stock_email_cooldown_hours===undefined ? 24 : p.low_stock_email_cooldown_hours)),
          p.weight_mode_enabled ? 1 : 0, p.electronic_scale_enabled ? 1 : 0,
          p.electronic_scale_type==='price' ? 'price' : 'weight',
          p.show_quotation_button ? 1 : 0, p.show_selling_units ? 1 : 0, p.show_employee_selector ? 1 : 0,
          p.show_cart_item_description ? 1 : 0, p.show_held_available_columns ? 1 : 0, p.quotation_hide_prices ? 1 : 0,
          p.require_payment_before_print ? 1 : 0, p.require_customer_before_print ? 1 : 0, p.require_phone_min_10 ? 1 : 0,
          p.customer_display_enabled ? 1 : 0, p.customer_display_simulator ? 1 : 0,
          p.customer_display_port||null, p.customer_display_baud_rate ? Number(p.customer_display_baud_rate) : 9600,
          p.customer_display_columns ? Number(p.customer_display_columns) : 20,
          p.customer_display_rows ? Number(p.customer_display_rows) : 2,
          p.customer_display_protocol||'escpos', p.customer_display_encoding||'windows-1256',
          p.customer_display_brightness ? Number(p.customer_display_brightness) : 100,
          p.customer_display_welcome_msg||'مرحباً بك', p.customer_display_thankyou_msg||'شكراً لزيارتك',
          p.appointment_reminder_minutes!==undefined ? Number(p.appointment_reminder_minutes) : 15,
          p.app_theme && ['light','gray','dark','auto'].includes(p.app_theme) ? p.app_theme : 'light',
          p.barcode_printer_device_name||null,
          (p.barcode_paper_width_mm===''||p.barcode_paper_width_mm===null||p.barcode_paper_width_mm===undefined) ? null : Number(p.barcode_paper_width_mm),
          (p.barcode_paper_height_mm===''||p.barcode_paper_height_mm===null||p.barcode_paper_height_mm===undefined) ? null : Number(p.barcode_paper_height_mm),
          p.barcode_show_shop_name ? 1 : 0, p.barcode_show_product_name ? 1 : 0,
          p.barcode_show_price ? 1 : 0, p.barcode_show_barcode_text ? 1 : 0,
          p.barcode_font_size_shop ? Number(p.barcode_font_size_shop) : 12,
          p.barcode_font_size_product ? Number(p.barcode_font_size_product) : 12,
          p.barcode_font_size_price ? Number(p.barcode_font_size_price) : 12,
          p.barcode_font_size_barcode_text ? Number(p.barcode_font_size_barcode_text) : 10,
          p.barcode_height_px ? Number(p.barcode_height_px) : 40,
          (p.barcode_label_offset_right_mm!==undefined && p.barcode_label_offset_right_mm!==null && p.barcode_label_offset_right_mm!=='') ? Number(p.barcode_label_offset_right_mm) : 0,
          (p.barcode_label_offset_left_mm!==undefined && p.barcode_label_offset_left_mm!==null && p.barcode_label_offset_left_mm!=='') ? Number(p.barcode_label_offset_left_mm) : 0,
          (p.barcode_label_offset_top_mm!==undefined && p.barcode_label_offset_top_mm!==null && p.barcode_label_offset_top_mm!=='') ? Number(p.barcode_label_offset_top_mm) : 0,
          (p.barcode_label_offset_bottom_mm!==undefined && p.barcode_label_offset_bottom_mm!==null && p.barcode_label_offset_bottom_mm!=='') ? Number(p.barcode_label_offset_bottom_mm) : 0,
          p.branch_name||null, p.show_shifts ? 1 : 0, p.show_appointments ? 1 : 0
        ]
      );
      // Handle logo updates (DB BLOB)
      if(p && p.logo_clear === true){
        await conn.query('UPDATE app_settings SET logo_blob=NULL, logo_mime=NULL, logo_path=NULL WHERE id=1');
      } else if(p && p.logo_blob_base64){
        try{
          const buf = Buffer.from(p.logo_blob_base64, 'base64');
          const mime = p.logo_mime || 'image/png';
          await conn.query('UPDATE app_settings SET logo_blob=?, logo_mime=?, logo_path=NULL WHERE id=1', [buf, mime]);
        }catch(_){ /* ignore malformed base64 */ }
      }
      // Handle default product image updates
      if(p && p.default_product_img_clear === true){
        await conn.query('UPDATE app_settings SET default_product_img_blob=NULL, default_product_img_mime=NULL WHERE id=1');
      } else if(p && p.default_product_img_blob_base64){
        try{
          const buf2 = Buffer.from(p.default_product_img_blob_base64, 'base64');
          const mime2 = p.default_product_img_mime || 'image/png';
          await conn.query('UPDATE app_settings SET default_product_img_blob=?, default_product_img_mime=? WHERE id=1', [buf2, mime2]);
        }catch(_){ /* ignore malformed base64 */ }
      }
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    } finally {
      if (conn) conn.release();
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // Offers Endpoints
  // ═══════════════════════════════════════════════════════════════
  app.get('/api/offers', async (req, res) => {
    let conn;
    try {
      conn = await dbAdapter.getConnection();
      const [rows] = await conn.query('SELECT * FROM offers ORDER BY id DESC');
      res.json({ ok: true, offers: rows });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    } finally {
      if (conn) conn.release();
    }
  });

  app.get('/api/offers/global-active', async (req, res) => {
    let conn;
    try {
      conn = await dbAdapter.getConnection();
      const nowCond = ' (start_date IS NULL OR NOW() >= start_date) AND (end_date IS NULL OR NOW() <= end_date) ';
      const [rows] = await conn.query(`SELECT * FROM offers WHERE is_global=1 AND is_active=1 AND ${nowCond} ORDER BY id DESC LIMIT 1`);
      res.json({ ok: true, item: rows && rows[0] ? rows[0] : null });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    } finally {
      if (conn) conn.release();
    }
  });

  app.get('/api/offers/for-product', async (req, res) => {
    let conn;
    try {
      const product_id = Number(req.query.product_id);
      const operation_id = req.query.operation_id != null && req.query.operation_id !== '' ? Number(req.query.operation_id) : null;
      if (!product_id) return res.json({ ok: true, item: null });
      conn = await dbAdapter.getConnection();
      const nowCond = ' (o.start_date IS NULL OR NOW() >= o.start_date) AND (o.end_date IS NULL OR NOW() <= o.end_date) ';
      const [rows] = await conn.query(`
        SELECT o.* FROM offers o
        LEFT JOIN offer_products op ON op.offer_id = o.id
        WHERE (o.is_global = 1 OR (op.product_id = ? AND (op.operation_id IS NULL OR op.operation_id = ?)))
          AND o.is_active = 1 AND ${nowCond}
          AND NOT EXISTS (
            SELECT 1 FROM offer_excluded_products ep
            WHERE ep.offer_id = o.id
            AND ep.product_id = ?
            AND (ep.operation_id IS NULL OR ep.operation_id <=> ?)
          )
        ORDER BY o.is_global ASC, o.id DESC
        LIMIT 1
      `, [product_id, operation_id, product_id, operation_id]);
      res.json({ ok: true, item: rows && rows[0] ? rows[0] : null });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    } finally {
      if (conn) conn.release();
    }
  });

  app.get('/api/cust-price/find', async (req, res) => {
    let conn;
    try {
      const customer_id = Number(req.query.customer_id);
      const product_id = Number(req.query.product_id);
      const operation_id = req.query.operation_id ? Number(req.query.operation_id) : null;
      if (!customer_id || !product_id) return res.json({ ok: false, error: 'بيانات ناقصة' });
      conn = await dbAdapter.getConnection();
      let basePrice = 0;
      if (operation_id != null) {
        const [[po]] = await conn.query('SELECT price FROM product_operations WHERE product_id=? AND operation_id=? LIMIT 1', [product_id, operation_id]);
        if (po) basePrice = Number(po.price || 0);
      }
      if (!basePrice) {
        const [[prod]] = await conn.query('SELECT price FROM products WHERE id=? LIMIT 1', [product_id]);
        basePrice = prod ? Number(prod.price || 0) : 0;
      }
      const [rules] = await conn.query(`
        SELECT * FROM customer_pricing
        WHERE customer_id=? AND product_id=? AND is_active=1
        ORDER BY (operation_id IS NOT NULL AND operation_id=?) DESC, id DESC
        LIMIT 5
      `, [customer_id, product_id, operation_id]);
      let finalPrice = null;
      for (const rule of rules) {
        if (rule.operation_id != null && rule.operation_id !== operation_id) continue;
        if (rule.price_type === 'fixed') { finalPrice = Number(rule.price_value); break; }
        if (rule.price_type === 'percent_off') { finalPrice = basePrice * (1 - Number(rule.price_value) / 100); break; }
        if (rule.price_type === 'amount_off') { finalPrice = basePrice - Number(rule.price_value); break; }
      }
      res.json({ ok: true, price: finalPrice, base_price: basePrice });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    } finally {
      if (conn) conn.release();
    }
  });

  app.get('/api/sales-init', async (req, res) => {
    let conn;
    try {
      const { sort = 'custom', limit = 48, category } = req.query;
      conn = await dbAdapter.getConnection();
      const SELECT_COLS = `id,name,name_en,barcode,price,min_price,cost,stock,category,is_tobacco,is_international_transport_service,is_active,hide_from_sales,sort_order,allow_manual_price,(image_blob IS NOT NULL OR (image_path IS NOT NULL AND image_path != '')) AS has_image`;
      const prodWhere = ['is_active=1', 'hide_from_sales=0'];
      const prodParams = [];
      if (category) { prodWhere.push('category=?'); prodParams.push(category); }
      const whereSql = 'WHERE ' + prodWhere.join(' AND ');
      let order = 'ORDER BY sort_order ASC, is_active DESC, name ASC';
      if (sort === 'name_asc') order = 'ORDER BY name ASC';
      else if (sort === 'price_asc') order = 'ORDER BY price ASC';
      else if (sort === 'price_desc') order = 'ORDER BY price DESC';
      const lim = Math.min(parseInt(limit) || 48, 200);
      const nowCond = '(start_date IS NULL OR NOW() >= start_date) AND (end_date IS NULL OR NOW() <= end_date)';

      const [[settingsRow], [types], [typesDisplay], [products], [globalOfferRows]] = await Promise.all([
        conn.query('SELECT * FROM app_settings WHERE id=1 LIMIT 1'),
        conn.query('SELECT id, name FROM main_types WHERE is_active=1 ORDER BY sort_order ASC, name ASC'),
        conn.query('SELECT id, name FROM main_types WHERE is_active=1 AND hidden_from_sales=0 ORDER BY sort_order ASC, name ASC'),
        conn.query(`SELECT ${SELECT_COLS} FROM products ${whereSql} ${order} LIMIT ?`, [...prodParams, lim]),
        conn.query(`SELECT * FROM offers WHERE is_global=1 AND is_active=1 AND ${nowCond} ORDER BY id DESC LIMIT 1`),
      ]);
      const settings = (settingsRow && settingsRow[0]) || {};
      settings.international_transport_zero_rate_enabled = settings.international_transport_zero_rate_enabled ? 1 : 0;
      settings.international_transport_zero_rate_can_mutate = false;
      try {
        if (typeof settings.payment_methods === 'string') settings.payment_methods = JSON.parse(settings.payment_methods);
        if (!Array.isArray(settings.payment_methods)) settings.payment_methods = [];
      } catch (_) { settings.payment_methods = []; }
      res.json({
        ok: true,
        settings,
        types: types,
        types_for_display: typesDisplay,
        products: products,
        products_total: null,
        global_offer: (globalOfferRows && globalOfferRows[0]) || null,
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    } finally {
      if (conn) conn.release();
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // POST /api/invoices — create invoice (secondary device route)
  // ═══════════════════════════════════════════════════════════════
  app.post('/api/invoices', async (req, res) => {
    const p = req.body || {};
    if (!Array.isArray(p.items) || p.items.length === 0) return res.status(400).json({ ok: false, error: 'لا توجد عناصر' });
    if (!p.payment_method) return res.status(400).json({ ok: false, error: 'طريقة الدفع مطلوبة' });
    if (p.tax_treatment === 'international_transport_zero_rate') {
      return res.status(403).json({ ok: false, error: 'PRIMARY_DEVICE_REQUIRED' });
    }
    let conn;
    try {
      conn = await dbAdapter.getConnection();

      let allowZero = 0;
      try {
        const [[s]] = await conn.query('SELECT allow_sell_zero_stock FROM app_settings WHERE id=1');
        allowZero = s ? Number(s.allow_sell_zero_stock || 0) : 0;
      } catch (_) { allowZero = 0; }

      await conn.beginTransaction();

      for (const it of p.items) {
        const pid = Number(it.product_id || 0);
        const qtyDisplay = Number(it.qty || 1);
        const unitMult = (it.unit_multiplier != null) ? Number(it.unit_multiplier || 1) : 1;
        let variantMult = 1;
        try {
          const vid = Number(it.variant_id || 0);
          if (vid) {
            const [[vr]] = await conn.query('SELECT stock_deduct_multiplier FROM product_variants WHERE id=? LIMIT 1', [vid]);
            if (vr && vr.stock_deduct_multiplier != null) {
              const m = Number(vr.stock_deduct_multiplier);
              variantMult = (Number.isFinite(m) && m > 0) ? m : 1;
            }
          }
        } catch (_) { }
        const qtyBase = Number((qtyDisplay * unitMult * variantMult).toFixed(3));
        if (!pid || qtyBase <= 0) continue;
        const [[prod]] = await conn.query('SELECT id, stock FROM products WHERE id=? FOR UPDATE', [pid]);
        if (!prod) { await conn.rollback(); return res.json({ ok: false, error: `المنتج غير موجود (ID ${pid})` }); }
        const cur = Number(prod.stock || 0);
        if (!allowZero && (cur - qtyBase) < 0) {
          await conn.rollback();
          return res.json({ ok: false, error: `لا يمكن إتمام البيع لعدم كفاية المخزون: ID ${pid} (المتاح ${cur} / المطلوب ${qtyBase})` });
        }
        await conn.query('UPDATE products SET stock = stock - ? WHERE id=?', [qtyBase, pid]);
      }

      if (!__apiSaleColumnsEnsured) {
        const checks = [
          ["SHOW COLUMNS FROM sales LIKE 'extra_value'", "ALTER TABLE sales ADD COLUMN extra_value DECIMAL(12,2) NULL AFTER sub_total"],
          ["SHOW COLUMNS FROM sales LIKE 'coupon_code'", "ALTER TABLE sales ADD COLUMN coupon_code VARCHAR(64) NULL AFTER discount_amount"],
          ["SHOW COLUMNS FROM sales LIKE 'coupon_mode'", "ALTER TABLE sales ADD COLUMN coupon_mode VARCHAR(16) NULL AFTER coupon_code"],
          ["SHOW COLUMNS FROM sales LIKE 'coupon_value'", "ALTER TABLE sales ADD COLUMN coupon_value DECIMAL(12,2) NULL AFTER coupon_mode"],
          ["SHOW COLUMNS FROM sales LIKE 'global_offer_mode'", "ALTER TABLE sales ADD COLUMN global_offer_mode VARCHAR(16) NULL AFTER coupon_value"],
          ["SHOW COLUMNS FROM sales LIKE 'global_offer_value'", "ALTER TABLE sales ADD COLUMN global_offer_value DECIMAL(12,2) NULL AFTER global_offer_mode"],
          ["SHOW COLUMNS FROM sales LIKE 'tobacco_fee'", "ALTER TABLE sales ADD COLUMN tobacco_fee DECIMAL(12,2) NULL AFTER extra_value"],
          ["SHOW COLUMNS FROM sales LIKE 'driver_id'", "ALTER TABLE sales ADD COLUMN driver_id INT NULL AFTER customer_vat"],
          ["SHOW COLUMNS FROM sales LIKE 'driver_name'", "ALTER TABLE sales ADD COLUMN driver_name VARCHAR(255) NULL AFTER driver_id"],
          ["SHOW COLUMNS FROM sales LIKE 'driver_phone'", "ALTER TABLE sales ADD COLUMN driver_phone VARCHAR(64) NULL AFTER driver_name"],
          ["SHOW COLUMNS FROM sales_items LIKE 'operation_id'", "ALTER TABLE sales_items ADD COLUMN operation_id INT NULL AFTER line_total"],
          ["SHOW COLUMNS FROM sales_items LIKE 'operation_name'", "ALTER TABLE sales_items ADD COLUMN operation_name VARCHAR(128) NULL AFTER operation_id"],
        ];
        for (const [showSql, alterSql] of checks) {
          const [col] = await conn.query(showSql);
          if (!col.length) await conn.query(alterSql);
        }
        __apiSaleColumnsEnsured = true;
      }

      const seq = await _apiGetNextSeq(conn);
      const orderNo = await _apiGetNextOrderNo(conn);

      let snapName = p.customer_name || null, snapPhone = null, snapVat = null, snapEmail = null;
      let snapAddress = null, snapCR = null, snapNatAddr = null, snapPostal = null, snapStreet = null, snapSub = null, snapNotes = null;
      if (p.customer_id) {
        try {
          const [[cust]] = await conn.query('SELECT name,phone,vat_number,email,address,cr_number,national_address,postal_code,street_number,sub_number,notes FROM customers WHERE id=? LIMIT 1', [p.customer_id]);
          if (cust) {
            if (!snapName) snapName = cust.name || null;
            snapPhone = cust.phone || null; snapVat = cust.vat_number || null; snapEmail = cust.email || null;
            snapAddress = cust.address || null; snapCR = cust.cr_number || null; snapNatAddr = cust.national_address || null;
            snapPostal = cust.postal_code || null; snapStreet = cust.street_number || null; snapSub = cust.sub_number || null; snapNotes = cust.notes || null;
          }
        } catch (_) { }
      }

      let drvId = p.driver_id || null, drvName = null, drvPhone = null;
      if (p.driver_id) {
        try {
          const [[drv]] = await conn.query('SELECT id,name,phone FROM drivers WHERE id=? LIMIT 1', [Number(p.driver_id)]);
          if (drv) { drvName = drv.name || null; drvPhone = drv.phone || null; }
        } catch (_) { }
      }

      let finalInvoiceNo = _apiGenInvoiceNo(seq);
      let attempts = 0;
      while (attempts < 50) {
        const [[ex]] = await conn.query('SELECT id FROM sales WHERE invoice_no=? LIMIT 1', [finalInvoiceNo]);
        if (!ex) break;
        attempts++;
        finalInvoiceNo = _apiGenInvoiceNo(await _apiGetNextSeq(conn));
      }
      if (attempts >= 50) { await conn.rollback(); return res.json({ ok: false, error: 'فشل توليد رقم فاتورة فريد' }); }

      let shiftId = (p.shift_id != null ? Number(p.shift_id) : null);
      if (!shiftId && p.created_by_user_id) {
        try {
          const [[os]] = await conn.query('SELECT id FROM shifts WHERE user_id=? AND status="open" ORDER BY opened_at DESC LIMIT 1', [p.created_by_user_id]);
          if (os) shiftId = os.id;
        } catch (_) { }
      }

      const payStatus = (String(p.payment_method).toLowerCase() === 'credit') ? 'unpaid' : 'paid';

      const [insRes] = await conn.query(
        `INSERT INTO sales (shift_id,invoice_no,order_no,created_by_user_id,created_by_username,customer_id,customer_name,customer_phone,customer_vat,customer_email,customer_address,customer_cr_number,customer_national_address,customer_postal_code,customer_street_number,customer_sub_number,customer_notes,driver_id,driver_name,driver_phone,payment_method,payment_status,sub_total,extra_value,tobacco_fee,vat_total,grand_total,total_after_discount,notes,discount_type,discount_value,discount_amount,coupon_code,coupon_mode,coupon_value,global_offer_mode,global_offer_value,pay_cash_amount,pay_card_amount) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          shiftId, finalInvoiceNo, Number(orderNo || 1),
          (p.created_by_user_id != null ? Number(p.created_by_user_id) : null), (p.created_by_username || null),
          (p.customer_id || null), snapName, snapPhone, snapVat, snapEmail, snapAddress, snapCR, snapNatAddr, snapPostal, snapStreet, snapSub, snapNotes,
          drvId, drvName, drvPhone,
          p.payment_method, payStatus,
          Number(p.sub_total || 0),
          (p.extra_value != null ? Number(p.extra_value) : null),
          (p.tobacco_fee != null ? Number(p.tobacco_fee) : null),
          Number(p.vat_total || 0), Number(p.grand_total || 0),
          (p.sub_after_discount != null ? Number(p.sub_after_discount) : null),
          p.notes || null,
          (p.discount_type || null),
          (p.discount_value != null ? Number(p.discount_value) : null),
          (p.discount_amount != null ? Number(p.discount_amount) : null),
          (p.coupon?.code || null), (p.coupon?.mode || null), (p.coupon?.value != null ? Number(p.coupon.value) : null),
          (p.global_offer?.mode || null), (p.global_offer?.value != null ? Number(p.global_offer.value) : null),
          (p.pay_cash_amount != null ? Number(p.pay_cash_amount) : null),
          (p.pay_card_amount != null ? Number(p.pay_card_amount) : null),
        ]
      );
      const saleId = insRes.insertId;

      const items = p.items.map(it => [
        saleId, it.product_id, it.name, (it.description || null), (it.unit_name || null),
        Number(it.unit_multiplier ?? 1), Number(it.price || 0), Number(it.qty || 1),
        Number(it.line_total || 0), (it.operation_id || null), (it.operation_name || null), (it.employee_id || null)
      ]);
      if (items.length) {
        await conn.query(`INSERT INTO sales_items (sale_id,product_id,name,description,unit_name,unit_multiplier,price,qty,line_total,operation_id,operation_name,employee_id) VALUES ?`, [items]);
      }

      if (shiftId) {
        try {
          const grandTotal = Number(p.grand_total || 0);
          let cashAmount = 0, cardAmount = 0;
          if (p.payment_method === 'cash') cashAmount = grandTotal;
          else if (['card','tamara','tabby','bank_transfer'].includes(p.payment_method)) cardAmount = grandTotal;
          else if (p.payment_method === 'mixed') { cashAmount = Number(p.pay_cash_amount || 0); cardAmount = Number(p.pay_card_amount || 0); }
          await conn.query(`UPDATE shifts SET total_invoices=total_invoices+1,total_sales=total_sales+?,cash_sales=cash_sales+?,card_sales=card_sales+? WHERE id=?`, [grandTotal, cashAmount, cardAmount, shiftId]);
        } catch (_) { }
      }

      await conn.commit();
      res.json({ ok: true, invoice_no: finalInvoiceNo, sale_id: saleId, order_no: Number(orderNo || 1) });
    } catch (err) {
      try { if (conn) await conn.rollback(); } catch (_) { }
      res.status(500).json({ ok: false, error: err.message });
    } finally {
      if (conn) conn.release();
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // Drivers Endpoints
  // ═══════════════════════════════════════════════════════════════
  app.get('/api/drivers', async (req, res) => {
    let conn;
    try {
      const { only_active, term } = req.query;
      conn = await dbAdapter.getConnection();
      const terms = []; const params = [];
      if (only_active === '1' || only_active === 'true') { terms.push('active=1'); }
      if (term) { terms.push('(name LIKE ? OR phone LIKE ?)'); const t = `%${term}%`; params.push(t, t); }
      const where = terms.length ? ('WHERE ' + terms.join(' AND ')) : '';
      const [rows] = await conn.query(`SELECT * FROM drivers ${where} ORDER BY id DESC`, params);
      res.json({ ok: true, items: rows });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    } finally {
      if (conn) conn.release();
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // Employees Endpoints
  // ═══════════════════════════════════════════════════════════════
  app.get('/api/employees', async (req, res) => {
    let conn;
    try {
      const { term } = req.query;
      conn = await dbAdapter.getConnection();
      const terms = []; const params = [];
      if (term) { terms.push('name LIKE ?'); params.push(`%${term}%`); }
      const where = terms.length ? ('WHERE ' + terms.join(' AND ')) : '';
      const [rows] = await conn.query(`SELECT * FROM employees ${where} ORDER BY id DESC`, params);
      res.json({ ok: true, items: rows });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    } finally {
      if (conn) conn.release();
    }
  });

  app.put('/api/invoices/:id/employees', async (req, res) => {
    let conn;
    try {
      const { id } = req.params;
      const { items } = req.body || {};
      if (!items || !items.length) {
        return res.status(400).json({ ok: false, error: 'بيانات ناقصة' });
      }
      conn = await dbAdapter.getConnection();
      const [[sale]] = await conn.query('SELECT id FROM sales WHERE id=? LIMIT 1', [id]);
      if (!sale) {
        return res.status(404).json({ ok: false, error: 'الفاتورة غير موجودة' });
      }
      await conn.beginTransaction();
      for (const it of items) {
        const employeeId = (it.employee_id != null && it.employee_id !== '') ? Number(it.employee_id) : null;
        await conn.query(
          'UPDATE sales_items SET employee_id=? WHERE id=? AND sale_id=?',
          [employeeId, Number(it.id), id]
        );
      }
      await conn.commit();
      res.json({ ok: true, message: 'تم تعديل الموظفين بنجاح' });
    } catch (err) {
      if (conn) { try { await conn.rollback(); } catch (_) {} }
      res.status(500).json({ ok: false, error: err.message });
    } finally {
      if (conn) conn.release();
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // Shifts Endpoints
  // ═══════════════════════════════════════════════════════════════
  app.get('/api/shifts/open-any', async (req, res) => {
    let conn;
    try {
      conn = await dbAdapter.getConnection();
      const [rows] = await conn.query(`SELECT * FROM shifts WHERE status='open' ORDER BY opened_at DESC LIMIT 1`);
      res.json({ ok: true, shift: rows[0] || null });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    } finally {
      if (conn) conn.release();
    }
  });

  app.get('/api/shifts/current', async (req, res) => {
    let conn;
    try {
      const userId = Number(req.query.user_id || 0);
      conn = await dbAdapter.getConnection();
      const [rows] = await conn.query(
        `SELECT * FROM shifts WHERE user_id=? AND status='open' ORDER BY opened_at DESC LIMIT 1`,
        [userId]
      );
      res.json({ ok: true, shift: rows[0] || null });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    } finally {
      if (conn) conn.release();
    }
  });

  app.post('/api/shifts/open', async (req, res) => {
    let conn;
    try {
      const { userId, username, openingCash, openingNotes } = req.body || {};
      conn = await dbAdapter.getConnection();
      const [existing] = await conn.query(`SELECT id FROM shifts WHERE user_id=? AND status='open'`, [userId]);
      if (existing.length > 0) return res.json({ ok: false, error: 'يوجد وردية مفتوحة بالفعل' });
      const [[maxRow]] = await conn.query(`SELECT COALESCE(MAX(CAST(shift_no AS UNSIGNED)),0) AS m FROM shifts WHERE shift_no REGEXP '^[0-9]+$'`);
      const shiftNo = String((Number(maxRow.m || 0)) + 1);
      const now = new Date();
      const nowStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
      const [result] = await conn.query(
        `INSERT INTO shifts (shift_no, user_id, username, opening_cash, opening_notes, status, opened_at, total_invoices, total_sales, cash_sales, card_sales) VALUES (?,?,?,?,?,'open',?,0,0,0,0)`,
        [shiftNo, userId, username, openingCash || 0, openingNotes || null, nowStr]
      );
      const [[shift]] = await conn.query(`SELECT * FROM shifts WHERE id=?`, [result.insertId]);
      res.json({ ok: true, shift });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    } finally {
      if (conn) conn.release();
    }
  });

  app.post('/api/shifts/:id/close', async (req, res) => {
    let conn;
    try {
      const shiftId = Number(req.params.id);
      const { closingCash, closingNotes } = req.body || {};
      conn = await dbAdapter.getConnection();
      const [[shift]] = await conn.query(`SELECT * FROM shifts WHERE id=? AND status='open' LIMIT 1`, [shiftId]);
      if (!shift) return res.json({ ok: false, error: 'الوردية غير موجودة أو مغلقة بالفعل' });
      const [salesRows] = await conn.query(
        `SELECT COALESCE(SUM(grand_total),0) AS total, COUNT(*) AS cnt FROM sales WHERE shift_id=? AND (doc_type IS NULL OR doc_type='invoice')`,
        [shiftId]
      );
      const salesTotal = salesRows[0] ? Number(salesRows[0].total || 0) : 0;
      const salesCount = salesRows[0] ? Number(salesRows[0].cnt || 0) : 0;
      await conn.query(
        `UPDATE shifts SET status='closed', closed_at=NOW(), closing_cash=?, closing_notes=?, total_sales=?, total_invoices=? WHERE id=?`,
        [closingCash || 0, closingNotes || null, salesTotal, salesCount, shiftId]
      );
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    } finally {
      if (conn) conn.release();
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // Held Invoices Endpoints
  // ═══════════════════════════════════════════════════════════════
  app.get('/api/held-invoices', async (req, res) => {
    let conn;
    try {
      conn = await dbAdapter.getConnection();
      const [rows] = await conn.query('SELECT * FROM held_invoices ORDER BY id ASC');
      const items = rows.map((r, idx) => {
        try { const d = JSON.parse(r.invoice_data); return { ...d, db_id: r.id, id: idx + 1 }; }
        catch (_) { return null; }
      }).filter(x => x !== null);
      res.json({ ok: true, items });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    } finally {
      if (conn) conn.release();
    }
  });

  app.post('/api/held-invoices', async (req, res) => {
    let conn;
    try {
      const payload = req.body || {};
      if (!payload.cart || !Array.isArray(payload.cart) || payload.cart.length === 0) {
        return res.status(400).json({ ok: false, error: 'السلة فارغة' });
      }
      conn = await dbAdapter.getConnection();
      const { adjustStockForHeldCart, checkStockForHeldCart, notifyProductsChanged } = require('./held_invoices');
      // منع تعليق كميات أكبر من المتوفر في المخزون
      const shortageMsg = await checkStockForHeldCart(conn, payload.cart);
      if(shortageMsg) return res.status(400).json({ ok: false, error: shortageMsg });
      const [result] = await conn.query('INSERT INTO held_invoices (invoice_data) VALUES (?)', [JSON.stringify(payload)]);
      // حجز الكميات المعلقة: خصم من المخزون
      try{
        await adjustStockForHeldCart(conn, payload.cart, -1);
        notifyProductsChanged('held-reserved');
      }catch(_){ }
      res.json({ ok: true, id: result.insertId });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    } finally {
      if (conn) conn.release();
    }
  });

  app.delete('/api/held-invoices/:id', async (req, res) => {
    let conn;
    try {
      const id = Number(req.params.id);
      conn = await dbAdapter.getConnection();
      // إعادة الكميات المحجوزة للمخزون قبل الحذف
      const [rows] = await conn.query('SELECT invoice_data FROM held_invoices WHERE id=?', [id]);
      await conn.query('DELETE FROM held_invoices WHERE id=?', [id]);
      if(rows && rows[0]){
        try{
          const { adjustStockForHeldCart, notifyProductsChanged } = require('./held_invoices');
          const data = JSON.parse(rows[0].invoice_data);
          await adjustStockForHeldCart(conn, data.cart, +1);
          notifyProductsChanged('held-released');
        }catch(_){ }
      }
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    } finally {
      if (conn) conn.release();
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // Suppliers Endpoints
  // ═══════════════════════════════════════════════════════════════
  app.get('/api/suppliers', async (req, res) => {
    let conn;
    try {
      const { search, active, sort } = req.query;
      conn = await dbAdapter.getConnection();
      const terms = []; const params = [];
      if (active === '1') { terms.push('is_active=1'); }
      if (search) { terms.push('(name LIKE ? OR phone LIKE ?)'); const s = `%${search}%`; params.push(s, s); }
      const where = terms.length ? ('WHERE ' + terms.join(' AND ')) : '';
      const order = sort === 'name_asc' ? 'ORDER BY name ASC, id ASC' : 'ORDER BY id DESC';
      const [rows] = await conn.query(`SELECT * FROM suppliers ${where} ${order}`, params);
      const items = rows.map(r => ({ ...r, balance: Number(r.balance || 0), total_due: Number(r.balance || 0) }));
      res.json({ ok: true, items });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    } finally {
      if (conn) conn.release();
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // Purchases Endpoints
  // ═══════════════════════════════════════════════════════════════
  app.get('/api/purchases', async (req, res) => {
    let conn;
    try {
      const { limit = 50, offset = 0, from, to } = req.query;
      conn = await dbAdapter.getConnection();
      const terms = []; const params = [];
      if (from) { terms.push('COALESCE(purchase_at, created_at) >= ?'); params.push(from); }
      if (to) { terms.push('COALESCE(purchase_at, created_at) <= ?'); params.push(to); }
      const where = terms.length ? ('WHERE ' + terms.join(' AND ')) : '';
      const [[cntRow]] = await conn.query(`SELECT COUNT(*) AS total FROM purchases ${where}`, params);
      const lim = Math.min(parseInt(limit) || 50, 999999);
      const [rows] = await conn.query(`SELECT * FROM purchases ${where} ORDER BY id DESC LIMIT ? OFFSET ?`, [...params, lim, parseInt(offset) || 0]);
      res.json({ ok: true, items: rows, total: Number(cntRow.total || 0) });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    } finally {
      if (conn) conn.release();
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // Purchase Invoices Endpoints
  // ═══════════════════════════════════════════════════════════════
  app.get('/api/purchase-invoices', async (req, res) => {
    let conn;
    try {
      const { limit = 50, offset = 0, supplier_id, from, to, search, doc_type } = req.query;
      conn = await dbAdapter.getConnection();
      const terms = []; const params = [];
      if (supplier_id) { terms.push('pi.supplier_id=?'); params.push(Number(supplier_id)); }
      if (doc_type) { terms.push('pi.doc_type=?'); params.push(String(doc_type)); }
      if (from) { terms.push('pi.invoice_at >= ?'); params.push(from); }
      if (to) { terms.push('pi.invoice_at <= ?'); params.push(to); }
      if (search) { terms.push('(pi.invoice_no LIKE ? OR s.name LIKE ?)'); const sq = `%${search}%`; params.push(sq, sq); }
      const where = terms.length ? ('WHERE ' + terms.join(' AND ')) : '';
      const lim = Math.min(parseInt(limit) || 50, 999999);
      const [[cntRow]] = await conn.query(
        `SELECT COUNT(*) AS total FROM purchase_invoices pi LEFT JOIN suppliers s ON s.id=pi.supplier_id ${where}`, params
      );
      const [rows] = await conn.query(
        `SELECT pi.*, s.name AS supplier_name FROM purchase_invoices pi LEFT JOIN suppliers s ON s.id=pi.supplier_id ${where} ORDER BY pi.id DESC LIMIT ? OFFSET ?`,
        [...params, lim, parseInt(offset) || 0]
      );
      res.json({ ok: true, items: rows, total: Number(cntRow.total || 0) });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    } finally {
      if (conn) conn.release();
    }
  });

  app.get('/api/purchase-invoices/:id', async (req, res) => {
    let conn;
    try {
      const id = Number(req.params.id);
      conn = await dbAdapter.getConnection();
      const [[inv]] = await conn.query('SELECT pi.*, s.name AS supplier_name FROM purchase_invoices pi LEFT JOIN suppliers s ON s.id=pi.supplier_id WHERE pi.id=? LIMIT 1', [id]);
      if (!inv) return res.status(404).json({ ok: false, error: 'غير موجود' });
      const [details] = await conn.query('SELECT pid.*, p.name AS product_name FROM purchase_invoice_details pid LEFT JOIN products p ON p.id=pid.product_id WHERE pid.purchase_id=? ORDER BY pid.id', [id]);
      res.json({ ok: true, invoice: inv, details });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    } finally {
      if (conn) conn.release();
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // Vouchers Endpoints
  // ═══════════════════════════════════════════════════════════════
  app.get('/api/vouchers', async (req, res) => {
    let conn;
    try {
      const { limit, offset = 0, voucher_type, from, to, entity_type, entity_id, search } = req.query;
      conn = await dbAdapter.getConnection();
      const terms = []; const params = [];
      if (voucher_type) { terms.push('voucher_type=?'); params.push(voucher_type); }
      if (entity_type) { terms.push('entity_type=?'); params.push(entity_type); }
      if (entity_id) { terms.push('entity_id=?'); params.push(entity_id); }
      const vHasTime = (v) => String(v).trim().length > 10;
      if (from) { terms.push(vHasTime(from) ? 'created_at >= ?' : 'DATE(created_at) >= ?'); params.push(from); }
      if (to) { terms.push(vHasTime(to) ? 'created_at <= ?' : 'DATE(created_at) <= ?'); params.push(to); }
      if (search) { terms.push('(voucher_no LIKE ? OR entity_name LIKE ? OR invoice_no LIKE ?)'); const s = `%${search}%`; params.push(s, s, s); }
      const where = terms.length ? ('WHERE ' + terms.join(' AND ')) : '';
      const [[cntRow]] = await conn.query(`SELECT COUNT(*) AS total FROM vouchers ${where}`, params);
      let rows;
      if (limit === undefined) {
        [rows] = await conn.query(`SELECT * FROM vouchers ${where} ORDER BY id DESC`, params);
      } else {
        const lim = Math.min(parseInt(limit) || 50, 500);
        [rows] = await conn.query(`SELECT * FROM vouchers ${where} ORDER BY id DESC LIMIT ? OFFSET ?`, [...params, lim, parseInt(offset) || 0]);
      }
      res.json({ ok: true, items: rows, total: Number(cntRow.total || 0) });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    } finally {
      if (conn) conn.release();
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // Quotations Endpoints
  // ═══════════════════════════════════════════════════════════════
  app.get('/api/quotations', async (req, res) => {
    let conn;
    try {
      const { limit = 50, offset = 0, search } = req.query;
      conn = await dbAdapter.getConnection();
      const terms = []; const params = [];
      if (search) { terms.push('(quotation_no LIKE ? OR customer_name LIKE ? OR customer_phone LIKE ?)'); const s = `%${search}%`; params.push(s, s, s); }
      const where = terms.length ? ('WHERE ' + terms.join(' AND ')) : '';
      const lim = Math.min(parseInt(limit) || 50, 500);
      const [[cntRow]] = await conn.query(`SELECT COUNT(*) AS total FROM quotations ${where}`, params);
      const [rows] = await conn.query(`SELECT id, quotation_no, customer_name, customer_phone, total, created_at FROM quotations ${where} ORDER BY id DESC LIMIT ? OFFSET ?`, [...params, lim, parseInt(offset) || 0]);
      res.json({ ok: true, items: rows, total: Number(cntRow.total || 0) });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    } finally {
      if (conn) conn.release();
    }
  });

  app.get('/api/quotations/:id', async (req, res) => {
    let conn;
    try {
      const id = Number(req.params.id);
      conn = await dbAdapter.getConnection();
      const [[row]] = await conn.query('SELECT * FROM quotations WHERE id=? LIMIT 1', [id]);
      if (!row) return res.status(404).json({ ok: false, error: 'غير موجود' });
      res.json({ ok: true, item: row });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    } finally {
      if (conn) conn.release();
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // Batch Screen-Init Endpoints (تسريع فتح الشاشات — طلب واحد بدل عدة طلبات)
  // ═══════════════════════════════════════════════════════════════

  // GET /api/init/invoices-screen — يجلب الإعدادات + إحصائية الفواتير دفعة واحدة
  app.get('/api/init/invoices-screen', async (req, res) => {
    let conn;
    try {
      conn = await dbAdapter.getConnection();
      let sendFromDate = null;
      try {
        const { app: electronApp } = require('electron');
        const cfgPath = require('path').join(electronApp.getPath('userData'), '.zatca-config.json');
        const cfg = JSON.parse(require('fs').readFileSync(cfgPath, 'utf8'));
        if (cfg && cfg.sendFromDate) sendFromDate = cfg.sendFromDate;
      } catch (_) { /* no config yet */ }
      const zatcaSql = `
        SELECT
          SUM(CASE WHEN zatca_status='rejected' THEN 1 ELSE 0 END) AS failed,
          SUM(CASE WHEN zatca_status<>'rejected' AND (zatca_status IN ('submitted','accepted') OR zatca_submitted IS NOT NULL) THEN 1 ELSE 0 END) AS sent,
          COUNT(*) AS total
        FROM sales
        WHERE (doc_type IS NULL OR doc_type='invoice') ${sendFromDate ? 'AND DATE(created_at) >= ?' : ''}
      `;
      const zatcaParams = sendFromDate ? [sendFromDate] : [];
      const [[settingsRow], [cntRow], [zatcaRow]] = await Promise.all([
        conn.query('SELECT * FROM app_settings WHERE id=1 LIMIT 1'),
        conn.query(`SELECT COUNT(*) AS total FROM sales WHERE (doc_type IS NULL OR doc_type='invoice')`),
        conn.query(zatcaSql, zatcaParams),
      ]);
      const settings = (settingsRow && settingsRow[0]) || {};
      try {
        if (typeof settings.payment_methods === 'string') settings.payment_methods = JSON.parse(settings.payment_methods);
        if (!Array.isArray(settings.payment_methods)) settings.payment_methods = [];
      } catch (_) { settings.payment_methods = []; }
      const zStats = (zatcaRow && zatcaRow[0]) || {};
      const zSent = Number(zStats.sent || 0);
      const zFailed = Number(zStats.failed || 0);
      const zTotal = Number(zStats.total || 0);
      res.json({
        ok: true,
        settings,
        total_invoices: Number((cntRow && cntRow[0] && cntRow[0].total) || 0),
        zatca_stats: { sent: zSent, failed: zFailed, pending: Math.max(0, zTotal - zSent - zFailed) },
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    } finally {
      if (conn) conn.release();
    }
  });

  // GET /api/init/customers-screen — يجلب الإعدادات + أول 100 عميل دفعة واحدة
  app.get('/api/init/customers-screen', async (req, res) => {
    let conn;
    try {
      conn = await dbAdapter.getConnection();
      const [[settingsRow], [customers], [cntRow]] = await Promise.all([
        conn.query('SELECT * FROM app_settings WHERE id=1 LIMIT 1'),
        conn.query('SELECT id, name, phone, email, vat_number, is_active, created_at FROM customers ORDER BY id DESC LIMIT 100'),
        conn.query('SELECT COUNT(*) AS total FROM customers'),
      ]);
      const settings = (settingsRow && settingsRow[0]) || {};
      try {
        if (typeof settings.payment_methods === 'string') settings.payment_methods = JSON.parse(settings.payment_methods);
        if (!Array.isArray(settings.payment_methods)) settings.payment_methods = [];
      } catch (_) { settings.payment_methods = []; }
      res.json({ ok: true, settings, customers, total: Number((cntRow && cntRow[0] && cntRow[0].total) || 0) });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    } finally {
      if (conn) conn.release();
    }
  });

  // GET /api/init/products-screen — يجلب الإعدادات + أول 100 منتج + الأنواع دفعة واحدة
  app.get('/api/init/products-screen', async (req, res) => {
    let conn;
    try {
      conn = await dbAdapter.getConnection();
      const [[settingsRow], [products], [types], [operations], [cntRow]] = await Promise.all([
        conn.query('SELECT * FROM app_settings WHERE id=1 LIMIT 1'),
        conn.query('SELECT id, name, name_en, barcode, price, cost, stock, category, is_tobacco, is_vat_exempt, is_international_transport_service, is_active, sort_order FROM products ORDER BY sort_order ASC, name ASC LIMIT 100'),
        conn.query('SELECT * FROM main_types WHERE is_active=1 ORDER BY sort_order ASC, name ASC'),
        conn.query('SELECT * FROM operations ORDER BY id'),
        conn.query('SELECT COUNT(*) AS total FROM products'),
      ]);
      const settings = (settingsRow && settingsRow[0]) || {};
      try {
        if (typeof settings.payment_methods === 'string') settings.payment_methods = JSON.parse(settings.payment_methods);
        if (!Array.isArray(settings.payment_methods)) settings.payment_methods = [];
      } catch (_) { settings.payment_methods = []; }
      res.json({ ok: true, settings, products, types, operations, total: Number((cntRow && cntRow[0] && cntRow[0].total) || 0) });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    } finally {
      if (conn) conn.release();
    }
  });

  // GET /api/init/shifts-screen — يجلب الإعدادات + الورديات الأخيرة دفعة واحدة
  app.get('/api/init/shifts-screen', async (req, res) => {
    let conn;
    try {
      const { user_id, limit = 20 } = req.query;
      conn = await dbAdapter.getConnection();
      const lim = Math.min(parseInt(limit) || 20, 200);
      const terms = []; const params = [];
      if (user_id) { terms.push('user_id=?'); params.push(Number(user_id)); }
      const where = terms.length ? ('WHERE ' + terms.join(' AND ')) : '';
      const [[settingsRow], [shifts], [openShift]] = await Promise.all([
        conn.query('SELECT * FROM app_settings WHERE id=1 LIMIT 1'),
        conn.query(`SELECT * FROM shifts ${where} ORDER BY id DESC LIMIT ?`, [...params, lim]),
        conn.query(`SELECT * FROM shifts WHERE status='open' ORDER BY opened_at DESC LIMIT 1`),
      ]);
      const settings = (settingsRow && settingsRow[0]) || {};
      try {
        if (typeof settings.payment_methods === 'string') settings.payment_methods = JSON.parse(settings.payment_methods);
        if (!Array.isArray(settings.payment_methods)) settings.payment_methods = [];
      } catch (_) { settings.payment_methods = []; }
      res.json({ ok: true, settings, shifts, open_shift: openShift[0] || null });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    } finally {
      if (conn) conn.release();
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // POST /api/customer-display/show
  // ═══════════════════════════════════════════════════════════════
  app.post('/api/customer-display/show', async (req, res) => {
    try {
      const { action, text } = req.body || {};
      const cd = require('./customer-display/index');
      const manager = cd.getManager ? cd.getManager() : null;
      if (!manager || !manager.isConnected) {
        return res.json({ ok: false, error: 'Customer display not connected' });
      }
      switch (String(action || '').toLowerCase()) {
        case 'welcome':
          await manager.displayWelcome(text || null);
          break;
        case 'thankyou':
          await manager.displayThankYou(text || null);
          break;
        case 'total':
          await manager.displayTotal(parseFloat(text) || 0);
          break;
        case 'clear':
          await manager.clear();
          break;
        default:
          await manager.displayItem(text || '', 0);
          break;
      }
      res.json({ ok: true, success: true });
    } catch (e) {
      res.json({ ok: false, error: 'failed to update customer display' });
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // Report parity endpoints used by secondary devices
  app.get('/api/users', async (_req, res) => {
    let conn;
    try {
      conn = await dbAdapter.getConnection();
      const [items] = await conn.query("SELECT id, username, full_name, role, is_active, created_at FROM users WHERE username <> 'superAdmin' ORDER BY id DESC");
      res.json({ ok:true, items });
    } catch (error) { res.status(500).json({ ok:false, error:error.message }); }
    finally { if (conn) conn.release(); }
  });

  app.get('/api/employees/:id', async (req, res) => {
    let conn;
    try {
      conn = await dbAdapter.getConnection();
      const [[item]] = await conn.query('SELECT * FROM employees WHERE id=? LIMIT 1', [Number(req.params.id)]);
      if (!item) return res.status(404).json({ ok:false, error:'غير موجود' });
      res.json({ ok:true, item });
    } catch (error) { res.status(500).json({ ok:false, error:error.message }); }
    finally { if (conn) conn.release(); }
  });

  app.get('/api/suppliers/:id', async (req, res) => {
    let conn;
    try {
      conn = await dbAdapter.getConnection();
      const [[supplier]] = await conn.query('SELECT * FROM suppliers WHERE id=? LIMIT 1', [Number(req.params.id)]);
      if (!supplier) return res.status(404).json({ ok:false, error:'غير موجود' });
      const balance = Number(supplier.balance || 0);
      res.json({ ok:true, item:{ ...supplier, balance, total_due:balance } });
    } catch (error) { res.status(500).json({ ok:false, error:error.message }); }
    finally { if (conn) conn.release(); }
  });

  app.get('/api/vouchers/:id', async (req, res) => {
    let conn;
    try {
      conn = await dbAdapter.getConnection();
      const [[item]] = await conn.query('SELECT * FROM vouchers WHERE id=? LIMIT 1', [Number(req.params.id)]);
      if (!item) return res.status(404).json({ ok:false, error:'Voucher not found' });
      res.json({ ok:true, item });
    } catch (error) { res.status(500).json({ ok:false, error:error.message }); }
    finally { if (conn) conn.release(); }
  });

  app.get('/api/settings-image', async (_req, res) => {
    let conn;
    try {
      conn = await dbAdapter.getConnection();
      const [[settings]] = await conn.query('SELECT logo_blob, logo_mime, logo_path FROM app_settings WHERE id=1 LIMIT 1');
      if (settings?.logo_blob) return res.json({ ok:true, base64:Buffer.from(settings.logo_blob).toString('base64'), mime:settings.logo_mime || 'image/png' });
      const logoPath = settings?.logo_path;
      if (logoPath) {
        const absolutePath = path.isAbsolute(logoPath) ? logoPath : path.resolve(__dirname, '..', '..', logoPath);
        if (fs.existsSync(absolutePath)) return res.json({ ok:true, base64:fs.readFileSync(absolutePath).toString('base64'), mime:settings.logo_mime || 'image/png' });
      }
      res.json({ ok:true, base64:null, mime:null });
    } catch (error) { res.status(500).json({ ok:false, error:error.message }); }
    finally { if (conn) conn.release(); }
  });

  app.get('/api/products-expiry', async (req, res) => {
    let conn;
    try {
      const { from_date, to_date, status } = req.query;
      if (!from_date || !to_date || !status) return res.status(400).json({ ok:false, error:'معلمات مفقودة' });
      conn = await dbAdapter.getConnection();
      const today = new Date(); today.setHours(0,0,0,0);
      const todayStr = today.toISOString().split('T')[0];
      const terms = ['expiry_date IS NOT NULL', 'expiry_date BETWEEN ? AND ?'];
      const params = [from_date, to_date];
      if (status === 'expired') { terms.push('expiry_date < ?'); params.push(todayStr); }
      if (status === 'valid') { terms.push('expiry_date >= ?'); params.push(todayStr); }
      const [products] = await conn.query(`SELECT id,name,name_en,barcode,price,cost,stock,category,description,image_path,is_tobacco,is_active,expiry_date,created_at FROM products WHERE ${terms.join(' AND ')} ORDER BY expiry_date ASC`, params);
      res.json({ ok:true, products });
    } catch (error) { res.status(500).json({ ok:false, error:error.message }); }
    finally { if (conn) conn.release(); }
  });

  app.get('/api/reports-inventory', async (req, res) => {
    let conn;
    try {
      const from = req.query.date_from ? String(req.query.date_from).replace('T', ' ').substring(0, 16) + ':00' : null;
      const to = req.query.date_to ? String(req.query.date_to).replace('T', ' ').substring(0, 16) + ':59' : null;
      const reportType = req.query.report_type || 'sold';
      const params = [];
      let salesSubquery = `SELECT id FROM sales WHERE (doc_type IS NULL OR doc_type IN ('invoice','credit_note'))`;
      if (from) { salesSubquery += ' AND created_at >= ?'; params.push(from); }
      if (to) { salesSubquery += ' AND created_at <= ?'; params.push(to); }
      const sql = reportType === 'not_sold' ? `
        SELECT p.id,p.name,COALESCE(p.barcode,'') barcode,COALESCE(p.category,'') category,COALESCE(p.stock,0) stock_qty,0 qty_sold
        FROM products p WHERE p.is_active=1 AND p.id NOT IN (
          SELECT si.product_id FROM sales_items si INNER JOIN sales sx ON sx.id=si.sale_id
          WHERE si.sale_id IN (${salesSubquery}) GROUP BY si.product_id
          HAVING SUM(CASE WHEN sx.doc_type='credit_note' THEN -ABS(si.qty) ELSE ABS(si.qty) END)>0
        ) ORDER BY p.name ASC, p.id ASC` : `
        SELECT p.id,p.name,COALESCE(p.barcode,'') barcode,COALESCE(p.category,'') category,COALESCE(p.stock,0) stock_qty,
          COALESCE(SUM(CASE WHEN si.sale_id IN (SELECT id FROM sales WHERE doc_type='credit_note') THEN -ABS(si.qty) ELSE ABS(si.qty) END),0) qty_sold
        FROM products p INNER JOIN sales_items si ON si.product_id=p.id AND si.sale_id IN (${salesSubquery})
        WHERE p.is_active=1 GROUP BY p.id,p.name,p.barcode,p.category,p.stock HAVING qty_sold>0 ORDER BY p.name ASC, p.id ASC`;
      conn = await dbAdapter.getConnection();
      const [items] = await conn.query(sql, params);
      res.json({ ok:true, items });
    } catch (error) { res.status(500).json({ ok:false, error:error.message }); }
    finally { if (conn) conn.release(); }
  });

  app.get('/api/employee-report', async (req, res) => {
    let conn;
    try {
      const employeeId = Number(req.query.employee_id || 0);
      const fromDate = req.query.from_date || '';
      const toDate = req.query.to_date || '';
      if (!employeeId || !fromDate || !toDate) return res.status(400).json({ ok:false, error:'بيانات التقرير مطلوبة' });
      const from = String(fromDate).includes(':') ? fromDate : `${fromDate} 00:00:00`;
      const to = String(toDate).includes(':') ? toDate : `${toDate} 23:59:59`;
      conn = await dbAdapter.getConnection();
      const [invoices] = await conn.query(`SELECT DISTINCT s.id,s.invoice_no,s.grand_total,s.payment_method,s.created_at,s.settled_cash,s.pay_cash_amount,c.name customer_name,GROUP_CONCAT(DISTINCT si.name SEPARATOR ', ') products_list,SUM(si.line_total) employee_total FROM sales s INNER JOIN sales_items si ON si.sale_id=s.id AND si.employee_id=? LEFT JOIN customers c ON c.id=s.customer_id WHERE s.doc_type='invoice' AND s.created_at>=? AND s.created_at<=? GROUP BY s.id ORDER BY s.created_at DESC`, [employeeId, from, to]);
      const [products] = await conn.query(`SELECT si.product_id,si.name product_name,SUM(si.qty) total_qty,AVG(si.price) avg_price,SUM(si.line_total) total_amount FROM sales_items si INNER JOIN sales s ON s.id=si.sale_id WHERE si.employee_id=? AND s.doc_type='invoice' AND s.created_at>=? AND s.created_at<=? GROUP BY si.product_id,si.name ORDER BY total_amount DESC`, [employeeId, from, to]);
      const [creditNotes] = await conn.query(`SELECT DISTINCT s.id,s.invoice_no,s.grand_total,s.payment_method,s.created_at,s.settled_cash,s.pay_cash_amount,s.ref_base_invoice_no,c.name customer_name,GROUP_CONCAT(DISTINCT si.name SEPARATOR ', ') products_list,SUM(si.line_total) employee_total FROM sales s INNER JOIN sales_items si ON si.sale_id=s.id AND si.employee_id=? LEFT JOIN customers c ON c.id=s.customer_id WHERE s.doc_type='credit_note' AND s.created_at>=? AND s.created_at<=? GROUP BY s.id ORDER BY s.created_at DESC`, [employeeId, from, to]);
      const [creditProducts] = await conn.query(`SELECT si.product_id,si.name product_name,SUM(si.qty) total_qty,AVG(si.price) avg_price,SUM(si.line_total) total_amount FROM sales_items si INNER JOIN sales s ON s.id=si.sale_id WHERE si.employee_id=? AND s.doc_type='credit_note' AND s.created_at>=? AND s.created_at<=? GROUP BY si.product_id,si.name ORDER BY total_amount DESC`, [employeeId, from, to]);
      res.json({ ok:true, data:{ invoices, products, creditNotes, creditProducts } });
    } catch (error) { res.status(500).json({ ok:false, error:error.message }); }
    finally { if (conn) conn.release(); }
  });

  // Permissions Endpoints
  // ═══════════════════════════════════════════════════════════════
  app.get('/api/permissions/:user_id', async (req, res) => {
    let conn;
    try {
      const { user_id } = req.params;
      if (!user_id) return res.status(400).json({ ok: false, error: 'معرّف المستخدم مفقود' });
      
      conn = await dbAdapter.getConnection();
      
      // Fetch user role
      const [uRows] = await conn.query('SELECT role FROM users WHERE id=? LIMIT 1', [user_id]);
      if (!uRows.length) return res.status(404).json({ ok: false, error: 'المستخدم غير موجود' });
      const role = uRows[0].role;

      // Load saved permissions for this user
      const [rows] = await conn.query('SELECT perm_key FROM user_permissions WHERE user_id=?', [user_id]);

      if (role === 'admin') {
        // Admin has all permissions
        const [allPerms] = await conn.query('SELECT perm_key FROM permissions');
        return res.json({ ok: true, keys: allPerms.map(r => r.perm_key) });
      }

      // Non-admin: return saved permissions
      const keys = rows.map(r => r.perm_key);
      res.json({ ok: true, keys });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    } finally {
      if (conn) conn.release();
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // Start Server
  // ═══════════════════════════════════════════════════════════════
  server = app.listen(port, host, () => {
    console.log(`✓ API Server listening on ${host}:${port}`);
  });

  return server;
}

function stopAPIServer() {
  if (server) {
    server.close(() => {
      console.log('API Server stopped');
    });
    server = null;
  }
}

module.exports = {
  startAPIServer,
  stopAPIServer,
};
