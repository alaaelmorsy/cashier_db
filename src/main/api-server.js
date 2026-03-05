const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const { dbAdapter } = require('../db/db-adapter');

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
      const { limit = 20, offset = 0, before_id, search, customer_q, payment_status } = req.query;
      conn = await dbAdapter.getConnection();
      const SELECT_COLS = `id, invoice_no, order_no, doc_type, created_at,
        customer_id, customer_name, customer_phone, customer_vat,
        payment_method, payment_status, sub_total, vat_total, grand_total,
        total_after_discount, discount_type, discount_value, discount_amount,
        paid_amount, remaining_amount, settled_at, settled_method, settled_cash,
        pay_cash_amount, pay_card_amount, shift_id,
        zatca_uuid, zatca_submitted, zatca_status, zatca_rejection_reason, zatca_response,
        created_by_user_id, created_by_username`;

      const whereClauses = ["(doc_type IS NULL OR doc_type='invoice')"];
      const params = [];
      const hasFilters = !!(search || customer_q || payment_status);

      if (search) {
        whereClauses.push('(invoice_no LIKE ? OR customer_name LIKE ? OR customer_phone LIKE ? OR customer_vat LIKE ?)');
        const s = `%${search}%`;
        params.push(s, s, s, s);
      }
      if (customer_q) {
        whereClauses.push('(customer_phone LIKE ? OR customer_name LIKE ? OR customer_vat LIKE ?)');
        const cq = `%${customer_q}%`;
        params.push(cq, cq, cq);
      }
      if (payment_status) {
        whereClauses.push('payment_status = ?');
        params.push(payment_status);
      }

      const where = 'WHERE ' + whereClauses.join(' AND ');
      const lim = Math.min(parseInt(limit) || 20, 500);

      // Fast COUNT: use index stats for unfiltered, exact COUNT only when filters applied
      let total = 0;
      if (!hasFilters) {
        const [cntRows] = await conn.query(
          `SELECT COUNT(*) AS total FROM sales WHERE (doc_type IS NULL OR doc_type='invoice')`
        );
        total = Number(cntRows[0]?.total || 0);
      } else {
        const [[countRow]] = await conn.query(`SELECT COUNT(*) AS total FROM sales ${where}`, params);
        total = Number(countRow.total || 0);
      }

      // Keyset pagination (before_id): O(1) regardless of page depth — avoids OFFSET scan
      let rows;
      const beforeId = before_id ? Number(before_id) : null;
      if (beforeId) {
        const ksWhere = 'WHERE ' + [...whereClauses, 'id < ?'].join(' AND ');
        const [ksRows] = await conn.query(
          `SELECT ${SELECT_COLS} FROM sales ${ksWhere} ORDER BY id DESC LIMIT ?`,
          [...params, beforeId, lim]
        );
        rows = ksRows;
      } else {
        const off = parseInt(offset) || 0;
        const [offRows] = await conn.query(
          `SELECT ${SELECT_COLS} FROM sales ${where} ORDER BY id DESC LIMIT ? OFFSET ?`,
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
      const [results] = await conn.query(
        'SELECT * FROM sales WHERE id=? LIMIT 1; SELECT * FROM sales_items WHERE sale_id=? ORDER BY id',
        [id, id]
      );
      const invoiceRows = results[0];
      const items = results[1];
      if (!invoiceRows.length) {
        return res.status(404).json({ ok: false, error: 'Invoice not found' });
      }
      res.json({ ok: true, invoice: invoiceRows[0], items });
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
      const { limit = 200, offset = 0 } = req.query;
      conn = await dbAdapter.getConnection();
      const sql = 'SELECT * FROM sales WHERE doc_type="credit_note" ORDER BY id DESC LIMIT ? OFFSET ?';
      const [rows] = await conn.query(sql, [parseInt(limit), parseInt(offset)]);
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
  // Products Endpoints
  // ═══════════════════════════════════════════════════════════════
  app.get('/api/products', async (req, res) => {
    let conn;
    try {
      const { q, active, hide_from_sales, category, sort, limit = 500, offset = 0, skip_count, starts_with } = req.query;
      conn = await dbAdapter.getConnection();
      const SELECT_COLS = `id,name,name_en,barcode,price,min_price,cost,stock,category,is_tobacco,is_active,hide_from_sales,sort_order,(image_blob IS NOT NULL OR (image_path IS NOT NULL AND image_path != '')) AS has_image`;
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
      const [rows] = await conn.query(`SELECT * FROM product_operations WHERE product_id IN (${placeholders}) ORDER BY product_id, id`, idArray);
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
      const { limit = 500, offset = 0, search } = req.query;
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

      const [rows] = await conn.query(sql, params);
      res.json({ ok: true, customers: rows });
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
      res.json({ ok: true, settings: rows[0] });
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
      const SELECT_COLS = `id,name,name_en,barcode,price,min_price,cost,stock,category,is_tobacco,is_active,hide_from_sales,sort_order,(image_blob IS NOT NULL OR (image_path IS NOT NULL AND image_path != '')) AS has_image`;
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
      res.json({
        ok: true,
        settings: (settingsRow && settingsRow[0]) || {},
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
          else if (['card','tamara','tabby'].includes(p.payment_method)) cardAmount = grandTotal;
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
