'use strict';

// نقطة القرار الوحيدة بين مسارَي الربط الإلكتروني:
//  - legacy : الوسيط المحلي القديم (local-zatca.js → خادم Java على 8080) — لا يُمَس.
//  - direct : الربط المباشر بدون وسيط (منقول من برنامج المغاسل).
//  - unlinked: لا إرسال.
//
// قاعدة الوضع (FR-002/FR-003/FR-004):
//  - integration_mode='direct' لا يُكتب إلا عند إكمال المستخدم شهادة الإنتاج صراحةً.
//  - ما دام الوضع ليس direct، فأي جهاز عليه app_settings.zatca_enabled=1 يعمل
//    بالوضع القديم — حتى لو فُعِّل بعد التحديث (getMode ديناميكية وقت الإرسال).
//  - لا يوجد أي تحويل تلقائي إلى direct إطلاقًا.

const { dbAdapter } = require('../../db/db-adapter');
const zatcaDb = require('./db');

// تُستدعى مرة عند الإقلاع: تهاجر الجداول وتثبّت الوضع الأولي (legacy للتركيبات القديمة).
async function detectModeOnce() {
  await zatcaDb.migrate();
}

async function legacyEnabled() {
  const conn = await dbAdapter.getConnection();
  try {
    const [[s]] = await conn.query('SELECT zatca_enabled FROM app_settings WHERE id = 1');
    return Boolean(s && s.zatca_enabled);
  } catch (_) {
    return false;
  } finally {
    conn.release();
  }
}

async function getMode() {
  const settings = await zatcaDb.getZatcaDirectSettings();
  if (settings && settings.integration_mode === 'direct') return 'direct';
  if (await legacyEnabled()) return 'legacy';
  return 'unlinked';
}

async function saleUsesInternationalZeroRate(saleId) {
  const conn = await dbAdapter.getConnection();
  try {
    const [[sale]] = await conn.query('SELECT tax_treatment FROM sales WHERE id=? LIMIT 1', [Number(saleId)]);
    return sale?.tax_treatment === 'international_transport_zero_rate';
  } finally {
    conn.release();
  }
}

function legacyZeroRateError() {
  const error = new Error('Legacy ZATCA route does not support international transport zero-rate invoices');
  error.code = 'LEGACY_ZATCA_ZERO_RATE_UNSUPPORTED';
  return error;
}

// إرسال مستند بعد حفظه (يُستدعى من sales.js بشكل غير محجوب).
async function submitSale(saleId) {
  const mode = await getMode();
  if (mode === 'legacy') {
    if (await saleUsesInternationalZeroRate(saleId)) throw legacyZeroRateError();
    const LocalZatcaBridge = require('../local-zatca');
    const bridge = LocalZatcaBridge.getInstance ? LocalZatcaBridge.getInstance() : new LocalZatcaBridge();
    return bridge.submitSaleById(saleId);
  }
  if (mode === 'direct') {
    const queue = require('./queue');
    return queue.submitDocument(saleId);
  }
  return null;
}

// دورة إعادة إرسال غير المرسل (يستدعيها المجدول الساعي وزر "إعادة الإرسال").
// عند legacy تُعاد نفس حلقة المجدول القديمة حرفيًا (تُنفَّذ في scheduler.js نفسه)،
// لذا يعيد الراوتر هنا الوضع فقط ليتصرف المستدعي — أما direct فتُدار بالكامل هنا.
async function retryUnsent(limit = 500) {
  const mode = await getMode();
  if (mode !== 'direct') return { mode, outcomes: [] };
  const queue = require('./queue');
  const outcomes = await queue.retryEligibleSales(limit);
  return { mode, outcomes };
}

module.exports = { detectModeOnce, getMode, retryUnsent, submitSale };
