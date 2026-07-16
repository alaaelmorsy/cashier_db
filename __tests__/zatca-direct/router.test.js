'use strict';

// router: كشف الوضع وقواعد FR-002/FR-003/FR-004

jest.mock('../../src/db/db-adapter', () => {
  const state = { zatcaEnabled: 0, taxTreatment: 'standard' };
  return {
    __state: state,
    dbAdapter: {
      getConnection: async () => ({
        query: async (sql) => {
          if (/zatca_enabled/.test(sql)) return [[{ zatca_enabled: state.zatcaEnabled }]];
          if (/tax_treatment/.test(sql)) return [[{ tax_treatment: state.taxTreatment }]];
          return [[]];
        },
        release: () => {},
      }),
    },
  };
});

jest.mock('../../src/main/zatca/db', () => {
  const state = { integrationMode: 'unlinked', migrated: 0 };
  return {
    __state: state,
    migrate: async () => { state.migrated += 1; },
    getZatcaDirectSettings: async () => ({ integration_mode: state.integrationMode }),
  };
});

const mockSubmitSaleById = jest.fn(async () => ({ success: true, via: 'bridge' }));
jest.mock('../../src/main/local-zatca', () => ({
  getInstance: () => ({ submitSaleById: mockSubmitSaleById }),
}));

const mockSubmitDocument = jest.fn(async () => ({ success: true, via: 'direct' }));
const mockRetryEligibleSales = jest.fn(async () => [{ id: 1, success: true }]);
jest.mock('../../src/main/zatca/queue', () => ({ submitDocument: mockSubmitDocument, retryEligibleSales: mockRetryEligibleSales }));

const adapter = require('../../src/db/db-adapter');
const zatcaDb = require('../../src/main/zatca/db');
const router = require('../../src/main/zatca/router');

describe('zatca router — كشف الوضع', () => {
  beforeEach(() => {
    adapter.__state.zatcaEnabled = 0;
    adapter.__state.taxTreatment = 'standard';
    zatcaDb.__state.integrationMode = 'unlinked';
    jest.clearAllMocks();
  });

  test('zatca_enabled=1 وبلا ربط مباشر → legacy', async () => {
    adapter.__state.zatcaEnabled = 1;
    expect(await router.getMode()).toBe('legacy');
  });

  test('zatca_enabled=0 وبلا ربط مباشر → unlinked', async () => {
    expect(await router.getMode()).toBe('unlinked');
  });

  test('تفعيل الوضع القديم لاحقًا على جهاز unlinked يعمل ديناميكيًا (FR-004)', async () => {
    expect(await router.getMode()).toBe('unlinked');
    adapter.__state.zatcaEnabled = 1; // المستخدم فعّل الربط القديم بعد التحديث
    expect(await router.getMode()).toBe('legacy');
  });

  test('direct له الأولوية على zatca_enabled (وضع واحد نشط)', async () => {
    adapter.__state.zatcaEnabled = 1;
    zatcaDb.__state.integrationMode = 'direct';
    expect(await router.getMode()).toBe('direct');
  });

  test('لا تحول تلقائيًا إلى direct مهما أعيد الفحص (FR-003)', async () => {
    adapter.__state.zatcaEnabled = 1;
    for (let i = 0; i < 5; i += 1) {
      await router.detectModeOnce();
      expect(await router.getMode()).toBe('legacy');
    }
  });

  test('legacy يفوض الإرسال للوسيط القديم حرفيًا', async () => {
    adapter.__state.zatcaEnabled = 1;
    await router.submitSale(42);
    expect(mockSubmitSaleById).toHaveBeenCalledWith(42);
    expect(mockSubmitDocument).not.toHaveBeenCalled();
  });

  test('direct يمرر الإرسال لقائمة الانتظار المباشرة', async () => {
    zatcaDb.__state.integrationMode = 'direct';
    await router.submitSale(7);
    expect(mockSubmitDocument).toHaveBeenCalledWith(7);
    expect(mockSubmitSaleById).not.toHaveBeenCalled();
  });

  test('unlinked لا يرسل شيئًا', async () => {
    const result = await router.submitSale(9);
    expect(result).toBeNull();
    expect(mockSubmitSaleById).not.toHaveBeenCalled();
    expect(mockSubmitDocument).not.toHaveBeenCalled();
  });

  test('retryUnsent يعمل فقط في direct', async () => {
    adapter.__state.zatcaEnabled = 1;
    expect((await router.retryUnsent()).outcomes).toEqual([]);
    zatcaDb.__state.integrationMode = 'direct';
    expect((await router.retryUnsent()).outcomes).toHaveLength(1);
    expect(mockRetryEligibleSales).toHaveBeenCalled();
  });

  test('legacy fails closed for an international zero-rate document before submission', async () => {
    adapter.__state.zatcaEnabled = 1;
    adapter.__state.taxTreatment = 'international_transport_zero_rate';
    await expect(router.submitSale(43)).rejects.toMatchObject({
      code: 'LEGACY_ZATCA_ZERO_RATE_UNSUPPORTED',
    });
    expect(mockSubmitSaleById).not.toHaveBeenCalled();
  });
});
