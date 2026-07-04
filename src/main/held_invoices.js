
const { ipcMain } = require('electron');
const { dbAdapter, DB_NAME } = require('../db/db-adapter');
const { isSecondaryDevice, fetchFromAPI, postToAPI, deleteFromAPI } = require('./api-client');

// خصم/إعادة كميات سلة الفاتورة المعلقة من مخزون المنتجات
// direction: -1 عند التعليق (حجز)، +1 عند الحذف/الاسترجاع (إرجاع)
async function adjustStockForHeldCart(conn, cart, direction){
  for(const it of (cart || [])){
    const pid = Number(it.id || it.product_id);
    if(!pid) continue;
    const mult = (it.unit_multiplier != null && Number(it.unit_multiplier) > 0) ? Number(it.unit_multiplier) : 1;
    const qty = Number(it.qty || 0) * mult;
    if(!qty) continue;
    await conn.query('UPDATE products SET stock = stock + ? WHERE id = ?', [direction * qty, pid]);
  }
}

// التحقق من أن كميات السلة لا تتجاوز المتوفر في المخزون قبل الحجز
// يرجع null إذا كان كل شيء متوفراً، أو رسالة خطأ بأول صنف ناقص
async function checkStockForHeldCart(conn, cart){
  const required = {}; // product_id -> total qty
  for(const it of (cart || [])){
    const pid = Number(it.id || it.product_id);
    if(!pid) continue;
    const mult = (it.unit_multiplier != null && Number(it.unit_multiplier) > 0) ? Number(it.unit_multiplier) : 1;
    required[pid] = (required[pid] || 0) + Number(it.qty || 0) * mult;
  }
  const ids = Object.keys(required).map(Number);
  if(ids.length === 0) return null;
  const [rows] = await conn.query(`SELECT id, name, stock FROM products WHERE id IN (${ids.map(()=>'?').join(',')})`, ids);
  for(const r of rows){
    const need = required[Number(r.id)] || 0;
    const stock = Number(r.stock || 0);
    if(need > stock){
      return `لا يمكن تعليق الفاتورة: الكمية المطلوبة من "${r.name}" (${need}) أكبر من المتوفر في المخزون (${stock})`;
    }
  }
  return null;
}

function notifyProductsChanged(action){
  try{
    const { BrowserWindow } = require('electron');
    BrowserWindow.getAllWindows().forEach(w => w.webContents.send('products:changed', { action }));
  }catch(_){ }
}

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
    if (isSecondaryDevice()) {
      try {
        const r = await fetchFromAPI('/held-invoices');
        if (r && r.ok) return { ok: true, items: r.items || [] };
        return { ok: false, error: r && r.error ? r.error : 'فشل الاتصال بالجهاز الرئيسي' };
      } catch (err) { return { ok: false, error: err.message || 'فشل الاتصال بالجهاز الرئيسي' }; }
    }
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
    if (isSecondaryDevice()) {
      try {
        const r = await postToAPI('/held-invoices', payload);
        if (r && r.ok) return { ok: true, id: r.id };
        return { ok: false, error: r && r.error ? r.error : 'فشل الاتصال بالجهاز الرئيسي' };
      } catch (err) { return { ok: false, error: err.message || 'فشل الاتصال بالجهاز الرئيسي' }; }
    }
    try{
      if(!payload || !payload.cart || payload.cart.length === 0){
        return { ok: false, error: 'السلة فارغة' };
      }
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTables(conn);
        // منع تعليق كميات أكبر من المتوفر في المخزون
        const shortageMsg = await checkStockForHeldCart(conn, payload.cart);
        if(shortageMsg) return { ok: false, error: shortageMsg };
        const invoiceData = JSON.stringify(payload);
        const [res] = await conn.query('INSERT INTO held_invoices (invoice_data) VALUES (?)', [invoiceData]);
        // حجز الكميات: خصم من المخزون حتى لا تُباع وهي معلقة
        await adjustStockForHeldCart(conn, payload.cart, -1);
        notifyProductsChanged('held-reserved');
        return { ok: true, id: res.insertId };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok: false, error: 'تعذر حفظ الفاتورة المعلقة' }; }
  });

  ipcMain.handle('held_invoices:delete', async (_e, { db_id }) => {
    if (isSecondaryDevice()) {
      try {
        const r = await deleteFromAPI(`/held-invoices/${db_id}`);
        if (r && r.ok) return { ok: true };
        return { ok: false, error: r && r.error ? r.error : 'فشل الاتصال بالجهاز الرئيسي' };
      } catch (err) { return { ok: false, error: err.message || 'فشل الاتصال بالجهاز الرئيسي' }; }
    }
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTables(conn);
        // إعادة الكميات المحجوزة للمخزون قبل الحذف (سواء إلغاء أو استرجاع للسلة)
        const [rows] = await conn.query('SELECT invoice_data FROM held_invoices WHERE id = ?', [db_id]);
        await conn.query('DELETE FROM held_invoices WHERE id = ?', [db_id]);
        if(rows && rows[0]){
          try{
            const data = JSON.parse(rows[0].invoice_data);
            await adjustStockForHeldCart(conn, data.cart, +1);
            notifyProductsChanged('held-released');
          }catch(_){ }
        }
        return { ok: true };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok: false, error: 'تعذر حذف الفاتورة المعلقة' }; }
  });
}

module.exports = { registerHeldInvoicesIPC, adjustStockForHeldCart, checkStockForHeldCart, notifyProductsChanged };
