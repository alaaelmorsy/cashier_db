'use strict';

const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '../../src/renderer/customers/index.html'), 'utf8');
const js = fs.readFileSync(path.join(__dirname, '../../src/renderer/customers/renderer.js'), 'utf8');

describe('customer VAT and ZATCA address validation', () => {
  test('marks the ZATCA address section as conditionally required', () => {
    expect(html).toMatch(/id=["']zatcaAddressRequirement["']/);
    expect(html).toMatch(/id=["']f_zatca_street["']/);
    expect(html).toMatch(/id=["']f_zatca_building["']/);
    expect(html).toMatch(/id=["']f_zatca_district["']/);
    expect(html).toMatch(/id=["']f_zatca_city["']/);
  });

  test('requires the complete ZATCA address only when a VAT number is present', () => {
    expect(js).toMatch(/validateVatCustomerAddress/);
    expect(js).toMatch(/zatca_street/);
    expect(js).toMatch(/zatca_building/);
    expect(js).toMatch(/zatca_district/);
    expect(js).toMatch(/zatca_city/);
    expect(js).toMatch(/postal_code/);
  });

  test('validates a Saudi VAT number as 15 digits starting and ending with 3', () => {
    expect(js).toMatch(/\^3\\d\{13\}3\$/);
  });

  test('keeps legacy address values without rendering duplicate visible fields', () => {
    expect(html).toMatch(/type=["']hidden["'][^>]*id=["']f_nataddr["']/);
    expect(html).toMatch(/type=["']hidden["'][^>]*id=["']f_street["']/);
    expect(html).toMatch(/type=["']hidden["'][^>]*id=["']f_subnumber["']/);
  });

  test('renders VAT validation feedback inside the customer dialog', () => {
    expect(html).toMatch(/id=["']zatcaAddressError["']/);
    expect(js).toMatch(/showZatcaAddressError/);
  });
});
