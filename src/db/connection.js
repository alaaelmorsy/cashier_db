// MySQL connection pool with runtime-configurable host
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Persisted config path (use Electron userData when available)
let CONFIG_PATH;
try {
  const { app } = require('electron');
  CONFIG_PATH = app ? path.join(app.getPath('userData'), 'db-config.json') : null;
} catch (_) { CONFIG_PATH = null; }
if (!CONFIG_PATH) {
  // Fallback for dev/non-electron context
  const appRoot = path.resolve(__dirname, '..', '..');
  CONFIG_PATH = path.join(appRoot, 'app', 'db-config.json');
}

// Base config from environment
let currentConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || 'Db2@dm1n2022',
  name: process.env.DB_NAME || 'cashier_db',
};

// Expose DB_NAME as a constant used by callers (from env)
const DB_NAME = currentConfig.name;

function safeReadJSON(p){ try{ return JSON.parse(fs.readFileSync(p, 'utf-8')); }catch(_){ return null; } }
function safeWriteJSON(p, obj){ try{ fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(obj, null, 2), 'utf-8'); }catch(_){ /* ignore */ } }

function loadSavedConfig(){
  try{
    if(fs.existsSync(CONFIG_PATH)){
      const saved = safeReadJSON(CONFIG_PATH) || {};
      currentConfig = { ...currentConfig, ...saved };
    }
  }catch(_){ /* ignore */ }
}

function saveConfig(){
  const toSave = { host: currentConfig.host, port: currentConfig.port, user: currentConfig.user, password: currentConfig.password, name: currentConfig.name };
  safeWriteJSON(CONFIG_PATH, toSave);
}

// Ensure the current DB user can connect remotely (idempotent)
async function ensureRemoteAccess(conn){
  try{
    const u = String(currentConfig.user || '').trim();
    const pw = String(currentConfig.password || '').trim();
    const db = String(DB_NAME || '').trim();
    if(!u || !pw || !db) return;

    // Simple escape for single quotes
    const esc = (s) => s.replace(/'/g, "''");

    // Allow from any host
    await conn.query(`CREATE USER IF NOT EXISTS '${esc(u)}'@'%' IDENTIFIED BY '${esc(pw)}';`);
    await conn.query(`GRANT ALL PRIVILEGES ON \`${esc(db)}\`.* TO '${esc(u)}'@'%';`);

    // Additionally allow from RadminVPN range (26.x.x.x), harmless if '%' already granted
    await conn.query(`CREATE USER IF NOT EXISTS '${esc(u)}'@'26.%' IDENTIFIED BY '${esc(pw)}';`);
    await conn.query(`GRANT ALL PRIVILEGES ON \`${esc(db)}\`.* TO '${esc(u)}'@'26.%';`);

    await conn.query('FLUSH PRIVILEGES;');
  }catch(_){ /* ignore if no privilege or MySQL policy prevents it */ }
}

async function initDbFromSaved(){
  loadSavedConfig();
  // If a pool was already created (unlikely on startup), drop it to apply saved config next time
  if(pool){ try{ await pool.end(); }catch(_){ } pool = null; }
}

let pool;

function isRemoteHost(host) {
  const h = String(host || '').toLowerCase().trim();
  return h && h !== '127.0.0.1' && h !== 'localhost' && h !== '::1';
}

async function getPool() {
  if (!pool) {
    // Load saved config before creating pool
    loadSavedConfig();

    const remote = isRemoteHost(currentConfig.host);

    pool = mysql.createPool({
      host: currentConfig.host,
      port: currentConfig.port,
      user: currentConfig.user,
      password: currentConfig.password,
      waitForConnections: true,
      connectionLimit: remote ? 5 : 10,
      queueLimit: 50,
      multipleStatements: true,
      connectTimeout: remote ? 10000 : 30000,
      timezone: 'local',
      enableKeepAlive: true,
      keepAliveInitialDelay: 30000,
    });

    // Ensure DB and tables exist
    const conn = await pool.getConnection();
    try {
      await conn.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;`);
      await conn.query(`USE \`${DB_NAME}\`;`);

      // Try to ensure remote access for current user/db on server side (no-op if lacks privileges)
      await ensureRemoteAccess(conn);

      // Users
      await conn.query(`
        CREATE TABLE IF NOT EXISTS users (
          id INT AUTO_INCREMENT PRIMARY KEY,
          username VARCHAR(100) NOT NULL UNIQUE,
          password_hash VARCHAR(255) NOT NULL,
          full_name VARCHAR(150) NULL,
          role ENUM('admin','cashier') NOT NULL DEFAULT 'admin',
          is_active TINYINT(1) NOT NULL DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);

      // Shifts (work sessions for cashiers)
      await conn.query(`
        CREATE TABLE IF NOT EXISTS shifts (
          id INT AUTO_INCREMENT PRIMARY KEY,
          shift_no VARCHAR(32) NOT NULL UNIQUE,
          user_id INT NOT NULL,
          username VARCHAR(100) NOT NULL,
          
          opened_at DATETIME NOT NULL,
          opening_cash DECIMAL(12,2) NOT NULL DEFAULT 0,
          opening_notes TEXT NULL,
          
          closed_at DATETIME NULL,
          closing_cash DECIMAL(12,2) NULL,
          closing_notes TEXT NULL,
          
          total_invoices INT NULL DEFAULT 0,
          total_sales DECIMAL(12,2) NULL DEFAULT 0,
          cash_sales DECIMAL(12,2) NULL DEFAULT 0,
          card_sales DECIMAL(12,2) NULL DEFAULT 0,
          split_sales DECIMAL(12,2) NULL DEFAULT 0,
          
          expected_cash DECIMAL(12,2) NULL,
          actual_cash DECIMAL(12,2) NULL,
          cash_difference DECIMAL(12,2) NULL,
          
          status ENUM('open','closed') NOT NULL DEFAULT 'open',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
          INDEX idx_status (status),
          INDEX idx_user_date (user_id, opened_at),
          INDEX idx_shift_no (shift_no)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      // Permissions catalog and user mapping
      await conn.query(`
        CREATE TABLE IF NOT EXISTS permissions (
          perm_key VARCHAR(64) NOT NULL PRIMARY KEY,
          name VARCHAR(150) NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
      // Add parent_key column for hierarchical permissions (idempotent)
      try{
        await conn.query(`ALTER TABLE permissions ADD COLUMN IF NOT EXISTS parent_key VARCHAR(64) NULL;`);
        await conn.query(`ALTER TABLE permissions ADD CONSTRAINT IF NOT EXISTS fk_perm_parent FOREIGN KEY (parent_key) REFERENCES permissions(perm_key) ON DELETE CASCADE;`);
      }catch(_){ /* ignore if already added or MySQL < 8 */ }

      await conn.query(`
        CREATE TABLE IF NOT EXISTS user_permissions (
          user_id INT NOT NULL,
          perm_key VARCHAR(64) NOT NULL,
          PRIMARY KEY (user_id, perm_key),
          CONSTRAINT fk_up_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          CONSTRAINT fk_up_perm FOREIGN KEY (perm_key) REFERENCES permissions(perm_key) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      // Seed default main permissions (idempotent)
      await conn.query(`
        INSERT IGNORE INTO permissions (perm_key, name) VALUES
          ('users','المستخدمون'),
          ('customers','العملاء'),
          ('sales','المبيعات'),
          ('invoices','الفواتير'),
          ('credit_notes','الفواتير الدائنة'),
          ('quotations','عروض الأسعار'),
          ('payments','المدفوعات'),
          ('vouchers','السندات'),
          ('products','المنتجات'),
          ('rooms','الغرف'),
          ('types','الأنواع'),
          ('settings','الإعدادات'),
          ('operations','العمليات'),
          ('purchases','المصروفات'),
          ('inventory','المخزون'),
          ('customer_pricing','تخصيص الأسعار'),
          ('offers','العروض'),
          ('drivers','السائقون'),
          ('reports','التقارير'),
          ('zatca','الفاتورة الإلكترونية'),
          ('permissions','الصلاحيات'),
          ('shifts','الشيفتات'),
          ('suppliers','الموردون'),
          ('employees','الموظفون'),
          ('purchase_invoices','فواتير الشراء'),
          ('kitchen','طابعات المطبخ');
      `);
      // Seed sub-permissions for modules (idempotent)
      // 1) Ensure all sub-permission keys exist
      await conn.query(`
        INSERT IGNORE INTO permissions (perm_key, name) VALUES
          -- sales
          ('sales.print','طباعة الفاتورة'),
          ('sales.clear','تفريغ'),
          ('sales.process_invoice','معالجة الفاتورة'),
          ('sales.discount','الخصم'),
          ('sales.extra','الإضافى'),
          ('sales.coupon','الكوبون'),
          ('sales.select_customer','اختيار العميل'),
          ('sales.select_driver','اختيار السائق'),
          ('sales.remove_item','حذف'),
          ('sales.edit_qty','تعديل الكمية'),
          -- customers
          ('customers.add','➕ إضافة عميل'),
          ('customers.edit','تعديل'),
          ('customers.toggle','تفعيل/إيقاف'),
          ('customers.delete','حذف'),
          -- invoices
          ('invoices.view','عرض الفاتورة'),
          -- users
          ('users.add','إضافة مستخدم'),
          ('users.edit','تعديل'),
          ('users.toggle','تفعيل/إيقاف'),
          ('users.delete','حذف'),
          -- products
          ('products.add','➕ إضافة منتج'),
          ('products.edit','تعديل'),
          ('products.toggle','تفعيل/إيقاف'),
          ('products.delete','حذف'),
          ('products.export_pdf','🧾 تصدير PDF'),
          ('products.export_csv','📄 تصدير CSV'),
          ('products.reorder','💾 حفظ ترتيب السطور'),
          -- rooms
          ('rooms.add','إضافة غرفة'),
          ('rooms.edit','تعديل'),
          ('rooms.delete','حذف'),
          ('rooms.open','فتح الغرفة'),
          -- types
          ('types.add','إضافة نوع رئيسي'),
          ('types.edit','✏️ تعديل'),
          ('types.toggle','⏸️ إيقاف/▶️ تفعيل'),
          ('types.delete','🗑️ حذف'),
          -- settings
          ('settings.update','حفظ الإعدادات'),
          ('settings.reload','إعادة تحميل'),
          ('settings.reset_sales','حذف كل الفواتير'),
          ('settings.reset_products','حذف كل المنتجات'),
          ('settings.reset_customers','حذف كل العملاء'),
          -- operations
          ('operations.add','إضافة عملية'),
          ('operations.edit','تعديل'),
          ('operations.toggle','تفعيل/إيقاف'),
          ('operations.delete','حذف'),
          ('operations.reorder','تغيير الترتيب'),
          -- purchases
          ('purchases.add','إضافة'),
          ('purchases.edit','تعديل'),
          ('purchases.delete','حذف'),
          ('purchases.export_csv','تصدير CSV'),
          ('purchases.export_pdf','تصدير PDF'),
          -- inventory
          ('inventory.add','عنصر مخزون جديد'),
          ('inventory.edit','تعديل'),
          ('inventory.toggle','تفعيل/إيقاف'),
          ('inventory.delete','حذف'),
          ('inventory.bom_edit','تعديل مكونات المنتج'),
          -- customer_pricing
          ('customer_pricing.add','إضافة'),
          ('customer_pricing.edit','تعديل'),
          ('customer_pricing.delete','حذف'),
          -- offers
          ('offers.add_offer','إضافة عرض'),
          ('offers.add_global_offer','إضافة عرض عام'),
          ('offers.edit_offer','تعديل عرض'),
          ('offers.toggle_offer','تفعيل/إيقاف عرض'),
          ('offers.delete_offer','حذف عرض'),
          ('offers.add_qty_offer','إضافة عرض كمي'),
          ('offers.edit_qty_offer','تعديل عرض كمي'),
          ('offers.toggle_qty_offer','تفعيل/إيقاف عرض كمي'),
          ('offers.delete_qty_offer','حذف عرض كمي'),
          ('offers.add_coupon','إضافة كوبون'),
          ('offers.edit_coupon','تعديل كوبون'),
          ('offers.toggle_coupon','تفعيل/إيقاف كوبون'),
          ('offers.delete_coupon','حذف كوبون'),
          -- drivers
          ('drivers.add','إضافة'),
          ('drivers.edit','حفظ'),
          ('drivers.toggle','تنشيط/إيقاف'),
          ('drivers.delete','حذف'),
          -- employees
          ('employees.add','إضافة موظف'),
          ('employees.edit','تعديل موظف'),
          ('employees.delete','حذف موظف'),
          -- reports
          ('reports.view_daily','تقرير يومي'),
          ('reports.view_period','تقرير فترة'),
          ('reports.view_all_invoices','كل الفواتير'),
          ('reports.view_purchases','تقرير المصروفات'),
          ('reports.view_customer_invoices','فواتير عميل'),
          ('reports.view_credit_invoices','الفواتير الدائنة'),
          ('reports.view_unpaid_invoices','فواتير غير مدفوعة'),
          ('reports.view_types','تقرير الأنواع'),
          ('reports.view_purchase_invoices','تقرير فواتير الشراء'),
          ('reports.view_customer_statement','كشف حساب عميل'),
          ('reports.view_supplier_statement','كشف حساب مورد'),
          ('reports.view_expiry','تقرير المنتجات المنتهية الصلاحية'),
          -- payments
          ('payments.settle_full','سداد كامل'),
          ('payments.view_invoice','عرض الفاتورة'),
          -- credit_notes
          ('credit_notes.view','عرض الإشعار'),
          ('credit_notes.view_base','عرض الفاتورة'),
          -- quotations
          ('quotations.save','حفظ عرض سعر'),
          ('quotations.view','عرض'),
          ('quotations.print','طباعة'),
          ('quotations.delete','حذف'),
          -- shifts
          ('shifts.open','فتح شيفت'),
          ('shifts.close','إغلاق شيفت'),
          ('shifts.view','عرض الشيفتات'),
          ('shifts.print','طباعة تقرير'),
          -- permissions screen
          ('permissions.manage','إدارة الصلاحيات')
      `);
      // 2) If parent_key column exists, update parent_key mapping for each module
      try{
        const updates = [
          'sales','customers','invoices','users','products','rooms','types','settings','operations',
          'purchases','inventory','customer_pricing','offers','drivers','employees','reports','payments','credit_notes','quotations','permissions','zatca','shifts'
        ];
        for(const k of updates){
          await conn.query(`UPDATE permissions SET parent_key=? WHERE perm_key LIKE CONCAT(?, '.%') AND (parent_key IS NULL OR parent_key<>?)`, [k, k, k]);
        }
      }catch(_){ /* ignore if parent_key not available */ }
      // 3) Normalize names to match exact UI labels
      try{
        const namePairs = [
          ['sales.print','طباعة الفاتورة'],['sales.clear','تفريغ'],['sales.process_invoice','معالجة الفاتورة'],['sales.discount','الخصم'],['sales.extra','الإضافى'],['sales.coupon','الكوبون'],['sales.select_customer','اختيار العميل'],['sales.select_driver','اختيار السائق'],['sales.remove_item','حذف'],['sales.edit_qty','تعديل الكمية'],
          ['customers.add','➕ إضافة عميل'],['customers.edit','تعديل'],['customers.toggle','تفعيل/إيقاف'],['customers.delete','حذف'],
          ['invoices.view','عرض الفاتورة'],
          ['users.add','إضافة مستخدم'],['users.edit','تعديل'],['users.toggle','تفعيل/إيقاف'],['users.delete','حذف'],
          ['products.add','➕ إضافة منتج'],['products.edit','تعديل'],['products.toggle','تفعيل/إيقاف'],['products.delete','حذف'],['products.export_pdf','🧾 تصدير PDF'],['products.export_csv','📄 تصدير CSV'],['products.reorder','💾 حفظ ترتيب السطور'],
          ['rooms.add','إضافة غرفة'],['rooms.edit','تعديل'],['rooms.delete','حذف'],['rooms.open','فتح الغرفة'],
          ['types.add','إضافة نوع رئيسي'],['types.edit','✏️ تعديل'],['types.toggle','⏸️ إيقاف/▶️ تفعيل'],['types.delete','🗑️ حذف'],
          ['settings.update','حفظ الإعدادات'],['settings.reload','إعادة تحميل'],['settings.reset_sales','حذف كل الفواتير'],['settings.reset_products','حذف كل المنتجات'],['settings.reset_customers','حذف كل العملاء'],
          ['operations.add','إضافة عملية'],['operations.edit','تعديل'],['operations.toggle','تفعيل/إيقاف'],['operations.delete','حذف'],['operations.reorder','تغيير الترتيب'],
          ['purchases.add','إضافة'],['purchases.edit','تعديل'],['purchases.delete','حذف'],['purchases.export_csv','تصدير CSV'],['purchases.export_pdf','تصدير PDF'],
          ['inventory.add','عنصر مخزون جديد'],['inventory.edit','تعديل'],['inventory.toggle','تفعيل/إيقاف'],['inventory.delete','حذف'],['inventory.bom_edit','تعديل مكونات المنتج'],
          ['customer_pricing.add','إضافة'],['customer_pricing.edit','تعديل'],['customer_pricing.delete','حذف'],
          ['offers.add_offer','إضافة عرض'],['offers.add_global_offer','إضافة عرض عام'],['offers.edit_offer','تعديل عرض'],['offers.toggle_offer','تفعيل/إيقاف عرض'],['offers.delete_offer','حذف عرض'],['offers.add_qty_offer','إضافة عرض كمي'],['offers.edit_qty_offer','تعديل عرض كمي'],['offers.toggle_qty_offer','تفعيل/إيقاف عرض كمي'],['offers.delete_qty_offer','حذف عرض كمي'],['offers.add_coupon','إضافة كوبون'],['offers.edit_coupon','تعديل كوبون'],['offers.toggle_coupon','تفعيل/إيقاف كوبون'],['offers.delete_coupon','حذف كوبون'],
          ['drivers.add','إضافة'],['drivers.edit','حفظ'],['drivers.toggle','تنشيط/إيقاف'],['drivers.delete','حذف'],
          ['employees.add','إضافة موظف'],['employees.edit','تعديل موظف'],['employees.delete','حذف موظف'],
          ['reports.view_daily','تقرير يومي'],['reports.view_period','تقرير فترة'],['reports.view_all_invoices','كل الفواتير'],['reports.view_purchases','تقرير المصروفات'],['reports.view_customer_invoices','فواتير عميل'],['reports.view_credit_invoices','الفواتير الدائنة'],['reports.view_unpaid_invoices','فواتير غير مدفوعة'],['reports.view_purchase_invoices','تقرير فواتير الشراء'],['reports.view_customer_statement','كشف حساب عميل'],['reports.view_supplier_statement','كشف حساب مورد'],
          ['payments.settle_full','سداد كامل'],['payments.view_invoice','عرض الفاتورة'],
          ['credit_notes.view','عرض الإشعار'],['credit_notes.view_base','عرض الفاتورة'],
          ['quotations.save','حفظ عرض سعر'],['quotations.view','عرض'],['quotations.print','طباعة'],['quotations.delete','حذف'],
          ['shifts.open','فتح شيفت'],['shifts.close','إغلاق شيفت'],['shifts.view','عرض الشيفتات'],['shifts.print','طباعة تقرير'],
          ['permissions.manage','إدارة الصلاحيات']
        ];
        for(const [k,nm] of namePairs){ await conn.query('UPDATE permissions SET name=? WHERE perm_key=?', [nm, k]); }
      }catch(_){ /* ignore */ }
      // Auto-grant the new report permission to admin users who have explicit saved permissions
      try{
        await conn.query(`
          INSERT IGNORE INTO user_permissions (user_id, perm_key)
          SELECT u.id, 'reports.view_types'
          FROM users u
          WHERE u.role='admin'
            AND EXISTS(SELECT 1 FROM user_permissions up WHERE up.user_id=u.id)
            AND NOT EXISTS(SELECT 1 FROM user_permissions up2 WHERE up2.user_id=u.id AND up2.perm_key='reports.view_types')
        `);
      }catch(_){ /* ignore */ }
      // Auto-grant the new qty offer permissions to admin users who have explicit saved permissions
      try{
        const qtyPerms = ['offers.add_qty_offer', 'offers.edit_qty_offer', 'offers.toggle_qty_offer', 'offers.delete_qty_offer'];
        for(const perm of qtyPerms){
          await conn.query(`
            INSERT IGNORE INTO user_permissions (user_id, perm_key)
            SELECT u.id, ?
            FROM users u
            WHERE u.role='admin'
              AND EXISTS(SELECT 1 FROM user_permissions up WHERE up.user_id=u.id)
              AND NOT EXISTS(SELECT 1 FROM user_permissions up2 WHERE up2.user_id=u.id AND up2.perm_key=?)
          `, [perm, perm]);
        }
      }catch(_){ /* ignore */ }
    } finally {
      conn.release();
    }
  }
  return pool;
}

// Update DB config at runtime and reset pool
async function updateConfig(partial){
  const next = { ...currentConfig, ...partial };
  const changed = ['host','port','user','password','name'].some(k => String(currentConfig[k]) !== String(next[k]));
  currentConfig = next;
  saveConfig();
  if(changed && pool){ try{ await pool.end(); }catch(_){ } pool = null; }
  return { ...currentConfig };
}

// Get current DB config
function getConfig(){ return { ...currentConfig }; }

// Test connection with given or current config (does not mutate state)
async function testConnection(tempCfg){
  const cfg = { ...currentConfig, ...(tempCfg||{}) };
  const conn = await mysql.createConnection({
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: cfg.password,
    multipleStatements: false,
  });
  try{
    await conn.query('SELECT 1');
  } finally {
    try{ await conn.end(); }catch(_){ }
  }
}

module.exports = { getPool, DB_NAME, initDbFromSaved, updateConfig, getConfig, testConnection };