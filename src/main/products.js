// Products IPC handlers: add product
const { ipcMain } = require('electron');
const { dbAdapter, DB_NAME } = require('../db/db-adapter');
const { isSecondaryDevice, fetchFromAPI } = require('./api-client');

function registerProductsIPC(){
  // ensure table exists once
  async function ensureTable(conn){
    await conn.query(`
      CREATE TABLE IF NOT EXISTS products (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        name_en VARCHAR(255) NULL,
        barcode VARCHAR(64) UNIQUE NULL,
        price DECIMAL(10,2) NOT NULL DEFAULT 0,
        cost DECIMAL(10,2) NOT NULL DEFAULT 0,
        stock DECIMAL(12,3) NOT NULL DEFAULT 0,
        category VARCHAR(128) NULL,
        description TEXT NULL,
        image_path VARCHAR(512) NULL,
        is_tobacco TINYINT NOT NULL DEFAULT 0,
        is_active TINYINT NOT NULL DEFAULT 1,
        base_unit VARCHAR(32) NOT NULL DEFAULT 'piece',
        base_qty_step DECIMAL(12,3) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    // ترقيات جداول قديمة: إضافة أعمدة مفقودة إن لزم
    const [colNameEn] = await conn.query("SHOW COLUMNS FROM products LIKE 'name_en'");
    if (!colNameEn.length) {
      await conn.query("ALTER TABLE products ADD COLUMN name_en VARCHAR(255) NULL AFTER name");
    }
    const [colImg] = await conn.query("SHOW COLUMNS FROM products LIKE 'image_path'");
    if (!colImg.length) {
      await conn.query("ALTER TABLE products ADD COLUMN image_path VARCHAR(512) NULL AFTER description");
    }
    // New image BLOB storage (for packaged builds)
    const [colImgBlob] = await conn.query("SHOW COLUMNS FROM products LIKE 'image_blob'");
    if (!colImgBlob.length) {
      await conn.query("ALTER TABLE products ADD COLUMN image_blob LONGBLOB NULL AFTER image_path");
    }
    const [colImgMime] = await conn.query("SHOW COLUMNS FROM products LIKE 'image_mime'");
    if (!colImgMime.length) {
      await conn.query("ALTER TABLE products ADD COLUMN image_mime VARCHAR(64) NULL AFTER image_blob");
    }
    const [colActive] = await conn.query("SHOW COLUMNS FROM products LIKE 'is_active'");
    if (!colActive.length) {
      await conn.query("ALTER TABLE products ADD COLUMN is_active TINYINT NOT NULL DEFAULT 1 AFTER description");
    }
    const [colTobacco] = await conn.query("SHOW COLUMNS FROM products LIKE 'is_tobacco'");
    if (!colTobacco.length) {
      await conn.query("ALTER TABLE products ADD COLUMN is_tobacco TINYINT NOT NULL DEFAULT 0 AFTER image_path");
    }
    const [colSortOrder] = await conn.query("SHOW COLUMNS FROM products LIKE 'sort_order'");
    if (!colSortOrder.length) {
      await conn.query("ALTER TABLE products ADD COLUMN sort_order INT NOT NULL DEFAULT 0 AFTER name_en");
    }
    const [colMinPrice] = await conn.query("SHOW COLUMNS FROM products LIKE 'min_price'");
    if (!colMinPrice.length) {
      await conn.query("ALTER TABLE products ADD COLUMN min_price DECIMAL(10,2) NULL DEFAULT NULL AFTER price");
    }
    const [colHideFromSales] = await conn.query("SHOW COLUMNS FROM products LIKE 'hide_from_sales'");
    if (!colHideFromSales.length) {
      await conn.query("ALTER TABLE products ADD COLUMN hide_from_sales TINYINT NOT NULL DEFAULT 0 AFTER is_active");
    }
    const [colExpiryDate] = await conn.query("SHOW COLUMNS FROM products LIKE 'expiry_date'");
    if (!colExpiryDate.length) {
      await conn.query("ALTER TABLE products ADD COLUMN expiry_date DATE NULL AFTER hide_from_sales");
    }

    // Multi-unit support: ensure base_unit and base_qty_step exist for legacy DBs
    const [colBaseUnit] = await conn.query("SHOW COLUMNS FROM products LIKE 'base_unit'");
    if(!colBaseUnit.length){
      await conn.query("ALTER TABLE products ADD COLUMN base_unit VARCHAR(32) NOT NULL DEFAULT 'piece' AFTER is_active");
    }
    const [colBaseStep] = await conn.query("SHOW COLUMNS FROM products LIKE 'base_qty_step'");
    if(!colBaseStep.length){
      await conn.query("ALTER TABLE products ADD COLUMN base_qty_step DECIMAL(12,3) NOT NULL DEFAULT 1 AFTER base_unit");
    }

    // Ensure stock supports 3 decimal places
    try{
      const [colStock] = await conn.query("SHOW COLUMNS FROM products LIKE 'stock'");
      if(colStock && colStock.length){
        const typeStr = String(colStock[0].Type||'').toLowerCase();
        // If not DECIMAL or scale < 3, upgrade to DECIMAL(12,3)
        let needsUpgrade = false;
        if(!typeStr.includes('decimal')) {
          needsUpgrade = true;
        } else {
          const m = typeStr.match(/decimal\((\d+),(\d+)\)/);
          if(m){ const scale = Number(m[2]||0); if(scale < 3) needsUpgrade = true; }
        }
        if(needsUpgrade){
          await conn.query("ALTER TABLE products MODIFY stock DECIMAL(12,3) NOT NULL DEFAULT 0");
        }
      }
    }catch(_){ /* ignore */ }

    // Indexes to speed up catalog on remote connections
    // Optimized composite index for sales catalog query (is_active, hide_from_sales, category, sort_order)
    try{ 
      const [existingIdx] = await conn.query("SHOW INDEX FROM products WHERE Key_name='idx_products_sales_catalog'");
      if(!existingIdx.length){
        await conn.query("CREATE INDEX idx_products_sales_catalog ON products (is_active, hide_from_sales, category, sort_order)");
      }
    }catch(_){ }
    
    try{ await conn.query("CREATE INDEX idx_products_barcode ON products (barcode)"); }catch(_){ }
    try{ await conn.query("CREATE INDEX idx_products_name ON products (name(100))"); }catch(_){ }
    try{ await conn.query("CREATE INDEX idx_products_name_en ON products (name_en(100))"); }catch(_){ }
    try{ await conn.query("CREATE INDEX idx_products_expiry_date ON products (expiry_date)"); }catch(_){ }
    
    // Full-Text Search Index for fast text search (replaces slow LIKE %query%)
    try{ 
      await conn.query("ALTER TABLE products ADD FULLTEXT INDEX ft_products_search (name, name_en)"); 
    }catch(_){ }
    
    // Legacy indexes cleanup (can be removed after migration)
    try{ await conn.query("DROP INDEX idx_products_active ON products"); }catch(_){ }
    try{ await conn.query("DROP INDEX idx_products_category ON products"); }catch(_){ }
    try{ await conn.query("DROP INDEX idx_products_sort ON products"); }catch(_){ }
    try{ await conn.query("DROP INDEX idx_products_active_cat_sort ON products"); }catch(_){ }
    try{ await conn.query("DROP INDEX idx_products_hide_from_sales ON products"); }catch(_){ }

    // Multi-unit support: ensure product_units table exists
    await conn.query(`
      CREATE TABLE IF NOT EXISTS product_units (
        id INT AUTO_INCREMENT PRIMARY KEY,
        product_id INT NOT NULL,
        unit_name VARCHAR(64) NOT NULL,
        multiplier DECIMAL(12,3) NOT NULL,
        price_mode ENUM('auto','manual') NOT NULL DEFAULT 'auto',
        price DECIMAL(10,2) NULL,
        UNIQUE KEY uniq_prod_unit (product_id, unit_name),
        CONSTRAINT fk_pu_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Product variants with individual barcodes (for multi-unit sales)
    await conn.query(`
      CREATE TABLE IF NOT EXISTS product_variants (
        id INT AUTO_INCREMENT PRIMARY KEY,
        product_id INT NOT NULL,
        variant_name VARCHAR(128) NOT NULL,
        barcode VARCHAR(64) UNIQUE NULL,
        price DECIMAL(10,2) NOT NULL DEFAULT 0,
        cost DECIMAL(10,2) NULL,
        is_active TINYINT NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_pv_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        KEY idx_variant_barcode (barcode),
        KEY idx_variant_product (product_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    // Ensure stock_deduct_multiplier exists in product_variants for legacy DBs
    try{
      const [colSDM] = await conn.query("SHOW COLUMNS FROM product_variants LIKE 'stock_deduct_multiplier'");
      if(!colSDM.length){
        await conn.query("ALTER TABLE product_variants ADD COLUMN stock_deduct_multiplier DECIMAL(12,3) NOT NULL DEFAULT 1 AFTER cost");
      }
    }catch(_){ }
    // Backfill/upgrade columns for legacy DBs where table exists without new columns
    try{
      const [colUnit] = await conn.query("SHOW COLUMNS FROM product_units LIKE 'unit_name'");
      if(!colUnit.length){ await conn.query("ALTER TABLE product_units ADD COLUMN unit_name VARCHAR(64) NOT NULL AFTER product_id"); }
      const [colMult] = await conn.query("SHOW COLUMNS FROM product_units LIKE 'multiplier'");
      if(!colMult.length){ await conn.query("ALTER TABLE product_units ADD COLUMN multiplier DECIMAL(12,3) NOT NULL DEFAULT 1 AFTER unit_name"); }
      const [colMode] = await conn.query("SHOW COLUMNS FROM product_units LIKE 'price_mode'");
      if(!colMode.length){ await conn.query("ALTER TABLE product_units ADD COLUMN price_mode ENUM('auto','manual') NOT NULL DEFAULT 'auto' AFTER multiplier"); }
      const [colPrice] = await conn.query("SHOW COLUMNS FROM product_units LIKE 'price'");
      if(!colPrice.length){ await conn.query("ALTER TABLE product_units ADD COLUMN price DECIMAL(10,2) NULL AFTER price_mode"); }
      // For legacy schemas where price might be NOT NULL, relax it to NULL
      try {
        const [colInfo] = await conn.query("SHOW FULL COLUMNS FROM product_units LIKE 'price'");
        if (Array.isArray(colInfo) && colInfo.length && String(colInfo[0].Null||'').toUpperCase() === 'NO') {
          await conn.query("ALTER TABLE product_units MODIFY COLUMN price DECIMAL(10,2) NULL");
        }
      } catch(_) { }
      // Ensure unique index exists
      try{ await conn.query("CREATE UNIQUE INDEX uniq_prod_unit ON product_units (product_id, unit_name)"); }catch(_){ }
    }catch(_){ }
  }

  ipcMain.handle('products:add', async (_evt, payload) => {
    const { name, name_en, price, cost, stock, category, description } = payload || {};
    let { barcode } = payload || {};
    if(!name) return { ok:false, error:'اسم المنتج مطلوب' };
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTable(conn);
        
        // إذا لم يتم إدخال باركود، قم بإنشاء باركود تلقائي يبدأ من 10000
        if(!barcode || barcode.trim() === ''){
          let autoBarcode = 10000;
          while(true){
            const [existing] = await conn.query('SELECT id FROM products WHERE barcode = ? LIMIT 1', [String(autoBarcode)]);
            if(!existing || existing.length === 0){
              barcode = String(autoBarcode);
              break;
            }
            autoBarcode++;
          }
        }
        
        // ضع العنصر الجديد في آخر الترتيب
        const [maxRow] = await conn.query('SELECT MAX(sort_order) AS m FROM products');
        const nextOrder = (Array.isArray(maxRow) && maxRow.length && maxRow[0].m != null) ? (Number(maxRow[0].m)||0)+1 : 0;
        const imgMime = payload?.image_mime || null;
        const imgBase64 = payload?.image_blob_base64 || null;
        const imgBuffer = (imgBase64 && typeof imgBase64 === 'string') ? Buffer.from(imgBase64, 'base64') : null;
        const expiryDate = payload?.expiry_date || null;
        const [r] = await conn.query(
          'INSERT INTO products (name, name_en, barcode, price, min_price, cost, stock, category, description, image_path, image_blob, image_mime, is_tobacco, is_active, hide_from_sales, expiry_date, sort_order, base_unit, base_qty_step) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
          [name, payload.name_en || null, barcode, price ?? 0, (payload.min_price!=null ? Number(payload.min_price) : null), cost ?? 0, stock ?? 0, category, description, payload.image_path || null, imgBuffer, imgMime, payload.is_tobacco ? 1 : 0, 1, (payload.hide_from_sales ? 1 : 0), expiryDate, nextOrder, (payload.base_unit||'piece'), (payload.base_qty_step!=null? Number(payload.base_qty_step): 1)]
        );
        const newId = r && (r.insertId || r.insertId === 0) ? Number(r.insertId) : null;
        return { ok:true, id: newId };
      } finally { conn.release(); }
    }catch(e){
      if (e && (e.code === 'ER_DUP_ENTRY' || e.code === 'SQLITE_CONSTRAINT')) return { ok:false, error:'الباركود موجود مسبقاً' };
      console.error(e); return { ok:false, error:'فشل حفظ المنتج' };
    }
  });

  // product units APIs
  ipcMain.handle('product_units:list', async (_e, product_id) => {
    const pid = (product_id && product_id.id) ? product_id.id : product_id;
    if(!pid) return { ok:false, error:'معرّف المنتج مفقود' };
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTable(conn);
        const [rows] = await conn.query('SELECT id, unit_name, multiplier, price_mode, price FROM product_units WHERE product_id=? ORDER BY id ASC', [pid]);
        return { ok:true, items: rows };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'تعذر تحميل وحدات المنتج' }; }
  });
  ipcMain.handle('product_units:set', async (_e, product_id, items) => {
    const pid = (product_id && product_id.id) ? product_id.id : product_id;
    const list = Array.isArray(items) ? items : [];
    if(!pid) return { ok:false, error:'معرّف المنتج مفقود' };
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTable(conn);
        await conn.query('DELETE FROM product_units WHERE product_id=?', [pid]);
        if(list.length){
          const [pRows] = await conn.query('SELECT price FROM products WHERE id=? LIMIT 1', [pid]);
          const basePrice = (Array.isArray(pRows) && pRows.length && pRows[0].price != null) ? Number(pRows[0].price) : 0;
          const values = list
            .map(u => {
              const unitName = String(u.unit_name || '').trim();
              const multiplier = Number(u.multiplier || 0);
              const mode = (u.price_mode === 'manual' ? 'manual' : 'auto');
              if (!unitName || !multiplier || multiplier <= 0) return null;
              // Compute price:
              // - auto: basePrice * multiplier
              // - manual: use provided price; if missing/invalid, fallback to auto
              let price;
              if (mode === 'manual' && u.price != null && u.price !== '') {
                price = Number(u.price);
              } else {
                price = Number((basePrice * multiplier).toFixed(2));
              }
              return [pid, unitName, multiplier, mode, price];
            })
            .filter(Boolean);
          if (values.length){
            await conn.query('INSERT INTO product_units (product_id, unit_name, multiplier, price_mode, price) VALUES ?', [values]);
          }
        }
        return { ok:true };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'فشل حفظ وحدات المنتج' }; }
  });

  // ========== PRODUCT VARIANTS API ==========
  // List variants for a product
  ipcMain.handle('product_variants:list', async (_e, product_id) => {
    const pid = (product_id && product_id.id) ? product_id.id : product_id;
    if(!pid) return { ok:false, error:'معرّف المنتج مفقود' };
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTable(conn);
        const [rows] = await conn.query('SELECT id, variant_name, barcode, price, cost, stock_deduct_multiplier, is_active, created_at FROM product_variants WHERE product_id=? ORDER BY id ASC', [pid]);
        return { ok:true, items: rows };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'تعذر تحميل الأصناف' }; }
  });

  // Add variant for product
  ipcMain.handle('product_variants:add', async (_e, payload) => {
    const product_id = Number(payload?.product_id);
    const variant_name = String(payload?.variant_name || '').trim();
    const barcode = String(payload?.barcode || '').trim();
    const price = Number(payload?.price || 0);
    const cost = payload?.cost != null ? Number(payload.cost) : null;

    if(!product_id) return { ok:false, error:'معرّف المنتج مفقود' };
    if(!variant_name) return { ok:false, error:'اسم الصنف مطلوب' };
    if(!barcode) return { ok:false, error:'الباركود مطلوب' };
    if(price <= 0) return { ok:false, error:'السعر يجب أن يكون أكبر من صفر' };

    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTable(conn);
        await conn.query(
          'INSERT INTO product_variants (product_id, variant_name, barcode, price, cost, stock_deduct_multiplier) VALUES (?,?,?,?,?,?)',
          [product_id, variant_name, barcode, price, cost, (payload?.stock_deduct_multiplier!=null ? Number(payload.stock_deduct_multiplier) : 1)]
        );
        return { ok:true };
      } finally { conn.release(); }
    }catch(e){
      if(e?.code === 'ER_DUP_ENTRY' || e?.code === 'SQLITE_CONSTRAINT') return { ok:false, error:'هذا الباركود موجود مسبقاً' };
      console.error(e); return { ok:false, error:'فشل إضافة الصنف' };
    }
  });

  // Update variant
  ipcMain.handle('product_variants:update', async (_e, payload) => {
    const variant_id = Number(payload?.id);
    const variant_name = String(payload?.variant_name || '').trim();
    const price = payload?.price != null ? Number(payload.price) : null;
    const cost = payload?.cost != null ? Number(payload.cost) : null;
    const is_active = payload?.is_active != null ? (payload.is_active ? 1 : 0) : null;

    if(!variant_id) return { ok:false, error:'معرّف الصنف مفقود' };
    if(price != null && price <= 0) return { ok:false, error:'السعر يجب أن يكون أكبر من صفر' };

    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTable(conn);
        const updates = [];
        const params = [];
        if(variant_name) { updates.push('variant_name=?'); params.push(variant_name); }
        if(price != null) { updates.push('price=?'); params.push(price); }
        if(cost != null) { updates.push('cost=?'); params.push(cost); }
        if(payload?.stock_deduct_multiplier != null) { updates.push('stock_deduct_multiplier=?'); params.push(Number(payload.stock_deduct_multiplier)); }
        if(is_active != null) { updates.push('is_active=?'); params.push(is_active); }
        if(!updates.length) return { ok:false, error:'لا توجد بيانات للتحديث' };
        params.push(variant_id);
        await conn.query('UPDATE product_variants SET ' + updates.join(',') + ' WHERE id=?', params);
        return { ok:true };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'فشل تحديث الصنف' }; }
  });

  // Delete variant
  ipcMain.handle('product_variants:delete', async (_e, variant_id) => {
    const vid = (variant_id && variant_id.id) ? variant_id.id : variant_id;
    if(!vid) return { ok:false, error:'معرّف الصنف مفقود' };
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTable(conn);
        await conn.query('DELETE FROM product_variants WHERE id=?', [vid]);
        return { ok:true };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'فشل حذف الصنف' }; }
  });

  // list (exclude image_blob from rows to keep payload small)
  ipcMain.handle('products:list', async (_e, q) => {
    // If Secondary device, fetch from API
    if (isSecondaryDevice()) {
      try {
        const result = await fetchFromAPI('/products', q || {});
        return { ok: true, products: result.products || [] };
      } catch (err) {
        return { ok: false, error: err.message };
      }
    }

    const query = q || {};
    const where = [];
    const whereParams = [];
    const orderParams = [];
    
    // Use LIKE for search queries (works with all word lengths including short Arabic words)
    if(query.q){
      const searchTerm = String(query.q).trim();
      if(query.starts_with){
        where.push('(name LIKE ? OR name_en LIKE ? OR barcode LIKE ?)');
        whereParams.push(`${searchTerm}%`, `${searchTerm}%`, `${searchTerm}%`);
      } else {
        where.push('(name LIKE ? OR name_en LIKE ? OR barcode LIKE ?)');
        whereParams.push(`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`);
      }
    }
    
    if(query.active==="1" || query.active==="0"){ where.push('is_active=?'); whereParams.push(Number(query.active)); }
    if(query.category){ where.push('category = ?'); whereParams.push(query.category); }
    if(query.hide_from_sales==="0" || query.hide_from_sales==="1"){ where.push('hide_from_sales=?'); whereParams.push(Number(query.hide_from_sales)); }

    let order = 'ORDER BY id DESC';
    if(query.sort === 'custom') order = 'ORDER BY sort_order ASC, is_active DESC, name ASC';
    if(query.sort === 'name_asc') order = 'ORDER BY name ASC';
    if(query.sort === 'price_asc') order = 'ORDER BY price ASC';
    if(query.sort === 'price_desc') order = 'ORDER BY price DESC';
    if(query.sort === 'stock_desc') order = 'ORDER BY stock DESC';
    // For search queries, prioritize exact matches at the beginning
    if(query.q && !/^\d+$/.test(String(query.q).trim())){
      order = 'ORDER BY (name LIKE ?) DESC, name ASC';
      orderParams.push(`${String(query.q).trim()}%`);
    }

    const whereSql = where.length ? ('WHERE ' + where.join(' AND ')) : '';

    // Optional pagination
    const limit = Number(query.limit || 0);
    const offset = Number(query.offset || 0);

    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTable(conn);
        
        let total = 0;
        if(!query.skip_count){
          const countSql = `SELECT COUNT(*) as total FROM products ${whereSql}`;
          const [countRows] = await conn.query(countSql, whereParams);
          total = (countRows && countRows[0] && countRows[0].total) ? Number(countRows[0].total) : 0;
        }
        
        const params = [...whereParams, ...orderParams];
        let sql = `SELECT id,name,name_en,barcode,price,min_price,cost,stock,category,is_tobacco,is_active,hide_from_sales,sort_order FROM products ${whereSql} ${order}`;
        if(limit > 0){ sql += ' LIMIT ? OFFSET ?'; params.push(limit, Math.max(0, offset)); }
        const [rows] = await conn.query(sql, params);
        return { ok:true, items: rows, total };
      } finally { conn.release(); }
    }catch(e){ 
      // Fallback to LIKE if Full-Text Search fails (e.g., index not created yet)
      console.error('Full-Text Search failed, falling back to LIKE:', e); 
      try{
        const conn = await dbAdapter.getConnection();
        try{
          await ensureTable(conn);
          const whereFallback = [];
          const paramsFallback = [];
          if(query.q){
            if(query.starts_with){
              whereFallback.push('(name LIKE ? OR name_en LIKE ? OR barcode LIKE ?)');
              paramsFallback.push(`${query.q}%`, `${query.q}%`, `${query.q}%`);
            } else {
              whereFallback.push('(name LIKE ? OR name_en LIKE ? OR barcode LIKE ?)');
              paramsFallback.push(`%${query.q}%`, `%${query.q}%`, `%${query.q}%`);
            }
          }
          if(query.active==="1" || query.active==="0"){ whereFallback.push('is_active=?'); paramsFallback.push(Number(query.active)); }
          if(query.category){ whereFallback.push('category = ?'); paramsFallback.push(query.category); }
          if(query.hide_from_sales==="0" || query.hide_from_sales==="1"){ whereFallback.push('hide_from_sales=?'); paramsFallback.push(Number(query.hide_from_sales)); }
          const whereSqlFallback = whereFallback.length ? ('WHERE ' + whereFallback.join(' AND ')) : '';
          
          let total = 0;
          if(!query.skip_count){
            const countSql = `SELECT COUNT(*) as total FROM products ${whereSqlFallback}`;
            const [countRows] = await conn.query(countSql, paramsFallback);
            total = (countRows && countRows[0] && countRows[0].total) ? Number(countRows[0].total) : 0;
          }
          
          let orderFallback = 'ORDER BY id DESC';
          if(query.sort === 'custom') orderFallback = 'ORDER BY sort_order ASC, is_active DESC, name ASC';
          let sql = `SELECT id,name,name_en,barcode,price,min_price,cost,stock,category,is_tobacco,is_active,hide_from_sales,sort_order FROM products ${whereSqlFallback} ${orderFallback}`;
          if(limit > 0){ sql += ' LIMIT ? OFFSET ?'; paramsFallback.push(limit, Math.max(0, offset)); }
          const [rows] = await conn.query(sql, paramsFallback);
          return { ok:true, items: rows, total };
        } finally { conn.release(); }
      }catch(e2){ console.error(e2); return { ok:false, error:'خطأ في تحميل المنتجات' }; }
    }
  });

  // get (without image_blob for list/detail to keep payload light)
  ipcMain.handle('products:get', async (_e, id) => {
    const pid = (id && id.id) ? id.id : id;
    if(!pid) return { ok:false, error:'معرّف مفقود' };

    // If Secondary device, fetch from API
    if (isSecondaryDevice()) {
      try {
        const result = await fetchFromAPI(`/products/${pid}`);
        if (!result.ok) return { ok: false, error: result.error || 'فشل جلب المنتج' };
        return { ok: true, product: result.product };
      } catch (err) {
        return { ok: false, error: err.message };
      }
    }

    try{
      const conn = await dbAdapter.getConnection();
      try{
        const [rows] = await conn.query('SELECT id,name,name_en,barcode,price,min_price,cost,stock,category,description,image_path,image_mime,is_tobacco,is_active,hide_from_sales,expiry_date,sort_order,created_at FROM products WHERE id=? LIMIT 1', [pid]);
        if(rows.length===0) return { ok:false, error:'غير موجود' };
        return { ok:true, item: rows[0] };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'خطأ في الجلب' }; }
  });

  // get by barcode (exclude image_blob) with Arabic-Indic digit normalization fallback
  // Optimized: normalize once and use indexed column for fast lookup
  ipcMain.handle('products:get_by_barcode', async (_e, barcode) => {
    const raw = (barcode && barcode.barcode) ? barcode.barcode : barcode;
    const code = String(raw || '').trim();
    if(!code) return { ok:false, error:'باركود مفقود' };

    // If Secondary device, fetch from API
    if (isSecondaryDevice()) {
      try {
        const result = await fetchFromAPI(`/products/barcode/${code}`);
        return { ok: true, product: result.product };
      } catch (err) {
        return { ok: false, error: err.message };
      }
    }
    
    // Normalize Arabic-Indic digits (both U+066x and U+06Fx ranges) to ASCII
    const normalizeDigits = (str) => {
      return str.replace(/[\u0660-\u0669\u06F0-\u06F9]/g, ch => {
        const c = ch.charCodeAt(0);
        if(c>=0x0660 && c<=0x0669) return String(c-0x0660);
        if(c>=0x06F0 && c<=0x06F9) return String(c-0x06F0);
        return ch;
      });
    };
    
    // Generate search variants (normalized)
    const codeNormalized = normalizeDigits(code).replace(/\s+/g,'');
    
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTable(conn);
        
        // First, search in product_variants (optimized with 2 conditions only)
        // Index on barcode makes this very fast
        const variantSql = `SELECT pv.id, pv.variant_name, pv.barcode, pv.price, pv.cost, 
                                   p.id AS product_id, p.name, p.name_en, p.stock, p.category, 
                                   p.description, p.image_path, p.image_mime, p.is_tobacco, 
                                   p.is_active, p.expiry_date, p.sort_order, p.created_at, pv.id AS variant_id
                            FROM product_variants pv
                            JOIN products p ON p.id = pv.product_id
                            WHERE pv.is_active = 1
                              AND (pv.barcode = ? OR pv.barcode = ?)
                            LIMIT 1`;
        const [variantRows] = await conn.query(variantSql, [code, codeNormalized]);
        if(variantRows.length > 0) {
          const v = variantRows[0];
          return { ok:true, item: {
            id: v.product_id,
            name: v.name,
            name_en: v.name_en,
            barcode: v.barcode,
            price: v.price,
            cost: v.cost || v.price,
            stock: v.stock,
            category: v.category,
            description: v.description,
            image_path: v.image_path,
            image_mime: v.image_mime,
            is_tobacco: v.is_tobacco,
            is_active: v.is_active,
            sort_order: v.sort_order,
            created_at: v.created_at,
            variant_id: v.variant_id,
            variant_name: v.variant_name
          }};
        }
        
        // If not found in variants, search in products (optimized with 2 conditions)
        // Index on barcode makes this extremely fast (no full table scan)
        const sql = `SELECT id,name,name_en,barcode,price,min_price,cost,stock,category,description,image_path,image_mime,is_tobacco,is_active,hide_from_sales,expiry_date,sort_order,created_at
                     FROM products
                     WHERE barcode = ? OR barcode = ?
                     LIMIT 1`;
        const [rows] = await conn.query(sql, [code, codeNormalized]);
        if(rows.length===0) return { ok:false, error:'غير موجود' };
        return { ok:true, item: rows[0] };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'خطأ في الجلب' }; }
  });

  // get products by expiry date range and status
  ipcMain.handle('products:get_by_expiry', async (_e, params) => {
    const { from_date, to_date, status } = params;
    if(!from_date || !to_date || !status) return { ok:false, error:'معلمات مفقودة' };
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTable(conn);
        const today = new Date();
        today.setHours(0,0,0,0);
        const todayStr = today.toISOString().split('T')[0];
        
        let sql, queryParams;
        
        if(status === 'expired'){
          sql = `SELECT id,name,name_en,barcode,price,cost,stock,category,description,image_path,is_tobacco,is_active,expiry_date,created_at 
                 FROM products 
                 WHERE expiry_date IS NOT NULL 
                   AND expiry_date BETWEEN ? AND ?
                   AND expiry_date < ?
                 ORDER BY expiry_date ASC`;
          queryParams = [from_date, to_date, todayStr];
        } else if(status === 'valid'){
          sql = `SELECT id,name,name_en,barcode,price,cost,stock,category,description,image_path,is_tobacco,is_active,expiry_date,created_at 
                 FROM products 
                 WHERE expiry_date IS NOT NULL 
                   AND expiry_date BETWEEN ? AND ?
                   AND expiry_date >= ?
                 ORDER BY expiry_date ASC`;
          queryParams = [from_date, to_date, todayStr];
        } else {
          sql = `SELECT id,name,name_en,barcode,price,cost,stock,category,description,image_path,is_tobacco,is_active,expiry_date,created_at 
                 FROM products 
                 WHERE expiry_date IS NOT NULL 
                   AND expiry_date BETWEEN ? AND ?
                 ORDER BY expiry_date ASC`;
          queryParams = [from_date, to_date];
        }
        
        console.log('Expiry report query:', { from_date, to_date, status, todayStr, sql });
        const [rows] = await conn.query(sql, queryParams);
        console.log('Expiry report results:', rows.length, 'products found');
        return { ok:true, products: rows };
      } finally { conn.release(); }
    }catch(e){ console.error('Error in products:get_by_expiry:', e); return { ok:false, error:'خطأ في جلب المنتجات' }; }
  });

  // fetch product image (BLOB or legacy path) as base64 for on-demand rendering
  ipcMain.handle('products:image_get', async (_e, idObj) => {
    const pid = (idObj && idObj.id) ? idObj.id : idObj;
    if(!pid) return { ok:false, error:'معرّف مفقود' };
    try{
      const fs = require('fs');
      const path = require('path');
      const conn = await dbAdapter.getConnection();
      try{
        const [rows] = await conn.query('SELECT image_blob, image_mime, image_path FROM products WHERE id=? LIMIT 1', [pid]);
        if(!rows.length) return { ok:false, error:'غير موجود' };
        const row = rows[0];
        if(row.image_blob){
          const base64 = Buffer.from(row.image_blob).toString('base64');
          return { ok:true, base64, mime: row.image_mime || 'image/png' };
        }
        const relOrAbs = row.image_path;
        if(relOrAbs){
          try{
            // support both absolute and app-relative 'assets/...'
            let abs = relOrAbs;
            if(/^assets\//.test(relOrAbs)){
              abs = path.resolve(__dirname, '..', '..', relOrAbs);
            }
            const buf = fs.readFileSync(abs);
            const ext = String(path.extname(abs)).toLowerCase();
            const mime = ext==='.jpg' || ext==='.jpeg' ? 'image/jpeg' : ext==='.webp' ? 'image/webp' : 'image/png';
            return { ok:true, base64: buf.toString('base64'), mime };
          }catch(_){ /* ignore path read errors */ }
        }
        return { ok:false, error:'لا توجد صورة' };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'خطأ في الجلب' }; }
  });

  // update
  ipcMain.handle('products:update', async (_e, id, payload) => {
    const pid = (id && id.id) ? id.id : id;
    if(!pid) return { ok:false, error:'معرّف مفقود' };
    const { name, name_en, barcode, price, cost, stock, category, description } = payload || {};
    if(!name) return { ok:false, error:'اسم المنتج مطلوب' };
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTable(conn);

        // Image update strategy:
        // - if remove_image: clear image fields
        // - else if image_blob_base64: replace with new BLOB
        // - else: keep current image fields unchanged
        const expiryDate = payload?.expiry_date || null;
        if(payload && payload.remove_image){
          await conn.query('UPDATE products SET name=?, name_en=?, barcode=?, price=?, min_price=?, cost=?, stock=?, category=?, description=?, image_path=NULL, image_blob=NULL, image_mime=NULL, is_tobacco=?, hide_from_sales=?, expiry_date=?, base_unit=?, base_qty_step=? WHERE id=?', [name, (name_en||null), barcode||null, price??0, (payload.min_price!=null ? Number(payload.min_price) : null), cost??0, stock??0, category||null, description||null, (payload.is_tobacco ? 1 : 0), (payload.hide_from_sales ? 1 : 0), expiryDate, (payload.base_unit||'piece'), (payload.base_qty_step!=null? Number(payload.base_qty_step): 1), pid]);
        } else if(payload && payload.image_blob_base64){
          const imgMime = payload?.image_mime || 'image/png';
          const imgBase64 = payload?.image_blob_base64 || null;
          const imgBuffer = (imgBase64 && typeof imgBase64 === 'string') ? Buffer.from(imgBase64, 'base64') : null;
          await conn.query('UPDATE products SET name=?, name_en=?, barcode=?, price=?, min_price=?, cost=?, stock=?, category=?, description=?, image_path=NULL, image_blob=?, image_mime=?, is_tobacco=?, hide_from_sales=?, expiry_date=?, base_unit=?, base_qty_step=? WHERE id=?', [name, (name_en||null), barcode||null, price??0, (payload.min_price!=null ? Number(payload.min_price) : null), cost??0, stock??0, category||null, description||null, imgBuffer, imgMime, (payload.is_tobacco ? 1 : 0), (payload.hide_from_sales ? 1 : 0), expiryDate, (payload.base_unit||'piece'), (payload.base_qty_step!=null? Number(payload.base_qty_step): 1), pid]);
        } else {
          await conn.query('UPDATE products SET name=?, name_en=?, barcode=?, price=?, min_price=?, cost=?, stock=?, category=?, description=?, is_tobacco=?, hide_from_sales=?, expiry_date=?, base_unit=?, base_qty_step=? WHERE id=?', [name, (name_en||null), barcode||null, price??0, (payload.min_price!=null ? Number(payload.min_price) : null), cost??0, stock??0, category||null, description||null, (payload.is_tobacco ? 1 : 0), (payload.hide_from_sales ? 1 : 0), expiryDate, (payload.base_unit||'piece'), (payload.base_qty_step!=null? Number(payload.base_qty_step): 1), pid]);
        }

        // After update, optionally trigger low stock email if enabled and stock is at/below threshold
        try{
          const [[s]] = await conn.query('SELECT low_stock_email_enabled, low_stock_threshold, low_stock_email_per_item, low_stock_email_cooldown_hours, email, smtp_host, smtp_port, smtp_secure, smtp_user, smtp_pass, seller_legal_name, company_location FROM app_settings WHERE id=1');
          if(s && s.low_stock_email_enabled){
            const [[pRow]] = await conn.query('SELECT id,name,stock FROM products WHERE id=?', [pid]);
            if(pRow){
              const threshold = Math.max(0, Number(s.low_stock_threshold||5));
              const isLow = Number(pRow.stock||0) <= threshold;
              if(isLow){
                const now = new Date();
                const hh = Math.max(1, Number(s.low_stock_email_cooldown_hours||24));
                await conn.query(`CREATE TABLE IF NOT EXISTS app_notifications (
                  id INT AUTO_INCREMENT PRIMARY KEY,
                  type VARCHAR(64) NOT NULL,
                  ref_id INT NULL,
                  sent_at DATETIME NOT NULL,
                  key_name VARCHAR(255) NULL,
                  UNIQUE KEY uniq_type_ref_key (type, ref_id, key_name)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);
                const keyName = 'low_stock';
                const [[last]] = await conn.query('SELECT sent_at FROM app_notifications WHERE type=? AND ref_id=? AND key_name=? ORDER BY sent_at DESC LIMIT 1', ['email', Number(pRow.id), keyName]);
                let canSend = true;
                if(last){
                  const lastAt = new Date(last.sent_at);
                  const diffH = (now - lastAt) / (1000*60*60);
                  if(diffH < hh){ canSend = false; }
                }
                if(canSend){
                  try{
                    const info = await require('./scheduler').__sendLowStockEmailInternal(s, [{ id: pRow.id, name: pRow.name, stock: Number(pRow.stock||0) }]);
                    await conn.query('INSERT INTO app_notifications (type, ref_id, sent_at, key_name) VALUES (?,?,NOW(),?)', ['email', Number(pRow.id), keyName]);
                  }catch(e){ console.error('low stock email send failed', e && e.message || e); }
                }
              }
            }
          }
        }catch(_){ }

        return { ok:true };
      } finally { conn.release(); }
    }catch(e){
      if (e && (e.code === 'ER_DUP_ENTRY' || e.code === 'SQLITE_CONSTRAINT')) return { ok:false, error:'الباركود موجود مسبقاً' };
      console.error(e); return { ok:false, error:'فشل التعديل' };
    }
  });

  // toggle
  ipcMain.handle('products:toggle', async (_e, id) => {
    const pid = (id && id.id) ? id.id : id;
    if(!pid) return { ok:false, error:'معرّف مفقود' };
    try{
      const conn = await dbAdapter.getConnection();
      try{
        const [rows] = await conn.query('SELECT is_active FROM products WHERE id=?', [pid]);
        if(rows.length===0) return { ok:false, error:'غير موجود' };
        const next = rows[0].is_active ? 0 : 1;
        await conn.query('UPDATE products SET is_active=? WHERE id=?', [next, pid]);
        return { ok:true };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'فشل تحديث الحالة' }; }
  });

  // reorder: استلام مصفوفة مرتبة من معرّفات المنتجات وتحديث sort_order
  ipcMain.handle('products:reorder', async (_e, ids) => {
    const list = Array.isArray(ids) ? ids.map(Number).filter(n => !isNaN(n)) : [];
    if(!list.length) return { ok:false, error:'قائمة فارغة' };
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTable(conn);
        // نحدّث sort_order بحسب الترتيب في المصفوفة
        for(let i=0;i<list.length;i++){
          await conn.query('UPDATE products SET sort_order=? WHERE id=?', [i, list[i]]);
        }
        return { ok:true };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'فشل تحديث الترتيب' }; }
  });

  // delete
  ipcMain.handle('products:delete', async (_e, id) => {
    const pid = (id && id.id) ? id.id : id;
    if(!pid) return { ok:false, error:'معرّف مفقود' };
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await conn.query('DELETE FROM products WHERE id=?', [pid]);
        return { ok:true };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'فشل الحذف' }; }
  });

  // bulk reset all products
  ipcMain.handle('products:reset_all', async () => {
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await conn.beginTransaction();
        // حذف كل المنتجات وإعادة الترقيم
        await conn.query('DELETE FROM products');
        try{ await conn.query('ALTER TABLE products AUTO_INCREMENT = 1'); }catch(_){ }

        // تأكيد وجود جدول الأنواع الرئيسية ثم حذفها أيضًا وإعادة الترقيم
        await conn.query(`
          CREATE TABLE IF NOT EXISTS main_types (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(128) NOT NULL UNIQUE,
            is_active TINYINT NOT NULL DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        await conn.query('DELETE FROM main_types');
        try{ await conn.query('ALTER TABLE main_types AUTO_INCREMENT = 1'); }catch(_){ }

        // تأكيد وجود جداول العمليات وربطها ثم حذفها أيضًا وإعادة الترقيم
        await conn.query(`
          CREATE TABLE IF NOT EXISTS operations (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(128) NOT NULL UNIQUE,
            sort_order INT NOT NULL DEFAULT 0,
            is_active TINYINT NOT NULL DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        await conn.query(`
          CREATE TABLE IF NOT EXISTS product_operations (
            id INT AUTO_INCREMENT PRIMARY KEY,
            product_id INT NOT NULL,
            operation_id INT NOT NULL,
            price DECIMAL(10,2) NOT NULL DEFAULT 0,
            UNIQUE KEY uniq_prod_op (product_id, operation_id),
            CONSTRAINT fk_po_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
            CONSTRAINT fk_po_operation FOREIGN KEY (operation_id) REFERENCES operations(id) ON DELETE CASCADE
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        // احذف ربط العمليات أولاً ثم العمليات
        await conn.query('DELETE FROM product_operations');
        try{ await conn.query('ALTER TABLE product_operations AUTO_INCREMENT = 1'); }catch(_){ }
        await conn.query('DELETE FROM operations');
        try{ await conn.query('ALTER TABLE operations AUTO_INCREMENT = 1'); }catch(_){ }

        await conn.commit();
        return { ok:true };
      } catch(e){ await conn.rollback(); throw e; }
      finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'فشل إعادة تعيين المنتجات' }; }
  });

  ipcMain.handle('products:import_excel', async (evt, excelData) => {
    if(!excelData || !Array.isArray(excelData) || excelData.length === 0){
      return { ok:false, error:'لا توجد بيانات للاستيراد' };
    }
    
    const sendProgress = (current, total, phase = 'processing') => {
      try{
        evt.sender.send('products:import_progress', { current, total, phase });
      }catch(_){}
    };
    
    const conn = await dbAdapter.getConnection();
    try{
      await ensureTable(conn);
      sendProgress(0, excelData.length, 'validation');
      
      await conn.query('START TRANSACTION');
      
      const [maxRow] = await conn.query('SELECT MAX(sort_order) AS m FROM products');
      let nextOrder = (Array.isArray(maxRow) && maxRow.length && maxRow[0].m != null) ? (Number(maxRow[0].m)||0)+1 : 0;
      
      const [existingBarcodes] = await conn.query('SELECT barcode FROM products WHERE barcode IS NOT NULL AND barcode != ""');
      const barcodeSet = new Set((existingBarcodes || []).map(r => String(r.barcode)));
      
      let successCount = 0;
      let errorCount = 0;
      const errors = [];
      const validRows = [];
      const rowMapping = [];
      
      for(let i = 0; i < excelData.length; i++){
        const row = excelData[i];
        const rowNum = i + 2;
        
        if(i % 100 === 0){
          sendProgress(i, excelData.length, 'validation');
        }
        
        const name = String(row.name || '').trim();
        const barcode = row.barcode ? String(row.barcode).trim() : null;
        const cost = Number(row.cost || 0);
        const price = Number(row.price || 0);
        const stock = Number(row.stock || 0);
        
        if(!name){
          errors.push(`السطر ${rowNum}: اسم المنتج مطلوب`);
          errorCount++;
          continue;
        }
        
        if(barcode && barcodeSet.has(barcode)){
          errors.push(`السطر ${rowNum}: الباركود "${barcode}" موجود مسبقاً`);
          errorCount++;
          continue;
        }
        
        if(barcode) barcodeSet.add(barcode);
        validRows.push([name, barcode, price, cost, stock, nextOrder++]);
        rowMapping.push({ rowNum, name, barcode });
        successCount++;
      }
      
      sendProgress(excelData.length, excelData.length, 'validation');
      
      if(validRows.length > 0){
        const BATCH_SIZE = 1000;
        let insertedCount = 0;
        
        for(let i = 0; i < validRows.length; i += BATCH_SIZE){
          const batch = validRows.slice(i, i + BATCH_SIZE);
          const batchMapping = rowMapping.slice(i, i + BATCH_SIZE);
          
          sendProgress(insertedCount, validRows.length, 'inserting');
          
          try{
            await conn.query(
              'INSERT INTO products (name, barcode, price, cost, stock, sort_order, is_active) VALUES ?',
              [batch.map(r => [...r, 1])]
            );
            insertedCount += batch.length;
          }catch(e){
            console.error('Batch insert error:', e);
            for(let j = 0; j < batch.length; j++){
              const row = batch[j];
              const mapping = batchMapping[j];
              try{
                await conn.query(
                  'INSERT INTO products (name, barcode, price, cost, stock, sort_order, is_active) VALUES (?,?,?,?,?,?,1)',
                  row
                );
                insertedCount++;
              }catch(innerE){
                if (innerE && (innerE.code === 'ER_DUP_ENTRY' || innerE.code === 'SQLITE_CONSTRAINT')){
                  errors.push(`السطر ${mapping.rowNum} (${mapping.name}): الباركود "${mapping.barcode}" موجود مسبقاً`);
                }else{
                  errors.push(`السطر ${mapping.rowNum} (${mapping.name}): ${innerE.message || 'خطأ غير معروف'}`);
                }
                successCount--;
                errorCount++;
              }
            }
          }
        }
        
        sendProgress(validRows.length, validRows.length, 'inserting');
      }
      
      await conn.query('COMMIT');
      sendProgress(100, 100, 'complete');
      
      return { 
        ok:true, 
        successCount, 
        errorCount, 
        errors: errors
      };
    }catch(e){
      try{ await conn.query('ROLLBACK'); }catch(_){}
      console.error(e);
      return { ok:false, error:'فشل استيراد المنتجات' };
    }finally{
      conn.release();
    }
  });

  ipcMain.handle('products:read_excel_file', async (_evt, filePath) => {
    try{
      const XLSX = require('xlsx');
      const workbook = XLSX.readFile(filePath);
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(firstSheet);
      
      if(!jsonData || jsonData.length === 0){
        return { ok: false, error: 'الملف فارغ أو لا يحتوي على بيانات' };
      }
      
      const excelData = jsonData.map(row => ({
        name: row['الاسم'] || row['name'] || row['Name'] || '',
        barcode: row['الباركود'] || row['barcode'] || row['Barcode'] || '',
        cost: parseFloat(row['سعر الشراء'] || row['cost'] || row['Cost'] || 0),
        price: parseFloat(row['سعر البيع'] || row['price'] || row['Price'] || 0),
        stock: parseFloat(row['المخزون'] || row['stock'] || row['Stock'] || 0)
      }));
      
      return { ok: true, data: excelData };
    }catch(e){
      console.error('Error reading Excel file:', e);
      return { ok: false, error: 'فشل قراءة ملف Excel: ' + (e.message || 'خطأ غير معروف') };
    }
  });

  ipcMain.handle('products:download_template', async () => {
    try{
      const XLSX = require('xlsx');
      const { dialog } = require('electron');
      const fs = require('fs');
      const path = require('path');
      
      const sampleData = [
        { 'الاسم': 'منتج تجريبي 1', 'الباركود': '1234567890', 'سعر الشراء': 10, 'سعر البيع': 15, 'المخزون': 100 },
        { 'الاسم': 'منتج تجريبي 2', 'الباركود': '0987654321', 'سعر الشراء': 20, 'سعر البيع': 30, 'المخزون': 50 },
        { 'الاسم': 'منتج تجريبي 3', 'الباركود': '', 'سعر الشراء': 5, 'سعر البيع': 8, 'المخزون': 200 }
      ];
      
      const ws = XLSX.utils.json_to_sheet(sampleData);
      
      ws['!cols'] = [
        { wch: 25 },
        { wch: 15 },
        { wch: 12 },
        { wch: 12 },
        { wch: 10 }
      ];
      
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'المنتجات');
      
      const result = await dialog.showSaveDialog({
        title: 'حفظ ملف Excel النموذجي',
        defaultPath: path.join(require('os').homedir(), 'Downloads', 'template_products.xlsx'),
        filters: [
          { name: 'Excel Files', extensions: ['xlsx'] }
        ]
      });
      
      if(!result.canceled && result.filePath){
        XLSX.writeFile(wb, result.filePath);
        return { ok: true, path: result.filePath };
      }
      
      return { ok: false, error: 'تم الإلغاء' };
    }catch(e){
      console.error('Error creating template:', e);
      return { ok: false, error: 'فشل إنشاء الملف النموذجي' };
    }
  });
}

// eager init to ensure table exists on app start
(async () => {
  try{
    const conn = await dbAdapter.getConnection();
    try{
      // local ensure since ensureTable is inside closure; duplicate minimal DDL
      await conn.query(`
        CREATE TABLE IF NOT EXISTS products (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          name_en VARCHAR(255) NULL,
          barcode VARCHAR(64) UNIQUE NULL,
          price DECIMAL(10,2) NOT NULL DEFAULT 0,
          cost DECIMAL(10,2) NOT NULL DEFAULT 0,
          stock DECIMAL(12,3) NOT NULL DEFAULT 0,
          category VARCHAR(128) NULL,
          description TEXT NULL,
          image_path VARCHAR(512) NULL,
          image_blob LONGBLOB NULL,
          image_mime VARCHAR(64) NULL,
          is_active TINYINT NOT NULL DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
      const [colNameEn] = await conn.query("SHOW COLUMNS FROM products LIKE 'name_en'");
      if (!colNameEn.length) {
        await conn.query("ALTER TABLE products ADD COLUMN name_en VARCHAR(255) NULL AFTER name");
      }
      const [colImg] = await conn.query("SHOW COLUMNS FROM products LIKE 'image_path'");
      if (!colImg.length) {
        await conn.query("ALTER TABLE products ADD COLUMN image_path VARCHAR(512) NULL AFTER description");
      }
      const [colImgBlob] = await conn.query("SHOW COLUMNS FROM products LIKE 'image_blob'");
      if (!colImgBlob.length) {
        await conn.query("ALTER TABLE products ADD COLUMN image_blob LONGBLOB NULL AFTER image_path");
      }
      const [colImgMime] = await conn.query("SHOW COLUMNS FROM products LIKE 'image_mime'");
      if (!colImgMime.length) {
        await conn.query("ALTER TABLE products ADD COLUMN image_mime VARCHAR(64) NULL AFTER image_blob");
      }
      const [colActive] = await conn.query("SHOW COLUMNS FROM products LIKE 'is_active'");
      if (!colActive.length) {
        await conn.query("ALTER TABLE products ADD COLUMN is_active TINYINT NOT NULL DEFAULT 1 AFTER description");
      }
      // Ensure product_variants table exists on startup
      await conn.query(`
        CREATE TABLE IF NOT EXISTS product_variants (
          id INT AUTO_INCREMENT PRIMARY KEY,
          product_id INT NOT NULL,
          variant_name VARCHAR(128) NOT NULL,
          barcode VARCHAR(64) UNIQUE NULL,
          price DECIMAL(10,2) NOT NULL DEFAULT 0,
          cost DECIMAL(10,2) NULL,
          stock_deduct_multiplier DECIMAL(12,3) NOT NULL DEFAULT 1,
          is_active TINYINT NOT NULL DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT fk_pv_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
          KEY idx_variant_barcode (barcode),
          KEY idx_variant_product (product_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
      // upgrade: add stock_deduct_multiplier if missing
      try {
        const [colSDM] = await conn.query("SHOW COLUMNS FROM product_variants LIKE 'stock_deduct_multiplier'");
        if(!colSDM.length){
          await conn.query("ALTER TABLE product_variants ADD COLUMN stock_deduct_multiplier DECIMAL(12,3) NOT NULL DEFAULT 1 AFTER cost");
        }
      } catch(_) { }
    } finally { conn.release(); }
  }catch(e){ /* silently ignore - tables will be created on first connection */ }
})();

module.exports = { registerProductsIPC };