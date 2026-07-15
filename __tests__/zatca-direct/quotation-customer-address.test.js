'use strict';

const fs = require('fs');
const path = require('path');

const quotation = fs.readFileSync(path.join(__dirname, '../../src/renderer/sales/quotation.html'), 'utf8');

describe('quotation customer ZATCA address', () => {
  test.each([
    ['postal', 'a4cPostal'],
    ['street', 'a4cZatcaStreet'],
    ['building', 'a4cZatcaBuilding'],
    ['district', 'a4cZatcaDistrict'],
    ['city', 'a4cZatcaCity'],
  ])('renders the customer %s field', (_field, id) => {
    expect(quotation).toMatch(new RegExp(`id=["']${id}["']`));
  });

  test('reads all ZATCA address values from the selected customer', () => {
    expect(quotation).toMatch(/postal_code/);
    expect(quotation).toMatch(/zatca_street/);
    expect(quotation).toMatch(/zatca_building/);
    expect(quotation).toMatch(/zatca_district/);
    expect(quotation).toMatch(/zatca_city/);
  });
});
