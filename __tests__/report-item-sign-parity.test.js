const fs = require('fs');
const path = require('path');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

describe('sold-item report sign normalization', () => {
  test('primary and branch summary queries subtract legacy positive and modern negative credit-note rows', () => {
    for (const source of [read('src/main/sales.js'), read('src/main/api-server.js')]) {
      expect(source).toMatch(/SUM\(CASE WHEN s\.doc_type='credit_note' THEN -ABS\(si\.qty\) ELSE ABS\(si\.qty\) END\) AS qty_total/);
      expect(source).toMatch(/SUM\(CASE WHEN s\.doc_type='credit_note' THEN -ABS\(si\.line_total\) ELSE ABS\(si\.line_total\) END\) AS amount_total/);
    }
  });

  test('inventory sold quantity uses the same normalized credit-note sign', () => {
    const source = read('src/main/sales.js');
    expect(source).toMatch(/SUM\(CASE WHEN .*doc_type='credit_note'.* THEN -ABS\(si\.qty\) ELSE ABS\(si\.qty\) END\).*AS qty_sold/s);
    expect(source).toContain('HAVING qty_sold > 0');
    expect(source).toMatch(/HAVING SUM\(CASE WHEN .*doc_type='credit_note'.* THEN -ABS\(si\.qty\) ELSE ABS\(si\.qty\) END\) > 0/s);
  });
});
