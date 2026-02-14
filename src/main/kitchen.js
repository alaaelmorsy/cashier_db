// Kitchen Printers IPC: manage kitchen printers and routing by main types, and print tickets
const { ipcMain, BrowserWindow } = require('electron');
const path = require('path');
const { dbAdapter, DB_NAME } = require('../db/db-adapter');

function registerKitchenIPC(){
  async function ensureTables(conn){
    await conn.query(`
      CREATE TABLE IF NOT EXISTS kitchen_printers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(128) NOT NULL,
        device_name VARCHAR(256) NOT NULL,
        is_active TINYINT NOT NULL DEFAULT 1,
        paper_width_mm INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);
    await conn.query(`
      CREATE TABLE IF NOT EXISTS kitchen_routes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        printer_id INT NOT NULL,
        type_name VARCHAR(128) NOT NULL,
        UNIQUE KEY uniq_route (printer_id, type_name),
        CONSTRAINT fk_kr_printer FOREIGN KEY (printer_id) REFERENCES kitchen_printers(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);
  }

  // list printers with routes
  ipcMain.handle('kitchen:list', async () => {
    try{
      const conn = await dbAdapter.getConnection();
      try{ await ensureTables(conn);
        const [printers] = await conn.query('SELECT * FROM kitchen_printers ORDER BY id ASC');
        const ids = printers.map(p => p.id);
        let routesBy = new Map();
        if(ids.length){
          const placeholders = ids.map(()=>'?').join(',');
          const [routes] = await conn.query(`SELECT printer_id, type_name FROM kitchen_routes WHERE printer_id IN (${placeholders})`, ids);
          routes.forEach(r => {
            const arr = routesBy.get(r.printer_id) || []; arr.push(r.type_name); routesBy.set(r.printer_id, arr);
          });
        }
        const items = printers.map(p => ({...p, types: routesBy.get(p.id) || [] }));
        return { ok:true, items };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'تعذر تحميل طابعات المطبخ' }; }
  });

  // add printer (name is auto = device_name)
  ipcMain.handle('kitchen:add', async (_e, payload) => {
    const { device_name, paper_width_mm } = payload || {};
    if(!device_name) return { ok:false, error:'اسم الطابعة مطلوب' };
    try{
      const conn = await dbAdapter.getConnection();
      try{ await ensureTables(conn);
        const autoName = String(device_name);
        const [res] = await conn.query('INSERT INTO kitchen_printers (name, device_name, paper_width_mm) VALUES (?,?,NULL)', [autoName, device_name]);
        return { ok:true, id: res.insertId };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'فشل إضافة الطابعة' }; }
  });

  // update printer (name is kept in sync with device_name)
  ipcMain.handle('kitchen:update', async (_e, id, payload) => {
    const pid = (id && id.id) ? id.id : id; if(!pid) return { ok:false, error:'معرّف مفقود' };
    const { device_name, paper_width_mm, is_active } = payload || {};
    try{
      const conn = await dbAdapter.getConnection();
      try{ await ensureTables(conn);
        const autoName = device_name ? String(device_name) : undefined;
        await conn.query('UPDATE kitchen_printers SET name=?, device_name=?, paper_width_mm=NULL, is_active=? WHERE id=?', [autoName, device_name, (is_active?1:0), pid]);
        return { ok:true };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'فشل التعديل' }; }
  });

  // list system printers
  ipcMain.handle('kitchen:list_system_printers', async (event) => {
    try{
      const printers = event.sender.getPrinters ? event.sender.getPrinters() : (event.sender.getPrintersAsync ? await event.sender.getPrintersAsync() : []);
      // map to simple array { name, isDefault }
      const items = (printers||[]).map(p => ({ name: p.name, isDefault: !!p.isDefault }));
      return { ok:true, items };
    }catch(e){ console.error(e); return { ok:false, error:'تعذر جلب طابعات النظام' }; }
  });

  // delete printer
  ipcMain.handle('kitchen:delete', async (_e, id) => {
    const pid = (id && id.id) ? id.id : id; if(!pid) return { ok:false, error:'معرّف مفقود' };
    try{
      const conn = await dbAdapter.getConnection();
      try{ await ensureTables(conn);
        await conn.query('DELETE FROM kitchen_printers WHERE id=?', [pid]);
        return { ok:true };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'فشل الحذف' }; }
  });

  // set routes for a printer
  ipcMain.handle('kitchen:set_routes', async (_e, id, type_names) => {
    const pid = (id && id.id) ? id.id : id; if(!pid) return { ok:false, error:'معرّف مفقود' };
    const types = Array.isArray(type_names) ? type_names : [];
    try{
      const conn = await dbAdapter.getConnection();
      try{ await ensureTables(conn);
        await conn.query('DELETE FROM kitchen_routes WHERE printer_id=?', [pid]);
        for(const t of types){ if(String(t||'').trim()){ await conn.query('INSERT INTO kitchen_routes (printer_id, type_name) VALUES (?,?)', [pid, String(t)]); } }
        return { ok:true };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'فشل حفظ الأقسام للطابعة' }; }
  });

  // simple ticket renderer
  async function printHtmlToDevice({ html, deviceName, copies }){
    const win = new BrowserWindow({ width: 420, height: 680, show:false, webPreferences:{ sandbox:false } });
    try{
      await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
      await new Promise((resolve) => setTimeout(resolve, 200));
      const n = Math.max(1, Number(copies||1));
      for(let i=0;i<n;i++){
        // Electron 28: use callback signature
        await new Promise((resolve, reject) => {
          win.webContents.print({
            silent:true,
            deviceName,
            printBackground: true,
            margins: { marginType: 'none' },
            pageSize: { width: 80000, height: 297000 }, // 80mm x 297mm بالميكرون
          }, (success, err) => {
            if(!success) reject(new Error(err||'print-failed')); else resolve();
          });
        });
      }
      return { ok:true };
    } finally { win.destroy(); }
  }

  function buildKitchenHtml({ header, items, roomName, saleId, waiterName, printAt, orderNo, invoiceNo, invoiceDate }){
    // استخدم نفس مقاس طباعة الكاشير (80mm x 297mm) بدون هوامش
    // Compact 80mm-like kitchen ticket, striped rows, grouped by category
    const esc = (s)=>String(s||'').replace(/[&<>]/g, ch=>({ '&':'&amp;','<':'&lt;','>':'&gt;' }[ch]));
    const groups = new Map();
    (items||[]).forEach((it) => {
      const key = (it.category && String(it.category).trim()) ? String(it.category).trim() : 'أخرى';
      if(!groups.has(key)) groups.set(key, []);
      groups.get(key).push(it);
    });
    const sections = [];
    for(const [cat, arr] of groups.entries()){
      let rowIdx = 0;
      const lines = arr.map(it => {
        const name = esc(it.name||'');
        const qty = Number(it.qty||0).toFixed(0);
        const op = it.operation_name ? esc(it.operation_name) : '';
        const zebra = (rowIdx++ % 2 === 0) ? 'row even' : 'row odd';
        const noteIn = it.description ? `<div class="note-in">ملاحظة: ${esc(it.description)}</div>` : '';
        return `<div class="${zebra}">
  <div class="cols"><div class="name">${name}</div><div class="op">${op}</div><div class="qty">x${qty}</div>${noteIn}</div>
</div>`;
      }).join('');
      sections.push(`<div class="section"><div class="section-h">${esc(cat)}</div><div class="head-row"><div>الصنف</div><div>العملية</div><div>الكمية</div></div>${lines}</div>`);
    }

    const now = printAt ? new Date(printAt) : new Date();
    // احصل على رقم الفاتورة وتاريخها إن تم تمريرهما أو استخرج من saleId لاحقًا
    const invNo = invoiceNo ? String(invoiceNo) : (saleId ? ('#'+String(saleId)) : '');
    const invDate = invoiceDate ? new Date(invoiceDate) : now;
    const dt = `${invDate.getFullYear()}-${String(invDate.getMonth()+1).padStart(2,'0')}-${String(invDate.getDate()).padStart(2,'0')} ${String(invDate.getHours()).padStart(2,'0')}:${String(invDate.getMinutes()).padStart(2,'0')}`;

    return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"/>
<style>
  @page { size: 80mm auto; margin: 0; }
  html, body { width: 80mm; }
  body{ font-family: system-ui,-apple-system, Segoe UI, Roboto, "Noto Kufi Arabic", Arial, sans-serif; margin:0; padding:8px 6px 10px; color:#000; }
  .ticket{ width: calc(80mm - 10mm); margin: 0 auto; } /* هوامش جانبية 5mm يمين ويسار */
  .title{ text-align:center; font-weight:900; font-size:18px; margin:2px 0 6px; }
  /* سطور مبسطة مثل فاتورة الكاشير */
  .meta-list{ margin:4px 0; font-size:12px; font-weight:800; color:#000; }
  .meta-list .row-line{ display:flex; justify-content:space-between; gap:8px; padding:2px 0; }
  .divider{ border-top:2px solid #000; margin:6px 0; }
  .section{ margin-bottom:6px; }
  .section-h{ background:#eef2ff; color:#0b3daa; font-family: system-ui,-apple-system, Segoe UI, Roboto, "Noto Kufi Arabic", Arial, sans-serif; font-weight:900; font-size:14px; padding:4px 6px; border-radius:4px; border:2px solid #0b3daa; }
  .head-row{ display:grid; grid-template-columns: 1fr .9fr .5fr; gap:0; font-size:12px; font-weight:900; color:#000; background:#fff; border:2px solid #000; border-radius:4px; overflow:hidden; margin-top:4px; }
  .head-row > div{ padding:6px 6px; border-inline-start:2px solid #000; }
  .head-row > div:first-child{ border-inline-start:0; }
  .row{ padding:0; }
  .cols{ display:grid; grid-template-columns: 1fr .9fr .5fr; gap:0; align-items:start; font-size:14px; font-weight:900; border:2px solid #000; border-top:0; }
  .cols > div{ padding:6px 6px; border-inline-start:2px solid #000; }
  .cols > div:first-child{ border-inline-start:0; }
  .name{ word-break:keep-all; overflow-wrap:anywhere; }
  .op{ color:#000; font-weight:900; font-size:13px; }
  .qty{ font-variant-numeric: tabular-nums; text-align:left; direction:ltr; }
  /* الملاحظة داخل نفس مربع الصنف */
  .note-in{ grid-column: 1 / -1; border-top:2px dashed #000; margin:0; padding:4px 6px; font-size:12px; font-weight:800; color:#000; }
  .footer{ text-align:center; color:#000; font-size:10px; margin-top:6px; }
</style>
</head><body>
  <div class="ticket">
    <div class="title">طلب مطبخ</div>
    <div class="meta-list">
      <div class="row-line"><div>رقم الفاتورة: <b>${esc(invNo||'')}</b></div><div>التاريخ: <b>${esc(dt||'')}</b></div></div>
      <div class="row-line"><div>رقم الأوردر: <b>${orderNo?esc(String(orderNo)):''}</b></div><div>مدخل الفاتورة: <b>${esc(waiterName||'')}</b></div></div>
      ${roomName?`<div class="row-line"><div>الغرفة: <b>${esc(roomName)}</b></div></div>`:''}
    </div>
    <div class="divider"></div>
    ${sections.join('')}
    <div class="footer">__</div>
  </div>
</body></html>`;
  }

  // test print to device
  ipcMain.handle('kitchen:test_print', async (_e, id) => {
    const pid = (id && id.id) ? id.id : id; if(!pid) return { ok:false, error:'معرّف مفقود' };
    try{
      const conn = await dbAdapter.getConnection();
      try{ await ensureTables(conn);
        const [[p]] = await conn.query('SELECT * FROM kitchen_printers WHERE id=?', [pid]);
        if(!p) return { ok:false, error:'غير موجود' };
        const html = buildKitchenHtml({ header: 'اختبار طابعة المطبخ', items:[{ name:'طلب تجريبي', qty:1 }], roomName: '', saleId: '', waiterName: '', printAt: Date.now() });
        const r = await printHtmlToDevice({ html, deviceName: p.device_name, copies: 1 });
        return r;
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'فشل طباعة الاختبار' }; }
  });

  // print order by routing items to printers based on product category (type_name)
  ipcMain.handle('kitchen:print_order', async (_e, payload) => {
    const { items, room_name, sale_id, waiter_name, copies_per_section, order_no } = payload || {};
    const cart = Array.isArray(items) ? items : [];
    const copies = Math.max(1, Number(copies_per_section||1));
    try{
      const conn = await dbAdapter.getConnection();
      try{ await ensureTables(conn);
        // load routes
        const [printers] = await conn.query('SELECT * FROM kitchen_printers WHERE is_active=1');
        if(!printers.length) return { ok:true, skipped:true };
        const ids = printers.map(p=>p.id);
        const placeholders = ids.map(()=>'?').join(',');
        const [routes] = await conn.query(`SELECT printer_id, type_name FROM kitchen_routes WHERE printer_id IN (${placeholders})`, ids);
        const mapTypes = new Map(); // type_name -> [printer]
        routes.forEach(r => {
          const p = printers.find(pp=>pp.id===r.printer_id); if(!p) return;
          const key = String(r.type_name||'');
          const arr = mapTypes.get(key) || []; arr.push(p); mapTypes.set(key, arr);
        });
        // group items by printers
        const byPrinter = new Map();
        for(const it of cart){
          const t = String(it.category||'');
          const printersForType = mapTypes.get(t) || [];
          for(const p of printersForType){
            const arr = byPrinter.get(p.id) || []; arr.push(it); byPrinter.set(p.id, arr);
          }
        }
        // print per printer
        for(const p of printers){
          const its = byPrinter.get(p.id) || [];
          if(!its.length) continue;
          // حاول جلب رقم الفاتورة وتاريخها لعرضهما في رأس التذكرة
          let invNo=null, invDate=null;
          try{
            if(sale_id){ const [[s]] = await conn.query('SELECT invoice_no, created_at FROM sales WHERE id=?', [Number(sale_id)]); if(s){ invNo = s.invoice_no||null; invDate = s.created_at||null; } }
          }catch(_){ }
          const html = buildKitchenHtml({ header: '', items: its, roomName: room_name||'', saleId: sale_id||'', waiterName: waiter_name||'', printAt: Date.now(), orderNo: (order_no||null), invoiceNo: invNo, invoiceDate: invDate });
          try{ await printHtmlToDevice({ html, deviceName: p.device_name, copies }); }catch(err){ console.error('kitchen print failed', p.device_name, err); }
        }
        return { ok:true };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'فشل طباعة المطبخ' }; }
  });
}

// eager ensure at app start
(async () => {
  try{
    const conn = await dbAdapter.getConnection();
    try{
      await conn.query(`
        CREATE TABLE IF NOT EXISTS kitchen_printers (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(128) NOT NULL,
          device_name VARCHAR(256) NOT NULL,
          is_active TINYINT NOT NULL DEFAULT 1,
          paper_width_mm INT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);
      await conn.query(`
        CREATE TABLE IF NOT EXISTS kitchen_routes (
          id INT AUTO_INCREMENT PRIMARY KEY,
          printer_id INT NOT NULL,
          type_name VARCHAR(128) NOT NULL,
          UNIQUE KEY uniq_route (printer_id, type_name)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);
    } finally { conn.release(); }
  }catch(e){ /* silently ignore - tables will be created on first connection */ }
})();

module.exports = { registerKitchenIPC };