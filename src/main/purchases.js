// Purchases IPC: record purchases with optional VAT inclusive logic
const { ipcMain } = require('electron');
const { dbAdapter, DB_NAME } = require('../db/db-adapter');

function registerPurchasesIPC(){
  async function ensureTables(conn){
    await conn.query(`
      CREATE TABLE IF NOT EXISTS purchases (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        apply_vat TINYINT NOT NULL DEFAULT 0,
        vat_percent DECIMAL(5,2) NOT NULL DEFAULT 15.00,
        sub_total DECIMAL(12,2) NOT NULL,
        vat_total DECIMAL(12,2) NOT NULL,
        grand_total DECIMAL(12,2) NOT NULL,
        notes VARCHAR(255) NULL,
        payment_method VARCHAR(20) NOT NULL DEFAULT 'cash',
        purchase_date DATE NOT NULL,
        purchase_at DATETIME NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    // Upgrade: add purchase_at if missing (nullable to avoid migration failures)
    const [colAt] = await conn.query("SHOW COLUMNS FROM purchases LIKE 'purchase_at'");
    if(!colAt.length){ await conn.query("ALTER TABLE purchases ADD COLUMN purchase_at DATETIME NULL DEFAULT NULL AFTER purchase_date"); }
    // Upgrade: add payment_method if missing
    const [colPay] = await conn.query("SHOW COLUMNS FROM purchases LIKE 'payment_method'");
    if(!colPay.length){ await conn.query("ALTER TABLE purchases ADD COLUMN payment_method VARCHAR(20) NOT NULL DEFAULT 'cash' AFTER notes"); }
  }

  ipcMain.handle('purchases:add', async (_e, payload) => {
    const p = payload || {};
    const name = (p.name||'').trim();
    const cost = Number(p.cost||0); // entered as total (inclusive when apply_vat)
    const applyVat = p.apply_vat ? 1 : 0;
    const vatPercent = Number(p.vat_percent||15);
    const purchaseDate = (p.purchase_date||'').trim();
    const purchaseTime = (p.purchase_time||'').trim(); // format: hh:mm AM/PM
    const notes = (p.notes||null);
    if(!name) return { ok:false, error:'اسم المصروفات مطلوب' };
    if(!purchaseDate) return { ok:false, error:'التاريخ مطلوب' };
    if(isNaN(cost) || cost < 0) return { ok:false, error:'قيمة التكلفة غير صحيحة' };
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTables(conn);
        let sub = 0, vat = 0, grand = 0;
        if(applyVat){
          const r = vatPercent/100;
          sub = cost / (1 + r);
          vat = cost - sub;
          grand = cost; // inclusive
        } else {
          sub = cost;
          vat = 0;
          grand = cost;
        }
        // build purchase_at DATETIME from date + 12h time
        let purchaseAt = `${purchaseDate} 00:00:00`;
        if(purchaseTime){
          const m = purchaseTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
          if(m){
            let hh = parseInt(m[1],10); const mm = m[2]; const ap = m[3].toUpperCase();
            if(ap==='PM' && hh < 12) hh += 12;
            if(ap==='AM' && hh === 12) hh = 0;
            const hh2 = String(hh).padStart(2,'0');
            purchaseAt = `${purchaseDate} ${hh2}:${mm}:00`;
          }
        }
        const paymentMethod = (p.payment_method||'cash').toLowerCase()==='network' ? 'network' : 'cash';
        const [res] = await conn.query(
          `INSERT INTO purchases (name, apply_vat, vat_percent, sub_total, vat_total, grand_total, notes, payment_method, purchase_date, purchase_at) VALUES (?,?,?,?,?,?,?,?,?,?)`,
          [name, applyVat, vatPercent, Number(sub.toFixed(2)), Number(vat.toFixed(2)), Number(grand.toFixed(2)), notes, paymentMethod, purchaseDate, purchaseAt]
        );
        return { ok:true, id: res.insertId };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'فشل حفظ المصروفات' }; }
  });

  ipcMain.handle('purchases:list', async (_e, query) => {
    const q = query || {};
    let where = '';
    const params = [];
    // دعم فلترة دقيقة بالزمن إذا توفرت from_at/to_at، وإلا نرجع للتاريخ فقط
    if(q.from_at || q.to_at){
      const terms = [];
      if(q.from_at){ terms.push('COALESCE(purchase_at, created_at) >= ?'); params.push(q.from_at); }
      if(q.to_at){ terms.push('COALESCE(purchase_at, created_at) <= ?'); params.push(q.to_at); }
      where = terms.length ? ('WHERE ' + terms.join(' AND ')) : '';
    } else if(q.from_date || q.to_date){
      if(q.from_date && q.to_date){ where = 'WHERE purchase_date BETWEEN ? AND ?'; params.push(q.from_date, q.to_date); }
      else if(q.from_date){ where = 'WHERE purchase_date >= ?'; params.push(q.from_date); }
      else if(q.to_date){ where = 'WHERE purchase_date <= ?'; params.push(q.to_date); }
    }
    
    // Pagination parameters
    const page = Math.max(1, Number(q.page || 1));
    const pageSize = Math.max(1, Math.min(1000, Number(q.pageSize || 20)));
    const offset = (page - 1) * pageSize;
    
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTables(conn);
        
        // Get total count
        const countParams = [...params];
        const [[{total}]] = await conn.query(`SELECT COUNT(*) as total FROM purchases ${where}`, countParams);
        
        // Get paginated results
        const queryParams = [...params];
        const [rows] = await conn.query(
          `SELECT * FROM purchases ${where} ORDER BY COALESCE(purchase_at, created_at) DESC, id DESC LIMIT ? OFFSET ?`, 
          [...queryParams, pageSize, offset]
        );
        
        return { ok:true, items: rows, total: Number(total || 0), page, pageSize };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'تعذر تحميل المصروفات' }; }
  });

  ipcMain.handle('purchases:update', async (_e, id, payload) => {
    const pid = (id && id.id) ? id.id : id;
    const p = payload || {};
    if(!pid) return { ok:false, error:'معرّف مفقود' };
    const name = (p.name||'').trim();
    const cost = Number(p.cost||0);
    const applyVat = p.apply_vat ? 1 : 0;
    const vatPercent = Number(p.vat_percent||15);
    const purchaseDate = (p.purchase_date||'').trim();
    const purchaseTime = (p.purchase_time||'').trim();
    const notes = (p.notes||null);
    if(!name) return { ok:false, error:'اسم المصروفات مطلوب' };
    if(!purchaseDate) return { ok:false, error:'التاريخ مطلوب' };
    if(isNaN(cost) || cost < 0) return { ok:false, error:'قيمة التكلفة غير صحيحة' };
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTables(conn);
        let sub=0, vat=0, grand=0;
        if(applyVat){ const r=vatPercent/100; sub=cost/(1+r); vat=cost-sub; grand=cost; }
        else { sub=cost; vat=0; grand=cost; }
        let purchaseAt = `${purchaseDate} 00:00:00`;
        if(purchaseTime){
          const m = purchaseTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
          if(m){ let hh=parseInt(m[1],10); const mm=m[2]; const ap=m[3].toUpperCase(); if(ap==='PM'&&hh<12) hh+=12; if(ap==='AM'&&hh===12) hh=0; const hh2=String(hh).padStart(2,'0'); purchaseAt = `${purchaseDate} ${hh2}:${mm}:00`; }
        }
        const paymentMethod = (p.payment_method||'cash').toLowerCase()==='network' ? 'network' : 'cash';
        await conn.query(`UPDATE purchases SET name=?, apply_vat=?, vat_percent=?, sub_total=?, vat_total=?, grand_total=?, notes=?, payment_method=?, purchase_date=?, purchase_at=? WHERE id=?`, [name, applyVat, vatPercent, Number(sub.toFixed(2)), Number(vat.toFixed(2)), Number(grand.toFixed(2)), notes, paymentMethod, purchaseDate, purchaseAt, pid]);
        return { ok:true };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'فشل تحديث المصروفات' };
    }
  });

  ipcMain.handle('purchases:delete', async (_e, id) => {
    const pid = (id && id.id) ? id.id : id;
    if(!pid) return { ok:false, error:'معرّف مفقود' };
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTables(conn);
        await conn.query('DELETE FROM purchases WHERE id=?', [pid]);
        return { ok:true };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'فشل الحذف' }; }
  });
}

// eager ensure
(async () => {
  try{
    const conn = await dbAdapter.getConnection();
    try{
      await conn.query(`
        CREATE TABLE IF NOT EXISTS purchases (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          apply_vat TINYINT NOT NULL DEFAULT 0,
          vat_percent DECIMAL(5,2) NOT NULL DEFAULT 15.00,
          sub_total DECIMAL(12,2) NOT NULL,
          vat_total DECIMAL(12,2) NOT NULL,
          grand_total DECIMAL(12,2) NOT NULL,
          notes VARCHAR(255) NULL,
          payment_method VARCHAR(20) NOT NULL DEFAULT 'cash',
          purchase_date DATE NOT NULL,
          purchase_at DATETIME NULL DEFAULT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
    } finally { conn.release(); }
  }catch(e){ /* silently ignore - tables will be created on first connection */ }
})();

module.exports = { registerPurchasesIPC };