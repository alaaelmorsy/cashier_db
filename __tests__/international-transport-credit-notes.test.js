'use strict';

const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.resolve(__dirname, '../src/main/sales.js'), 'utf8');

describe('international transport credit-note inheritance', () => {
  test('full and partial credits copy persisted tax and route snapshots', () => {
    expect((source.match(/sale\.tax_treatment \|\| 'standard'/g) || []).length).toBeGreaterThanOrEqual(2);
    expect((source.match(/sale\.zero_rate_reason_code \|\| null/g) || []).length).toBeGreaterThanOrEqual(2);
    expect(source).not.toContain('sale.transport_origin || null');
    expect(source).not.toContain('sale.shipment_reference || null');
  });

  test('partial credit uses the source applied rate and item eligibility snapshot', () => {
    expect(source).toContain('const vatPercent = sale.tax_percent_applied == null');
    expect(source).toContain(': Number(sale.tax_percent_applied)');
    expect((source.match(/is_international_transport_service_snapshot/g) || []).length).toBeGreaterThanOrEqual(5);
  });
});
