// Customers IPC handlers
const { ipcMain } = require('electron');
const { dbAdapter, DB_NAME } = require('../db/db-adapter');

function registerCustomersIPC(){
  async function ensureTable(conn){
    await conn.query(`
      CREATE TABLE IF NOT EXISTS customers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(64) NULL,
        email VARCHAR(255) NULL,
        address VARCHAR(255) NULL,
        vat_number VARCHAR(32) NULL,
        cr_number VARCHAR(32) NULL,
        national_address VARCHAR(255) NULL,
        postal_code VARCHAR(16) NULL,
        street_number VARCHAR(32) NULL,
        sub_number VARCHAR(32) NULL,
        notes TEXT NULL,
        is_active TINYINT NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_name (name),
        INDEX idx_phone (phone),
        INDEX idx_email (email),
        INDEX idx_is_active (is_active),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    // تأكيد وجود الأعمدة على قواعد قديمة
    try{
      const [colsVat] = await conn.query("SHOW COLUMNS FROM customers LIKE 'vat_number'");
      if(!colsVat || colsVat.length === 0){
        await conn.query("ALTER TABLE customers ADD COLUMN vat_number VARCHAR(32) NULL AFTER address");
      }
    }catch(e){ console.warn('ensureTable: vat_number check/add failed', e.message || e); }
    try{
      const [colsCr] = await conn.query("SHOW COLUMNS FROM customers LIKE 'cr_number'");
      if(!colsCr || colsCr.length === 0){
        await conn.query("ALTER TABLE customers ADD COLUMN cr_number VARCHAR(32) NULL AFTER vat_number");
      }
    }catch(e){ console.warn('ensureTable: cr_number check/add failed', e.message || e); }
    try{
      const [colsNat] = await conn.query("SHOW COLUMNS FROM customers LIKE 'national_address'");
      if(!colsNat || colsNat.length === 0){
        await conn.query("ALTER TABLE customers ADD COLUMN national_address VARCHAR(255) NULL AFTER cr_number");
      }
    }catch(e){ console.warn('ensureTable: national_address check/add failed', e.message || e); }
    try{
      const [colsPostal] = await conn.query("SHOW COLUMNS FROM customers LIKE 'postal_code'");
      if(!colsPostal || colsPostal.length === 0){
        await conn.query("ALTER TABLE customers ADD COLUMN postal_code VARCHAR(16) NULL AFTER national_address");
      }
    }catch(e){ console.warn('ensureTable: postal_code check/add failed', e.message || e); }
    try{
      const [colsStreet] = await conn.query("SHOW COLUMNS FROM customers LIKE 'street_number'");
      if(!colsStreet || colsStreet.length === 0){
        await conn.query("ALTER TABLE customers ADD COLUMN street_number VARCHAR(32) NULL AFTER postal_code");
      }
    }catch(e){ console.warn('ensureTable: street_number check/add failed', e.message || e); }
    try{
      const [colsSub] = await conn.query("SHOW COLUMNS FROM customers LIKE 'sub_number'");
      if(!colsSub || colsSub.length === 0){
        await conn.query("ALTER TABLE customers ADD COLUMN sub_number VARCHAR(32) NULL AFTER street_number");
      }
    }catch(e){ console.warn('ensureTable: sub_number check/add failed', e.message || e); }
    
    // حذف عمود phone_validation_enabled القديم إذا كان موجوداً
    try{
      const [colsOld] = await conn.query("SHOW COLUMNS FROM customers LIKE 'phone_validation_enabled'");
      if(colsOld && colsOld.length > 0){
        await conn.query("ALTER TABLE customers DROP COLUMN phone_validation_enabled");
        console.log('Removed obsolete column: phone_validation_enabled');
      }
    }catch(e){ console.warn('ensureTable: phone_validation_enabled removal failed', e.message || e); }
    
    // Optimized indexes for 600k+ customers
    // Full-Text Search index for fast name search
    try{
      const [ftIndex] = await conn.query("SHOW INDEX FROM customers WHERE Key_name = 'ft_customer_name'");
      if(!ftIndex || ftIndex.length === 0){
        await conn.query("ALTER TABLE customers ADD FULLTEXT INDEX ft_customer_name (name)");
      }
    }catch(e){ console.warn('ensureTable: ft_customer_name add failed', e.message || e); }
    
    // Composite index for common queries (active customers by name)
    try{
      const [indexes] = await conn.query("SHOW INDEX FROM customers WHERE Key_name = 'idx_active_name'");
      if(!indexes || indexes.length === 0){
        await conn.query("ALTER TABLE customers ADD INDEX idx_active_name (is_active, name(100))");
      }
    }catch(e){ console.warn('ensureTable: idx_active_name add failed', e.message || e); }
    
    // Phone index for quick lookup
    try{
      const [indexes] = await conn.query("SHOW INDEX FROM customers WHERE Key_name = 'idx_phone'");
      if(!indexes || indexes.length === 0){
        await conn.query("ALTER TABLE customers ADD INDEX idx_phone (phone)");
      }
    }catch(e){ console.warn('ensureTable: idx_phone add failed', e.message || e); }
    
    // VAT number index for ZATCA integration
    try{
      const [indexes] = await conn.query("SHOW INDEX FROM customers WHERE Key_name = 'idx_vat_number'");
      if(!indexes || indexes.length === 0){
        await conn.query("ALTER TABLE customers ADD INDEX idx_vat_number (vat_number)");
      }
    }catch(e){ console.warn('ensureTable: idx_vat_number add failed', e.message || e); }
    
    // Cleanup legacy single-column indexes (replaced by composite indexes)
    try{ await conn.query("DROP INDEX idx_name ON customers"); }catch(_){ }
    try{ await conn.query("DROP INDEX idx_is_active ON customers"); }catch(_){ }
    try{ await conn.query("DROP INDEX idx_email ON customers"); }catch(_){ }
    try{ await conn.query("DROP INDEX idx_created_at ON customers"); }catch(_){ }
  }

  // add
  ipcMain.handle('customers:add', async (_evt, payload) => {
    const { name, phone, email, address, vat_number, cr_number, national_address, postal_code, street_number, sub_number, notes } = payload || {};
    if(!phone || String(phone).trim()==='') return { ok:false, error:'رقم الجوال مطلوب' };
    const safeName = (name && String(name).trim()!=='') ? String(name).trim() : String(phone).trim();
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTable(conn);
        // منع تكرار رقم الجوال
        const [[dup]] = await conn.query('SELECT id FROM customers WHERE phone=? LIMIT 1', [String(phone).trim()]);
        if(dup){ return { ok:false, error:'رقم الجوال موجود بالفعل' }; }
        const [res] = await conn.query(
          'INSERT INTO customers (name, phone, email, address, vat_number, cr_number, national_address, postal_code, street_number, sub_number, notes) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
          [safeName, String(phone).trim(), email||null, address||null, vat_number||null, cr_number||null, national_address||null, postal_code||null, street_number||null, sub_number||null, notes||null]
        );
        return { ok:true, id: res.insertId };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'فشل حفظ العميل' }; }
  });

  // list
  ipcMain.handle('customers:list', async (_e, q) => {
    const query = q || {};
    const where = [];
    const params = [];
    if(query.q){ where.push('(name LIKE ? OR phone LIKE ? OR email LIKE ?)'); params.push(`%${query.q}%`, `%${query.q}%`, `%${query.q}%`); }
    if(query.active==="1" || query.active==="0"){ where.push('is_active=?'); params.push(Number(query.active)); }

    let order = 'ORDER BY id DESC';
    if(query.sort === 'name_asc') order = 'ORDER BY name ASC';
    if(query.sort === 'created_asc') order = 'ORDER BY created_at ASC';

    const whereSql = where.length ? ('WHERE ' + where.join(' AND ')) : '';

    // Server-side pagination
    const page = Math.max(1, Number(query.page || 1));
    const pageSize = Number(query.pageSize || 20);
    const offset = (page - 1) * pageSize;

    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTable(conn);
        
        // Optimized count strategy for large tables (600k+ customers)
        const hasFilters = query.q || (query.active === "1" || query.active === "0");
        let total = 0;
        
        if (!hasFilters) {
          // Ultra-fast estimation: use MySQL table stats for unfiltered customer list
          const [statsRows] = await conn.query(`
            SELECT TABLE_ROWS 
            FROM information_schema.TABLES 
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'customers'
          `, [DB_NAME]);
          total = statsRows[0]?.TABLE_ROWS || 0;
        } else {
          // Precise count when filters are applied
          const [[{total: count}]] = await conn.query(`SELECT COUNT(*) as total FROM customers ${whereSql}`, params);
          total = count;
        }
        
        // Get paginated data
        const limitSql = pageSize > 0 ? `LIMIT ${pageSize} OFFSET ${offset}` : '';
        const [rows] = await conn.query(`SELECT * FROM customers ${whereSql} ${order} ${limitSql}`, params);
        
        return { ok:true, items: rows, total, page, pageSize };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'خطأ في تحميل العملاء' }; }
  });

  // get
  ipcMain.handle('customers:get', async (_e, id) => {
    const cid = (id && id.id) ? id.id : id;
    if(!cid) return { ok:false, error:'معرّف مفقود' };
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTable(conn);
        const [rows] = await conn.query('SELECT * FROM customers WHERE id=? LIMIT 1', [cid]);
        if(rows.length===0) return { ok:false, error:'غير موجود' };
        return { ok:true, item: rows[0] };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'خطأ في الجلب' }; }
  });

  // update
  ipcMain.handle('customers:update', async (_e, id, payload) => {
    const cid = (id && id.id) ? id.id : id;
    if(!cid) return { ok:false, error:'معرّف مفقود' };
    const { name, phone, email, address, vat_number, cr_number, national_address, postal_code, street_number, sub_number, notes } = payload || {};
    if(!phone || String(phone).trim()==='') return { ok:false, error:'رقم الجوال مطلوب' };
    const safeName = (name && String(name).trim()!=='') ? String(name).trim() : String(phone).trim();
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTable(conn);
        // منع تكرار رقم الجوال لغير نفس السجل
        const [[dup]] = await conn.query('SELECT id FROM customers WHERE phone=? AND id<>? LIMIT 1', [String(phone).trim(), cid]);
        if(dup){ return { ok:false, error:'رقم الجوال موجود بالفعل' }; }
        await conn.query('UPDATE customers SET name=?, phone=?, email=?, address=?, vat_number=?, cr_number=?, national_address=?, postal_code=?, street_number=?, sub_number=?, notes=? WHERE id=?', [safeName, String(phone).trim(), email||null, address||null, vat_number||null, cr_number||null, national_address||null, postal_code||null, street_number||null, sub_number||null, notes||null, cid]);
        return { ok:true };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'فشل التعديل' }; }
  });

  // toggle
  ipcMain.handle('customers:toggle', async (_e, id) => {
    const cid = (id && id.id) ? id.id : id;
    if(!cid) return { ok:false, error:'معرّف مفقود' };
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTable(conn);
        const [rows] = await conn.query('SELECT is_active FROM customers WHERE id=?', [cid]);
        if(rows.length===0) return { ok:false, error:'غير موجود' };
        const next = rows[0].is_active ? 0 : 1;
        await conn.query('UPDATE customers SET is_active=? WHERE id=?', [next, cid]);
        return { ok:true };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'فشل تحديث الحالة' }; }
  });

  // delete
  ipcMain.handle('customers:delete', async (_e, id) => {
    const cid = (id && id.id) ? id.id : id;
    if(!cid) return { ok:false, error:'معرّف مفقود' };
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTable(conn);
        
        // التحقق من وجود فواتير مرتبطة بالعميل
        const [invoices] = await conn.query('SELECT COUNT(*) as count FROM sales WHERE customer_id=?', [cid]);
        if(invoices && invoices[0] && invoices[0].count > 0){
          return { 
            ok: false, 
            error: 'لا يمكن حذف العميل لأنه مرتبط بفواتير سابقة.\nيمكنك إيقاف العميل بدلاً من حذفه.',
            hasInvoices: true 
          };
        }
        
        await conn.query('DELETE FROM customers WHERE id=?', [cid]);
        return { ok:true };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'فشل الحذف' }; }
  });

  // bulk reset all customers
  ipcMain.handle('customers:reset_all', async () => {
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTable(conn);
        await conn.beginTransaction();
        await conn.query('DELETE FROM customers');
        try{ await conn.query('ALTER TABLE customers AUTO_INCREMENT = 1'); }catch(_){ }
        await conn.commit();
        return { ok:true };
      } catch(e){ await conn.rollback(); throw e; }
      finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'فشل إعادة تعيين العملاء' }; }
  });
}

// eager ensure on app start
(async () => {
  try{
    const conn = await dbAdapter.getConnection();
    try{
      await conn.query(`
        CREATE TABLE IF NOT EXISTS customers (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          phone VARCHAR(64) NULL,
          email VARCHAR(255) NULL,
          address VARCHAR(255) NULL,
          vat_number VARCHAR(32) NULL,
          cr_number VARCHAR(32) NULL,
          national_address VARCHAR(255) NULL,
          postal_code VARCHAR(16) NULL,
          street_number VARCHAR(32) NULL,
          sub_number VARCHAR(32) NULL,
          notes TEXT NULL,
          is_active TINYINT NOT NULL DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_name (name),
          INDEX idx_phone (phone),
          INDEX idx_email (email),
          INDEX idx_is_active (is_active),
          INDEX idx_created_at (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
      if(!(await dbAdapter.columnExists('customers', 'vat_number'))){
        try{ await conn.query("ALTER TABLE customers ADD COLUMN vat_number VARCHAR(32) NULL AFTER address"); }
        catch(e){ console.warn('init ensure: vat_number add failed', e.message || e); }
      }
      if(!(await dbAdapter.columnExists('customers', 'cr_number'))){
        try{ await conn.query("ALTER TABLE customers ADD COLUMN cr_number VARCHAR(32) NULL AFTER vat_number"); }
        catch(e){ console.warn('init ensure: cr_number add failed', e.message || e); }
      }
      if(!(await dbAdapter.columnExists('customers', 'national_address'))){
        try{ await conn.query("ALTER TABLE customers ADD COLUMN national_address VARCHAR(255) NULL AFTER cr_number"); }
        catch(e){ console.warn('init ensure: national_address add failed', e.message || e); }
      }
      if(!(await dbAdapter.columnExists('customers', 'postal_code'))){
        try{ await conn.query("ALTER TABLE customers ADD COLUMN postal_code VARCHAR(16) NULL AFTER national_address"); }
        catch(e){ console.warn('init ensure: postal_code add failed', e.message || e); }
      }
      if(!(await dbAdapter.columnExists('customers', 'street_number'))){
        try{ await conn.query("ALTER TABLE customers ADD COLUMN street_number VARCHAR(32) NULL AFTER postal_code"); }
        catch(e){ console.warn('init ensure: street_number add failed', e.message || e); }
      }
      if(!(await dbAdapter.columnExists('customers', 'sub_number'))){
        try{ await conn.query("ALTER TABLE customers ADD COLUMN sub_number VARCHAR(32) NULL AFTER street_number"); }
        catch(e){ console.warn('init ensure: sub_number add failed', e.message || e); }
      }
      
      // Add indexes if they don't exist
      try{
        const [indexes] = await conn.query("SHOW INDEX FROM customers WHERE Key_name = 'idx_name'");
        if(!indexes || indexes.length === 0){
          await conn.query("ALTER TABLE customers ADD INDEX idx_name (name)");
        }
      }catch(e){ console.warn('init: idx_name add failed', e.message || e); }
      try{
        const [indexes] = await conn.query("SHOW INDEX FROM customers WHERE Key_name = 'idx_phone'");
        if(!indexes || indexes.length === 0){
          await conn.query("ALTER TABLE customers ADD INDEX idx_phone (phone)");
        }
      }catch(e){ console.warn('init: idx_phone add failed', e.message || e); }
      try{
        const [indexes] = await conn.query("SHOW INDEX FROM customers WHERE Key_name = 'idx_email'");
        if(!indexes || indexes.length === 0){
          await conn.query("ALTER TABLE customers ADD INDEX idx_email (email)");
        }
      }catch(e){ console.warn('init: idx_email add failed', e.message || e); }
      try{
        const [indexes] = await conn.query("SHOW INDEX FROM customers WHERE Key_name = 'idx_is_active'");
        if(!indexes || indexes.length === 0){
          await conn.query("ALTER TABLE customers ADD INDEX idx_is_active (is_active)");
        }
      }catch(e){ console.warn('init: idx_is_active add failed', e.message || e); }
      try{
        const [indexes] = await conn.query("SHOW INDEX FROM customers WHERE Key_name = 'idx_created_at'");
        if(!indexes || indexes.length === 0){
          await conn.query("ALTER TABLE customers ADD INDEX idx_created_at (created_at)");
        }
      }catch(e){ console.warn('init: idx_created_at add failed', e.message || e); }
    } finally { conn.release(); }
  }catch(e){ /* silently ignore - tables will be created on first connection */ }
})();

module.exports = { registerCustomersIPC };