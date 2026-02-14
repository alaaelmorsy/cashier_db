
const { ipcMain } = require('electron');
const { dbAdapter, DB_NAME } = require('../db/db-adapter');

function registerHeldInvoicesIPC(){
  async function ensureTables(conn){
    await conn.query(`
      CREATE TABLE IF NOT EXISTS held_invoices (
        id INT AUTO_INCREMENT PRIMARY KEY,
        invoice_data TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
  }

  ipcMain.handle('held_invoices:list', async () => {
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTables(conn);
        const [rows] = await conn.query('SELECT * FROM held_invoices ORDER BY id ASC');
        return { ok: true, items: rows.map((r, idx) => {
          try{
            const data = JSON.parse(r.invoice_data);
            return { ...data, db_id: r.id, id: idx + 1 };
          }catch(_){
            return null;
          }
        }).filter(x => x !== null) };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok: false, error: 'تعذر جلب الفواتير المعلقة' }; }
  });

  ipcMain.handle('held_invoices:add', async (_e, payload) => {
    try{
      if(!payload || !payload.cart || payload.cart.length === 0){
        return { ok: false, error: 'السلة فارغة' };
      }
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTables(conn);
        const invoiceData = JSON.stringify(payload);
        const [res] = await conn.query('INSERT INTO held_invoices (invoice_data) VALUES (?)', [invoiceData]);
        return { ok: true, id: res.insertId };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok: false, error: 'تعذر حفظ الفاتورة المعلقة' }; }
  });

  ipcMain.handle('held_invoices:delete', async (_e, { db_id }) => {
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTables(conn);
        await conn.query('DELETE FROM held_invoices WHERE id = ?', [db_id]);
        return { ok: true };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok: false, error: 'تعذر حذف الفاتورة المعلقة' }; }
  });
}

module.exports = { registerHeldInvoicesIPC };
