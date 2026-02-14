const { ipcMain } = require('electron');
const { dbAdapter, DB_NAME } = require('../db/db-adapter');

function registerEmployeesIPC(){
  async function ensureTables(conn){
    await conn.query(`
      CREATE TABLE IF NOT EXISTS employees (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
  }

  ipcMain.handle('employees:list', async (_e, query) => {
    const q = query || {}; const term = (q.term||'').trim();
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTables(conn);
        const terms = [];
        const params = [];
        if(term){ terms.push('name LIKE ?'); params.push('%'+term+'%'); }
        const where = terms.length ? ('WHERE ' + terms.join(' AND ')) : '';
        const [rows] = await conn.query(`SELECT * FROM employees ${where} ORDER BY id DESC`, params);
        return { ok:true, items: rows };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'تعذر جلب الموظفين' }; }
  });

  ipcMain.handle('employees:add', async (_e, payload) => {
    try{
      const p = payload || {}; const name = String(p.name||'').trim();
      if(!name){ return { ok:false, error:'الاسم مطلوب' }; }
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTables(conn);
        const [res] = await conn.query('INSERT INTO employees (name) VALUES (?)', [name]);
        return { ok:true, id: res.insertId };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'تعذر إضافة الموظف' }; }
  });

  ipcMain.handle('employees:update', async (_e, { id }, payload) => {
    try{
      const p = payload || {}; const name = (typeof p.name==='string') ? String(p.name).trim() : undefined;
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTables(conn);
        if(typeof name === 'undefined' || !name) return { ok:false, error:'لا توجد حقول للتعديل' };
        await conn.query('UPDATE employees SET name=? WHERE id=?', [name, Number(id)]);
        return { ok:true };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'تعذر تحديث الموظف' }; }
  });

  ipcMain.handle('employees:delete', async (_e, { id }) => {
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTables(conn);
        await conn.query('DELETE FROM employees WHERE id=?', [Number(id)]);
        return { ok:true };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'تعذر حذف الموظف' }; }
  });

  ipcMain.handle('employees:get', async (_e, { id }) => {
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTables(conn);
        const [[row]] = await conn.query('SELECT * FROM employees WHERE id=? LIMIT 1', [Number(id)]);
        if(!row) return { ok:false, error:'غير موجود' };
        return { ok:true, item: row };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'تعذر جلب الموظف' }; }
  });
}

module.exports = { registerEmployeesIPC };
