const { ipcMain } = require('electron');
const { dbAdapter, DB_NAME } = require('../db/db-adapter');

function registerShiftsIPC() {
  
  ipcMain.handle('shift:get-current', async (event, userId) => {
    try {
      const conn = await dbAdapter.getConnection();
      try {
        await conn.query(`USE \`${DB_NAME}\``);
        
        const [rows] = await conn.query(
          `SELECT * FROM shifts WHERE user_id = ? AND status = 'open' ORDER BY opened_at DESC LIMIT 1`,
          [userId]
        );
        
        return { ok: true, shift: rows[0] || null };
      } finally {
        conn.release();
      }
    } catch (err) {
      console.error('shift:get-current error:', err);
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('shift:get-any-open', async () => {
    try {
      const conn = await dbAdapter.getConnection();
      try {
        await conn.query(`USE \`${DB_NAME}\``);
        
        const [rows] = await conn.query(
          `SELECT * FROM shifts WHERE status = 'open' ORDER BY opened_at DESC LIMIT 1`
        );
        
        return { ok: true, shift: rows[0] || null };
      } finally {
        conn.release();
      }
    } catch (err) {
      console.error('shift:get-any-open error:', err);
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('shift:open', async (event, data) => {
    const { userId, username, openingCash, openingNotes } = data;
    
    try {
      const conn = await dbAdapter.getConnection();
      try {
        await conn.query(`USE \`${DB_NAME}\``);
        
        const [existing] = await conn.query(
          `SELECT id FROM shifts WHERE user_id = ? AND status = 'open'`,
          [userId]
        );
        
        if (existing.length > 0) {
          return { ok: false, error: 'لديك شيفت مفتوح بالفعل' };
        }
        
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        const nowStr = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
        
        const [maxShift] = await conn.query(
          `SELECT COALESCE(MAX(CAST(shift_no AS UNSIGNED)), 0) as max_no FROM shifts WHERE shift_no REGEXP '^[0-9]+$'`
        );
        const nextShiftNo = (maxShift[0]?.max_no || 0) + 1;
        const shiftNo = String(nextShiftNo);
        
        const [result] = await conn.query(
          `INSERT INTO shifts (shift_no, user_id, username, opened_at, opening_cash, opening_notes, status, total_invoices, total_sales, cash_sales, card_sales)
           VALUES (?, ?, ?, ?, ?, ?, 'open', 0, 0, 0, 0)`,
          [shiftNo, userId, username, nowStr, openingCash || 0, openingNotes || null]
        );
        
        const [newShift] = await conn.query(
          `SELECT * FROM shifts WHERE id = ?`,
          [result.insertId]
        );
        
        return { ok: true, shift: newShift[0] };
      } finally {
        conn.release();
      }
    } catch (err) {
      console.error('shift:open error:', err);
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('shift:close', async (event, data) => {
    const { shiftId, actualCash, closingNotes } = data;
    
    try {
      const conn = await dbAdapter.getConnection();
      try {
        await conn.query(`USE \`${DB_NAME}\``);
        
        const [shift] = await conn.query(
          `SELECT * FROM shifts WHERE id = ? AND status = 'open'`,
          [shiftId]
        );
        
        if (shift.length === 0) {
          return { ok: false, error: 'الشيفت غير موجود أو مغلق بالفعل' };
        }
        
        const [salesStats] = await conn.query(
          `SELECT 
            COUNT(CASE WHEN (doc_type IS NULL OR doc_type = 'invoice') THEN 1 END) as total_invoices,
            COUNT(CASE WHEN doc_type = 'credit_note' THEN 1 END) as total_refunds,
            COALESCE(SUM(CASE WHEN (doc_type IS NULL OR doc_type = 'invoice') THEN grand_total ELSE 0 END), 0) as total_sales,
            COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN grand_total ELSE 0 END), 0) as cash_sales,
            COALESCE(SUM(CASE WHEN payment_method IN ('card','tamara','tabby') THEN grand_total ELSE 0 END), 0) as card_sales,
            COALESCE(SUM(CASE WHEN payment_method = 'mixed' THEN COALESCE(pay_cash_amount, 0) ELSE 0 END), 0) as mixed_cash,
            COALESCE(SUM(CASE WHEN payment_method = 'mixed' THEN COALESCE(pay_card_amount, 0) ELSE 0 END), 0) as mixed_card,
            COALESCE(SUM(CASE WHEN payment_method = 'split' THEN grand_total ELSE 0 END), 0) as split_sales,
            COALESCE(SUM(CASE WHEN doc_type = 'credit_note' THEN ABS(grand_total) ELSE 0 END), 0) as total_refunds_amount
           FROM sales 
           WHERE shift_id = ?`,
          [shiftId]
        );
        
        const stats = salesStats[0];
        const openingCash = parseFloat(shift[0].opening_cash) || 0;
        const cashSales = parseFloat(stats.cash_sales) + parseFloat(stats.mixed_cash || 0);
        const cardSales = parseFloat(stats.card_sales) + parseFloat(stats.mixed_card || 0);
        const expectedCash = openingCash + cashSales;
        const actualCashValue = parseFloat(actualCash) || 0;
        const cashDifference = actualCashValue - expectedCash;
        
        shift[0].total_refunds = stats.total_refunds || 0;
        shift[0].total_refunds_amount = stats.total_refunds_amount || 0;
        
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        const nowStr = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
        
        await conn.query(
          `UPDATE shifts SET 
            status = 'closed',
            closed_at = ?,
            closing_cash = ?,
            closing_notes = ?,
            total_invoices = ?,
            total_sales = ?,
            cash_sales = ?,
            card_sales = ?,
            split_sales = ?,
            expected_cash = ?,
            actual_cash = ?,
            cash_difference = ?
           WHERE id = ?`,
          [
            nowStr, actualCashValue, closingNotes || null,
            stats.total_invoices, stats.total_sales,
            cashSales, cardSales, stats.split_sales,
            expectedCash, actualCashValue, cashDifference,
            shiftId
          ]
        );
        
        const [closedShift] = await conn.query(
          `SELECT * FROM shifts WHERE id = ?`,
          [shiftId]
        );
        
        return { ok: true, shift: closedShift[0] };
      } finally {
        conn.release();
      }
    } catch (err) {
      console.error('shift:close error:', err);
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('shift:list', async (event, filters = {}) => {
    try {
      const conn = await dbAdapter.getConnection();
      try {
        await conn.query(`USE \`${DB_NAME}\``);
        
        let query = `SELECT * FROM shifts WHERE 1=1`;
        const params = [];
        
        if (filters.userId) {
          query += ` AND user_id = ?`;
          params.push(filters.userId);
        }
        
        if (filters.status) {
          query += ` AND status = ?`;
          params.push(filters.status);
        }
        
        if (filters.dateFrom) {
          query += ` AND opened_at >= ?`;
          params.push(filters.dateFrom);
        }
        
        if (filters.dateTo) {
          query += ` AND opened_at <= ?`;
          params.push(filters.dateTo);
        }
        
        query += ` ORDER BY opened_at DESC`;
        
        if (filters.limit) {
          query += ` LIMIT ?`;
          params.push(parseInt(filters.limit));
        }
        
        const [rows] = await conn.query(query, params);
        
        return { ok: true, shifts: rows };
      } finally {
        conn.release();
      }
    } catch (err) {
      console.error('shift:list error:', err);
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('shift:get-by-id', async (event, shiftId) => {
    try {
      const conn = await dbAdapter.getConnection();
      try {
        await conn.query(`USE \`${DB_NAME}\``);
        
        const [shift] = await conn.query(
          `SELECT * FROM shifts WHERE id = ?`,
          [shiftId]
        );
        
        if (shift.length === 0) {
          return { ok: false, error: 'الشيفت غير موجود' };
        }
        
        const [invoices] = await conn.query(
          `SELECT id, invoice_no, doc_type, grand_total, payment_method, created_at 
           FROM sales 
           WHERE shift_id = ?
           ORDER BY created_at DESC`,
          [shiftId]
        );
        
        const [stats] = await conn.query(
          `SELECT 
            COUNT(CASE WHEN (doc_type IS NULL OR doc_type = 'invoice') THEN 1 END) as total_invoices,
            COUNT(CASE WHEN doc_type = 'credit_note' THEN 1 END) as total_refunds,
            COALESCE(SUM(CASE WHEN (doc_type IS NULL OR doc_type = 'invoice') THEN grand_total ELSE 0 END), 0) as total_sales,
            COALESCE(SUM(CASE WHEN doc_type = 'credit_note' THEN ABS(grand_total) ELSE 0 END), 0) as total_refunds_amount,
            COALESCE(SUM(CASE WHEN (doc_type IS NULL OR doc_type = 'invoice') AND payment_method = 'cash' THEN grand_total ELSE 0 END), 0) as gross_cash,
            COALESCE(SUM(CASE WHEN (doc_type IS NULL OR doc_type = 'invoice') AND payment_method IN ('card','tamara','tabby') THEN grand_total ELSE 0 END), 0) as gross_card,
            COALESCE(SUM(CASE WHEN (doc_type IS NULL OR doc_type = 'invoice') AND payment_method = 'split' THEN grand_total ELSE 0 END), 0) as gross_split,
            COALESCE(SUM(CASE WHEN (doc_type IS NULL OR doc_type = 'invoice') AND payment_method = 'mixed' THEN COALESCE(pay_cash_amount, 0) ELSE 0 END), 0) as gross_mixed_cash,
            COALESCE(SUM(CASE WHEN (doc_type IS NULL OR doc_type = 'invoice') AND payment_method = 'mixed' THEN COALESCE(pay_card_amount, 0) ELSE 0 END), 0) as gross_mixed_card,
            COALESCE(SUM(CASE WHEN doc_type = 'credit_note' AND payment_method = 'cash' THEN ABS(grand_total) ELSE 0 END), 0) as refunds_cash,
            COALESCE(SUM(CASE WHEN doc_type = 'credit_note' AND payment_method IN ('card','tamara','tabby') THEN ABS(grand_total) ELSE 0 END), 0) as refunds_card,
            COALESCE(SUM(CASE WHEN doc_type = 'credit_note' AND payment_method = 'split' THEN ABS(grand_total) ELSE 0 END), 0) as refunds_split,
            COALESCE(SUM(CASE WHEN doc_type = 'credit_note' AND payment_method = 'mixed' THEN COALESCE(pay_cash_amount, 0) ELSE 0 END), 0) as refunds_mixed_cash,
            COALESCE(SUM(CASE WHEN doc_type = 'credit_note' AND payment_method = 'mixed' THEN COALESCE(pay_card_amount, 0) ELSE 0 END), 0) as refunds_mixed_card
           FROM sales 
           WHERE shift_id = ?`,
          [shiftId]
        );
        
        const shiftData = shift[0];
        if (stats[0]) {
          const s = stats[0];
          shiftData.total_invoices = s.total_invoices || 0;
          shiftData.total_refunds = s.total_refunds || 0;
          shiftData.total_sales = s.total_sales || 0;
          shiftData.total_refunds_amount = s.total_refunds_amount || 0;
          
          const grossCash = parseFloat(s.gross_cash || 0) + parseFloat(s.gross_split || 0) / 2 + parseFloat(s.gross_mixed_cash || 0);
          const grossCard = parseFloat(s.gross_card || 0) + parseFloat(s.gross_split || 0) / 2 + parseFloat(s.gross_mixed_card || 0);
          const refundsCash = parseFloat(s.refunds_cash || 0) + parseFloat(s.refunds_split || 0) / 2 + parseFloat(s.refunds_mixed_cash || 0);
          const refundsCard = parseFloat(s.refunds_card || 0) + parseFloat(s.refunds_split || 0) / 2 + parseFloat(s.refunds_mixed_card || 0);
          
          shiftData.gross_cash_sales = grossCash;
          shiftData.gross_card_sales = grossCard;
          shiftData.refunds_cash = refundsCash;
          shiftData.refunds_card = refundsCard;
          shiftData.cash_sales = grossCash - refundsCash;
          shiftData.card_sales = grossCard - refundsCard;
        }
        
        return { ok: true, shift: shiftData, invoices };
      } finally {
        conn.release();
      }
    } catch (err) {
      console.error('shift:get-by-id error:', err);
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('shift:get-statistics', async (event, filters = {}) => {
    try {
      const conn = await dbAdapter.getConnection();
      try {
        await conn.query(`USE \`${DB_NAME}\``);
        
        let query = `SELECT 
          COUNT(*) as total_shifts,
          COUNT(CASE WHEN status = 'open' THEN 1 END) as open_shifts,
          COUNT(CASE WHEN status = 'closed' THEN 1 END) as closed_shifts,
          COALESCE(SUM(CASE WHEN status = 'open' THEN (cash_sales + card_sales) ELSE 0 END), 0) as total_revenue,
          COALESCE(SUM(cash_sales), 0) as total_cash,
          COALESCE(SUM(card_sales), 0) as total_card,
          COALESCE(SUM(total_invoices), 0) as total_invoices_count,
          COALESCE(AVG(cash_difference), 0) as avg_cash_difference
        FROM shifts WHERE 1=1`;
        
        const params = [];
        
        if (filters.userId) {
          query += ` AND user_id = ?`;
          params.push(filters.userId);
        }
        
        if (filters.dateFrom) {
          query += ` AND opened_at >= ?`;
          params.push(filters.dateFrom);
        }
        
        if (filters.dateTo) {
          query += ` AND opened_at <= ?`;
          params.push(filters.dateTo);
        }
        
        const [stats] = await conn.query(query, params);
        
        return { ok: true, statistics: stats[0] };
      } finally {
        conn.release();
      }
    } catch (err) {
      console.error('shift:get-statistics error:', err);
      return { ok: false, error: err.message };
    }
  });
}

module.exports = { registerShiftsIPC };
