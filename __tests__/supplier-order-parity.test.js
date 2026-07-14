const fs = require('fs');
const path = require('path');

const read = (relativePath) => fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');

describe('supplier order parity between primary and secondary devices', () => {
  const suppliersSource = read('src/main/suppliers.js');
  const apiSource = read('src/main/api-server.js');

  test('secondary forwards the requested supplier sort to the primary API', () => {
    expect(suppliersSource).toContain('if (query.sort) p.sort = query.sort');
  });

  test('both data paths use the same deterministic name order', () => {
    expect(suppliersSource).toContain("if(query.sort === 'name_asc') order = 'ORDER BY name ASC, id ASC'");
    expect(apiSource).toContain("const order = sort === 'name_asc' ? 'ORDER BY name ASC, id ASC' : 'ORDER BY id DESC'");
    expect(apiSource).toContain('SELECT * FROM suppliers ${where} ${order}');
  });
});
