// Drivers IPC: manage drivers list and CRUD
const { ipcMain } = require('electron');
const { dbAdapter, DB_NAME } = require('../db/db-adapter');

function registerDriversIPC(){
  async function ensureTables(conn){
    await conn.query(`
      CREATE TABLE IF NOT EXISTS drivers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(64) NULL,
        active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
  }

  ipcMain.handle('drivers:list', async (_e, query) => {
    const q = query || {}; const onlyActive = q.only_active ? 1 : 0; const term = (q.term||'').trim();
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTables(conn);
        const terms = [];
        const params = [];
        if(onlyActive){ terms.push('active=1'); }
        if(term){ terms.push('(name LIKE ? OR phone LIKE ?)'); params.push('%'+term+'%','%'+term+'%'); }
        const where = terms.length ? ('WHERE ' + terms.join(' AND ')) : '';
        const [rows] = await conn.query(`SELECT * FROM drivers ${where} ORDER BY id DESC`, params);
        return { ok:true, items: rows };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'تعذر جلب السائقين' }; }
  });

  ipcMain.handle('drivers:add', async (_e, payload) => {
    try{
      const p = payload || {}; const name = String(p.name||'').trim(); const phone = (p.phone||'').trim();
      if(!name){ return { ok:false, error:'الاسم مطلوب' }; }
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTables(conn);
        const [res] = await conn.query('INSERT INTO drivers (name, phone, active) VALUES (?,?,1)', [name, phone||null]);
        return { ok:true, id: res.insertId };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'تعذر إضافة السائق' }; }
  });

  ipcMain.handle('drivers:update', async (_e, { id }, payload) => {
    try{
      const p = payload || {}; const name = (typeof p.name==='string') ? String(p.name).trim() : undefined; const phone = (typeof p.phone==='string') ? String(p.phone).trim() : undefined;
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTables(conn);
        const fields = []; const params = [];
        if(typeof name !== 'undefined'){ fields.push('name=?'); params.push(name||null); }
        if(typeof phone !== 'undefined'){ fields.push('phone=?'); params.push(phone||null); }
        if(!fields.length) return { ok:false, error:'لا توجد حقول للتعديل' };
        params.push(Number(id));
        await conn.query(`UPDATE drivers SET ${fields.join(', ')} WHERE id=?`, params);
        return { ok:true };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'تعذر تحديث السائق' }; }
  });

  ipcMain.handle('drivers:toggle', async (_e, { id }) => {
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTables(conn);
        await conn.query('UPDATE drivers SET active = 1 - active WHERE id=?', [Number(id)]);
        return { ok:true };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'تعذر تغيير الحالة' }; }
  });

  ipcMain.handle('drivers:delete', async (_e, { id }) => {
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTables(conn);
        await conn.query('DELETE FROM drivers WHERE id=?', [Number(id)]);
        return { ok:true };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'تعذر حذف السائق' }; }
  });

  ipcMain.handle('drivers:get', async (_e, { id }) => {
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTables(conn);
        const [[row]] = await conn.query('SELECT * FROM drivers WHERE id=? LIMIT 1', [Number(id)]);
        if(!row) return { ok:false, error:'غير موجود' };
        return { ok:true, item: row };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'تعذر جلب السائق' }; }
  });
}

module.exports = { registerDriversIPC };