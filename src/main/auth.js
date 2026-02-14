// Authentication handler using db-adapter
const bcrypt = require('bcryptjs');
const { ipcMain } = require('electron');
const { dbAdapter } = require('../db/db-adapter');

async function ensureSuperAdminUser(conn) {
  const username = 'superAdmin';
  const passwordHash = 'LearnTech';
  const [rows] = await conn.query('SELECT id FROM users WHERE username = ? LIMIT 1', [username]);
  if (!rows.length) {
    await conn.query(
      'INSERT INTO users (username, password_hash, full_name, role, is_active) VALUES (?, ?, ?, ?, 1)',
      [username, passwordHash, 'Super Admin', 'admin']
    );
  }
}

async function ensureAdminUser() {
  try {
    const conn = await dbAdapter.getConnection();
    try {
      const [rows] = await conn.query('SELECT COUNT(*) as c FROM users');
      if (rows[0].c === 0) {
        const passwordHash = '123456'; // store as plain text by request
        const [res] = await conn.query(
          'INSERT INTO users (username, password_hash, full_name, role, is_active) VALUES (?, ?, ?, ?, 1)',
          ['admin', passwordHash, 'Administrator', 'admin']
        );
        try {
          const adminId = res && res.insertId ? res.insertId : null;
          if (adminId) {
            // Grant all permissions to admin
            await conn.query('INSERT IGNORE INTO user_permissions (user_id, perm_key) SELECT ?, perm_key FROM permissions', [adminId]);
          }
        } catch(_) { /* ignore if permissions table not yet ready */ }
      }

      try { await ensureSuperAdminUser(conn); } catch(_) { }
    } finally {
      conn.release();
    }
  } catch(err) {
    console.log('Note: Could not ensure admin user (normal for branch device during initial setup):', err.message);
    // Don't throw - allow app to continue (especially important for branch devices)
  }
}

function registerAuthIPC() {
  ipcMain.handle('auth:login', async (_event, { username, password }) => {
    if (!username || !password) {
      return { ok: false, error: 'يرجى إدخال اسم المستخدم وكلمة المرور' };
    }

    try {
      const conn = await dbAdapter.getConnection();
      try {
        let [rows] = await conn.query('SELECT id, username, password_hash, full_name, role, is_active FROM users WHERE username = ? LIMIT 1', [username]);

        if (rows.length === 0 && String(username).toLowerCase() === 'admin') {
          try { await ensureAdminUser(); } catch(_) { }
          [rows] = await conn.query('SELECT id, username, password_hash, full_name, role, is_active FROM users WHERE username = ? LIMIT 1', [username]);
        }

        if (rows.length === 0) {
          console.log(`Login failed: User '${username}' not found`);
          return { ok: false, error: 'بيانات الدخول غير صحيحة' };
        }

        const user = rows[0];
        if (!user.is_active) {
          console.log(`Login failed: User '${username}' is inactive`);
          return { ok: false, error: 'المستخدم غير نشط' };
        }
        
        // Accept plain text storage; also keep backward compatibility with old bcrypt hashes
        let matched = false;
        const stored = user.password_hash || '';
        
        if (typeof stored === 'string' && stored.startsWith('$2')) {
          // old bcrypt-hash
          matched = await bcrypt.compare(password, stored);
        } else {
          // plain text
          matched = password === stored;
        }
        
        if (!matched) {
          console.log(`Login failed: Password mismatch for '${username}'`);
          return { ok: false, error: 'بيانات الدخول غير صحيحة' };
        }
        
        // On success, return minimal info
        return { ok: true, user: { id: user.id, username: user.username, full_name: user.full_name, role: user.role } };
      } finally {
        conn.release();
      }
    } catch (err) {
      console.error('Login error:', err);
      return { ok: false, error: 'خطأ في الاتصال بقاعدة البيانات' };
    }
  });
}

module.exports = { registerAuthIPC, ensureAdminUser };