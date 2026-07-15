'use strict';

// قائمة انتظار تسلسلية (promise chain) تحفظ ترتيب سلسلة ICV/PIH —
// منقولة من برنامج المغاسل (server/services/zatca/queue.js).
// retryEligibleSales: إعادة تسمية مقصودة لـ retryEligibleOrders المرجعية.

const db = require('./db');
const direct = require('./directService');

let queueTail = Promise.resolve();

function enqueue(work) {
  const queued = queueTail.then(work, work);
  queueTail = queued.catch(() => undefined);
  return queued;
}

async function resolveUnconfirmedBefore(documentType, documentId) {
  const unconfirmed = await db.getUnconfirmedZatcaSubmissions();
  const blockers = unconfirmed.filter((submission) => (
    !(submission.document_type === documentType && Number(submission.document_id) === Number(documentId))
  ));
  for (const blocker of blockers) {
    if (blocker.document_type === 'credit_note') {
      await direct.submitCreditNote(blocker.document_id);
    } else {
      await direct.submitSale(blocker.document_id);
    }
  }
}

function submitSale(saleId) {
  return enqueue(async () => {
    await resolveUnconfirmedBefore('sale', saleId);
    return direct.submitSale(saleId);
  });
}

function submitCreditNote(saleId) {
  return enqueue(async () => {
    await resolveUnconfirmedBefore('credit_note', saleId);
    return direct.submitCreditNote(saleId);
  });
}

// إرسال مستند حسب نوعه (فاتورة أو إشعار دائن — كلاهما صف في sales).
function submitDocument(saleId) {
  return submitSale(saleId);
}

// Each document is enqueued individually so manual submissions from the UI
// interleave with the bulk retry batch instead of waiting minutes behind it.
async function retryEligibleSales(limit = 100) {
  const settings = await db.getZatcaDirectSettings();
  if (settings.onboarding_status !== 'production_ready') return [];
  const outcomes = [];
  const pending = await db.getPendingZatcaSubmissions(limit);
  for (const submission of pending) {
    try {
      const response = submission.document_type === 'credit_note'
        ? await submitCreditNote(submission.document_id)
        : await submitSale(submission.document_id);
      outcomes.push({ id: submission.document_id, success: response.success, status: response.status });
    } catch (error) {
      outcomes.push({ id: submission.document_id, success: false, message: error.message });
      // خطأ شبكي/مؤقت: لا جدوى من متابعة الدفعة والشبكة مقطوعة.
      // خطأ بيانات في مستند واحد: يُعلَّم للمراجعة ويُتابَع الباقي.
      if (direct.retryable(error)) return outcomes;
    }
  }
  const unsent = await db.getUnsentZatcaSales(limit);
  for (const doc of unsent) {
    if (await db.getZatcaSubmission(doc.documentType, doc.id)) continue;
    try {
      const response = doc.documentType === 'credit_note'
        ? await submitCreditNote(doc.id)
        : await submitSale(doc.id);
      outcomes.push({ id: doc.id, success: response.success, status: response.status });
    } catch (error) {
      outcomes.push({ id: doc.id, success: false, message: error.message });
      if (direct.retryable(error)) break;
    }
  }
  return outcomes;
}

module.exports = { retryEligibleSales, submitCreditNote, submitDocument, submitSale };
