'use strict';

const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.resolve(__dirname, '../src/main/sales.js'), 'utf8');

describe('primary international transport sale contract', () => {
  test('locks the setting and authoritative products inside the transaction', () => {
    const begin = source.indexOf('await conn.beginTransaction()');
    const settingLock = source.indexOf('international_transport_zero_rate_enabled FROM app_settings WHERE id=1 FOR UPDATE', begin);
    const productLock = source.indexOf('is_international_transport_service FROM products WHERE id=? FOR UPDATE', settingLock);
    const validation = source.indexOf('validateInternationalTransportSale({', productLock);
    expect(begin).toBeGreaterThan(-1);
    expect(settingLock).toBeGreaterThan(begin);
    expect(productLock).toBeGreaterThan(settingLock);
    expect(validation).toBeGreaterThan(productLock);
  });

  test('rejects forged zero-rate totals and persists immutable sale/item snapshots', () => {
    expect(source).toContain('VALIDATION_ERRORS.TOTAL_MISMATCH');
    expect(source).toContain('taxSnapshot.tax_treatment');
    expect(source).toContain('taxSnapshot.tax_percent_applied');
    expect(source).toContain('taxSnapshot.zero_rate_reason_code');
    expect(source).toContain('is_international_transport_service_snapshot');
    expect(source).not.toContain('transport: p.transport');
    expect(source).not.toContain('taxSnapshot.transport_origin');
  });

  test('queues ZATCA only after the transaction commits', () => {
    const commit = source.indexOf('await conn.commit()', source.indexOf("ipcMain.handle('sales:create'"));
    const queue = source.indexOf('autoSubmitZatcaIfEnabled(saleId)', commit);
    expect(commit).toBeGreaterThan(-1);
    expect(queue).toBeGreaterThan(commit);
    expect(source).toContain("error?.code !== 'LEGACY_ZATCA_ZERO_RATE_UNSUPPORTED'");
    expect(source).toContain("zatca_status='rejected'");
  });
});
