// Permissions IPC handlers
const { ipcMain } = require('electron');
const { dbAdapter, DB_NAME } = require('../db/db-adapter');

// Ensure required permission keys exist (idempotent)
async function ensureDefaultPermissions() {
  try {
    const conn = await dbAdapter.getConnection();
    try {
      await conn.query(`USE \`${DB_NAME}\``);
      
      // Detect optional parent_key column
      const hasParent = await dbAdapter.columnExists('permissions', 'parent_key');

      const perms = [
        { perm_key: 'suppliers', name: 'الموردون', parent: null },
        { perm_key: 'suppliers.add', name: 'إضافة مورد', parent: 'suppliers' },
        { perm_key: 'suppliers.edit', name: 'تعديل مورد', parent: 'suppliers' },
        { perm_key: 'suppliers.toggle', name: 'تفعيل/إيقاف مورد', parent: 'suppliers' },
        { perm_key: 'suppliers.delete', name: 'حذف مورد', parent: 'suppliers' },

        // Appointments permissions
        { perm_key: 'appointments', name: 'المواعيد', parent: null },
        { perm_key: 'appointments.add', name: 'حجز موعد', parent: 'appointments' },
        { perm_key: 'appointments.edit', name: 'تعديل موعد', parent: 'appointments' },
        { perm_key: 'appointments.delete', name: 'حذف موعد', parent: 'appointments' },

        // Purchase Invoices permissions
        { perm_key: 'purchase_invoices', name: 'فواتير الشراء', parent: null },
        { perm_key: 'purchase_invoices.add', name: 'إضافة فاتورة شراء', parent: 'purchase_invoices' },
        { perm_key: 'purchase_invoices.edit', name: 'تعديل فاتورة شراء', parent: 'purchase_invoices' },
        { perm_key: 'purchase_invoices.delete', name: 'حذف فاتورة شراء', parent: 'purchase_invoices' },
        { perm_key: 'purchase_invoices.print', name: 'طباعة فاتورة شراء', parent: 'purchase_invoices' },

        // Vouchers permissions
        { perm_key: 'vouchers', name: 'السندات', parent: null },
        { perm_key: 'vouchers.add', name: 'إضافة سند', parent: 'vouchers' },
        { perm_key: 'vouchers.edit', name: 'تعديل سند', parent: 'vouchers' },
        { perm_key: 'vouchers.delete', name: 'حذف سند', parent: 'vouchers' },
        { perm_key: 'vouchers.print', name: 'طباعة سند', parent: 'vouchers' },

        // Quotations permissions
        { perm_key: 'quotations', name: 'عروض الأسعار', parent: null },
        { perm_key: 'quotations.add', name: 'إضافة عرض سعر', parent: 'quotations' },
        { perm_key: 'quotations.edit', name: 'تعديل عرض سعر', parent: 'quotations' },
        { perm_key: 'quotations.delete', name: 'حذف عرض سعر', parent: 'quotations' },
        { perm_key: 'quotations.print', name: 'طباعة عرض سعر', parent: 'quotations' },
        { perm_key: 'quotations.convert', name: 'تحويل لفاتورة', parent: 'quotations' },

        // WhatsApp permissions
        { perm_key: 'whatsapp', name: 'إدارة واتساب', parent: null },
        { perm_key: 'whatsapp.send', name: 'إرسال رسائل', parent: 'whatsapp' },
        { perm_key: 'whatsapp.view', name: 'عرض الرسائل', parent: 'whatsapp' },

        // Shifts permissions
        { perm_key: 'shifts', name: 'الشفتات', parent: null },
        { perm_key: 'shifts.view', name: 'عرض الشفتات', parent: 'shifts' },
        { perm_key: 'shifts.open', name: 'فتح شفت', parent: 'shifts' },
        { perm_key: 'shifts.close', name: 'إغلاق شفت', parent: 'shifts' },
        { perm_key: 'shifts.print', name: 'طباعة تفاصيل الشفت', parent: 'shifts' },
      ];

      for (const p of perms) {
        if (hasParent) {
          await conn.query(
            'INSERT IGNORE INTO permissions (perm_key, name, parent_key) VALUES (?,?,?)',
            [p.perm_key, p.name, p.parent]
          );
        } else {
          await conn.query(
            'INSERT IGNORE INTO permissions (perm_key, name) VALUES (?,?)',
            [p.perm_key, p.name]
          );
        }
      }
    } finally { conn.release(); }
  } catch (e) {
    // Non-fatal: do not crash app if permissions seeding fails
    console.error('ensureDefaultPermissions failed', e);
  }
}

function registerPermissionsIPC(){
  // Best-effort seed of default permissions (runs once on startup)
  ensureDefaultPermissions();

  // List all available permissions (with optional hierarchy)
  ipcMain.handle('perms:list_all', async () => {
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await conn.query(`USE \`${DB_NAME}\``);
        
        // Try to get parent_key if exists; if not, synthesize hierarchy from naming (e.g., sales.* -> parent sales)
        let rows;
        try{
          const [r] = await conn.query('SELECT perm_key, name, parent_key FROM permissions ORDER BY name ASC');
          rows = r;
        }catch(_){
          const [r] = await conn.query('SELECT perm_key, name FROM permissions ORDER BY name ASC');
          rows = r.map(x => ({ ...x, parent_key: (x.perm_key.includes('.') ? x.perm_key.split('.')[0] : null) }));
        }
        // Filter out Rooms and Inventory permissions entirely
        const filtered = (rows||[]).filter(x => !/^rooms(\.|$)/i.test(x.perm_key) && !/^inventory(\.|$)/i.test(x.perm_key));
        return { ok:true, items: filtered };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'فشل تحميل الصلاحيات' }; }
  });

  // Get permissions for a user -> returns array of keys
  ipcMain.handle('perms:get_for_user', async (_evt, { user_id }) => {
    if(!user_id) return { ok:false, error:'معرّف المستخدم مفقود' };
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await conn.query(`USE \`${DB_NAME}\``);
        
        // Fetch user role then user-specific permissions
        const [uRows] = await conn.query('SELECT role FROM users WHERE id=? LIMIT 1', [user_id]);
        if(!uRows.length) return { ok:false, error:'المستخدم غير موجود' };
        const role = uRows[0].role;

        // Load any saved permissions for this user
        const [rows] = await conn.query('SELECT perm_key FROM user_permissions WHERE user_id=?', [user_id]);

        if (role === 'admin') {
          // Admin always has all permissions to avoid missing newly added ones
          const [allPerms] = await conn.query('SELECT perm_key FROM permissions');
          return { ok:true, keys: allPerms.map(r => r.perm_key) };
        }

        // Non-admin: return saved permissions
        const keys = rows.map(r => r.perm_key);
        return { ok:true, keys };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'فشل الجلب' }; }
  });

  // Set permissions for a user (replace)
  ipcMain.handle('perms:set_for_user', async (_evt, { user_id, keys }) => {
    if(!user_id || !Array.isArray(keys)) return { ok:false, error:'بيانات غير مكتملة' };
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await conn.query(`USE \`${DB_NAME}\``);
        
        // Allow modifying permissions for all users (including admin). Admin will default to all only if none saved.
        await conn.beginTransaction();
        await conn.query('DELETE FROM user_permissions WHERE user_id=?', [user_id]);
        if(keys.length){
          const values = keys.map(k => [user_id, k]);
          await conn.query('INSERT INTO user_permissions (user_id, perm_key) VALUES ?', [values]);
        }
        await conn.commit();
        return { ok:true };
      } catch(e){
        try{ await conn.rollback(); }catch(_){ }
        if(e && e.code === 'ER_NO_REFERENCED_ROW_2'){
          return { ok:false, error:'صلاحية غير معرّفة' };
        }
        console.error(e); return { ok:false, error:'فشل الحفظ' };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'فشل الاتصال بقاعدة البيانات' }; }
  });
}

module.exports = { registerPermissionsIPC }; 