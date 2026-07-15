'use strict';

const fs = require('fs');
const path = require('path');

const rendererPath = path.join(__dirname, '../../src/renderer/credit_notes/renderer.js');

describe('credit note manual ZATCA submission routing', () => {
  test('sends through the active integration mode instead of always using the legacy bridge', () => {
    const source = fs.readFileSync(rendererPath, 'utf8');

    expect(source).toMatch(/zatcaDirect\.getStatus\(\)/);
    expect(source).toMatch(/mode\s*===\s*['"]direct['"][\s\S]*?zatcaDirect\.submitCreditNote\(saleId\)/);
    expect(source).toMatch(/mode\s*===\s*['"]legacy['"][\s\S]*?localZatca\.submitBySaleId\(saleId\)/);
    expect(source).toMatch(/const resp\s*=\s*await submitCreditNoteByActiveMode\(id\)/);
  });
});
