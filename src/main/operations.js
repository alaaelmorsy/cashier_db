// Operations IPC handlers: manage operations and product-specific operation prices
const { ipcMain } = require('electron');
const { dbAdapter, DB_NAME } = require('../db/db-adapter');

async function ensureTables(conn){
  await conn.query(`CREATE TABLE IF NOT EXISTS operations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(128) NOT NULL UNIQUE,
    sort_order INT NOT NULL DEFAULT 0,
    is_active TINYINT NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);
  // ترقية الجداول القديمة: إضافة عمود sort_order إن لم يكن موجودًا
  const [colSort] = await conn.query("SHOW COLUMNS FROM operations LIKE 'sort_order'");
  if(!colSort.length){
    await conn.query("ALTER TABLE operations ADD COLUMN sort_order INT NOT NULL DEFAULT 0 AFTER name");
  }

  await conn.query(`CREATE TABLE IF NOT EXISTS product_operations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    operation_id INT NOT NULL,
    price DECIMAL(10,2) NOT NULL DEFAULT 0,
    UNIQUE KEY uniq_prod_op (product_id, operation_id),
    CONSTRAINT fk_po_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    CONSTRAINT fk_po_operation FOREIGN KEY (operation_id) REFERENCES operations(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);
}

function registerOperationsIPC(){
  // CRUD for operations
  ipcMain.handle('ops:list', async () => {
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTables(conn);
        const [rows] = await conn.query('SELECT * FROM operations ORDER BY sort_order ASC, is_active DESC, name ASC');
        return { ok:true, items: rows };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'تعذر تحميل العمليات' }; }
  });

  ipcMain.handle('ops:add', async (_e, payload) => {
    const name = (payload && payload.name ? String(payload.name) : '').trim();
    const sort_order = Number(payload && payload.sort_order || 0);
    if(!name) return { ok:false, error:'اسم العملية مطلوب' };
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTables(conn);
        const [res] = await conn.query('INSERT INTO operations (name, sort_order, is_active) VALUES (?,?,1)', [name, sort_order]);
        return { ok:true, id: res.insertId };
      } finally { conn.release(); }
    }catch(e){
      if (e && e.code === 'ER_DUP_ENTRY') return { ok:false, error:'اسم العملية موجود مسبقاً' };
      console.error(e); return { ok:false, error:'فشل الحفظ' };
    }
  });

  ipcMain.handle('ops:update', async (_e, id, payload) => {
    const oid = (id && id.id) ? id.id : id;
    if(!oid) return { ok:false, error:'معرّف مفقود' };
    const { name, is_active } = payload || {};
    const sort_order = Number(payload && payload.sort_order || 0);
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTables(conn);
        await conn.query('UPDATE operations SET name=?, sort_order=?, is_active=? WHERE id=?', [name, sort_order, (is_active?1:0), oid]);
        return { ok:true };
      } finally { conn.release(); }
    }catch(e){
      if (e && e.code === 'ER_DUP_ENTRY') return { ok:false, error:'اسم العملية موجود مسبقاً' };
      console.error(e); return { ok:false, error:'فشل التحديث' };
    }
  });

  ipcMain.handle('ops:toggle', async (_e, id) => {
    const oid = (id && id.id) ? id.id : id;
    if(!oid) return { ok:false, error:'معرّف مفقود' };
    try{
      const conn = await dbAdapter.getConnection();
      try{
        const [rows] = await conn.query('SELECT is_active FROM operations WHERE id=?', [oid]);
        if(!rows.length) return { ok:false, error:'غير موجود' };
        const next = rows[0].is_active ? 0 : 1;
        await conn.query('UPDATE operations SET is_active=? WHERE id=?', [next, oid]);
        return { ok:true };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'فشل تحديث الحالة' }; }
  });

  ipcMain.handle('ops:delete', async (_e, id) => {
    const oid = (id && id.id) ? id.id : id;
    if(!oid) return { ok:false, error:'معرّف مفقود' };
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTables(conn);
        
        const [opRows] = await conn.query('SELECT name FROM operations WHERE id=?', [oid]);
        if(opRows.length === 0) return { ok:false, error:'العملية غير موجودة' };
        
        const [productRows] = await conn.query('SELECT COUNT(*) as count FROM product_operations WHERE operation_id=?', [oid]);
        const productCount = productRows[0].count || 0;
        
        if(productCount > 0){
          return { 
            ok: false, 
            error: `لا يمكن حذف هذه العملية لأنها مرتبطة بـ ${productCount} منتج. يمكنك إيقافها بدلاً من الحذف.`,
            cannotDelete: true
          };
        }
        
        await conn.query('DELETE FROM operations WHERE id=?', [oid]);
        return { ok:true };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'فشل الحذف' }; }
  });

  // Product <-> Operations mapping
  ipcMain.handle('prod_ops:list', async (_e, product_id) => {
    const pid = (product_id && product_id.id) ? product_id.id : product_id;
    if(!pid) return { ok:false, error:'معرّف المنتج مفقود' };
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTables(conn);
        const [rows] = await conn.query(`
          SELECT po.operation_id, po.price, o.name, o.is_active, o.sort_order
          FROM product_operations po
          JOIN operations o ON o.id = po.operation_id
          WHERE po.product_id = ?
          ORDER BY o.sort_order ASC, o.name ASC
        `, [pid]);
        return { ok:true, items: rows };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'تعذر تحميل عمليات المنتج' }; }
  });

  // Batch fetch operations for multiple products (10x+ performance improvement for exports)
  ipcMain.handle('prod_ops:list_batch', async (_e, product_ids) => {
    const ids = Array.isArray(product_ids) ? product_ids.filter(id => id) : [];
    if(!ids.length) return { ok:true, items: {} };
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTables(conn);
        // Get all product operations in one query
        const placeholders = ids.map(() => '?').join(',');
        const [rows] = await conn.query(`
          SELECT po.product_id, po.operation_id, po.price, o.name, o.is_active, o.sort_order
          FROM product_operations po
          JOIN operations o ON o.id = po.operation_id
          WHERE po.product_id IN (${placeholders})
          ORDER BY po.product_id ASC, o.sort_order ASC, o.name ASC
        `, ids);
        
        // Group by product_id
        const result = {};
        (rows || []).forEach(row => {
          if(!result[row.product_id]) result[row.product_id] = [];
          result[row.product_id].push({
            operation_id: row.operation_id,
            price: row.price,
            name: row.name,
            is_active: row.is_active,
            sort_order: row.sort_order
          });
        });
        return { ok:true, items: result };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'تعذر تحميل عمليات المنتجات', items: {} }; }
  });

  ipcMain.handle('prod_ops:set', async (_e, product_id, items) => {
    const pid = (product_id && product_id.id) ? product_id.id : product_id;
    if(!pid) return { ok:false, error:'معرّف المنتج مفقود' };
    const list = Array.isArray(items) ? items : [];
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTables(conn);
        await conn.query('DELETE FROM product_operations WHERE product_id=?', [pid]);
        if(list.length){
          const values = list.map(it => [pid, Number(it.operation_id), Number(it.price||0)]);
          await conn.query('INSERT INTO product_operations (product_id, operation_id, price) VALUES ?',[values]);
        }
        return { ok:true };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'فشل حفظ ربط العمليات' }; }
  });
}

// eager init to ensure tables at app start
(async () => {
  try{
    const conn = await dbAdapter.getConnection();
    try{
      await ensureTables(conn);
    } finally { conn.release(); }
  }catch(e){ /* silently ignore - tables will be created on first connection */ }
})();

module.exports = { registerOperationsIPC };