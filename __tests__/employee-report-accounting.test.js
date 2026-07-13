const { summarizeEmployeeReport } = require('../src/shared/employee-report-accounting');

describe('employee report accounting', () => {
  test('normalizes historical signs for sales, credit notes and quantities', () => {
    expect(summarizeEmployeeReport({
      invoices: [{ employee_total: 100 }, { employee_total: -50 }], products: [{ total_qty: 3 }, { total_qty: -2 }],
      creditNotes: [{ employee_total: 20 }, { employee_total: -10 }], creditProducts: [{ total_qty: 1 }, { total_qty: -0.5 }],
    })).toEqual({ sales: 150, salesQty: 5, returns: 30, returnsQty: 1.5, net: 120, netQty: 3.5 });
  });
  test('rounds fractional money without floating-point drift', () => {
    expect(summarizeEmployeeReport({ invoices: [{ employee_total: 0.1 }, { employee_total: 0.2 }] }).net).toBe(0.3);
  });
});
