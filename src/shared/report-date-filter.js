function assertTableAlias(tableAlias) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(tableAlias)) {
    throw new Error('Invalid report table alias');
  }
}

function boundedColumn(column, from, to) {
  if (from && to) return { clause: `(${column} >= ? AND ${column} <= ?)`, params: [from, to] };
  if (from) return { clause: `${column} >= ?`, params: [from] };
  if (to) return { clause: `${column} <= ?`, params: [to] };
  return { clause: '', params: [] };
}

function buildActivityFilter(tableAlias, from, to) {
  if (!from && !to) return { clause: '', params: [] };
  const created = boundedColumn(`${tableAlias}.created_at`, from, to);
  const settled = boundedColumn(`${tableAlias}.settled_at`, from, to);
  const paid = boundedColumn('report_payment.created_at', from, to);
  return {
    clause: `(((${tableAlias}.settled_at IS NULL AND ${created.clause}) OR `
      + `(${tableAlias}.settled_at IS NOT NULL AND ${settled.clause}) OR `
      + `EXISTS (SELECT 1 FROM payment_transactions report_payment `
      + `WHERE report_payment.sale_id = ${tableAlias}.id AND ${paid.clause})))`,
    params: [...created.params, ...settled.params, ...paid.params],
  };
}

function buildReportDateFilter(options = {}) {
  const tableAlias = options.tableAlias || 's';
  const basis = options.basis || 'document';
  assertTableAlias(tableAlias);
  if (basis === 'document') return boundedColumn(`${tableAlias}.created_at`, options.from, options.to);
  if (basis === 'activity') return buildActivityFilter(tableAlias, options.from, options.to);
  throw new Error(`Unsupported report date basis: ${basis}`);
}

module.exports = { buildReportDateFilter };
