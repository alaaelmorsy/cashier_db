'use strict';

// طبقة بيانات الربط المباشر مع ZATCA — منقولة من برنامج المغاسل
// (database/db.js:migrateZatcaSettings وما بعدها) مع تكييف مستندات الكاشير:
// المستند هو صف في `sales` (doc_type = invoice | credit_note).

const crypto = require('crypto');
const { dbAdapter } = require('../../db/db-adapter');
const vault = require('./vault');

const DEFAULT_PIH = 'NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjcyOWQ3M2EyN2ZiNTdlOQ==';

let migrated = false;

async function withConn(work) {
  const conn = await dbAdapter.getConnection();
  try { return await work(conn); } finally { conn.release(); }
}

async function migrate() {
  if (migrated) return;
  await withConn(async (conn) => {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS zatca_settings (
        id INT NOT NULL PRIMARY KEY,
        integration_mode ENUM('unlinked','legacy','direct') NOT NULL DEFAULT 'unlinked',
        company_name VARCHAR(200) DEFAULT NULL,
        vat_number VARCHAR(50) DEFAULT NULL,
        commercial_registration VARCHAR(50) DEFAULT NULL,
        business_category VARCHAR(120) NOT NULL DEFAULT 'Supply activities',
        branch_name VARCHAR(150) DEFAULT NULL,
        email VARCHAR(150) DEFAULT NULL,
        street VARCHAR(200) DEFAULT NULL,
        building VARCHAR(50) DEFAULT NULL,
        city VARCHAR(100) NOT NULL DEFAULT 'الرياض',
        postal_code VARCHAR(20) DEFAULT NULL,
        district VARCHAR(120) DEFAULT NULL,
        send_start_date DATE DEFAULT NULL,
        environment ENUM('sandbox','simulation','production') NOT NULL DEFAULT 'sandbox',
        onboarding_status VARCHAR(30) NOT NULL DEFAULT 'not_started',
        egs_serial_number VARCHAR(200) DEFAULT NULL,
        private_key_enc LONGTEXT DEFAULT NULL,
        public_key_pem LONGTEXT DEFAULT NULL,
        csr_pem LONGTEXT DEFAULT NULL,
        compliance_token_enc LONGTEXT DEFAULT NULL,
        compliance_secret_enc LONGTEXT DEFAULT NULL,
        compliance_request_id VARCHAR(200) DEFAULT NULL,
        production_token_enc LONGTEXT DEFAULT NULL,
        production_secret_enc LONGTEXT DEFAULT NULL,
        production_certificate_pem LONGTEXT DEFAULT NULL,
        certificate_expires_at DATETIME DEFAULT NULL,
        current_icv BIGINT UNSIGNED NOT NULL DEFAULT 0,
        current_pih VARCHAR(255) DEFAULT NULL,
        last_tested_at DATETIME DEFAULT NULL,
        vault_key VARCHAR(100) DEFAULT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS zatca_submissions (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        document_type ENUM('sale','credit_note') NOT NULL,
        document_id INT NOT NULL,
        invoice_kind ENUM('simplified','standard') NOT NULL,
        submission_type ENUM('REPORTING','CLEARANCE') NOT NULL,
        uuid VARCHAR(100) NOT NULL,
        icv BIGINT UNSIGNED NOT NULL,
        previous_invoice_hash VARCHAR(255) NOT NULL,
        invoice_hash VARCHAR(255) DEFAULT NULL,
        qr_code LONGTEXT DEFAULT NULL,
        signed_xml LONGTEXT DEFAULT NULL,
        cleared_xml LONGTEXT DEFAULT NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'pending',
        attempts INT UNSIGNED NOT NULL DEFAULT 0,
        next_attempt_at DATETIME DEFAULT NULL,
        http_status INT DEFAULT NULL,
        warnings_json JSON DEFAULT NULL,
        errors_json JSON DEFAULT NULL,
        response_json LONGTEXT DEFAULT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_zatca_document (document_type, document_id),
        UNIQUE KEY uq_zatca_uuid (uuid),
        KEY idx_zatca_queue (status, next_attempt_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // أعمدة عنوان ZATCA لعملاء الشركات (فاتورة standard تتطلب عنوانًا مكتملًا)
    const customerCols = [
      ['zatca_street', 'VARCHAR(200) DEFAULT NULL'],
      ['zatca_building', 'VARCHAR(20) DEFAULT NULL'],
      ['zatca_district', 'VARCHAR(120) DEFAULT NULL'],
      ['zatca_city', 'VARCHAR(100) DEFAULT NULL'],
    ];
    for (const [col, def] of customerCols) {
      await conn.query(`ALTER TABLE customers ADD COLUMN ${col} ${def}`).catch(() => {});
    }

    // صف الإعدادات الوحيد — كشف الوضع يحدث مرة واحدة هنا (FR-002):
    // تركيبة كانت تعمل بالوضع القديم (zatca_enabled=1) تُثبَّت legacy وتبقى كما هي.
    const [[cnt]] = await conn.query('SELECT COUNT(*) AS c FROM zatca_settings WHERE id = 1');
    if (Number(cnt.c) === 0) {
      let legacyEnabled = 0;
      try {
        const [[s]] = await conn.query('SELECT zatca_enabled FROM app_settings WHERE id = 1');
        legacyEnabled = s && s.zatca_enabled ? 1 : 0;
      } catch (_) {}
      await conn.query(
        'INSERT INTO zatca_settings (id, integration_mode) VALUES (1, ?)',
        [legacyEnabled ? 'legacy' : 'unlinked']
      );
    }

    // مفتاح تشفير أسرار ZATCA يُولَّد مرة واحدة ويُخزَّن في قاعدة البيانات نفسها،
    // حتى تكون نسخة قاعدة البيانات وحدها كافية للانتقال إلى جهاز جديد.
    const [[keyRow]] = await conn.query('SELECT vault_key FROM zatca_settings WHERE id = 1');
    let vaultKey = keyRow ? keyRow.vault_key : null;
    if (keyRow && !vaultKey) {
      vaultKey = crypto.randomBytes(32).toString('base64');
      await conn.query('UPDATE zatca_settings SET vault_key = ? WHERE id = 1', [vaultKey]);
    }
    if (vaultKey) vault.setStoredKey(vaultKey);
  });
  migrated = true;
}

async function getZatcaDirectSettings() {
  await migrate();
  return withConn(async (conn) => {
    const [[row]] = await conn.query('SELECT * FROM zatca_settings WHERE id = 1');
    return row || null;
  });
}

// نسخة آمنة للواجهة — بلا أسرار ولا مفاتيح.
async function getZatcaSettings() {
  await migrate();
  return withConn(async (conn) => {
    const [[row]] = await conn.query(
      `SELECT id, integration_mode, company_name, vat_number, commercial_registration,
              business_category, branch_name, email, street, building, city, postal_code,
              district, send_start_date, environment, onboarding_status, egs_serial_number,
              certificate_expires_at, current_icv, last_tested_at, updated_at
       FROM zatca_settings WHERE id = 1`
    );
    if (!row) return null;
    return {
      id: row.id,
      integrationMode: row.integration_mode,
      companyName: row.company_name || '',
      vatNumber: row.vat_number || '',
      commercialRegistration: row.commercial_registration || '',
      businessCategory: row.business_category || 'Supply activities',
      branchName: row.branch_name || '',
      email: row.email || '',
      address: {
        street: row.street || '',
        building: row.building || '',
        city: row.city || 'الرياض',
        postalCode: row.postal_code || '',
        district: row.district || '',
      },
      sendStartDate: row.send_start_date ? toSqlDate(row.send_start_date) : null,
      environment: row.environment || 'sandbox',
      onboardingStatus: row.onboarding_status || 'not_started',
      egsSerialNumber: row.egs_serial_number || '',
      certificateExpiresAt: row.certificate_expires_at || null,
      currentIcv: Number(row.current_icv || 0),
      lastTestedAt: row.last_tested_at || null,
      updatedAt: row.updated_at,
    };
  });
}

function toSqlDate(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

async function saveZatcaSettings(data = {}) {
  await migrate();
  const s = (v, max) => (v == null ? '' : String(v).trim().slice(0, max));

  const companyName = s(data.companyName, 200);
  const vatNumber = s(data.vatNumber, 50);
  if (!companyName) throw new Error('اسم المنشأة مطلوب');
  if (!vatNumber) throw new Error('رقم التسجيل الضريبي مطلوب');

  // KSA VAT: 15 digits (starts with 3 and ends with 3)
  const vatDigits = vatNumber.replace(/\D/g, '');
  if (vatDigits.length !== 15) throw new Error('رقم التسجيل الضريبي يجب أن يكون 15 رقم');
  if (!(vatDigits.startsWith('3') && vatDigits.endsWith('3'))) throw new Error('رقم التسجيل الضريبي غير صالح');

  const commercialRegistration = s(data.commercialRegistration, 50) || null;
  const businessCategory = s(data.businessCategory, 120) || 'Supply activities';
  const branchName = s(data.branchName, 150) || null;
  const emailRaw = s(data.email, 150);
  const email = emailRaw || null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('البريد الإلكتروني غير صالح');

  const addr = data.address && typeof data.address === 'object' ? data.address : {};
  const street = s(addr.street, 200) || null;
  const building = s(addr.building, 50) || null;
  const city = s(addr.city, 100) || 'الرياض';
  const postalCode = s(addr.postalCode, 20) || null;
  const district = s(addr.district, 120) || null;
  const sendStartDate = data.sendStartDate ? toSqlDate(data.sendStartDate) : null;

  await withConn((conn) => conn.query(
    `UPDATE zatca_settings SET
       company_name = ?, vat_number = ?, commercial_registration = ?, business_category = ?,
       branch_name = ?, email = ?, street = ?, building = ?, city = ?, postal_code = ?, district = ?,
       send_start_date = ?
     WHERE id = 1`,
    [companyName, vatNumber, commercialRegistration, businessCategory, branchName, email,
     street, building, city, postalCode, district, sendStartDate]
  ));
  return { success: true };
}

async function saveZatcaOnboardingState(fields) {
  await migrate();
  const allowed = new Set([
    'integration_mode', 'environment', 'onboarding_status', 'egs_serial_number', 'private_key_enc',
    'public_key_pem', 'csr_pem', 'compliance_token_enc', 'compliance_secret_enc',
    'compliance_request_id', 'production_token_enc', 'production_secret_enc',
    'production_certificate_pem', 'certificate_expires_at', 'last_tested_at',
    'current_icv', 'current_pih',
  ]);
  const entries = Object.entries(fields || {}).filter(([key]) => allowed.has(key));
  if (!entries.length) return;
  const assignments = entries.map(([key]) => `${key} = ?`).join(', ');
  await withConn((conn) => conn.query(
    `UPDATE zatca_settings SET ${assignments} WHERE id = 1`,
    entries.map(([, value]) => value)
  ));
}

// حجز سجل إرسال بعدّاد ICV وتجزئة PIH الحاليين — داخل معاملة بقفل صف الإعدادات
// حتى لا تتفرع السلسلة. UUID ثابت عبر كل المحاولات (منع الازدواج).
async function reserveZatcaSubmission(documentType, documentId, invoiceKind, uuid) {
  await migrate();
  const conn = await dbAdapter.getConnection();
  try {
    await conn.beginTransaction();
    const [[settings]] = await conn.query('SELECT current_icv, current_pih FROM zatca_settings WHERE id = 1 FOR UPDATE');
    const icv = Number(settings.current_icv || 0) + 1;
    const pih = settings.current_pih || DEFAULT_PIH;
    const [[existing]] = await conn.query(
      'SELECT * FROM zatca_submissions WHERE document_type = ? AND document_id = ? FOR UPDATE',
      [documentType, documentId]
    );
    // قفل السلسلة: ما دام هناك مستند آخر أُرسل للهيئة ولم يُؤكَّد رده، لا يُحجز
    // أو يُعاد إرسال أي مستند غيره — وإلا تفرّعت سلسلة ICV/PIH لدى الهيئة.
    const [[inflight]] = await conn.query(
      `SELECT document_type, document_id FROM zatca_submissions
       WHERE status = 'sent_unconfirmed' AND NOT (document_type = ? AND document_id = ?) LIMIT 1`,
      [documentType, documentId]
    );
    if (inflight) {
      const busy = new Error('يوجد مستند سابق بانتظار تأكيد استلام الهيئة — سيُعاد إرسال هذا المستند تلقائيًا بعد حسمه');
      busy.code = 'ZATCA_CHAIN_BUSY';
      throw busy;
    }
    if (existing) {
      const accepted = ['reported', 'cleared', 'accepted_with_warnings', 'skipped'].includes(existing.status);
      // sent_unconfirmed: الطلب ربما وصل الهيئة فعلاً — يُعاد إرسال نفس الـ XML
      // الموقّع دون تغيير ICV/PIH وإلا تكرّرت الفاتورة بعدّادين مختلفين.
      const frozen = existing.status === 'sent_unconfirmed' && existing.signed_xml;
      if (!accepted && !frozen && (Number(existing.icv) !== icv || existing.previous_invoice_hash !== pih)) {
        await conn.query(
          'UPDATE zatca_submissions SET icv = ?, previous_invoice_hash = ? WHERE id = ?',
          [icv, pih, existing.id]
        );
        existing.icv = icv;
        existing.previous_invoice_hash = pih;
      }
      await conn.commit();
      return existing;
    }
    const submissionType = invoiceKind === 'standard' ? 'CLEARANCE' : 'REPORTING';
    const [inserted] = await conn.query(
      `INSERT INTO zatca_submissions
       (document_type, document_id, invoice_kind, submission_type, uuid, icv, previous_invoice_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [documentType, documentId, invoiceKind, submissionType, uuid, icv, pih]
    );
    const [[created]] = await conn.query('SELECT * FROM zatca_submissions WHERE id = ?', [inserted.insertId]);
    await conn.commit();
    return created;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

async function updateZatcaSubmission(id, fields) {
  const allowed = new Set([
    'invoice_hash', 'qr_code', 'signed_xml', 'cleared_xml', 'status', 'attempts',
    'next_attempt_at', 'http_status', 'warnings_json', 'errors_json', 'response_json',
  ]);
  const entries = Object.entries(fields || {}).filter(([key]) => allowed.has(key));
  if (!entries.length) return;
  const assignments = entries.map(([key]) => `${key} = ?`).join(', ');
  await withConn((conn) => conn.query(
    `UPDATE zatca_submissions SET ${assignments} WHERE id = ?`,
    [...entries.map(([, value]) => value), id]
  ));
}

// قبول الهيئة: تحديث السجل وترقية رأس السلسلة (ICV/PIH) في معاملة واحدة.
async function acceptZatcaSubmission(id, accepted) {
  const conn = await dbAdapter.getConnection();
  try {
    await conn.beginTransaction();
    const [[submission]] = await conn.query('SELECT * FROM zatca_submissions WHERE id = ? FOR UPDATE', [id]);
    if (!submission) throw new Error('سجل إرسال ZATCA غير موجود');
    await conn.query(
      `UPDATE zatca_submissions SET invoice_hash = ?, qr_code = ?, signed_xml = ?, cleared_xml = ?,
       status = ?, attempts = ?, next_attempt_at = NULL, http_status = ?, warnings_json = ?, response_json = ?
       WHERE id = ?`,
      [accepted.invoiceHash, accepted.qrCode, accepted.signedXml, accepted.clearedXml,
       accepted.status, accepted.attempts, accepted.httpStatus, accepted.warningsJson,
       accepted.responseJson, id]
    );
    await conn.query(
      'UPDATE zatca_settings SET current_icv = ?, current_pih = ? WHERE id = 1',
      [submission.icv, accepted.invoiceHash]
    );
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

async function getPendingZatcaSubmissions(limit = 100) {
  await migrate();
  const safeLimit = Math.min(500, Math.max(1, Number(limit) || 100));
  return withConn(async (conn) => {
    const [rows] = await conn.query(
      `SELECT zs.* FROM zatca_submissions zs
       INNER JOIN sales s ON s.id = zs.document_id
       INNER JOIN zatca_settings cfg ON cfg.id = 1
       WHERE zs.status IN ('pending','retry_wait','sent_unconfirmed','manual_review','rejected')
         AND (cfg.send_start_date IS NULL OR DATE(s.created_at) >= cfg.send_start_date)
       ORDER BY zs.icv ASC LIMIT ?`,
      [safeLimit]
    );
    return rows;
  });
}

async function getUnconfirmedZatcaSubmissions() {
  await migrate();
  return withConn(async (conn) => {
    const [rows] = await conn.query(
      `SELECT * FROM zatca_submissions
       WHERE status = 'sent_unconfirmed'
       ORDER BY icv ASC`
    );
    return rows;
  });
}

async function getZatcaSubmission(documentType, documentId) {
  await migrate();
  return withConn(async (conn) => {
    const [[row]] = await conn.query(
      'SELECT * FROM zatca_submissions WHERE document_type = ? AND document_id = ?',
      [documentType, documentId]
    );
    return row || null;
  });
}

// المستندات غير المرسلة بعد (فواتير وإشعارات دائنة معًا — كلاهما صف في sales).
async function getUnsentZatcaSales(limit = 500) {
  await migrate();
  return withConn(async (conn) => {
    const [[cfg]] = await conn.query('SELECT send_start_date FROM zatca_settings WHERE id = 1');
    const startDate = cfg && cfg.send_start_date ? toSqlDate(cfg.send_start_date) : null;
    const params = [];
    const dateClause = startDate ? 'AND DATE(s.created_at) >= ?' : '';
    if (startDate) params.push(startDate);
    params.push(Math.min(500, Math.max(1, Number(limit) || 500)));
    const [rows] = await conn.query(
      `SELECT s.id, s.doc_type FROM sales s
       WHERE (s.zatca_status IS NULL OR s.zatca_status NOT IN ('submitted', 'accepted'))
         AND s.invoice_no IS NOT NULL
         AND EXISTS (SELECT 1 FROM sales_items si WHERE si.sale_id = s.id)
         ${dateClause}
       ORDER BY s.id ASC
       LIMIT ?`,
      params
    );
    return rows.map((r) => ({ id: r.id, documentType: r.doc_type === 'credit_note' ? 'credit_note' : 'sale' }));
  });
}

// فاتورة/إشعار مع بنوده وبيانات عنوان ZATCA لعميله (للفواتير الضريبية).
async function getSaleForZatca(saleId) {
  await migrate();
  return withConn(async (conn) => {
    const [[sale]] = await conn.query('SELECT * FROM sales WHERE id = ?', [saleId]);
    if (!sale) return null;
    const [items] = await conn.query('SELECT * FROM sales_items WHERE sale_id = ? ORDER BY id ASC', [saleId]);
    let customer = null;
    if (sale.customer_id) {
      const [[row]] = await conn.query(
        `SELECT id, name, vat_number, postal_code, zatca_street, zatca_building, zatca_district, zatca_city
         FROM customers WHERE id = ?`,
        [sale.customer_id]
      );
      customer = row || null;
    }
    return { sale, items, customer };
  });
}

// ملخص الحالة على صف الفاتورة نفسه — توافق شاشات الفواتير والتقارير الحالية.
async function updateSaleZatcaStatus(saleId, data = {}) {
  const mapping = [
    ['uuid', 'zatca_uuid'], ['hash', 'zatca_hash'], ['qr', 'zatca_qr'],
    ['status', 'zatca_status'], ['rejectionReason', 'zatca_rejection_reason'], ['response', 'zatca_response'],
  ];
  const sets = [];
  const values = [];
  for (const [key, column] of mapping) {
    if (!(key in data)) continue;
    sets.push(`${column} = ?`);
    values.push(data[key] == null ? null : data[key]);
  }
  if ('status' in data && (data.status === 'submitted' || data.status === 'accepted')) {
    sets.push('zatca_submitted = NOW()');
  }
  if (!sets.length) return;
  await withConn((conn) => conn.query(`UPDATE sales SET ${sets.join(', ')} WHERE id = ?`, [...values, saleId]));
}

async function getZatcaDocumentCounts() {
  await migrate();
  return withConn(async (conn) => {
    const [[row]] = await conn.query(
      `SELECT
         SUM(CASE WHEN status IN ('reported','cleared','accepted_with_warnings') THEN 1 ELSE 0 END) AS sent,
         SUM(CASE WHEN status IN ('pending','retry_wait','sent_unconfirmed') THEN 1 ELSE 0 END) AS pending,
         SUM(CASE WHEN status IN ('rejected','manual_review') THEN 1 ELSE 0 END) AS rejected
       FROM zatca_submissions`
    );
    return {
      sent: Number(row.sent || 0),
      pending: Number(row.pending || 0),
      rejected: Number(row.rejected || 0),
    };
  });
}

module.exports = {
  acceptZatcaSubmission,
  getPendingZatcaSubmissions,
  getUnconfirmedZatcaSubmissions,
  getSaleForZatca,
  getUnsentZatcaSales,
  getZatcaDirectSettings,
  getZatcaDocumentCounts,
  getZatcaSettings,
  getZatcaSubmission,
  migrate,
  reserveZatcaSubmission,
  saveZatcaOnboardingState,
  saveZatcaSettings,
  updateSaleZatcaStatus,
  updateZatcaSubmission,
};
