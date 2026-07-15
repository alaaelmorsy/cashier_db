'use strict';

const crypto = require('crypto');

// مفتاح مخزَّن في قاعدة البيانات (zatca_settings.vault_key) — يُضبط عند تهيئة
// قاعدة البيانات، فتكفي نسخة قاعدة البيانات وحدها للانتقال إلى جهاز جديد.
let storedKeySecret = null;

function setStoredKey(secret) {
  storedKeySecret = secret ? String(secret) : null;
}

function candidateKeys() {
  // المفتاح المخزَّن أولًا (يُستخدم للتشفير الجديد)، ومفاتيح .env تبقى
  // احتياطيًا لفك أسرار قديمة شُفِّرت بها قبل هذه الآلية.
  const secrets = [storedKeySecret, process.env.ZATCA_SECRET_KEY]
    .filter((secret) => secret);
  if (!secrets.length) throw new Error('مفتاح تشفير ZATCA غير متاح — قاعدة البيانات لم تُهيأ ولا يوجد ZATCA_SECRET_KEY');
  return secrets.map((secret) => crypto.createHash('sha256').update(String(secret)).digest());
}

function encryptSecret(plainText) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', candidateKeys()[0], iv);
  const encrypted = Buffer.concat([cipher.update(String(plainText), 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString('base64')).join(':');
}

// تُجرَّب كل المفاتيح المرشّحة (GCM يكشف المفتاح الخطأ) حتى تبقى الأسرار
// القديمة قابلة للفك بعد تغيّر مصدر المفتاح.
function decryptSecret(cipherText) {
  const parts = String(cipherText || '').split(':').map((part) => Buffer.from(part, 'base64'));
  if (parts.length !== 3) throw new Error('بيانات اعتماد ZATCA المشفرة غير صالحة');
  let lastError;
  for (const key of candidateKeys()) {
    try {
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, parts[0]);
      decipher.setAuthTag(parts[1]);
      return Buffer.concat([decipher.update(parts[2]), decipher.final()]).toString('utf8');
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error('تعذر فك تشفير بيانات اعتماد ZATCA — أعد خطوات الربط لإصدار شهادة جديدة. ' + (lastError ? lastError.message : ''));
}

module.exports = { decryptSecret, encryptSecret, setStoredKey };
