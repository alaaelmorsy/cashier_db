'use strict';

const fs = require('fs');
const path = require('path');

const a4 = fs.readFileSync(path.join(__dirname, '../../src/renderer/sales/print-a4.html'), 'utf8');

describe('A4 invoice customer ZATCA address', () => {
  test.each([
    ['street', 'a4cZatcaStreet'],
    ['building', 'a4cZatcaBuilding'],
    ['district', 'a4cZatcaDistrict'],
    ['city', 'a4cZatcaCity'],
    ['postal', 'a4cPostal'],
  ])('renders the customer %s field', (_field, id) => {
    expect(a4).toMatch(new RegExp(`id=["']${id}["']`));
  });

  test('reads all ZATCA address values from the loaded customer record', () => {
    expect(a4).toMatch(/zatca_street/);
    expect(a4).toMatch(/zatca_building/);
    expect(a4).toMatch(/zatca_district/);
    expect(a4).toMatch(/zatca_city/);
    expect(a4).toMatch(/postal_code/);
  });
});
