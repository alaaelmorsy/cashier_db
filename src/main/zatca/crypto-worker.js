'use strict';

const crypto = require('node:crypto');
const {
  extractCertificateSignature,
  extractRawPublicKey,
  generateCSR,
  generatePhase2TLV,
  signInvoice,
} = require('@talha7k/zatca');

function selectSigningCertificate({ privateKeyPem, candidates }) {
  const publicKeyPem = crypto.createPublicKey(crypto.createPrivateKey(privateKeyPem))
    .export({ type: 'spki', format: 'pem' });
  for (const pem of candidates || []) {
    if (!pem) continue;
    try {
      const certificateKey = new crypto.X509Certificate(pem).publicKey.export({ type: 'spki', format: 'pem' });
      if (certificateKey === publicKeyPem) return pem;
    } catch (_) {}
  }
  return null;
}

function signingArtifacts({ signParams, qrParams }) {
  const certificateSignature = extractCertificateSignature(signParams.certificatePem);
  const signed = signInvoice({
    ...signParams,
    qrData: { ...signParams.qrData, certificateSignature },
  });
  const qrCodeBase64 = generatePhase2TLV({
    ...qrParams,
    invoiceHash: signed.invoiceHash,
    signatureValue: signed.signatureValue,
    publicKey: extractRawPublicKey(signParams.certificatePem),
    certificateSignature,
  });
  return { ...signed, qrCodeBase64 };
}

function execute(action, payload) {
  switch (action) {
    case 'generateCSR':
      return generateCSR(payload.params, payload.environment);
    case 'signInvoice':
      return signInvoice(payload);
    case 'extractCertificateSignature':
      return extractCertificateSignature(payload.certificatePem);
    case 'certificateValidity': {
      const certificate = new crypto.X509Certificate(payload.certificatePem);
      return { validFrom: certificate.validFrom, validTo: certificate.validTo };
    }
    case 'selectSigningCertificate':
      return selectSigningCertificate(payload);
    case 'signingArtifacts':
      return signingArtifacts(payload);
    default:
      throw new Error('Unsupported ZATCA crypto action');
  }
}

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  try {
    const request = JSON.parse(input);
    process.stdout.write(JSON.stringify({ ok: true, result: execute(request.action, request.payload) }));
  } catch (error) {
    process.stdout.write(JSON.stringify({
      ok: false,
      error: {
        code: error && error.code ? String(error.code) : 'ZATCA_CRYPTO_ERROR',
        message: error && error.message ? String(error.message) : 'ZATCA crypto operation failed',
      },
    }));
    process.exitCode = 1;
  }
});

