// Purchase Invoices (فاتورة شراء)
// - Master-detail records for supplier purchases
// - Updates product stock on save/update/delete
// - Updates supplier balance on credit purchases

const { ipcMain } = require('electron');
const { dbAdapter, DB_NAME } = require('../db/db-adapter');

function registerPurchaseInvoicesIPC(){
  async function ensureTables(conn){
    // Master table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS purchase_invoices (
        id INT AUTO_INCREMENT PRIMARY KEY,
        invoice_no VARCHAR(32) NOT NULL UNIQUE,
        invoice_at DATETIME NOT NULL,
        supplier_id INT NOT NULL,
        payment_method VARCHAR(16) NOT NULL, -- cash | network | credit
        reference_no VARCHAR(64) NULL,
        notes VARCHAR(255) NULL,
        sub_total DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        discount_general DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        vat_percent DECIMAL(5,2) NOT NULL DEFAULT 15.00,
        vat_total DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        grand_total DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        amount_paid DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        amount_due DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_purchase_invoices_supplier (supplier_id),
        INDEX idx_purchase_invoices_at (invoice_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    // Details table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS purchase_invoice_details (
        id INT AUTO_INCREMENT PRIMARY KEY,
        purchase_id INT NOT NULL,
        product_id INT NOT NULL,
        qty DECIMAL(12,3) NOT NULL DEFAULT 0,
        unit_cost DECIMAL(12,4) NOT NULL DEFAULT 0,
        discount_line DECIMAL(12,2) NOT NULL DEFAULT 0,
        line_total DECIMAL(12,2) NOT NULL DEFAULT 0,
        FOREIGN KEY (purchase_id) REFERENCES purchase_invoices(id) ON DELETE CASCADE,
        INDEX idx_pid (purchase_id),
        INDEX idx_prod (product_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    // Suppliers: ensure balance column exists for credit tracking
    try{
      const [cols] = await conn.query("SHOW COLUMNS FROM suppliers LIKE 'balance'");
      if(!cols || cols.length===0){
        await conn.query("ALTER TABLE suppliers ADD COLUMN balance DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER vat_number");
      }
    }catch(_){ /* ignore */ }
    // Remove obsolete items column if exists (old schema)
    try{
      const [colsItems] = await conn.query("SHOW COLUMNS FROM purchase_invoices LIKE 'items'");
      if(colsItems && colsItems.length>0){
        await conn.query("ALTER TABLE purchase_invoices DROP COLUMN items");
      }
    }catch(_){ /* ignore */ }
    // Ensure invoice_at column exists (migration from older schema)
    try{
      const [colsAt] = await conn.query("SHOW COLUMNS FROM purchase_invoices LIKE 'invoice_at'");
      if(!colsAt || colsAt.length===0){
        await conn.query("ALTER TABLE purchase_invoices ADD COLUMN invoice_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER invoice_no");
        await conn.query("CREATE INDEX idx_purchase_invoices_at ON purchase_invoices (invoice_at)");
      }
    }catch(_){ /* ignore */ }
    // Ensure all required columns exist
    const requiredCols = [
      { name: 'payment_method', def: "VARCHAR(16) NOT NULL DEFAULT 'cash'" },
      { name: 'reference_no', def: 'VARCHAR(64) NULL' },
      { name: 'notes', def: 'VARCHAR(255) NULL' },
      { name: 'sub_total', def: 'DECIMAL(12,2) NOT NULL DEFAULT 0.00' },
      { name: 'discount_general', def: 'DECIMAL(12,2) NOT NULL DEFAULT 0.00' },
      { name: 'vat_percent', def: 'DECIMAL(5,2) NOT NULL DEFAULT 15.00' },
      { name: 'vat_total', def: 'DECIMAL(12,2) NOT NULL DEFAULT 0.00' },
      { name: 'grand_total', def: 'DECIMAL(12,2) NOT NULL DEFAULT 0.00' },
      { name: 'amount_paid', def: 'DECIMAL(12,2) NOT NULL DEFAULT 0.00' },
      { name: 'amount_due', def: 'DECIMAL(12,2) NOT NULL DEFAULT 0.00' }
    ];
    for(const col of requiredCols){
      try{
        const [exists] = await conn.query(`SHOW COLUMNS FROM purchase_invoices LIKE '${col.name}'`);
        if(!exists || exists.length===0){
          await conn.query(`ALTER TABLE purchase_invoices ADD COLUMN ${col.name} ${col.def}`);
        }
      }catch(_){ /* ignore */ }
    }
    // Purchase invoices: ensure price_mode column exists to reconstruct UI prices correctly
    try{
      const [colsPm] = await conn.query("SHOW COLUMNS FROM purchase_invoices LIKE 'price_mode'");
      if(!colsPm || colsPm.length===0){
        await conn.query("ALTER TABLE purchase_invoices ADD COLUMN price_mode VARCHAR(16) NOT NULL DEFAULT 'exclusive' AFTER payment_method");
      }
    }catch(_){ /* ignore */ }
    // Persist UI-entered discount value for perfect round-trip
    try{
      const [colsUiDisc] = await conn.query("SHOW COLUMNS FROM purchase_invoices LIKE 'discount_general_ui'");
      if(!colsUiDisc || colsUiDisc.length===0){
        await conn.query("ALTER TABLE purchase_invoices ADD COLUMN discount_general_ui DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER discount_general");
      }
    }catch(_){ /* ignore */ }
    // Persist UI-entered unit price and line total in details
    try{
      const [colsUiUnit] = await conn.query("SHOW COLUMNS FROM purchase_invoice_details LIKE 'ui_unit_cost'");
      if(!colsUiUnit || colsUiUnit.length===0){
        await conn.query("ALTER TABLE purchase_invoice_details ADD COLUMN ui_unit_cost DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER unit_cost");
      }
    }catch(_){ /* ignore */ }
    try{
      const [colsUiLine] = await conn.query("SHOW COLUMNS FROM purchase_invoice_details LIKE 'ui_line_total'");
      if(!colsUiLine || colsUiLine.length===0){
        await conn.query("ALTER TABLE purchase_invoice_details ADD COLUMN ui_line_total DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER line_total");
      }
    }catch(_){ /* ignore */ }
    // Ensure description column exists in details
    try{
      const [colsDesc] = await conn.query("SHOW COLUMNS FROM purchase_invoice_details LIKE 'description'");
      if(!colsDesc || colsDesc.length===0){
        await conn.query("ALTER TABLE purchase_invoice_details ADD COLUMN description VARCHAR(255) NULL AFTER product_id");
      }
    }catch(_){ /* ignore */ }
    // Payments table for partial settlements of purchase invoices
    try{
      await conn.query(`
        CREATE TABLE IF NOT EXISTS purchase_payments (
          id INT AUTO_INCREMENT PRIMARY KEY,
          supplier_id INT NOT NULL,
          purchase_id INT NOT NULL,
          invoice_no VARCHAR(32) NOT NULL,
          amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
          note VARCHAR(255) NULL,
          paid_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_supplier (supplier_id),
          INDEX idx_purchase (purchase_id),
          INDEX idx_invoice_no (invoice_no),
          FOREIGN KEY (purchase_id) REFERENCES purchase_invoices(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
    }catch(_){ /* ignore */ }
  }

  async function nextInvoiceNo(conn){
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth()+1).padStart(2,'0');
    const prefix = `PI-${yyyy}${mm}-`;
    const [[row]] = await conn.query(
      "SELECT invoice_no FROM purchase_invoices WHERE invoice_no LIKE ? ORDER BY invoice_no DESC LIMIT 1",
      [prefix + '%']
    );
    let seq = 1;
    if(row && row.invoice_no){
      const m = String(row.invoice_no).match(/-(\d+)$/);
      if(m){ seq = Number(m[1]||'0') + 1; }
    }
    return prefix + String(seq).padStart(5,'0');
  }

  function computeHeaderTotals(payload, lines){
    // Sum of line totals (exclusive) as sent/normalized
    let sub = 0;
    for(const ln of lines){ sub += Number(ln.line_total||0); }
    sub = Number(sub.toFixed(2));

    const discountGeneral = Math.max(0, Number(payload.discount_general||0));
    const vatPercent = Math.max(0, Number(payload.vat_percent||15));
    const applyVat = payload.apply_vat !== false;
    const priceMode = String(payload.price_mode||'inclusive');

    // Base exclusive after discount (non-inclusive discount)
    const baseExclusive = Math.max(0, Number((sub - discountGeneral).toFixed(2)));

    // Compute VAT by summing per-line VAT after proportionally allocating general discount.
    // This avoids rounding drift like 150.01 vs 150.00 when lines individually round to two decimals.
    let vatTotal = 0;
    // For zero_vat mode: VAT should always be 0 regardless of vat_percent value
    if(priceMode === 'zero_vat'){
      vatTotal = 0;
    } else if(applyVat && vatPercent > 0){
      if(sub > 0){
        // Allocate discount per line proportionally to its share of sub
        let allocated = 0;
        const shares = [];
        for(const ln of lines){
          const lt = Number(ln.line_total||0);
          const share = Number(((discountGeneral * (lt / sub))).toFixed(2));
          shares.push(share);
          allocated += share;
        }
        // Fix any rounding drift in discount allocation on the last line
        const drift = Number((discountGeneral - allocated).toFixed(2));
        if(shares.length > 0 && drift !== 0){
          shares[shares.length - 1] = Number((shares[shares.length - 1] + drift).toFixed(2));
        }
        // Sum VAT per line after discount allocation, rounding each line
        for(let i=0; i<lines.length; i++){
          const lt = Number(lines[i].line_total||0);
          const lineBase = Number((lt - (shares[i]||0)).toFixed(2));
          vatTotal += Number((lineBase * (vatPercent/100)).toFixed(2));
        }
        vatTotal = Number(vatTotal.toFixed(2));
      } else {
        vatTotal = 0;
      }
    } else {
      vatTotal = 0;
    }

    const grandExclusive = baseExclusive;
    const grand = Number((grandExclusive + vatTotal).toFixed(2));
    const method = String(payload.payment_method||'cash').toLowerCase();
    // Check both Arabic 'آجل' and English 'credit'
    const isCredit = method === 'credit' || method === 'آجل';
    const amountPaid = isCredit ? 0 : grand;
    const amountDue = Number((grand - amountPaid).toFixed(2));

    // NOTE: For backward compatibility with existing UI that treats sub_total as net-exclusive,
    // we keep returning `sub` as baseExclusive (net after discount), not the raw sum of lines.
    // Changing this now could double-subtract discount on some screens.
    return { sub: grandExclusive, discountGeneral, vatPercent, vatTotal, grand, amountPaid, amountDue, method, isCredit };
  }

  function normalizeLines(items, priceMode, vatPercent){
    // Renderer sends exclusive values already (unit_cost_exclusive, discount_exclusive)
    // So we must NOT divide by VAT again here. We simply validate and compute totals.
    const out = [];
    for(const it of (Array.isArray(items)?items:[])){
      const pid = Number(it.product_id||0);
      const qty = Number(it.qty||0);
      const unitExclusive = Number(Number(it.unit_cost||0).toFixed(4));
      const discountExclusive = Math.max(0, Number(Number(it.discount_line||0).toFixed(2)));
      if(!pid || qty<=0 || unitExclusive<0) return { error: 'بيانات صنف غير صحيحة' };
      const lineTotalExclusive = Math.max(0, (qty * unitExclusive) - discountExclusive);
      const description = (it.description && String(it.description).trim()) ? String(it.description).trim() : null;
      out.push({ product_id: pid, qty, unit_cost: unitExclusive, discount_line: discountExclusive, line_total: Number(lineTotalExclusive.toFixed(2)), description });
    }
    if(out.length===0) return { error: 'لا توجد أصناف' };
    return { lines: out };
  }

  function toAtString(dtStr){
    const now = new Date();
    let d = now;
    if(dtStr){ const t = new Date(dtStr); if(!isNaN(t.getTime())) d = t; }
    const pad = (v)=>String(v).padStart(2,'0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
  }

  // Validate purchase cost does not exceed selling price
  async function validatePurchaseCosts(conn, lines, priceMode, vatPercent){
    const productIds = lines.map(ln => ln.product_id);
    if(productIds.length === 0) return { ok: true };
    
    const [products] = await conn.query('SELECT id, name, price FROM products WHERE id IN (?)', [productIds]);
    const productMap = {};
    for(const p of products){
      productMap[p.id] = { name: p.name, price: Number(p.price||0) };
    }
    
    for(const ln of lines){
      const product = productMap[ln.product_id];
      if(!product) continue;
      
      // Calculate UI unit cost (the actual entered value)
      const uiUnit = (String(priceMode||'exclusive')==='inclusive') 
        ? Number((ln.unit_cost * (1 + (Number(vatPercent||0)/100))).toFixed(2)) 
        : Number(ln.unit_cost.toFixed(2));
      
      // Check if purchase cost exceeds selling price
      if(uiUnit > product.price){
        return { 
          ok: false, 
          error: `سعر الشراء (${uiUnit.toFixed(2)}) أكبر من سعر البيع (${product.price.toFixed(2)}) للمنتج: ${product.name}` 
        };
      }
    }
    
    return { ok: true };
  }

  // Add
  ipcMain.handle('purchase_invoices:add', async (_e, payload) => {
    const p = payload || {};
    const supplierId = Number(p.supplier_id||0);
    if(!supplierId) return { ok:false, error:'المورد مطلوب' };
    const norm = normalizeLines(p.items, p.price_mode, p.vat_percent);
    if(norm.error) return { ok:false, error: norm.error };
    const lines = norm.lines;

    const header = computeHeaderTotals(p, lines);
    const atStr = toAtString(p.invoice_dt);
    const referenceNo = (p.reference_no||null) ? String(p.reference_no).trim() : null;
    const notes = (p.notes||null) ? String(p.notes).trim() : null;

    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTables(conn);
        // Validate purchase costs don't exceed selling prices
        const validation = await validatePurchaseCosts(conn, lines, p.price_mode, p.vat_percent);
        if(!validation.ok) return { ok:false, error: validation.error };
        await conn.beginTransaction();
        const invNo = await nextInvoiceNo(conn);
        const discountGeneralUi = (String(p.price_mode||'exclusive')==='inclusive') ? Number((Number(p.discount_general||0) * (1 + (Number(p.vat_percent||0)/100))).toFixed(2)) : Number(p.discount_general||0);
        const [res] = await conn.query(
          `INSERT INTO purchase_invoices (invoice_no, invoice_at, supplier_id, payment_method, price_mode, reference_no, notes, sub_total, discount_general, discount_general_ui, vat_percent, vat_total, grand_total, amount_paid, amount_due)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [invNo, atStr, supplierId, header.method, String(p.price_mode||'exclusive'), referenceNo, notes, header.sub, header.discountGeneral, discountGeneralUi, header.vatPercent, header.vatTotal, header.grand, header.amountPaid, header.amountDue]
        );
        const purchaseId = res.insertId;
        for(const ln of lines){
          // Persist UI-entered values to guarantee round-trip display
          const uiUnit = (String(p.price_mode||'exclusive')==='inclusive') ? Number(((ln.unit_cost) * (1 + (Number(p.vat_percent||0)/100))).toFixed(2)) : Number(ln.unit_cost.toFixed(2));
          const uiLine = Number((Number(uiUnit) * Number(ln.qty)).toFixed(2));
          await conn.query(
            `INSERT INTO purchase_invoice_details (purchase_id, product_id, description, qty, unit_cost, discount_line, line_total, ui_unit_cost, ui_line_total) VALUES (?,?,?,?,?,?,?,?,?)`,
            [purchaseId, ln.product_id, ln.description, ln.qty, ln.unit_cost, ln.discount_line, ln.line_total, uiUnit, uiLine]
          );
          // Update stock and purchase cost in products table (use UI-entered price)
          await conn.query(`UPDATE products SET stock = stock + ?, cost = ? WHERE id = ?`, [ln.qty, uiUnit, ln.product_id]);
        }
        if(header.isCredit){
          await conn.query(`UPDATE suppliers SET balance = balance + ? WHERE id = ?`, [header.grand, supplierId]);
        }
        await conn.commit();
        try{ const { BrowserWindow } = require('electron'); BrowserWindow.getAllWindows().forEach(w => w.webContents.send('products:changed', { action:'stock-increased', purchase_id: purchaseId })); }catch(_){ }
        return { ok:true, id: purchaseId, invoice_no: invNo };
      }catch(e){ try{ await conn.rollback(); }catch(_){ } console.error('purchase_invoices:add failed', e); return { ok:false, error:'فشل حفظ الفاتورة' }; }
      finally{ conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'فشل الاتصال بقاعدة البيانات' }; }
  });

  // List
  ipcMain.handle('purchase_invoices:list', async (_e, q) => {
    const query = q || {};
    const where = [];
    const params = [];
    if(query.from){ where.push('invoice_at >= ?'); params.push(String(query.from)); }
    if(query.to){ where.push('invoice_at <= ?'); params.push(String(query.to)); }
    if(query.supplier_id){ where.push('supplier_id = ?'); params.push(Number(query.supplier_id)); }
    if(query.invoice_no){ where.push('invoice_no LIKE ?'); params.push(`%${String(query.invoice_no).trim()}%`); }
    const whereSql = where.length ? ('WHERE ' + where.join(' AND ')) : '';
    const page = Math.max(1, Number(query.page) || 1);
    let pageSize = Number(query.pageSize) || 100;
    if (pageSize <= 0) pageSize = 100;
    if (pageSize > 100000) pageSize = 100000;
    const offset = (page - 1) * pageSize;
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTables(conn);
        const countSql = `SELECT COUNT(*) as total FROM purchase_invoices ${whereSql}`;
        const [countRows] = await conn.query(countSql, params);
        const total = countRows[0]?.total || 0;
        const [rows] = await conn.query(`SELECT * FROM purchase_invoices ${whereSql} ORDER BY invoice_at DESC, id DESC LIMIT ? OFFSET ?`, [...params, pageSize, offset]);
        return { ok:true, items: rows, total, page, pageSize };
      }finally{ conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'تعذر تحميل الفواتير' }; }
  });

  // Get
  ipcMain.handle('purchase_invoices:get', async (_e, idObj) => {
    const pid = (idObj && idObj.id) ? idObj.id : idObj;
    if(!pid) return { ok:false, error:'معرّف مفقود' };
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTables(conn);
        const [[inv]] = await conn.query('SELECT * FROM purchase_invoices WHERE id=?', [pid]);
        if(!inv) return { ok:false, error:'غير موجود' };
        const [rows] = await conn.query('SELECT * FROM purchase_invoice_details WHERE purchase_id=?', [pid]);
        return { ok:true, item: inv, items: rows };
      }finally{ conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'تعذر الجلب' }; }
  });

  // Update
  ipcMain.handle('purchase_invoices:update', async (_e, idObj, payload) => {
    const id = (idObj && idObj.id) ? Number(idObj.id) : Number(idObj);
    const p = payload || {};
    const supplierId = Number(p.supplier_id||0);
    if(!id) return { ok:false, error:'معرّف مفقود' };
    if(!supplierId) return { ok:false, error:'المورد مطلوب' };
    const norm = normalizeLines(p.items, p.price_mode, p.vat_percent);
    if(norm.error) return { ok:false, error: norm.error };
    const lines = norm.lines;
    const header = computeHeaderTotals(p, lines);
    const atStr = toAtString(p.invoice_dt);
    const referenceNo = (p.reference_no||null) ? String(p.reference_no).trim() : null;
    const notes = (p.notes||null) ? String(p.notes).trim() : null;

    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTables(conn);
        // Validate purchase costs don't exceed selling prices
        const validation = await validatePurchaseCosts(conn, lines, p.price_mode, p.vat_percent);
        if(!validation.ok) return { ok:false, error: validation.error };
        await conn.beginTransaction();
        const [[old]] = await conn.query('SELECT * FROM purchase_invoices WHERE id=? LIMIT 1', [id]);
        if(!old){ await conn.rollback(); return { ok:false, error:'غير موجود' }; }
        const [oldDetails] = await conn.query('SELECT * FROM purchase_invoice_details WHERE purchase_id=?', [id]);
        // Revert stock for old details
        for(const od of oldDetails){ await conn.query('UPDATE products SET stock = stock - ? WHERE id=?', [od.qty, od.product_id]); }
        // Adjust old supplier balance if old was credit (check both Arabic 'آجل' and English 'credit')
        const oldMethod = String(old.payment_method).toLowerCase();
        if(oldMethod === 'credit' || oldMethod === 'آجل'){
          await conn.query('UPDATE suppliers SET balance = balance - ? WHERE id=?', [old.grand_total, old.supplier_id]);
        }
        // Replace details
        await conn.query('DELETE FROM purchase_invoice_details WHERE purchase_id=?', [id]);
        // Update header (keep invoice_no)
        const discountGeneralUi = (String(p.price_mode||'exclusive')==='inclusive') ? Number((Number(p.discount_general||0) * (1 + (Number(p.vat_percent||0)/100))).toFixed(2)) : Number(p.discount_general||0);
        await conn.query(
          `UPDATE purchase_invoices SET invoice_at=?, supplier_id=?, payment_method=?, price_mode=?, reference_no=?, notes=?, sub_total=?, discount_general=?, discount_general_ui=?, vat_percent=?, vat_total=?, grand_total=?, amount_paid=?, amount_due=? WHERE id=?`,
          [atStr, supplierId, header.method, String(p.price_mode||'exclusive'), referenceNo, notes, header.sub, header.discountGeneral, discountGeneralUi, header.vatPercent, header.vatTotal, header.grand, header.amountPaid, header.amountDue, id]
        );
        // Insert new details and apply stock
        for(const ln of lines){
          const uiUnit = (String(p.price_mode||'exclusive')==='inclusive') ? Number(((ln.unit_cost) * (1 + (Number(p.vat_percent||0)/100))).toFixed(2)) : Number(ln.unit_cost.toFixed(2));
          const uiLine = Number((Number(uiUnit) * Number(ln.qty)).toFixed(2));
          await conn.query(
            'INSERT INTO purchase_invoice_details (purchase_id, product_id, description, qty, unit_cost, discount_line, line_total, ui_unit_cost, ui_line_total) VALUES (?,?,?,?,?,?,?,?,?)',
            [id, ln.product_id, ln.description, ln.qty, ln.unit_cost, ln.discount_line, ln.line_total, uiUnit, uiLine]
          );
          // Update stock and purchase cost in products table (use UI-entered price)
          await conn.query('UPDATE products SET stock = stock + ?, cost = ? WHERE id=?', [ln.qty, uiUnit, ln.product_id]);
        }
        // Apply new supplier balance if credit
        if(header.isCredit){
          await conn.query('UPDATE suppliers SET balance = balance + ? WHERE id=?', [header.grand, supplierId]);
        }
        await conn.commit();
        try{ const { BrowserWindow } = require('electron'); BrowserWindow.getAllWindows().forEach(w => w.webContents.send('products:changed', { action:'stock-recomputed', purchase_id: id })); }catch(_){ }
        return { ok:true, id };
      }catch(e){ try{ await conn.rollback(); }catch(_){ } console.error('purchase_invoices:update failed', e); return { ok:false, error:'فشل تحديث الفاتورة' }; }
      finally{ conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'فشل الاتصال بقاعدة البيانات' }; }
  });

  // Delete
  ipcMain.handle('purchase_invoices:delete', async (_e, idObj) => {
    const id = (idObj && idObj.id) ? Number(idObj.id) : Number(idObj);
    if(!id) return { ok:false, error:'معرّف مفقود' };
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTables(conn);
        await conn.beginTransaction();
        const [[inv]] = await conn.query('SELECT * FROM purchase_invoices WHERE id=? LIMIT 1', [id]);
        if(!inv){ await conn.rollback(); return { ok:false, error:'غير موجود' }; }
        const [rows] = await conn.query('SELECT * FROM purchase_invoice_details WHERE purchase_id=?', [id]);
        // Revert stock
        for(const r of rows){ await conn.query('UPDATE products SET stock = stock - ? WHERE id=?', [r.qty, r.product_id]); }
        // Adjust supplier balance if credit (check both Arabic 'آجل' and English 'credit')
        const invMethod = String(inv.payment_method).toLowerCase();
        if(invMethod === 'credit' || invMethod === 'آجل'){
          await conn.query('UPDATE suppliers SET balance = balance - ? WHERE id=?', [inv.grand_total, inv.supplier_id]);
        }
        // Delete master (details cascade)
        await conn.query('DELETE FROM purchase_invoices WHERE id=?', [id]);
        await conn.commit();
        try{ const { BrowserWindow } = require('electron'); BrowserWindow.getAllWindows().forEach(w => w.webContents.send('products:changed', { action:'stock-decreased', purchase_id: id })); }catch(_){ }
        return { ok:true };
      }catch(e){ try{ await conn.rollback(); }catch(_){ } console.error('purchase_invoices:delete failed', e); return { ok:false, error:'فشل حذف الفاتورة' }; }
      finally{ conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'فشل الاتصال بقاعدة البيانات' }; }
  });

  // --- Payments: record a payment against a single purchase invoice ---
  ipcMain.handle('purchase_invoices:pay', async (_e, payload) => {
    const p = payload || {};
    const purchaseId = Number(p.purchase_id||0);
    const amount = Number(p.amount||0);
    const invoiceNo = (p.invoice_no||'').trim();
    const note = (p.note||null) ? String(p.note).trim() : null;
    if(!purchaseId || !invoiceNo) return { ok:false, error:'معرّف الفاتورة ورقمها مطلوبان' };
    if(!(amount>0)) return { ok:false, error:'المبلغ غير صحيح' };
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTables(conn);
        await conn.beginTransaction();
        const [[inv]] = await conn.query('SELECT * FROM purchase_invoices WHERE id=? LIMIT 1', [purchaseId]);
        if(!inv) { await conn.rollback(); return { ok:false, error:'الفاتورة غير موجودة' }; }
        const supplierId = Number(inv.supplier_id);
        const dueBefore = Number(inv.amount_due||0);
        if(dueBefore <= 0){ await conn.rollback(); return { ok:false, error:'لا يوجد رصيد مستحق على هذه الفاتورة' }; }
        // Cap amount to due
        const payAmt = Math.min(amount, dueBefore);
        // Insert payment record
        await conn.query('INSERT INTO purchase_payments (supplier_id, purchase_id, invoice_no, amount, note, paid_at) VALUES (?,?,?,?,?,NOW())', [supplierId, purchaseId, invoiceNo, payAmt, note]);
        // Update invoice paid/due
        const newPaid = Number(inv.amount_paid||0) + payAmt;
        const newDue = Number((Number(inv.grand_total||0) - newPaid).toFixed(2));
        await conn.query('UPDATE purchase_invoices SET amount_paid=?, amount_due=? WHERE id=?', [newPaid, newDue, purchaseId]);
        // If fully paid and was credit, convert invoice to cash (requested behavior)
        const payMethod = String(inv.payment_method||'').toLowerCase();
        if(newDue <= 0 && (payMethod === 'credit' || payMethod === 'آجل' || payMethod === 'اجل')){
          await conn.query('UPDATE purchase_invoices SET payment_method=?, amount_due=0 WHERE id=?', ['cash', purchaseId]);
        }
        // Adjust supplier balance downwards (since this was a credit purchase originally)
        // Check Arabic variants ('آجل'/'اجل') and English 'credit'
        if(payMethod === 'credit' || payMethod === 'آجل' || payMethod === 'اجل'){
          await conn.query('UPDATE suppliers SET balance = GREATEST(0, balance - ?) WHERE id=?', [payAmt, supplierId]);
        }
        await conn.commit();
        return { ok:true, new_paid: newPaid, new_due: newDue };
      }catch(e){ try{ await conn.rollback(); }catch(_){ } console.error('purchase_invoices:pay failed', e); return { ok:false, error:'فشل تسجيل السداد' }; }
      finally{ conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'فشل الاتصال بقاعدة البيانات' }; }
  });
}

module.exports = { registerPurchaseInvoicesIPC };