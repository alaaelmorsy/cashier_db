// Main Types IPC (main categories)
const { ipcMain } = require('electron');
const { dbAdapter, DB_NAME } = require('../db/db-adapter');

function registerTypesIPC(){
  async function ensureTable(conn){
    // Ensure table exists with sort_order column (for custom ordering like operations)
    await conn.query(`
      CREATE TABLE IF NOT EXISTS main_types (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(128) NOT NULL UNIQUE,
        sort_order INT NOT NULL DEFAULT 0,
        is_active TINYINT NOT NULL DEFAULT 1,
        hidden_from_sales TINYINT NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    // Migration for older databases: add sort_order if missing and initialize
    const [colSort] = await conn.query("SHOW COLUMNS FROM main_types LIKE 'sort_order'");
    if(!colSort.length){
      await conn.query("ALTER TABLE main_types ADD COLUMN sort_order INT NOT NULL DEFAULT 0 AFTER name");
      // Initialize sort_order to id for stable default ordering
      await conn.query("UPDATE main_types SET sort_order = id WHERE sort_order = 0");
    }
    // Migration: add hidden_from_sales if missing
    const [colHidden] = await conn.query("SHOW COLUMNS FROM main_types LIKE 'hidden_from_sales'");
    if(!colHidden.length){
      await conn.query("ALTER TABLE main_types ADD COLUMN hidden_from_sales TINYINT NOT NULL DEFAULT 0 AFTER is_active");
    }
  }

  // add
  ipcMain.handle('types:add', async (_evt, payload) => {
    const { name } = payload || {};
    if(!name) return { ok:false, error:'اسم النوع الرئيسي مطلوب' };
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTable(conn);
        // Place new type at the end of the list
        const [mx] = await conn.query('SELECT COALESCE(MAX(sort_order), -1) AS m FROM main_types');
        const next = Number(mx && mx[0] && mx[0].m != null ? mx[0].m : -1) + 1;
        await conn.query('INSERT INTO main_types (name, sort_order) VALUES (?, ?)', [name, next]);
        return { ok:true };
      } finally { conn.release(); }
    }catch(e){
      if(e && e.code === 'ER_DUP_ENTRY') return { ok:false, error:'الاسم موجود مسبقًا' };
      console.error(e); return { ok:false, error:'فشل حفظ النوع' };
    }
  });

  // list active (for dropdowns and validation - includes hidden types)
  ipcMain.handle('types:list', async () => {
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTable(conn);
        const [rows] = await conn.query('SELECT id, name FROM main_types WHERE is_active=1 ORDER BY sort_order ASC, name ASC');
        return { ok:true, items: rows };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'تعذر تحميل الأنواع' }; }
  });

  // list active and visible (for display in sales screen tabs only)
  ipcMain.handle('types:list_for_display', async () => {
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTable(conn);
        const [rows] = await conn.query('SELECT id, name FROM main_types WHERE is_active=1 AND hidden_from_sales=0 ORDER BY sort_order ASC, name ASC');
        return { ok:true, items: rows };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'تعذر تحميل الأنواع' }; }
  });

  // list all (manage screen)
  ipcMain.handle('types:list_all', async () => {
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTable(conn);
        const [rows] = await conn.query('SELECT * FROM main_types ORDER BY sort_order ASC, name ASC');
        return { ok:true, items: rows };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'تعذر تحميل الأنواع' }; }
  });

  // get one
  ipcMain.handle('types:get', async (_e, id) => {
    const tid = (id && id.id) ? id.id : id;
    if(!tid) return { ok:false, error:'معرّف مفقود' };
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTable(conn);
        const [rows] = await conn.query('SELECT * FROM main_types WHERE id=? LIMIT 1', [tid]);
        if(rows.length===0) return { ok:false, error:'غير موجود' };
        return { ok:true, item: rows[0] };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'خطأ في الجلب' }; }
  });

  // update name only
  ipcMain.handle('types:update', async (_e, id, payload) => {
    const tid = (id && id.id) ? id.id : id;
    if(!tid) return { ok:false, error:'معرّف مفقود' };
    const { name } = payload || {};
    if(!name) return { ok:false, error:'الاسم مطلوب' };
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTable(conn);
        
        // Get old name before updating
        const [oldRows] = await conn.query('SELECT name FROM main_types WHERE id=?', [tid]);
        if(oldRows.length === 0) return { ok:false, error:'النوع غير موجود' };
        const oldName = oldRows[0].name;
        
        // Update the main_types table
        await conn.query('UPDATE main_types SET name=? WHERE id=?', [name, tid]);
        
        // Update all products that have the old category name to the new name
        await conn.query('UPDATE products SET category=? WHERE category=?', [name, oldName]);
        
        return { ok:true };
      } finally { conn.release(); }
    }catch(e){
      if(e && e.code === 'ER_DUP_ENTRY') return { ok:false, error:'الاسم موجود مسبقًا' };
      console.error(e); return { ok:false, error:'فشل التعديل' };
    }
  });

  // toggle active
  ipcMain.handle('types:toggle', async (_e, id) => {
    const tid = (id && id.id) ? id.id : id;
    if(!tid) return { ok:false, error:'معرّف مفقود' };
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTable(conn);
        const [rows] = await conn.query('SELECT is_active FROM main_types WHERE id=?', [tid]);
        if(rows.length===0) return { ok:false, error:'غير موجود' };
        const next = rows[0].is_active ? 0 : 1;
        await conn.query('UPDATE main_types SET is_active=? WHERE id=?', [next, tid]);
        return { ok:true };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'فشل تحديث الحالة' }; }
  });

  // delete
  ipcMain.handle('types:delete', async (_e, id) => {
    const tid = (id && id.id) ? id.id : id;
    if(!tid) return { ok:false, error:'معرّف مفقود' };
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTable(conn);
        
        const [typeRows] = await conn.query('SELECT name FROM main_types WHERE id=?', [tid]);
        if(typeRows.length === 0) return { ok:false, error:'النوع غير موجود' };
        
        const typeName = typeRows[0].name;
        const [productRows] = await conn.query('SELECT COUNT(*) as count FROM products WHERE category=?', [typeName]);
        const productCount = productRows[0].count || 0;
        
        if(productCount > 0){
          return { 
            ok: false, 
            error: `لا يمكن حذف هذا النوع لأنه يحتوي على ${productCount} صنف مرتبط به. يمكنك إيقافه بدلاً من الحذف.`,
            cannotDelete: true
          };
        }
        
        await conn.query('DELETE FROM main_types WHERE id=?', [tid]);
        return { ok:true };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'فشل الحذف' }; }
  });

  // Reorder types (array of {id, sort_order})
  ipcMain.handle('types:reorder', async (_e, items) => {
    try{
      const list = Array.isArray(items) ? items : [];
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTable(conn);
        const updates = list.map(it => [Number(it.sort_order||0), Number(it.id)]);
        if(updates.length){
          // Batch update using CASE for efficiency
          const ids = updates.map(u => u[1]);
          const cases = updates.map(u => `WHEN id=${u[1]} THEN ${u[0]}`).join(' ');
          await conn.query(`UPDATE main_types SET sort_order = CASE ${cases} END WHERE id IN (${ids.join(',')})`);
        }
        return { ok:true };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'فشل حفظ ترتيب الأنواع' }; }
  });

  // toggle hide from sales
  ipcMain.handle('types:toggle_hide', async (_e, id) => {
    const tid = (id && id.id) ? id.id : id;
    if(!tid) return { ok:false, error:'معرّف مفقود' };
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTable(conn);
        const [rows] = await conn.query('SELECT hidden_from_sales FROM main_types WHERE id=?', [tid]);
        if(rows.length===0) return { ok:false, error:'غير موجود' };
        const next = rows[0].hidden_from_sales ? 0 : 1;
        await conn.query('UPDATE main_types SET hidden_from_sales=? WHERE id=?', [next, tid]);
        return { ok:true };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'فشل تحديث حالة الإخفاء' }; }
  });

  // Eager ensure table once when registering IPC (use inner ensureTable scope)
  (async () => {
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTable(conn);
      } finally { conn.release(); }
    }catch(e){ /* silently ignore - tables will be created on first connection */ }
  })();
}

module.exports = { registerTypesIPC };