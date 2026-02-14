// Suppliers IPC handlers
const { ipcMain } = require('electron');
const { dbAdapter, DB_NAME } = require('../db/db-adapter');

function registerSuppliersIPC(){
  async function ensureTable(conn){
    await conn.query(`
      CREATE TABLE IF NOT EXISTS suppliers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(64) NULL,
        vat_number VARCHAR(32) NULL,
        is_active TINYINT NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    // Backfill/ensure columns on old DBs
    try{
      const [colsPhone] = await conn.query("SHOW COLUMNS FROM suppliers LIKE 'phone'");
      if(!colsPhone || colsPhone.length===0){ await conn.query("ALTER TABLE suppliers ADD COLUMN phone VARCHAR(64) NULL AFTER name"); }
    }catch(_){ }
    try{
      const [colsVat] = await conn.query("SHOW COLUMNS FROM suppliers LIKE 'vat_number'");
      if(!colsVat || colsVat.length===0){ await conn.query("ALTER TABLE suppliers ADD COLUMN vat_number VARCHAR(32) NULL AFTER phone"); }
    }catch(_){ }
    try{
      const [colsAct] = await conn.query("SHOW COLUMNS FROM suppliers LIKE 'is_active'");
      if(!colsAct || colsAct.length===0){ await conn.query("ALTER TABLE suppliers ADD COLUMN is_active TINYINT NOT NULL DEFAULT 1 AFTER vat_number"); }
    }catch(_){ }
    // Ensure balance column exists for credit purchases/payments tracking
    try{
      const [colsBal] = await conn.query("SHOW COLUMNS FROM suppliers LIKE 'balance'");
      if(!colsBal || colsBal.length===0){ await conn.query("ALTER TABLE suppliers ADD COLUMN balance DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER vat_number"); }
    }catch(_){ }
  }

  // add
  ipcMain.handle('suppliers:add', async (_e, payload) => {
    const { name, phone, vat_number } = payload || {};
    if(!name || String(name).trim()==='') return { ok:false, error:'اسم المورد مطلوب' };
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTable(conn);
        // optional: prevent exact duplicate by name+phone
        if(phone && String(phone).trim()!==''){
          const [[dup]] = await conn.query('SELECT id FROM suppliers WHERE name=? AND phone=? LIMIT 1', [String(name).trim(), String(phone).trim()]);
          if(dup){ return { ok:false, error:'مورد بنفس الاسم والجوال موجود بالفعل' }; }
        }
        const [res] = await conn.query('INSERT INTO suppliers (name, phone, vat_number) VALUES (?,?,?)', [String(name).trim(), phone||null, vat_number||null]);
        return { ok:true, id: res.insertId };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'فشل حفظ المورد' }; }
  });

  // list
  ipcMain.handle('suppliers:list', async (_e, q) => {
    const query = q || {};
    const where = [];
    const params = [];
    if(query.q){ where.push('(name LIKE ? OR phone LIKE ? OR vat_number LIKE ?)'); params.push(`%${query.q}%`, `%${query.q}%`, `%${query.q}%`); }
    if(query.active==="1" || query.active==="0"){ where.push('is_active=?'); params.push(Number(query.active)); }
    const whereSql = where.length ? ('WHERE ' + where.join(' AND ')) : '';
    let order = 'ORDER BY id DESC';
    if(query.sort === 'name_asc') order = 'ORDER BY name ASC';
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTable(conn);
        const [rows] = await conn.query(`SELECT * FROM suppliers ${whereSql} ${order}`, params);
        // Use balance column directly from suppliers table (updated by purchase_invoices operations)
        const items = rows.map(r => ({ 
          ...r, 
          balance: Number(r.balance || 0),
          total_due: Number(r.balance || 0)  // Alias for backward compatibility
        }));
        return { ok:true, items };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'خطأ في تحميل الموردين' }; }
  });

  // get
  ipcMain.handle('suppliers:get', async (_e, id) => {
    const sid = (id && id.id) ? id.id : id;
    if(!sid) return { ok:false, error:'معرّف مفقود' };
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTable(conn);
        const [rows] = await conn.query('SELECT * FROM suppliers WHERE id=? LIMIT 1', [sid]);
        if(rows.length===0) return { ok:false, error:'غير موجود' };
        const supplier = rows[0];
        // Use balance column directly from suppliers table (updated by purchase_invoices operations)
        const balance = Number(supplier.balance || 0);
        return { ok:true, item: { ...supplier, balance, total_due: balance } };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'خطأ في الجلب' }; }
  });

  // update
  ipcMain.handle('suppliers:update', async (_e, id, payload) => {
    const sid = (id && id.id) ? id.id : id;
    if(!sid) return { ok:false, error:'معرّف مفقود' };
    const { name, phone, vat_number, is_active } = payload || {};
    if(!name || String(name).trim()==='') return { ok:false, error:'اسم المورد مطلوب' };
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTable(conn);
        await conn.query('UPDATE suppliers SET name=?, phone=?, vat_number=?, is_active=? WHERE id=?', [String(name).trim(), phone||null, vat_number||null, (is_active?1:0), sid]);
        return { ok:true };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'فشل التعديل' }; }
  });

  // toggle
  ipcMain.handle('suppliers:toggle', async (_e, id) => {
    const sid = (id && id.id) ? id.id : id;
    if(!sid) return { ok:false, error:'معرّف مفقود' };
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTable(conn);
        const [rows] = await conn.query('SELECT is_active FROM suppliers WHERE id=?', [sid]);
        if(rows.length===0) return { ok:false, error:'غير موجود' };
        const next = rows[0].is_active ? 0 : 1;
        await conn.query('UPDATE suppliers SET is_active=? WHERE id=?', [next, sid]);
        return { ok:true };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'فشل تحديث الحالة' }; }
  });

  // delete
  ipcMain.handle('suppliers:delete', async (_e, id) => {
    const sid = (id && id.id) ? id.id : id;
    if(!sid) return { ok:false, error:'معرّف مفقود' };
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTable(conn);
        // prevent deletion if there are related purchase invoices
        const [[cnt]] = await conn.query('SELECT COUNT(*) AS c FROM purchase_invoices WHERE supplier_id=?', [sid]);
        if(Number(cnt?.c||0) > 0){ return { ok:false, error:'لا يمكن حذف المورد لوجود فواتير مرتبطة به' }; }
        await conn.query('DELETE FROM suppliers WHERE id=?', [sid]);
        return { ok:true };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'فشل الحذف' }; }
  });
}

// Eager ensure on app start (robust against connection reuse)
(async () => {
  try{
    const conn = await dbAdapter.getConnection();
    try{
      await conn.query(`CREATE TABLE IF NOT EXISTS suppliers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(64) NULL,
        vat_number VARCHAR(32) NULL,
        is_active TINYINT NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);
    } finally { conn.release(); }
  }catch(e){ /* silently ignore - tables will be created on first connection */ }
})();

module.exports = { registerSuppliersIPC };