'use strict';

// queue: تسلسل، تمييز الأخطاء الشبكية عن رفض البيانات، وعدم الازدواج

const mockSubmitSale = jest.fn();
const mockSubmitCreditNote = jest.fn();
const mockRetryable = jest.fn((e) => /API_CONN_ERR/.test(String(e && e.code)));
jest.mock('../../src/main/zatca/directService', () => ({ submitSale: mockSubmitSale, submitCreditNote: mockSubmitCreditNote, retryable: mockRetryable }));

const mockState = { blockers: [], pending: [], unsent: [], existing: new Set(), status: 'production_ready' };
jest.mock('../../src/main/zatca/db', () => ({
  getZatcaDirectSettings: async () => ({ onboarding_status: mockState.status }),
  getUnconfirmedZatcaSubmissions: async () => mockState.blockers,
  getPendingZatcaSubmissions: async () => mockState.pending,
  getUnsentZatcaSales: async () => mockState.unsent,
  getZatcaSubmission: async (type, id) => (mockState.existing.has(`${type}:${id}`) ? { id: 1 } : null),
}));

const queue = require('../../src/main/zatca/queue');

function netError() {
  const e = new Error('connection failed');
  e.code = 'API_CONN_ERR';
  return e;
}

describe('zatca queue', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockState.blockers = [];
    mockState.pending = [];
    mockState.unsent = [];
    mockState.existing = new Set();
    mockState.status = 'production_ready';
    mockSubmitSale.mockResolvedValue({ success: true, status: 'reported' });
    mockSubmitCreditNote.mockResolvedValue({ success: true, status: 'reported' });
  });

  test('لا شيء يُرسل قبل production_ready', async () => {
    mockState.status = 'csr_generated';
    mockState.unsent = [{ id: 1, documentType: 'sale' }];
    expect(await queue.retryEligibleSales()).toEqual([]);
    expect(mockSubmitSale).not.toHaveBeenCalled();
  });

  test('المعلقون أولًا ثم غير المرسلين، بترتيبهم', async () => {
    mockState.pending = [{ document_type: 'sale', document_id: 1 }];
    mockState.unsent = [{ id: 2, documentType: 'sale' }, { id: 3, documentType: 'credit_note' }];
    const outcomes = await queue.retryEligibleSales();
    expect(outcomes.map((o) => o.id)).toEqual([1, 2, 3]);
    expect(mockSubmitCreditNote).toHaveBeenCalledWith(3);
  });

  test('خطأ شبكي يوقف الدفعة (لا جدوى والشبكة مقطوعة)', async () => {
    mockState.pending = [
      { document_type: 'sale', document_id: 1 },
      { document_type: 'sale', document_id: 2 },
    ];
    mockSubmitSale.mockRejectedValueOnce(netError());
    const outcomes = await queue.retryEligibleSales();
    expect(outcomes).toHaveLength(1);
    expect(outcomes[0].success).toBe(false);
    expect(mockSubmitSale).toHaveBeenCalledTimes(1);
  });

  test('رفض بيانات لمستند واحد لا يوقف بقية الدفعة', async () => {
    mockState.pending = [
      { document_type: 'sale', document_id: 1 },
      { document_type: 'sale', document_id: 2 },
    ];
    mockSubmitSale.mockRejectedValueOnce(new Error('بيانات غير صالحة'));
    const outcomes = await queue.retryEligibleSales();
    expect(outcomes).toHaveLength(2);
    expect(outcomes[0].success).toBe(false);
    expect(outcomes[1].success).toBe(true);
  });

  test('مستند له سجل إرسال قائم لا يُرسل مرتين من قائمة غير المرسل', async () => {
    mockState.unsent = [{ id: 5, documentType: 'sale' }];
    mockState.existing.add('sale:5');
    const outcomes = await queue.retryEligibleSales();
    expect(outcomes).toEqual([]);
    expect(mockSubmitSale).not.toHaveBeenCalled();
  });

  test('الإرسال تسلسلي عبر سلسلة promise واحدة', async () => {
    const order = [];
    mockSubmitSale.mockImplementation(async (id) => {
      order.push(`start-${id}`);
      await new Promise((r) => setTimeout(r, 10));
      order.push(`end-${id}`);
      return { success: true };
    });
    await Promise.all([queue.submitSale(1), queue.submitSale(2)]);
    expect(order).toEqual(['start-1', 'end-1', 'start-2', 'end-2']);
  });

  test('manual submission resolves an older unconfirmed document before sending the requested invoice', async () => {
    // The blocker can be older than send_start_date, so it is intentionally absent from `pending`.
    mockState.blockers = [{ document_type: 'sale', document_id: 7, status: 'sent_unconfirmed' }];

    await queue.submitSale(8);

    expect(mockSubmitSale.mock.calls.map(([id]) => id)).toEqual([7, 8]);
  });
});
