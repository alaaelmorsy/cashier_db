// Vouchers IPC module - سندات القبض والصرف
const { ipcMain } = require('electron');
const { dbAdapter, DB_NAME } = require('../db/db-adapter');

function registerVouchersIPC() {
  // Ensure vouchers table exists
  async function ensureTable(conn) {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS vouchers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        voucher_no VARCHAR(64) NOT NULL,
        voucher_type ENUM('receipt', 'payment') NOT NULL,
        amount DECIMAL(12,2) NOT NULL,
        payment_method VARCHAR(50) NULL,
        notes TEXT NULL,
        entity_type ENUM('customer', 'supplier') NOT NULL,
        entity_id INT NULL,
        entity_name VARCHAR(255) NULL,
        entity_phone VARCHAR(64) NULL,
        entity_tax_number VARCHAR(128) NULL,
        invoice_no VARCHAR(64) NULL,
        user_id INT NULL,
        user_name VARCHAR(150) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_voucher_type_no (voucher_type, voucher_no),
        INDEX idx_voucher_type (voucher_type),
        INDEX idx_entity_type (entity_type),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    
    // Create counters table for sequential numbering
    await conn.query(`
      CREATE TABLE IF NOT EXISTS voucher_counters (
        voucher_type ENUM('receipt', 'payment') PRIMARY KEY,
        last_number INT NOT NULL DEFAULT 0
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Migration: drop old UNIQUE(voucher_no) if exists, ensure UNIQUE(voucher_type, voucher_no)
    try {
      const [idxRows] = await conn.query(`
        SELECT INDEX_NAME, NON_UNIQUE, GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS cols
        FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'vouchers'
        GROUP BY INDEX_NAME, NON_UNIQUE
      `, [DB_NAME]);

      // Drop any unique index that is only on voucher_no
      const toDrop = (idxRows || []).filter(r => Number(r.NON_UNIQUE) === 0 && String(r.cols) === 'voucher_no');
      for (const r of toDrop) {
        await conn.query(`ALTER TABLE vouchers DROP INDEX \`${r.INDEX_NAME}\``);
      }

      // Ensure composite unique exists
      const hasComposite = (idxRows || []).some(r => Number(r.NON_UNIQUE) === 0 && String(r.cols) === 'voucher_type,voucher_no');
      if (!hasComposite) {
        await conn.query('ALTER TABLE vouchers ADD UNIQUE KEY `unique_voucher_type_no` (`voucher_type`, `voucher_no`)');
      }
    } catch (e) {
      console.warn('Vouchers index migration skipped:', e.message);
    }
  }
  
  // Get next voucher number
  ipcMain.handle('vouchers:get_next_number', async (event, voucherType) => {
    const conn = await dbAdapter.getConnection();
    try {
      await ensureTable(conn);
      
      // Start transaction
      await conn.beginTransaction();
      
      // Get or create counter
      const [rows] = await conn.query(
        'SELECT last_number FROM voucher_counters WHERE voucher_type = ?',
        [voucherType]
      );
      
      let nextNumber;
      if (rows.length === 0) {
        // First voucher of this type
        nextNumber = 1;
        await conn.query(
          'INSERT INTO voucher_counters (voucher_type, last_number) VALUES (?, ?)',
          [voucherType, nextNumber]
        );
      } else {
        // Increment counter
        nextNumber = rows[0].last_number + 1;
        await conn.query(
          'UPDATE voucher_counters SET last_number = ? WHERE voucher_type = ?',
          [nextNumber, voucherType]
        );
      }
      
      await conn.commit();
      
      // Format voucher number: numeric only per type starting from 1
      const voucherNo = String(nextNumber);
      
      return { ok: true, voucher_no: voucherNo, number: nextNumber };
    } catch (error) {
      await conn.rollback();
      console.error('Get next voucher number error:', error);
      return { ok: false, error: error.message };
    } finally {
      conn.release();
    }
  });

  // Create voucher
  ipcMain.handle('vouchers:create', async (event, data) => {
    const conn = await dbAdapter.getConnection();
    try {
      await ensureTable(conn);
      
      const [result] = await conn.query(
        `INSERT INTO vouchers 
        (voucher_no, voucher_type, amount, payment_method, notes, 
         entity_type, entity_id, entity_name, entity_phone, entity_tax_number,
         invoice_no, user_id, user_name) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          data.voucher_no,
          data.voucher_type,
          data.amount,
          data.payment_method || null,
          data.notes || null,
          data.entity_type,
          data.entity_id || null,
          data.entity_name || null,
          data.entity_phone || null,
          data.entity_tax_number || null,
          data.invoice_no || null,
          data.user_id || null,
          data.user_name || null
        ]
      );
      
      return { ok: true, id: result.insertId };
    } catch (error) {
      console.error('Create voucher error:', error);
      return { ok: false, error: error.message };
    } finally {
      conn.release();
    }
  });

  // Get all vouchers with filters
  ipcMain.handle('vouchers:list', async (event, filters = {}) => {
    const conn = await dbAdapter.getConnection();
    try {
      await ensureTable(conn);
      
      let sql = 'SELECT * FROM vouchers WHERE 1=1';
      const params = [];
      
      if (filters.voucher_type) {
        sql += ' AND voucher_type = ?';
        params.push(filters.voucher_type);
      }
      
      if (filters.entity_type) {
        sql += ' AND entity_type = ?';
        params.push(filters.entity_type);
      }

      // Optional: filter by specific entity (customer/supplier) id
      if (filters.entity_id) {
        sql += ' AND entity_id = ?';
        params.push(filters.entity_id);
      }
      
      if (filters.from_date) {
        sql += ' AND DATE(created_at) >= DATE(?)';
        params.push(filters.from_date);
      }
      
      if (filters.to_date) {
        sql += ' AND DATE(created_at) <= DATE(?)';
        params.push(filters.to_date);
      }
      
      if (filters.search) {
        sql += ' AND (voucher_no LIKE ? OR entity_name LIKE ? OR invoice_no LIKE ?)';
        const searchTerm = `%${filters.search}%`;
        params.push(searchTerm, searchTerm, searchTerm);
      }
      
      sql += ' ORDER BY created_at DESC';
      
      console.log('Vouchers SQL:', sql);
      console.log('Vouchers params:', params);
      
      const [rows] = await conn.query(sql, params);
      
      console.log(`Found ${rows.length} vouchers`);
      
      return { ok: true, items: rows };
    } catch (error) {
      console.error('List vouchers error:', error);
      return { ok: false, error: error.message };
    } finally {
      conn.release();
    }
  });

  // Get single voucher by ID
  ipcMain.handle('vouchers:get', async (event, id) => {
    const conn = await dbAdapter.getConnection();
    try {
      await ensureTable(conn);
      
      const [rows] = await conn.query('SELECT * FROM vouchers WHERE id = ?', [id]);
      
      if (rows.length === 0) {
        return { ok: false, error: 'Voucher not found' };
      }
      
      return { ok: true, item: rows[0] };
    } catch (error) {
      console.error('Get voucher error:', error);
      return { ok: false, error: error.message };
    } finally {
      conn.release();
    }
  });

  // Delete voucher
  ipcMain.handle('vouchers:delete', async (event, id) => {
    const conn = await dbAdapter.getConnection();
    try {
      await ensureTable(conn);
      
      await conn.query('DELETE FROM vouchers WHERE id = ?', [id]);
      
      return { ok: true };
    } catch (error) {
      console.error('Delete voucher error:', error);
      return { ok: false, error: error.message };
    } finally {
      conn.release();
    }
  });

  // Get statistics
  ipcMain.handle('vouchers:stats', async (event, filters = {}) => {
    const conn = await dbAdapter.getConnection();
    try {
      await ensureTable(conn);
      
      let sql = `
        SELECT 
          voucher_type,
          COUNT(*) as count,
          SUM(amount) as total
        FROM vouchers
        WHERE 1=1
      `;
      const params = [];
      
      if (filters.from_date) {
        sql += ' AND DATE(created_at) >= ?';
        params.push(filters.from_date);
      }
      
      if (filters.to_date) {
        sql += ' AND DATE(created_at) <= ?';
        params.push(filters.to_date);
      }
      
      sql += ' GROUP BY voucher_type';
      
      const [rows] = await conn.query(sql, params);
      
      return { ok: true, stats: rows };
    } catch (error) {
      console.error('Vouchers stats error:', error);
      return { ok: false, error: error.message };
    } finally {
      conn.release();
    }
  });
}

// Bootstrap for module registration
(async function bootstrap() {
  try {
    const conn = await dbAdapter.getConnection();
    try {
      await conn.query(`CREATE TABLE IF NOT EXISTS vouchers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        voucher_no VARCHAR(64) NOT NULL,
        voucher_type ENUM('receipt', 'payment') NOT NULL,
        amount DECIMAL(12,2) NOT NULL,
        payment_method VARCHAR(50) NULL,
        notes TEXT NULL,
        entity_type ENUM('customer', 'supplier') NOT NULL,
        entity_id INT NULL,
        entity_name VARCHAR(255) NULL,
        entity_phone VARCHAR(64) NULL,
        entity_tax_number VARCHAR(128) NULL,
        invoice_no VARCHAR(64) NULL,
        user_id INT NULL,
        user_name VARCHAR(150) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_voucher_type_no (voucher_type, voucher_no),
        INDEX idx_voucher_type (voucher_type),
        INDEX idx_entity_type (entity_type),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
      
      // Create voucher_counters table for sequential numbering
      await conn.query(`CREATE TABLE IF NOT EXISTS voucher_counters (
        voucher_type ENUM('receipt', 'payment') NOT NULL PRIMARY KEY,
        last_number INT NOT NULL DEFAULT 0
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
      
      // Initialize counters if not exist
      await conn.query(`INSERT IGNORE INTO voucher_counters (voucher_type, last_number) VALUES ('receipt', 0), ('payment', 0)`);
    } finally {
      conn.release();
    }
  } catch (e) {
    /* silently ignore - tables will be created on first connection */
  }
})();

module.exports = { registerVouchersIPC };