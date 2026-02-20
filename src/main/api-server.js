const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const { dbAdapter } = require('../db/db-adapter');

const DEFAULT_API_PORT = 4310;
const DEFAULT_API_HOST = '0.0.0.0';

let server = null;

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
  app.use(morgan('tiny'));

  app.get('/api/health', (req, res) => {
    res.json({ ok: true, message: 'API Server is running' });
  });

  // ═══════════════════════════════════════════════════════════════
  // Sales Endpoints
  // ═══════════════════════════════════════════════════════════════
  app.get('/api/invoices', async (req, res) => {
    try {
      const { limit = 200, offset = 0, search, payment_status } = req.query;
      const conn = await dbAdapter.getConnection();
      let sql = 'SELECT * FROM sales WHERE doc_type="invoice"';
      const params = [];

      if (search) {
        sql += ' AND (invoice_no LIKE ? OR customer_name LIKE ? OR customer_phone LIKE ?)';
        const s = `%${search}%`;
        params.push(s, s, s);
      }

      if (payment_status) {
        sql += ' AND payment_status = ?';
        params.push(payment_status);
      }

      sql += ' ORDER BY id DESC LIMIT ? OFFSET ?';
      params.push(parseInt(limit), parseInt(offset));

      const [rows] = await conn.query(sql, params);
      conn.release();
      res.json({ ok: true, invoices: rows });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/invoices/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const conn = await dbAdapter.getConnection();
      const [results] = await conn.query(
        'SELECT * FROM sales WHERE id=? LIMIT 1; SELECT * FROM sales_items WHERE sale_id=? ORDER BY id',
        [id, id]
      );
      conn.release();
      const invoiceRows = results[0];
      const items = results[1];
      if (!invoiceRows.length) {
        return res.status(404).json({ ok: false, error: 'Invoice not found' });
      }
      res.json({ ok: true, invoice: invoiceRows[0], items });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/credit-invoices', async (req, res) => {
    try {
      const { limit = 200, offset = 0 } = req.query;
      const conn = await dbAdapter.getConnection();
      const sql = 'SELECT * FROM sales WHERE payment_status="unpaid" AND doc_type="invoice" ORDER BY id DESC LIMIT ? OFFSET ?';
      const [rows] = await conn.query(sql, [parseInt(limit), parseInt(offset)]);
      conn.release();
      res.json({ ok: true, invoices: rows });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/credit-notes', async (req, res) => {
    try {
      const { limit = 200, offset = 0 } = req.query;
      const conn = await dbAdapter.getConnection();
      const sql = 'SELECT * FROM sales WHERE doc_type="credit_note" ORDER BY id DESC LIMIT ? OFFSET ?';
      const [rows] = await conn.query(sql, [parseInt(limit), parseInt(offset)]);
      conn.release();
      res.json({ ok: true, credit_notes: rows });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/period-summary', async (req, res) => {
    try {
      const { from, to } = req.query;
      const conn = await dbAdapter.getConnection();
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
      conn.release();
      res.json({ ok: true, summary: rows[0] });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // Products Endpoints
  // ═══════════════════════════════════════════════════════════════
  app.get('/api/products', async (req, res) => {
    try {
      const { limit = 500, offset = 0, search, category_id, is_active } = req.query;
      const conn = await dbAdapter.getConnection();
      let sql = 'SELECT * FROM products WHERE 1=1';
      const params = [];

      if (search) {
        sql += ' AND (name_ar LIKE ? OR name_en LIKE ? OR barcode LIKE ?)';
        const s = `%${search}%`;
        params.push(s, s, s);
      }

      if (category_id) {
        sql += ' AND category_id = ?';
        params.push(category_id);
      }

      if (is_active !== undefined) {
        sql += ' AND is_active = ?';
        params.push(is_active === 'true' || is_active === '1' ? 1 : 0);
      }

      sql += ' ORDER BY display_order ASC, id DESC LIMIT ? OFFSET ?';
      params.push(parseInt(limit), parseInt(offset));

      const [rows] = await conn.query(sql, params);
      conn.release();
      res.json({ ok: true, products: rows });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/products/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const conn = await dbAdapter.getConnection();
      const [rows] = await conn.query('SELECT * FROM products WHERE id=? LIMIT 1', [id]);
      if (!rows.length) {
        conn.release();
        return res.status(404).json({ ok: false, error: 'Product not found' });
      }
      conn.release();
      res.json({ ok: true, product: rows[0] });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/products/barcode/:code', async (req, res) => {
    try {
      const { code } = req.params;
      const conn = await dbAdapter.getConnection();
      const [rows] = await conn.query('SELECT * FROM products WHERE barcode=? LIMIT 1', [code]);
      conn.release();
      if (!rows.length) {
        return res.json({ ok: true, product: null });
      }
      res.json({ ok: true, product: rows[0] });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/products-images-batch', async (req, res) => {
    try {
      const { ids } = req.query;
      if (!ids) return res.json({ ok: true, images: [] });
      const idArray = String(ids).split(',').map(x => parseInt(x)).filter(x => x > 0);
      if (!idArray.length) return res.json({ ok: true, images: [] });

      const conn = await dbAdapter.getConnection();
      const placeholders = idArray.map(() => '?').join(',');
      const [rows] = await conn.query(`SELECT id, image_data FROM products WHERE id IN (${placeholders})`, idArray);
      conn.release();
      res.json({ ok: true, images: rows });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/products-ops-batch', async (req, res) => {
    try {
      const { ids } = req.query;
      if (!ids) return res.json({ ok: true, operations: [] });
      const idArray = String(ids).split(',').map(x => parseInt(x)).filter(x => x > 0);
      if (!idArray.length) return res.json({ ok: true, operations: [] });

      const conn = await dbAdapter.getConnection();
      const placeholders = idArray.map(() => '?').join(',');
      const [rows] = await conn.query(`SELECT * FROM product_operations WHERE product_id IN (${placeholders}) ORDER BY product_id, id`, idArray);
      conn.release();
      res.json({ ok: true, operations: rows });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // Customers Endpoints
  // ═══════════════════════════════════════════════════════════════
  app.get('/api/customers', async (req, res) => {
    try {
      const { limit = 500, offset = 0, search } = req.query;
      const conn = await dbAdapter.getConnection();
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
      conn.release();
      res.json({ ok: true, customers: rows });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/customers/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const conn = await dbAdapter.getConnection();
      const [rows] = await conn.query('SELECT * FROM customers WHERE id=? LIMIT 1', [id]);
      conn.release();
      if (!rows.length) {
        return res.status(404).json({ ok: false, error: 'Customer not found' });
      }
      res.json({ ok: true, customer: rows[0] });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // Operations Endpoints
  // ═══════════════════════════════════════════════════════════════
  app.get('/api/operations', async (req, res) => {
    try {
      const conn = await dbAdapter.getConnection();
      const [rows] = await conn.query('SELECT * FROM operations ORDER BY id');
      conn.release();
      res.json({ ok: true, operations: rows });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // Types/Categories Endpoints
  // ═══════════════════════════════════════════════════════════════
  app.get('/api/types', async (req, res) => {
    try {
      const conn = await dbAdapter.getConnection();
      const [rows] = await conn.query('SELECT * FROM types ORDER BY id');
      conn.release();
      res.json({ ok: true, types: rows });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // Settings Endpoints
  // ═══════════════════════════════════════════════════════════════
  app.get('/api/settings', async (req, res) => {
    try {
      const conn = await dbAdapter.getConnection();
      const [rows] = await conn.query('SELECT * FROM app_settings WHERE id=1 LIMIT 1');
      conn.release();
      if (!rows.length) {
        return res.json({ ok: true, settings: {} });
      }
      res.json({ ok: true, settings: rows[0] });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // Offers Endpoints
  // ═══════════════════════════════════════════════════════════════
  app.get('/api/offers', async (req, res) => {
    try {
      const conn = await dbAdapter.getConnection();
      const [rows] = await conn.query('SELECT * FROM offers ORDER BY id DESC');
      conn.release();
      res.json({ ok: true, offers: rows });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
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
