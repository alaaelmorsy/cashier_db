'use strict';

const path = require('path');
const crypto = require('crypto');
const {
  DEFAULT_COMPLIANCE_PREVIOUS_INVOICE_HASH,
  buildComplianceInvoiceXml,
} = require('@talha7k/zatca');

const { runCryptoAction } = require('../../src/main/zatca/crypto-runtime');

const validCsrInput = {
  organizationNameAr: 'Test Company',
  organizationNameEn: 'Test Company',
  vatNumber: '300000000000003',
  crNumber: '1010101010',
  country: 'SA',
  commonName: 'Main Branch',
  invoiceType: '1100',
  businessCategory: 'Retail',
  location: {
    city: 'Riyadh',
    district: 'Olaya',
    street: 'King Road',
    buildingNumber: '1234',
    postalCode: '12244',
  },
  egsSerialNumber: '1-PLUSCashier|2-POS|3-test-device',
};

function derLength(length) {
  if (length < 128) return Buffer.from([length]);
  const bytes = [];
  for (let remaining = length; remaining; remaining >>>= 8) bytes.unshift(remaining & 0xff);
  return Buffer.from([0x80 | bytes.length, ...bytes]);
}

function der(tag, ...parts) {
  const body = Buffer.concat(parts);
  return Buffer.concat([Buffer.from([tag]), derLength(body.length), body]);
}

function derOid(oid) {
  const arcs = oid.split('.').map(Number);
  const bytes = [arcs[0] * 40 + arcs[1]];
  for (const arc of arcs.slice(2)) {
    const encoded = [arc & 0x7f];
    for (let remaining = arc >>> 7; remaining; remaining >>>= 7) encoded.unshift(0x80 | (remaining & 0x7f));
    bytes.push(...encoded);
  }
  return der(0x06, Buffer.from(bytes));
}

function selfSignedCertificate(privateKeyPem, publicKeyPem) {
  const algorithm = der(0x30, derOid('1.2.840.10045.4.3.2'));
  const commonName = der(0x30, der(0x31, der(0x30, derOid('2.5.4.3'), der(0x0c, Buffer.from('Production Test')))));
  const validity = der(0x30,
    der(0x17, Buffer.from('260101000000Z')),
    der(0x17, Buffer.from('300101000000Z'))
  );
  const publicKeyDer = crypto.createPublicKey(publicKeyPem).export({ type: 'spki', format: 'der' });
  const tbsCertificate = der(0x30,
    der(0xa0, der(0x02, Buffer.from([2]))),
    der(0x02, Buffer.from([1])),
    algorithm,
    commonName,
    validity,
    commonName,
    publicKeyDer
  );
  const signature = crypto.sign('sha256', tbsCertificate, privateKeyPem);
  const certificateDer = der(0x30, tbsCertificate, algorithm, der(0x03, Buffer.from([0]), signature));
  const base64 = certificateDer.toString('base64').match(/.{1,64}/g).join('\n');
  return `-----BEGIN CERTIFICATE-----\n${base64}\n-----END CERTIFICATE-----`;
}

test('production CSR generation runs in the bundled Node crypto runtime', async () => {
  const generated = await runCryptoAction('generateCSR', {
    params: validCsrInput,
    environment: 'production',
  }, {
    nodePath: process.execPath,
    workerPath: path.resolve(__dirname, '../../src/main/zatca/crypto-worker.js'),
  });

  expect(generated.csr).toContain('BEGIN CERTIFICATE REQUEST');
  expect(generated.privateKey).toContain('BEGIN PRIVATE KEY');
  const key = crypto.createPrivateKey(generated.privateKey);
  expect(key.asymmetricKeyDetails.namedCurve).toBe('secp256k1');
});

test('crypto worker does not leak a private key when an action fails', async () => {
  const privateKey = 'VERY-SENSITIVE-PRIVATE-KEY';

  await expect(runCryptoAction('unknown-action', { privateKey }, {
    nodePath: process.execPath,
    workerPath: path.resolve(__dirname, '../../src/main/zatca/crypto-worker.js'),
  })).rejects.not.toThrow(privateKey);
});

test('production runtime signs all six compliance documents and creates the invoice QR', async () => {
  const generated = await runCryptoAction('generateCSR', {
    params: validCsrInput,
    environment: 'production',
  });
  const certificatePem = selfSignedCertificate(generated.privateKey, generated.publicKey);
  const selected = await runCryptoAction('selectSigningCertificate', {
    privateKeyPem: generated.privateKey,
    candidates: [certificatePem],
  });
  expect(selected).toBe(certificatePem);

  const address = {
    street: 'King Road', building: '1234', district: 'Olaya', city: 'Riyadh',
    postalCode: '12244', countryCode: 'SA',
  };
  const checkTypes = [
    'SIMPLIFIED_INVOICE', 'SIMPLIFIED_CREDIT_NOTE', 'SIMPLIFIED_DEBIT_NOTE',
    'STANDARD_INVOICE', 'STANDARD_CREDIT_NOTE', 'STANDARD_DEBIT_NOTE',
  ];
  let firstSigned;
  for (const [index, checkType] of checkTypes.entries()) {
    const built = buildComplianceInvoiceXml({
      checkType,
      supplier: {
        nameAr: 'شركة اختبار', nameEn: 'Test Company', vatNumber: '300000000000003',
        crNumber: '1010101010', address,
      },
      customer: { name: 'Test Customer', vatNumber: '300000000000003', address },
      uuid: crypto.randomUUID(),
      originalInvoiceUuid: crypto.randomUUID(),
      invoiceCounter: index + 1,
      previousInvoiceHash: DEFAULT_COMPLIANCE_PREVIOUS_INVOICE_HASH,
    });
    const signed = await runCryptoAction('signInvoice', {
      xml: built.invoiceXml,
      privateKeyPem: generated.privateKey,
      certificatePem,
    });
    expect(signed.signedXml).toContain('<ds:Signature');
    expect(signed.invoiceHash).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
    firstSigned ||= built.invoiceXml;
  }

  const artifacts = await runCryptoAction('signingArtifacts', {
    signParams: {
      xml: firstSigned,
      privateKeyPem: generated.privateKey,
      certificatePem,
      qrData: {
        sellerName: 'Test Company', vatNumber: '300000000000003',
        timestamp: '2026-07-15T12:00:00', totalWithVat: '115.00', vatTotal: '15.00',
      },
    },
    qrParams: {
      sellerName: 'Test Company', vatNumber: '300000000000003',
      timestamp: '2026-07-15T12:00:00', totalWithVat: '115.00', vatTotal: '15.00',
    },
  });
  expect(artifacts.qrCodeBase64).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
});
