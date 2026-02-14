// Customer-specific pricing IPC handlers
const { ipcMain } = require('electron');
const { dbAdapter, DB_NAME } = require('../db/db-adapter');

async function ensureTable(conn){
  // Create table without hard FK dependencies to avoid init order issues
  await conn.query(`
    CREATE TABLE IF NOT EXISTS customer_pricing (
      id INT AUTO_INCREMENT PRIMARY KEY,
      customer_id INT NOT NULL,
      product_id INT NOT NULL,
      operation_id INT NULL,
      price_cash DECIMAL(10,2) NULL,
      discount_percent DECIMAL(5,2) NULL,
      UNIQUE KEY uniq_cust_prod_op (customer_id, product_id, operation_id),
      KEY idx_customer (customer_id),
      KEY idx_product (product_id),
      KEY idx_operation (operation_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
}

function normalizeRule(rule){
  const mode = rule && rule.mode === 'percent' ? 'percent' : (rule && rule.mode === 'cash' ? 'cash' : null);
  const price_cash = mode === 'cash' ? Number(rule.value || 0) : null;
  const discount_percent = mode === 'percent' ? Math.max(0, Math.min(100, Number(rule.value || 0))) : null;
  const operation_id = rule && rule.operation_id ? Number(rule.operation_id) : null;
  return { price_cash, discount_percent, operation_id };
}

function registerCustomerPricingIPC(){
  // List rules with optional basic search
  ipcMain.handle('cust_price:list', async (_e, q) => {
    const query = q || {};
    const where = [];
    const params = [];
    if (query.customer_id) { where.push('cp.customer_id = ?'); params.push(Number(query.customer_id)); }
    if (query.product_id) { where.push('cp.product_id = ?'); params.push(Number(query.product_id)); }
    if (query.q) {
      where.push('(c.name LIKE ? OR c.phone LIKE ? OR p.name LIKE ? OR p.barcode LIKE ?)');
      const s = `%${query.q}%`;
      params.push(s, s, s, s);
    }
    const whereSql = where.length ? ('WHERE ' + where.join(' AND ')) : '';

    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTable(conn);
        const [rows] = await conn.query(`
          SELECT cp.*, c.name AS customer_name, c.phone AS customer_phone,
                 p.name AS product_name, p.barcode AS product_barcode,
                 o.name AS operation_name
          FROM customer_pricing cp
          LEFT JOIN customers c ON c.id = cp.customer_id
          LEFT JOIN products p ON p.id = cp.product_id
          LEFT JOIN operations o ON o.id = cp.operation_id
          ${whereSql}
          ORDER BY cp.id DESC
          LIMIT 500
        `, params);
        return { ok:true, items: rows };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'تعذر تحميل تخصيصات الأسعار' }; }
  });

  // Upsert rule (insert or update existing by unique customer+product+operation)
  ipcMain.handle('cust_price:upsert', async (_e, payload) => {
    const customer_id = Number(payload && payload.customer_id);
    const product_id = Number(payload && payload.product_id);
    const { price_cash, discount_percent, operation_id } = normalizeRule(payload || {});
    if (!customer_id) return { ok:false, error:'العميل مطلوب' };
    if (!product_id) return { ok:false, error:'المنتج مطلوب' };
    if (price_cash == null && discount_percent == null) return { ok:false, error:'اختر نوع التخصيص وأدخل القيمة' };

    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTable(conn);
        // Ensure one mode only
        const pc = price_cash != null ? Number(price_cash) : null;
        const dp = discount_percent != null ? Number(discount_percent) : null;
        // MySQL treats NULL in unique as distinct; for ON DUPLICATE KEY we normalize operation_id null to -1 in shadow unique if needed.
        // Simpler: rely on unique with NULL; duplicate key won't trigger if op_id changes between NULL/non-NULL.
        // We'll do an app-level upsert: try select then insert/update.
        const [existRows] = await conn.query(
          'SELECT id FROM customer_pricing WHERE customer_id=? AND product_id=? AND ((operation_id IS NULL AND ? IS NULL) OR operation_id = ? ) LIMIT 1',
          [customer_id, product_id, operation_id, operation_id]
        );
        if (existRows && existRows.length) {
          const id = existRows[0].id;
          await conn.query('UPDATE customer_pricing SET price_cash=?, discount_percent=?, operation_id=? WHERE id=?', [pc, dp, operation_id, id]);
          return { ok:true, id };
        } else {
          const [res] = await conn.query(
            'INSERT INTO customer_pricing (customer_id, product_id, operation_id, price_cash, discount_percent) VALUES (?,?,?,?,?)',
            [customer_id, product_id, operation_id, pc, dp]
          );
          return { ok:true, id: res.insertId };
        }
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'فشل حفظ التخصيص' }; }
  });

  // Delete rule
  ipcMain.handle('cust_price:delete', async (_e, id) => {
    const rid = (id && id.id) ? id.id : id;
    if (!rid) return { ok:false, error:'معرّف مفقود' };
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTable(conn);
        await conn.query('DELETE FROM customer_pricing WHERE id=?', [rid]);
        return { ok:true };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'فشل الحذف' }; }
  });

  // Update rule by id
  ipcMain.handle('cust_price:update', async (_e, id, payload) => {
    const rid = (id && id.id) ? id.id : id;
    if(!rid) return { ok:false, error:'معرّف مفقود' };
    const customer_id = Number(payload && payload.customer_id);
    const product_id = Number(payload && payload.product_id);
    const { price_cash, discount_percent, operation_id } = normalizeRule(payload || {});
    if (!customer_id) return { ok:false, error:'العميل مطلوب' };
    if (!product_id) return { ok:false, error:'المنتج مطلوب' };
    if (price_cash == null && discount_percent == null) return { ok:false, error:'اختر نوع التخصيص وأدخل القيمة' };

    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTable(conn);
        const pc = price_cash != null ? Number(price_cash) : null;
        const dp = discount_percent != null ? Number(discount_percent) : null;
        await conn.query('UPDATE customer_pricing SET customer_id=?, product_id=?, operation_id=?, price_cash=?, discount_percent=? WHERE id=?', [customer_id, product_id, operation_id, pc, dp, rid]);
        return { ok:true };
      } finally { conn.release(); }
    }catch(e){
      if(e && e.code === 'ER_DUP_ENTRY') return { ok:false, error:'يوجد تخصيص مماثل بالفعل' };
      console.error(e); return { ok:false, error:'فشل التعديل' };
    }
  });

  // Find effective price for a customer/product/(optional operation)
  ipcMain.handle('cust_price:find_price', async (_e, payload) => {
    const customer_id = Number(payload && payload.customer_id);
    const product_id = Number(payload && payload.product_id);
    const operation_id = payload && payload.operation_id ? Number(payload.operation_id) : null;
    if (!customer_id || !product_id) return { ok:false, error:'بيانات ناقصة' };
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTable(conn);
        // Base price: either product_operations price (if op provided and exists) or products.price
        let basePrice = 0;
        if (operation_id != null) {
          const [[po]] = await conn.query('SELECT price FROM product_operations WHERE product_id=? AND operation_id=? LIMIT 1', [product_id, operation_id]);
          if (po) basePrice = Number(po.price || 0);
        }
        if (!basePrice) {
          const [[prod]] = await conn.query('SELECT price FROM products WHERE id=? LIMIT 1', [product_id]);
          basePrice = prod ? Number(prod.price || 0) : 0;
        }

        // Exact match rule first
        let [rules] = await conn.query(
          'SELECT * FROM customer_pricing WHERE customer_id=? AND product_id=? AND ((operation_id IS NULL AND ? IS NULL) OR operation_id = ?) LIMIT 1',
          [customer_id, product_id, operation_id, operation_id]
        );
        let rule = rules && rules[0];
        if (!rule && operation_id != null) {
          // Fallback to rule without operation
          [rules] = await conn.query(
            'SELECT * FROM customer_pricing WHERE customer_id=? AND product_id=? AND operation_id IS NULL LIMIT 1',
            [customer_id, product_id]
          );
          rule = rules && rules[0];
        }
        if (!rule) return { ok:true, price: basePrice, base: basePrice, applied: null };

        if (rule.price_cash != null) {
          return { ok:true, price: Number(rule.price_cash), base: basePrice, applied: { type:'cash', value: Number(rule.price_cash) } };
        }
        if (rule.discount_percent != null) {
          const p = Math.max(0, Math.min(100, Number(rule.discount_percent)));
          const final = Number((basePrice * (1 - p/100)).toFixed(2));
          return { ok:true, price: final, base: basePrice, applied: { type:'percent', value: p } };
        }
        return { ok:true, price: basePrice, base: basePrice, applied: null };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'تعذر احتساب السعر' }; }
  });
}

// eager init
(async () => {
  try{
    const conn = await dbAdapter.getConnection();
    try{ await ensureTable(conn); } finally { conn.release(); }
  }catch(e){ /* silently ignore - tables will be created on first connection */ }
})();

module.exports = { registerCustomerPricingIPC };