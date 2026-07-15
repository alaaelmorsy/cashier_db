'use strict';

const mockCertificatePem = require('tls').rootCertificates[0];

const mockBuildComplianceInvoiceXml = jest.fn((input) => {
  if (!input.uuid || !input.originalInvoiceUuid) throw new ReferenceError('crypto is not defined');
  return {
    uuid: input.uuid,
    invoiceXml: '<Invoice><cbc:ProfileID>reporting:1.0</cbc:ProfileID><cbc:IssueDate>2026-07-14</cbc:IssueDate><cbc:TaxInclusiveAmount>115.00</cbc:TaxInclusiveAmount><cbc:TaxAmount>15.00</cbc:TaxAmount></Invoice>',
  };
});
const mockParseCertificate = jest.fn(() => {
  throw new Error("Cannot read properties of undefined (reading 'getTime')");
});
const mockSaveZatcaOnboardingState = jest.fn();

jest.mock('@talha7k/zatca', () => ({
  DEFAULT_COMPLIANCE_PREVIOUS_INVOICE_HASH: 'PIH',
  ZatcaApiClient: jest.fn(() => ({
    verifyCompliance: async () => ({ valid: true, messages: [] }),
    requestProductionCSID: async () => ({
      status: 'ACCEPTED', binarySecurityToken: 'certificate', secret: 'production-secret',
    }),
  })),
  asCertificatePem: () => mockCertificatePem,
  buildComplianceInvoiceXml: mockBuildComplianceInvoiceXml,
  extractCertificateSignature: () => '',
  extractInvoiceTimestamp: () => '2026-07-14T10:00:00Z',
  extractXmlValue: () => null,
  generateCSR: jest.fn(),
  parseCertificate: mockParseCertificate,
  signInvoice: ({ xml }) => ({ invoiceHash: 'hash', signedXml: xml }),
}));

jest.mock('../../src/main/zatca/db', () => ({
  getZatcaDirectSettings: async () => ({
    environment: 'sandbox', company_name: 'Test', vat_number: '399999999900003',
    commercial_registration: '1010101010', street: 'Street', building: '1234',
    district: 'District', city: 'Riyadh', postal_code: '12244',
    private_key_enc: 'key', compliance_token_enc: 'certificate', compliance_secret_enc: 'secret',
    compliance_request_id: 'request-id', onboarding_status: 'compliance_passed',
  }),
  saveZatcaOnboardingState: mockSaveZatcaOnboardingState,
}));

jest.mock('../../src/main/zatca/vault', () => ({
  decryptSecret: (value) => value,
  encryptSecret: (value) => value,
}));

jest.mock('../../src/main/zatca/crypto-runtime', () => ({
  runCryptoAction: jest.fn(async (action, payload) => {
    if (action === 'signInvoice') return { invoiceHash: 'hash', signedXml: payload.xml };
    if (action === 'extractCertificateSignature') return '';
    if (action === 'certificateValidity') {
      return { validFrom: 'Jul 14 00:00:00 2026 GMT', validTo: 'Jul 14 00:00:00 2027 GMT' };
    }
    throw new Error(`Unexpected crypto action: ${action}`);
  }),
}));

jest.mock('../../src/main/zatca/index', () => ({
  effectiveVatNumber: (settings) => settings.vat_number,
}));

const { requestProductionCsid, runComplianceChecks } = require('../../src/main/zatca/onboarding');

test('compliance checks pass explicit UUIDs and never rely on a library crypto global', async () => {
  await expect(runComplianceChecks()).resolves.toHaveLength(6);
  expect(mockBuildComplianceInvoiceXml).toHaveBeenCalledTimes(6);
  for (const [input] of mockBuildComplianceInvoiceXml.mock.calls) {
    expect(input.uuid).toMatch(/^[0-9a-f-]{36}$/i);
    expect(input.originalInvoiceUuid).toMatch(/^[0-9a-f-]{36}$/i);
  }
});

test('production certificate parsing works on Electron runtimes without validToDate', async () => {
  const issued = await requestProductionCsid();

  expect(issued.expiresAt).toBeTruthy();
  expect(mockSaveZatcaOnboardingState).toHaveBeenCalledWith(expect.objectContaining({
    onboarding_status: 'production_ready',
    certificate_expires_at: expect.any(Date),
  }));
});
