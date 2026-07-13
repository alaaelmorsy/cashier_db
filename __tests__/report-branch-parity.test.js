const fs = require('fs');
const path = require('path');

const read = (relativePath) => fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');

describe('primary and secondary report parity', () => {
  const salesSource = read('src/main/sales.js');
  const apiSource = read('src/main/api-server.js');

  test('both primary IPC and primary HTTP API use the shared date policy', () => {
    expect(salesSource).toContain("require('../shared/report-date-filter')");
    expect(apiSource).toContain("require('../shared/report-date-filter')");
    expect((salesSource.match(/buildReportDateFilter\(/g) || []).length).toBeGreaterThanOrEqual(3);
    expect((apiSource.match(/buildReportDateFilter\(/g) || []).length).toBeGreaterThanOrEqual(3);
  });

  test('secondary forwarding preserves activity date basis for all report endpoints', () => {
    expect((salesSource.match(/apiParams\.date_basis = q\.date_basis/g) || []).length).toBeGreaterThanOrEqual(2);
    expect(salesSource).toContain("fetchFromAPI('/sales-items-summary', apiParams)");
    expect(salesSource).toContain("fetchFromAPI('/sales-items-detailed', apiParams)");
  });

  test('profitability fields are identical in primary and HTTP detail queries', () => {
    const requiredFields = ['si.unit_multiplier', 'AS cost_price', 'AS is_vat_exempt'];
    for (const field of requiredFields) {
      expect(salesSource).toContain(field);
      expect(apiSource).toContain(field);
    }
  });

  test('secondary has remote endpoints for inventory, employee and expiry reports', () => {
    const productsSource = read('src/main/products.js');
    expect(salesSource).toContain("fetchFromAPI('/reports-inventory'");
    expect(salesSource).toContain("fetchFromAPI('/employee-report'");
    expect(productsSource).toContain("fetchFromAPI('/products-expiry'");
    expect(apiSource).toContain("app.get('/api/reports-inventory'");
    expect(apiSource).toContain("app.get('/api/employee-report'");
    expect(apiSource).toContain("app.get('/api/products-expiry'");
  });

  test('secondary report lookup data never falls back to its local database', () => {
    const usersSource = read('src/main/users.js');
    const employeesSource = read('src/main/employees.js');
    const customersSource = read('src/main/customers.js');
    const suppliersSource = read('src/main/suppliers.js');
    const vouchersSource = read('src/main/vouchers.js');
    const settingsSource = read('src/main/settings.js');
    expect(usersSource).toContain("fetchFromAPI('/users'");
    expect(employeesSource).toContain('fetchFromAPI(`/employees/${employeeId}`)');
    expect(customersSource).toContain('fetchFromAPI(`/customers/${cid}`)');
    expect(suppliersSource).toContain('fetchFromAPI(`/suppliers/${sid}`)');
    expect(vouchersSource).toContain('fetchFromAPI(`/vouchers/${voucherId}`)');
    expect(settingsSource).toContain("fetchFromAPI('/settings-image'");
    for (const route of ['/api/users', '/api/suppliers/:id', '/api/vouchers/:id', '/api/settings-image']) {
      expect(apiSource).toContain(`app.get('${route}'`);
    }
  });
});
