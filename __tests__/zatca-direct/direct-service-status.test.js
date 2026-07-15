'use strict';

const mockGetSettings = jest.fn();
const mockGetSale = jest.fn();
const mockUpdateSaleStatus = jest.fn();

jest.mock('@talha7k/zatca', () => ({
  ZatcaApiClient: jest.fn(),
  asCertificatePem: jest.fn(),
  extractCertificateSignature: jest.fn(),
  extractRawPublicKey: jest.fn(),
  generateCreditNoteXml: jest.fn(),
  generateInvoiceXml: jest.fn(),
  generatePhase2TLV: jest.fn(),
  isCreditNoteData: jest.fn(),
  signInvoice: jest.fn(),
}));

jest.mock('../../src/main/zatca/db', () => ({
  getZatcaDirectSettings: mockGetSettings,
  getSaleForZatca: mockGetSale,
  updateSaleZatcaStatus: mockUpdateSaleStatus,
}));

jest.mock('../../src/main/zatca/vault', () => ({ decryptSecret: (secret) => secret }));
jest.mock('../../src/main/zatca/index', () => ({
  classifyInvoice: () => 'simplified',
}));
jest.mock('../../src/main/zatca/mapper', () => ({ mapCreditNote: jest.fn(), mapSale: jest.fn() }));
jest.mock('../../src/db/db-adapter', () => ({ dbAdapter: { getConnection: jest.fn() } }));
jest.mock('electron', () => ({ BrowserWindow: { getAllWindows: () => [] } }));

const direct = require('../../src/main/zatca/directService');

function productionSettings(overrides = {}) {
  return {
    onboarding_status: 'production_ready',
    environment: 'production',
    production_token_enc: 'production-token',
    production_secret_enc: 'production-secret',
    certificate_expires_at: new Date(Date.now() + 86400000),
    ...overrides,
  };
}

describe('automatic ZATCA failure status', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSettings.mockResolvedValue(productionSettings());
  });

  test('marks a credit note as failed when its original invoice was not sent', async () => {
    mockGetSale
      .mockResolvedValueOnce({ sale: { id: 81, doc_type: 'credit_note', ref_base_sale_id: 12 } })
      .mockResolvedValueOnce(null);

    await expect(direct.submitCreditNote(81)).rejects.toThrow('الفاتورة الأصلية');
    expect(mockUpdateSaleStatus).toHaveBeenCalledWith(81, expect.objectContaining({
      status: 'rejected',
      rejectionReason: expect.stringContaining('الفاتورة الأصلية'),
    }));
  });

  test('marks an invoice as failed when the production certificate is expired', async () => {
    mockGetSettings.mockResolvedValue(productionSettings({ certificate_expires_at: new Date(Date.now() - 86400000) }));

    await expect(direct.submitSale(91)).rejects.toThrow('منتهية الصلاحية');
    expect(mockUpdateSaleStatus).toHaveBeenCalledWith(91, expect.objectContaining({
      status: 'rejected',
      rejectionReason: expect.stringContaining('منتهية الصلاحية'),
    }));
  });

  test('keeps a transient ZATCA connection error pending for automatic retry', async () => {
    const connectionError = new Error('ZATCA API connection failed');
    connectionError.code = 'API_CONN_ERR';
    mockGetSettings.mockRejectedValue(connectionError);

    await expect(direct.submitSale(101)).rejects.toMatchObject({ code: 'API_CONN_ERR' });
    expect(mockUpdateSaleStatus).not.toHaveBeenCalled();
  });
});
