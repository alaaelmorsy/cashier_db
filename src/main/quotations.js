// Quotations IPC handlers (عروض الأسعار)
const { ipcMain } = require('electron');
const { dbAdapter, DB_NAME } = require('../db/db-adapter');

module.exports = function setupQuotationsIPC() {
  // Ensure quotations table exists
  async function ensureQuotationsTable(conn) {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS quotations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        quotation_no VARCHAR(50) NOT NULL,
        customer_id INT DEFAULT NULL,
        customer_name VARCHAR(255) DEFAULT NULL,
        customer_phone VARCHAR(50) DEFAULT NULL,
        customer_email VARCHAR(100) DEFAULT NULL,
        customer_address TEXT DEFAULT NULL,
        customer_vat VARCHAR(50) DEFAULT NULL,
        customer_cr VARCHAR(50) DEFAULT NULL,
        customer_national_address TEXT DEFAULT NULL,
        cashier_id INT DEFAULT NULL,
        cashier_name VARCHAR(255) DEFAULT NULL,
        items_json TEXT NOT NULL,
        subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
        discount_type VARCHAR(20) DEFAULT 'none',
        discount_value DECIMAL(12,2) DEFAULT 0,
        discount_amount DECIMAL(12,2) DEFAULT 0,
        extra_amount DECIMAL(12,2) DEFAULT 0,
        vat_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
        tobacco_fee DECIMAL(12,2) DEFAULT 0,
        total DECIMAL(12,2) NOT NULL DEFAULT 0,
        notes TEXT DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_quotation_no (quotation_no),
        INDEX idx_customer_id (customer_id),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  // Generate next quotation number
  ipcMain.handle('quotations:generate_number', async () => {
    try {
      const conn = await dbAdapter.getConnection();
      try {
        await ensureQuotationsTable(conn);
        
        // Get the highest quotation number
        const [rows] = await conn.query(
          'SELECT quotation_no FROM quotations ORDER BY CAST(quotation_no AS UNSIGNED) DESC LIMIT 1'
        );
        
        let nextNum = 1;
        if (rows.length > 0) {
          const last = rows[0].quotation_no;
          // Extract number (now just plain number like "1", "2", "123")
          const num = parseInt(last, 10);
          if (!isNaN(num)) {
            nextNum = num + 1;
          }
        }
        
        const quotationNo = String(nextNum);
        console.log('[Quotations] Generated number:', quotationNo);
        return { ok: true, quotation_no: quotationNo };
      } finally {
        conn.release();
      }
    } catch (e) {
      console.error('quotations:generate_number error:', e);
      return { ok: false, error: 'فشل إنشاء رقم عرض السعر' };
    }
  });

  // Save quotation
  ipcMain.handle('quotations:save', async (event, data) => {
    try {
      const conn = await dbAdapter.getConnection();
      try {
        await ensureQuotationsTable(conn);

        const [result] = await conn.query(
          `INSERT INTO quotations (
            quotation_no, customer_id, customer_name, customer_phone, 
            customer_email, customer_address, customer_vat, customer_cr,
            customer_national_address, cashier_id, cashier_name,
            items_json, subtotal, discount_type, discount_value,
            discount_amount, extra_amount, vat_amount, tobacco_fee, 
            total, notes, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            data.quotation_no,
            data.customer_id || null,
            data.customer_name || null,
            data.customer_phone || null,
            data.customer_email || null,
            data.customer_address || null,
            data.customer_vat || null,
            data.customer_cr || null,
            data.customer_national_address || null,
            data.cashier_id || null,
            data.cashier_name || null,
            JSON.stringify(data.items || []),
            Number(data.subtotal || 0),
            data.discount_type || 'none',
            Number(data.discount_value || 0),
            Number(data.discount_amount || 0),
            Number(data.extra_amount || 0),
            Number(data.vat_amount || 0),
            Number(data.tobacco_fee || 0),
            Number(data.total || 0),
            data.notes || null,
            data.created_at || new Date()
          ]
        );

        console.log('[Quotations] Saved successfully:', data.quotation_no, '| ID:', result.insertId);
        return { ok: true, id: result.insertId };
      } finally {
        conn.release();
      }
    } catch (e) {
      console.error('quotations:save error:', e);
      return { ok: false, error: 'فشل حفظ عرض السعر' };
    }
  });

  // Get quotations with optional search by quotation_no and pagination
  ipcMain.handle('quotations:list', async (event, params) => {
    try {
      const conn = await dbAdapter.getConnection();
      try {
        await ensureQuotationsTable(conn);

        const search = params && params.search ? String(params.search).trim() : '';
        const page = Math.max(1, Number(params && params.page ? params.page : 1));
        const pageSize = Math.max(1, Math.min(100, Number(params && params.pageSize ? params.pageSize : 20)));
        const offset = (page - 1) * pageSize;

        let whereSql = '';
        const sqlParams = [];
        if (search) {
          // Exact match on quotation_no (space-insensitive)
          whereSql = 'WHERE REPLACE(quotation_no, " ", "") = ?';
          sqlParams.push(search.replace(/\s+/g, ''));
        }

        // Total count for pagination
        const [countRows] = await conn.query(`SELECT COUNT(*) AS total FROM quotations ${whereSql}`, sqlParams);
        const total = countRows[0] ? Number(countRows[0].total) : 0;

        // Paged data
        const [rows] = await conn.query(
          `SELECT 
            id, quotation_no, customer_name, customer_phone,
            total, created_at, cashier_name
          FROM quotations 
          ${whereSql}
          ORDER BY id DESC
          LIMIT ? OFFSET ?`,
          [...sqlParams, pageSize, offset]
        );

        return { ok: true, quotations: rows, total, page, pageSize };
      } finally {
        conn.release();
      }
    } catch (e) {
      console.error('quotations:list error:', e);
      return { ok: false, error: 'فشل تحميل عروض الأسعار' };
    }
  });

  // Get quotation by ID
  ipcMain.handle('quotations:get', async (event, id) => {
    try {
      const conn = await dbAdapter.getConnection();
      try {
        await ensureQuotationsTable(conn);

        const [rows] = await conn.query(
          'SELECT * FROM quotations WHERE id = ? LIMIT 1',
          [id]
        );

        if (rows.length === 0) {
          return { ok: false, error: 'عرض السعر غير موجود' };
        }

        const quotation = rows[0];
        // Parse items JSON
        try {
          quotation.items = JSON.parse(quotation.items_json || '[]');
        } catch (_) {
          quotation.items = [];
        }

        return { ok: true, quotation };
      } finally {
        conn.release();
      }
    } catch (e) {
      console.error('quotations:get error:', e);
      return { ok: false, error: 'فشل تحميل عرض السعر' };
    }
  });

  // Delete quotation
  ipcMain.handle('quotations:delete', async (event, id) => {
    try {
      const conn = await dbAdapter.getConnection();
      try {
        await ensureQuotationsTable(conn);

        const [result] = await conn.query('DELETE FROM quotations WHERE id = ?', [id]);
        console.log('[Quotations] Deleted quotation ID:', id, '| Affected rows:', result.affectedRows);
        return { ok: true };
      } finally {
        conn.release();
      }
    } catch (e) {
      console.error('quotations:delete error:', e);
      return { ok: false, error: 'فشل حذف عرض السعر' };
    }
  });
};