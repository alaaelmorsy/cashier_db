// Offers and Coupons IPC handlers
const { ipcMain } = require('electron');
const { dbAdapter, DB_NAME } = require('../db/db-adapter');

async function ensureTables(conn){
  await conn.query(`
    CREATE TABLE IF NOT EXISTS offers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      description VARCHAR(255) NULL,
      mode ENUM('percent','cash') NOT NULL,
      value DECIMAL(10,2) NOT NULL,
      start_date DATETIME NULL,
      end_date DATETIME NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  // Ensure is_global column exists (ignore error if already exists)
  try{ await conn.query('ALTER TABLE offers ADD COLUMN is_global TINYINT(1) NOT NULL DEFAULT 0'); }catch(_){ }

  await conn.query(`
    CREATE TABLE IF NOT EXISTS offer_products (
      id INT AUTO_INCREMENT PRIMARY KEY,
      offer_id INT NOT NULL,
      product_id INT NOT NULL,
      operation_id INT NULL,
      UNIQUE KEY uniq_offer_prod_op (offer_id, product_id, operation_id),
      KEY idx_offer (offer_id),
      KEY idx_product (product_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  await conn.query(`
    CREATE TABLE IF NOT EXISTS coupons (
      id INT AUTO_INCREMENT PRIMARY KEY,
      code VARCHAR(50) NOT NULL UNIQUE,
      name VARCHAR(150) NULL,
      mode ENUM('percent','cash') NOT NULL,
      value DECIMAL(10,2) NOT NULL,
      start_date DATETIME NULL,
      end_date DATETIME NULL,
      min_invoice_total DECIMAL(10,2) NULL,
      usage_limit INT NULL,
      used_count INT NOT NULL DEFAULT 0,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  // Quantity-based offers (buy X get Nth at discount)
  await conn.query(`
    CREATE TABLE IF NOT EXISTS offer_qty_rules (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      description VARCHAR(255) NULL,
      buy_qty INT NOT NULL,
      nth INT NOT NULL DEFAULT 1,
      mode ENUM('percent','cash') NOT NULL,
      value DECIMAL(10,2) NOT NULL,
      start_date DATETIME NULL,
      end_date DATETIME NULL,
      per_group TINYINT(1) NOT NULL DEFAULT 1,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  await conn.query(`
    CREATE TABLE IF NOT EXISTS offer_qty_products (
      id INT AUTO_INCREMENT PRIMARY KEY,
      rule_id INT NOT NULL,
      product_id INT NOT NULL,
      operation_id INT NULL,
      UNIQUE KEY uniq_rule_prod_op (rule_id, product_id, operation_id),
      KEY idx_rule (rule_id),
      KEY idx_product (product_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  try{ await conn.query('ALTER TABLE offer_qty_products ADD COLUMN mode ENUM(\'percent\',\'cash\') NULL'); }catch(_){ }
  try{ await conn.query('ALTER TABLE offer_qty_products ADD COLUMN value DECIMAL(10,2) NULL'); }catch(_){ }
  
  await conn.query(`
    CREATE TABLE IF NOT EXISTS offer_excluded_products (
      id INT AUTO_INCREMENT PRIMARY KEY,
      offer_id INT NOT NULL,
      product_id INT NOT NULL,
      operation_id INT NULL,
      UNIQUE KEY uniq_offer_excl_prod_op (offer_id, product_id, operation_id),
      KEY idx_offer (offer_id),
      KEY idx_product (product_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
}

function sanitizeModeAndValue(payload){
  const mode = payload && payload.mode === 'percent' ? 'percent' : 'cash';
  let value = Number(payload && payload.value || 0);
  if(mode === 'percent') value = Math.max(0, Math.min(100, value));
  if(mode === 'cash') value = Math.max(0, value);
  return { mode, value };
}

function registerOffersIPC(){
  // OFFERS CRUD
  ipcMain.handle('offers:list', async (_e, q) => {
    const query = q || {};
    const params = [];
    const where = [];
    if(query.q){ where.push('(name LIKE ? OR description LIKE ?)'); const s = `%${query.q}%`; params.push(s, s); }
    if(query.active != null){ where.push('is_active = ?'); params.push(String(query.active)==='1'?1:0); }
    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTables(conn);
        const [rows] = await conn.query(`
          SELECT o.*, (
            SELECT COUNT(*) FROM offer_products op WHERE op.offer_id = o.id
          ) AS items_count
          FROM offers o
          ${whereSql}
          ORDER BY o.id DESC
          LIMIT 500
        `, params);
        // تطبيع is_global في حال كان NULL
        for(const r of rows){ if(r.is_global == null){ r.is_global = 0; } }
        return { ok:true, items: rows };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'تعذر تحميل العروض' }; }
  });

  ipcMain.handle('offers:add', async (_e, payload) => {
    const name = (payload && payload.name || '').trim();
    if(!name) return { ok:false, error:'اسم العرض مطلوب' };
    const { mode, value } = sanitizeModeAndValue(payload);
    const start_date = payload && payload.start_date ? new Date(payload.start_date) : null;
    const end_date = payload && payload.end_date ? new Date(payload.end_date) : null;
    const description = payload && payload.description ? String(payload.description) : null;
    const is_active = (payload && String(payload.is_active) === '0') ? 0 : 1;
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTables(conn);
        // Prevent more than one global offer at a time
        if(Number(payload && payload.is_global ? 1 : 0) === 1){
          const [[g]] = await conn.query('SELECT id FROM offers WHERE is_global=1 LIMIT 1');
          if(g && g.id){ return { ok:false, error:'يوجد عرض عام بالفعل. احذف العرض الحالي قبل إضافة عرض عام جديد.' }; }
        }
        const [res] = await conn.query(
          'INSERT INTO offers(name, description, mode, value, start_date, end_date, is_active, is_global) VALUES (?,?,?,?,?,?,?,?)',
          [name, description, mode, value, start_date, end_date, is_active, Number(payload && payload.is_global ? 1 : 0)]
        );
        return { ok:true, id: res.insertId };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'فشل إضافة العرض' }; }
  });

  ipcMain.handle('offers:update', async (_e, idObj, payload) => {
    const id = (idObj && idObj.id) ? idObj.id : idObj;
    if(!id) return { ok:false, error:'معرّف مفقود' };
    const name = (payload && payload.name || '').trim();
    if(!name) return { ok:false, error:'اسم العرض مطلوب' };
    const { mode, value } = sanitizeModeAndValue(payload);
    const start_date = payload && payload.start_date ? new Date(payload.start_date) : null;
    const end_date = payload && payload.end_date ? new Date(payload.end_date) : null;
    const description = payload && payload.description ? String(payload.description) : null;
    const is_active = (payload && String(payload.is_active) === '0') ? 0 : 1;
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTables(conn);
        // Prevent having more than one global after update: if this update sets is_global=1, ensure no other global exists
        if(Number(payload && payload.is_global ? 1 : 0) === 1){
          const [rows] = await conn.query('SELECT id FROM offers WHERE is_global=1 AND id<>? LIMIT 1', [id]);
          if(rows && rows.length){ return { ok:false, error:'يوجد عرض عام بالفعل. احذف العرض الحالي قبل تفعيل عرض عام آخر.' }; }
        }
        await conn.query(
          'UPDATE offers SET name=?, description=?, mode=?, value=?, start_date=?, end_date=?, is_active=?, is_global=? WHERE id=?',
          [name, description, mode, value, start_date, end_date, is_active, Number(payload && payload.is_global ? 1 : 0), id]
        );
        return { ok:true };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'فشل تعديل العرض' }; }
  });

  ipcMain.handle('offers:delete', async (_e, idObj) => {
    const id = (idObj && idObj.id) ? idObj.id : idObj;
    if(!id) return { ok:false, error:'معرّف مفقود' };
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTables(conn);
        await conn.query('DELETE FROM offer_products WHERE offer_id=?', [id]);
        await conn.query('DELETE FROM offer_excluded_products WHERE offer_id=?', [id]);
        await conn.query('DELETE FROM offers WHERE id=?', [id]);
        return { ok:true };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'فشل حذف العرض' }; }
  });

  ipcMain.handle('offers:toggle', async (_e, idObj) => {
    const id = (idObj && idObj.id) ? idObj.id : idObj;
    if(!id) return { ok:false, error:'معرّف مفقود' };
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTables(conn);
        const [[row]] = await conn.query('SELECT is_active FROM offers WHERE id=?', [id]);
        if(!row) return { ok:false, error:'العرض غير موجود' };
        const next = row.is_active ? 0 : 1;
        await conn.query('UPDATE offers SET is_active=? WHERE id=?', [next, id]);
        return { ok:true, is_active: next };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'فشل تغيير الحالة' }; }
  });

  ipcMain.handle('offers:set_products', async (_e, idObj, items) => {
    const id = (idObj && idObj.id) ? idObj.id : idObj;
    if(!id) return { ok:false, error:'معرّف العرض مفقود' };
    const list = Array.isArray(items) ? items : [];
    // Support either [1,2,3] or [{product_id, operation_id}]
    const rows = [];
    for(const it of list){
      if(typeof it === 'number'){
        const pid = Number(it); if(pid) rows.push([id, pid, null]);
      } else if (it && typeof it === 'object'){
        const pid = Number(it.product_id||0); if(pid){
          const op = (it.operation_id!=null && it.operation_id!=='') ? Number(it.operation_id) : null;
          rows.push([id, pid, op]);
        }
      }
    }
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTables(conn);
        await conn.query('DELETE FROM offer_products WHERE offer_id=?', [id]);
        // حتى لو كانت rows فارغة فهذا يمسح القديم
        if(rows.length){ await conn.query('INSERT INTO offer_products(offer_id, product_id, operation_id) VALUES ?', [rows]); }
        return { ok:true };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'فشل ربط المنتجات' }; }
  });

  // Find active offer for a product (and optional operation)
  ipcMain.handle('offers:find_for_product', async (_e, payload) => {
    const product_id = Number(payload && payload.product_id);
    const operation_id = (payload && payload.operation_id != null) ? Number(payload.operation_id) : null;
    if(!product_id) return { ok:false, error:'product_id مفقود' };
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTables(conn);
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
        return { ok:true, item: rows && rows[0] ? rows[0] : null };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'تعذر البحث عن العرض' }; }
  });

  // Find active global offer (no product binding)
  ipcMain.handle('offers:find_global_active', async () => {
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTables(conn);
        const nowCond = ' (start_date IS NULL OR NOW() >= start_date) AND (end_date IS NULL OR NOW() <= end_date) ';
        const [rows] = await conn.query(`
          SELECT * FROM offers WHERE is_global = 1 AND is_active = 1 AND ${nowCond}
          ORDER BY id DESC
          LIMIT 1
        `);
        return { ok:true, item: rows && rows[0] ? rows[0] : null };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'تعذر البحث عن العرض العام' }; }
  });

  // List products linked to an offer (with names)
  ipcMain.handle('offers:get_products', async (_e, idObj) => {
    const id = (idObj && idObj.id) ? idObj.id : idObj;
    if(!id) return { ok:false, error:'معرّف العرض مفقود' };
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTables(conn);
        const [rows] = await conn.query(`
          SELECT op.product_id, op.operation_id,
                 p.name AS product_name,
                 o.name AS operation_name
          FROM offer_products op
          LEFT JOIN products p ON p.id = op.product_id
          LEFT JOIN operations o ON o.id = op.operation_id
          WHERE op.offer_id = ?
          ORDER BY op.id ASC
        `, [id]);
        return { ok:true, items: rows };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'تعذر تحميل أصناف العرض' }; }
  });

  // Set excluded products for an offer (global offers)
  ipcMain.handle('offers:set_excluded_products', async (_e, idObj, items) => {
    const id = (idObj && idObj.id) ? idObj.id : idObj;
    if(!id) return { ok:false, error:'معرّف العرض مفقود' };
    const list = Array.isArray(items) ? items : [];
    const rows = [];
    for(const it of list){
      if(typeof it === 'number'){
        const pid = Number(it); if(pid) rows.push([id, pid, null]);
      } else if (it && typeof it === 'object'){
        const pid = Number(it.product_id||0); if(pid){
          const op = (it.operation_id!=null && it.operation_id!=='') ? Number(it.operation_id) : null;
          rows.push([id, pid, op]);
        }
      }
    }
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTables(conn);
        await conn.query('DELETE FROM offer_excluded_products WHERE offer_id=?', [id]);
        if(rows.length){ await conn.query('INSERT INTO offer_excluded_products(offer_id, product_id, operation_id) VALUES ?', [rows]); }
        return { ok:true };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'فشل ربط المنتجات المستثناة' }; }
  });

  // Get excluded products for an offer
  ipcMain.handle('offers:get_excluded_products', async (_e, idObj) => {
    const id = (idObj && idObj.id) ? idObj.id : idObj;
    if(!id) return { ok:false, error:'معرّف العرض مفقود' };
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTables(conn);
        const [rows] = await conn.query(`
          SELECT ep.product_id, ep.operation_id,
                 p.name AS product_name,
                 o.name AS operation_name
          FROM offer_excluded_products ep
          LEFT JOIN products p ON p.id = ep.product_id
          LEFT JOIN operations o ON o.id = ep.operation_id
          WHERE ep.offer_id = ?
          ORDER BY ep.id ASC
        `, [id]);
        return { ok:true, items: rows };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'تعذر تحميل الأصناف المستثناة' }; }
  });

  // Quantity-based Offers (Buy X, discount on Nth)
  ipcMain.handle('offers_qty:list', async (_e, q) => {
    const query = q || {};
    const params = [];
    const where = [];
    if(query.q){ where.push('(name LIKE ? OR description LIKE ?)'); const s = `%${query.q}%`; params.push(s, s); }
    if(query.active != null){ where.push('is_active = ?'); params.push(String(query.active)==='1'?1:0); }
    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTables(conn);
        const [rows] = await conn.query(`
          SELECT r.*, (
            SELECT COUNT(*) FROM offer_qty_products qp WHERE qp.rule_id = r.id
          ) AS items_count
          FROM offer_qty_rules r
          ${whereSql}
          ORDER BY r.id DESC
          LIMIT 500
        `, params);
        return { ok:true, items: rows };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'تعذر تحميل عروض الكمية' }; }
  });

  ipcMain.handle('offers_qty:add', async (_e, payload) => {
    const name = (payload && payload.name || '').trim();
    if(!name) return { ok:false, error:'اسم العرض مطلوب' };
    const buy_qty = Math.max(1, Number(payload && payload.buy_qty || 0));
    const nth = Math.max(1, Number(payload && payload.nth || 1));
    const { mode, value } = sanitizeModeAndValue(payload);
    const start_date = payload && payload.start_date ? new Date(payload.start_date) : null;
    const end_date = payload && payload.end_date ? new Date(payload.end_date) : null;
    const description = payload && payload.description ? String(payload.description) : null;
    const per_group = (payload && String(payload.per_group) === '0') ? 0 : 1;
    const is_active = (payload && String(payload.is_active) === '0') ? 0 : 1;
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTables(conn);
        const [res] = await conn.query(
          'INSERT INTO offer_qty_rules(name, description, buy_qty, nth, mode, value, start_date, end_date, per_group, is_active) VALUES (?,?,?,?,?,?,?,?,?,?)',
          [name, description, buy_qty, nth, mode, value, start_date, end_date, per_group, is_active]
        );
        return { ok:true, id: res.insertId };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'فشل إضافة العرض الكمي' }; }
  });

  ipcMain.handle('offers_qty:update', async (_e, idObj, payload) => {
    const id = (idObj && idObj.id) ? idObj.id : idObj;
    if(!id) return { ok:false, error:'معرّف مفقود' };
    const name = (payload && payload.name || '').trim();
    if(!name) return { ok:false, error:'اسم العرض مطلوب' };
    const buy_qty = Math.max(1, Number(payload && payload.buy_qty || 0));
    const nth = Math.max(1, Number(payload && payload.nth || 1));
    const { mode, value } = sanitizeModeAndValue(payload);
    const start_date = payload && payload.start_date ? new Date(payload.start_date) : null;
    const end_date = payload && payload.end_date ? new Date(payload.end_date) : null;
    const description = payload && payload.description ? String(payload.description) : null;
    const per_group = (payload && String(payload.per_group) === '0') ? 0 : 1;
    const is_active = (payload && String(payload.is_active) === '0') ? 0 : 1;
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTables(conn);
        await conn.query(
          'UPDATE offer_qty_rules SET name=?, description=?, buy_qty=?, nth=?, mode=?, value=?, start_date=?, end_date=?, per_group=?, is_active=? WHERE id=?',
          [name, description, buy_qty, nth, mode, value, start_date, end_date, per_group, is_active, id]
        );
        return { ok:true };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'فشل تعديل العرض الكمي' }; }
  });

  ipcMain.handle('offers_qty:delete', async (_e, idObj) => {
    const id = (idObj && idObj.id) ? idObj.id : idObj;
    if(!id) return { ok:false, error:'معرّف مفقود' };
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTables(conn);
        await conn.query('DELETE FROM offer_qty_products WHERE rule_id=?', [id]);
        await conn.query('DELETE FROM offer_qty_rules WHERE id=?', [id]);
        return { ok:true };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'فشل حذف العرض الكمي' }; }
  });

  ipcMain.handle('offers_qty:toggle', async (_e, idObj) => {
    const id = (idObj && idObj.id) ? idObj.id : idObj;
    if(!id) return { ok:false, error:'معرّف مفقود' };
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTables(conn);
        const [[row]] = await conn.query('SELECT is_active FROM offer_qty_rules WHERE id=?', [id]);
        if(!row) return { ok:false, error:'العرض غير موجود' };
        const next = row.is_active ? 0 : 1;
        await conn.query('UPDATE offer_qty_rules SET is_active=? WHERE id=?', [next, id]);
        return { ok:true, is_active: next };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'فشل تغيير الحالة' }; }
  });

  ipcMain.handle('offers_qty:set_products', async (_e, idObj, items) => {
    const id = (idObj && idObj.id) ? idObj.id : idObj;
    if(!id) return { ok:false, error:'معرّف العرض مفقود' };
    const list = Array.isArray(items) ? items : [];
    const rows = [];
    for(const it of list){
      if(typeof it === 'number'){
        const pid = Number(it); if(pid) rows.push([id, pid, null, null, null]);
      } else if (it && typeof it === 'object'){
        const pid = Number(it.product_id||0); if(pid){
          const op = (it.operation_id!=null && it.operation_id!=='') ? Number(it.operation_id) : null;
          const mode = (it.mode === 'percent' || it.mode === 'cash') ? it.mode : null;
          const value = (it.value != null && Number(it.value) > 0) ? Number(it.value) : null;
          rows.push([id, pid, op, mode, value]);
        }
      }
    }
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTables(conn);
        await conn.query('DELETE FROM offer_qty_products WHERE rule_id=?', [id]);
        if(rows.length){ await conn.query('INSERT INTO offer_qty_products(rule_id, product_id, operation_id, mode, value) VALUES ?', [rows]); }
        return { ok:true };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'فشل ربط المنتجات' }; }
  });

  ipcMain.handle('offers_qty:get_products', async (_e, idObj) => {
    const id = (idObj && idObj.id) ? idObj.id : idObj;
    if(!id) return { ok:false, error:'معرّف العرض مفقود' };
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTables(conn);
        const [rows] = await conn.query(`
          SELECT qp.product_id, qp.operation_id, qp.mode, qp.value,
                 p.name AS product_name,
                 o.name AS operation_name
          FROM offer_qty_products qp
          LEFT JOIN products p ON p.id = qp.product_id
          LEFT JOIN operations o ON o.id = qp.operation_id
          WHERE qp.rule_id = ?
          ORDER BY qp.id ASC
        `, [id]);
        return { ok:true, items: rows };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'تعذر تحميل أصناف العرض الكمي' }; }
  });

  ipcMain.handle('offers_qty:find_for_product', async (_e, payload) => {
    const product_id = Number(payload && payload.product_id);
    const operation_id = (payload && payload.operation_id != null) ? Number(payload.operation_id) : null;
    if(!product_id) return { ok:false, error:'product_id مفقود' };
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTables(conn);
        const nowCond = ' (r.start_date IS NULL OR NOW() >= r.start_date) AND (r.end_date IS NULL OR NOW() <= r.end_date) ';
        const [rows] = await conn.query(`
          SELECT r.*, qp.mode AS product_mode, qp.value AS product_value 
          FROM offer_qty_rules r
          LEFT JOIN offer_qty_products qp ON qp.rule_id = r.id
          WHERE (qp.product_id = ? AND (qp.operation_id IS NULL OR qp.operation_id = ?))
            AND r.is_active = 1 AND ${nowCond}
          ORDER BY r.id DESC
          LIMIT 1
        `, [product_id, operation_id]);
        return { ok:true, item: rows && rows[0] ? rows[0] : null };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'تعذر البحث عن عرض كمي' }; }
  });
  
  // Validate coupon against date/usage/min invoice and compute discount for a given sub_total
  ipcMain.handle('coupons:validate', async (_e, payload) => {
    const code = (payload && payload.code || '').trim();
    const sub_total = Number(payload && payload.sub_total || 0);
    if(!code) return { ok:false, error:'أدخل رمز الكوبون' };
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTables(conn);
        const [[c]] = await conn.query('SELECT * FROM coupons WHERE code=? AND is_active=1 LIMIT 1', [code]);
        if(!c) return { ok:false, error:'الكوبون غير موجود أو موقوف' };
        const now = new Date();
        if(c.start_date && now < new Date(c.start_date)) return { ok:false, error:'الكوبون لم يبدأ بعد' };
        if(c.end_date && now > new Date(c.end_date)) return { ok:false, error:'انتهت صلاحية الكوبون' };
        if(c.usage_limit != null && Number(c.used_count||0) >= Number(c.usage_limit)) return { ok:false, error:'تم استنفاد حد استخدام الكوبون' };
        if(c.min_invoice_total != null && sub_total < Number(c.min_invoice_total)) return { ok:false, error:`يتطلب حد أدنى ${Number(c.min_invoice_total).toFixed(2)}` };
        const mode = c.mode === 'percent' ? 'percent' : 'cash';
        const value = Number(c.value||0);
        const amount = mode==='percent' ? Number((sub_total * (value/100)).toFixed(2)) : Math.min(sub_total, Number(value));
        return { ok:true, mode, value, amount, code };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'تعذر التحقق من الكوبون' }; }
  });

  // COUPONS CRUD
  ipcMain.handle('coupons:list', async (_e, q) => {
    const query = q || {};
    const params = [];
    const where = [];
    if(query.q){ where.push('(code LIKE ? OR name LIKE ?)'); const s = `%${query.q}%`; params.push(s, s); }
    if(query.active != null){ where.push('is_active = ?'); params.push(String(query.active)==='1'?1:0); }
    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTables(conn);
        const [rows] = await conn.query(`
          SELECT * FROM coupons
          ${whereSql}
          ORDER BY id DESC
          LIMIT 500
        `, params);
        return { ok:true, items: rows };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'تعذر تحميل الكوبونات' }; }
  });

  ipcMain.handle('coupons:add', async (_e, payload) => {
    const code = (payload && payload.code || '').trim();
    if(!code) return { ok:false, error:'رمز الكوبون مطلوب' };
    const name = (payload && payload.name || '').trim() || null;
    const { mode, value } = sanitizeModeAndValue(payload);
    const start_date = payload && payload.start_date ? new Date(payload.start_date) : null;
    const end_date = payload && payload.end_date ? new Date(payload.end_date) : null;
    const min_invoice_total = payload && payload.min_invoice_total != null ? Number(payload.min_invoice_total) : null;
    const usage_limit = payload && payload.usage_limit != null ? Math.max(0, Number(payload.usage_limit)) : null;
    const is_active = (payload && String(payload.is_active) === '0') ? 0 : 1;
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTables(conn);
        const [res] = await conn.query(
          'INSERT INTO coupons(code, name, mode, value, start_date, end_date, min_invoice_total, usage_limit, is_active) VALUES (?,?,?,?,?,?,?,?,?)',
          [code, name, mode, value, start_date, end_date, min_invoice_total, usage_limit, is_active]
        );
        return { ok:true, id: res.insertId };
      } finally { conn.release(); }
    }catch(e){ if(e && e.code==='ER_DUP_ENTRY') return { ok:false, error:'الرمز مستخدم مسبقًا' }; console.error(e); return { ok:false, error:'فشل إضافة الكوبون' }; }
  });

  ipcMain.handle('coupons:update', async (_e, idObj, payload) => {
    const id = (idObj && idObj.id) ? idObj.id : idObj;
    if(!id) return { ok:false, error:'معرّف مفقود' };
    const code = (payload && payload.code || '').trim();
    if(!code) return { ok:false, error:'رمز الكوبون مطلوب' };
    const name = (payload && payload.name || '').trim() || null;
    const { mode, value } = sanitizeModeAndValue(payload);
    const start_date = payload && payload.start_date ? new Date(payload.start_date) : null;
    const end_date = payload && payload.end_date ? new Date(payload.end_date) : null;
    const min_invoice_total = payload && payload.min_invoice_total != null ? Number(payload.min_invoice_total) : null;
    const usage_limit = payload && payload.usage_limit != null ? Math.max(0, Number(payload.usage_limit)) : null;
    const is_active = (payload && String(payload.is_active) === '0') ? 0 : 1;
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTables(conn);
        await conn.query(
          'UPDATE coupons SET code=?, name=?, mode=?, value=?, start_date=?, end_date=?, min_invoice_total=?, usage_limit=?, is_active=? WHERE id=?',
          [code, name, mode, value, start_date, end_date, min_invoice_total, usage_limit, is_active, id]
        );
        return { ok:true };
      } finally { conn.release(); }
    }catch(e){ if(e && e.code==='ER_DUP_ENTRY') return { ok:false, error:'الرمز مستخدم مسبقًا' }; console.error(e); return { ok:false, error:'فشل تعديل الكوبون' }; }
  });

  ipcMain.handle('coupons:delete', async (_e, idObj) => {
    const id = (idObj && idObj.id) ? idObj.id : idObj;
    if(!id) return { ok:false, error:'معرّف مفقود' };
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTables(conn);
        await conn.query('DELETE FROM coupons WHERE id=?', [id]);
        return { ok:true };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'فشل حذف الكوبون' }; }
  });

  ipcMain.handle('coupons:toggle', async (_e, idObj) => {
    const id = (idObj && idObj.id) ? idObj.id : idObj;
    if(!id) return { ok:false, error:'معرّف مفقود' };
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTables(conn);
        const [[row]] = await conn.query('SELECT is_active FROM coupons WHERE id=?', [id]);
        if(!row) return { ok:false, error:'الكوبون غير موجود' };
        const next = row.is_active ? 0 : 1;
        await conn.query('UPDATE coupons SET is_active=? WHERE id=?', [next, id]);
        return { ok:true, is_active: next };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'فشل تغيير الحالة' }; }
  });
}

// eager init
(async () => {
  try{
    const conn = await dbAdapter.getConnection();
    try{ await ensureTables(conn); } finally { conn.release(); }
  }catch(e){ /* silently ignore - tables will be created on first connection */ }
})();

module.exports = { registerOffersIPC };