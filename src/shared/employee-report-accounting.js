(function exposeEmployeeReportAccounting(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.EmployeeReportAccounting = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createEmployeeReportAccounting() {
  const rounded = (amount, digits = 2) => Number(Number(amount || 0).toFixed(digits));
  const sumAbs = (records, field) => (Array.isArray(records) ? records : []).reduce((sum, record) => sum + Math.abs(Number(record?.[field] || 0)), 0);
  function summarizeEmployeeReport(options = {}) {
    const sales = rounded(sumAbs(options.invoices, 'employee_total'));
    const salesQty = rounded(sumAbs(options.products, 'total_qty'), 3);
    const returns = rounded(sumAbs(options.creditNotes, 'employee_total'));
    const returnsQty = rounded(sumAbs(options.creditProducts, 'total_qty'), 3);
    return { sales, salesQty, returns, returnsQty, net: rounded(sales - returns), netQty: rounded(salesQty - returnsQty, 3) };
  }
  return { summarizeEmployeeReport };
});
