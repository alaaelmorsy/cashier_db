// Users IPC handlers (CRUD)
const { ipcMain } = require('electron');
const bcrypt = require('bcryptjs');
const { dbAdapter, DB_NAME } = require('../db/db-adapter');

function registerUsersIPC(){
  // List users
  ipcMain.handle('users:list', async () => {
    try{
      const conn = await dbAdapter.getConnection();
      try{
        const [rows] = await conn.query("SELECT id, username, full_name, role, is_active, created_at FROM users WHERE username <> 'superAdmin' ORDER BY id DESC");
        return { ok:true, items: rows };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'خطأ في تحميل المستخدمين' }; }
  });

  // Get single
  ipcMain.handle('users:get', async (_evt, { id }) => {
    if(!id) return { ok:false, error:'معرّف مفقود' };
    try{
      const conn = await dbAdapter.getConnection();
      try{
        const [rows] = await conn.query('SELECT id, username, full_name, role, is_active, password_hash as password FROM users WHERE id=? LIMIT 1', [id]);
        if(rows.length===0) return { ok:false, error:'غير موجود' };
        if(rows[0].username === 'superAdmin') return { ok:false, error:'غير مسموح' };
        return { ok:true, item: rows[0] };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'خطأ في الجلب' }; }
  });

  // Add user
  ipcMain.handle('users:add', async (_evt, payload) => {
    const { username, full_name, password, role, is_active } = payload || {};
    if(!username || !password) return { ok:false, error:'اسم المستخدم وكلمة المرور مطلوبة' };
    if(username === 'superAdmin') return { ok:false, error:'اسم المستخدم غير متاح' };
    try{
      const conn = await dbAdapter.getConnection();
      try{
        const password_hash = password; // store as plain text by request
        await conn.query('INSERT INTO users (username, password_hash, full_name, role, is_active) VALUES (?,?,?,?,?)', [username, password_hash, full_name||null, role||'cashier', is_active?1:0]);
        return { ok:true };
      } finally { conn.release(); }
    }catch(e){
      if (e && (e.code === 'ER_DUP_ENTRY' || e.code === 'SQLITE_CONSTRAINT')) return { ok:false, error:'اسم المستخدم موجود مسبقاً' };
      console.error(e); return { ok:false, error:'فشل الإضافة' };
    }
  });

  // Update user (by username)
  ipcMain.handle('users:update', async (_evt, { username, payload }) => {
    if(!username) return { ok:false, error:'اسم المستخدم مفقود' };
    if(username === 'superAdmin') return { ok:false, error:'لا يمكن تعديل هذا المستخدم' };
    const { full_name, password, role, is_active } = payload || {};
    try{
      const conn = await dbAdapter.getConnection();
      try{
        const [current] = await conn.query('SELECT role, is_active FROM users WHERE username=? LIMIT 1', [username]);
        if(current.length === 0) return { ok:false, error:'المستخدم غير موجود' };
        
        const oldRole = current[0].role;
        const oldActive = current[0].is_active;
        
        if(oldRole === 'admin' && role !== 'admin' && oldActive === 1){
          const [[cnt]] = await conn.query("SELECT COUNT(*) AS c FROM users WHERE role='admin' AND is_active=1");
          if(Number(cnt.c||0) <= 1){
            return { ok:false, error:'لا يمكن تغيير دور آخر مدير نشط' };
          }
        }
        
        if(password){
          const password_hash = password;
          await conn.query('UPDATE users SET full_name=?, role=?, is_active=?, password_hash=? WHERE username=?', [full_name||null, role||'cashier', is_active?1:0, password_hash, username]);
        } else {
          await conn.query('UPDATE users SET full_name=?, role=?, is_active=? WHERE username=?', [full_name||null, role||'cashier', is_active?1:0, username]);
        }
        return { ok:true };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'فشل التعديل' }; }
  });

  // Toggle active (السماح دائمًا بالتوقيف بدلاً من الحذف)
  ipcMain.handle('users:toggle', async (_evt, { id }) => {
    if(!id) return { ok:false, error:'معرّف مفقود' };
    try{
      const conn = await dbAdapter.getConnection();
      try{
        const [rows] = await conn.query('SELECT is_active, role, username FROM users WHERE id=?', [id]);
        if(rows.length===0) return { ok:false, error:'غير موجود' };
        const cur = rows[0];
        if(cur.username === 'superAdmin') return { ok:false, error:'لا يمكن إيقاف هذا المستخدم' };
        const newVal = cur.is_active ? 0 : 1;
        // لا تسمح بإيقاف آخر مدير نشط
        if(cur.role === 'admin' && newVal === 0){
          const [[cnt]] = await conn.query("SELECT COUNT(*) AS c FROM users WHERE role='admin' AND is_active=1");
          if(Number(cnt.c||0) <= 1){
            return { ok:false, error:'يجب أن يبقى مدير واحد على الأقل نشطًا' };
          }
        }
        await conn.query('UPDATE users SET is_active=? WHERE id=?', [newVal, id]);
        return { ok:true };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'فشل تحديث الحالة' }; }
  });

  // Delete with constraints
  ipcMain.handle('users:delete', async (_evt, { id }) => {
    if(!id) return { ok:false, error:'معرّف مفقود' };
    try{
      const conn = await dbAdapter.getConnection();
      try{
        // 1) لا تحذف إذا كان المستخدم هو المدير الوحيد المتبقي
        const [[ua]] = await conn.query('SELECT role, username FROM users WHERE id=? LIMIT 1', [id]);
        if(!ua) return { ok:false, error:'المستخدم غير موجود' };
        if(ua.username === 'superAdmin') return { ok:false, error:'لا يمكن حذف هذا المستخدم' };
        if(ua.role === 'admin'){
          const [[cnt]] = await conn.query("SELECT COUNT(*) AS c FROM users WHERE role='admin' AND is_active=1");
          if(Number(cnt.c||0) <= 1){
            return { ok:false, error:'لا يمكن حذف آخر مستخدم مدير.' };
          }
        }
        // 2) لا تحذف إذا طبع هذا المستخدم فواتير
        // نعتمد على sales.created_by_user_id التي أضفناها
        try{
          const [[s]] = await conn.query('SELECT COUNT(*) AS c FROM sales WHERE created_by_user_id=?', [id]);
          if(Number(s.c||0) > 0){
            return { ok:false, error:'لا يمكن حذف مستخدم قام بطباعة فواتير. يمكن فقط إيقافه.' };
          }
        }catch(_){ /* في حال غياب العمود لأي قاعدة قديمة */ }
        // نفّذ الحذف
        await conn.query('DELETE FROM users WHERE id=?', [id]);
        return { ok:true };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'فشل الحذف' }; }
  });

  ipcMain.handle('users:count_active_admins', async () => {
    try{
      const conn = await dbAdapter.getConnection();
      try{
        const [[cnt]] = await conn.query("SELECT COUNT(*) AS c FROM users WHERE role='admin' AND is_active=1");
        return { ok:true, count: Number(cnt.c||0) };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, count: 0 }; }
  });
}

module.exports = { registerUsersIPC };