const {
  buildReportDateFilter,
} = require('../src/shared/report-date-filter');

describe('report date filters', () => {
  test('all-invoices basis uses document creation only', () => {
    expect(buildReportDateFilter({
      tableAlias: 's',
      from: '2026-01-01 00:00:00',
      to: '2026-01-01 23:59:59',
      basis: 'document',
    })).toEqual({
      clause: '(s.created_at >= ? AND s.created_at <= ?)',
      params: ['2026-01-01 00:00:00', '2026-01-01 23:59:59'],
    });
  });

  test('activity basis uses creation for unsettled documents and settlement for settled documents', () => {
    const filter = buildReportDateFilter({
      tableAlias: 's',
      from: '2026-01-01 00:00:00',
      to: '2026-01-01 23:59:59',
      basis: 'activity',
    });

    expect(filter.clause).toContain('s.settled_at IS NULL AND (s.created_at >= ?');
    expect(filter.clause).toContain('s.settled_at IS NOT NULL AND (s.settled_at >= ?');
    expect(filter.clause).toContain('payment_transactions');
    expect(filter.params).toHaveLength(6);
  });

  test.each([
    ['from only', '2026-01-01 00:00:00', null, '>='],
    ['to only', null, '2026-01-01 23:59:59', '<='],
    ['no bounds', null, null, ''],
  ])('handles %s boundary', (_label, from, to, operator) => {
    const filter = buildReportDateFilter({ tableAlias: 's', from, to, basis: 'document' });
    expect(filter.clause).toContain(operator);
    expect(filter.params).toEqual([from, to].filter(Boolean));
  });

  test('rejects an unsupported basis instead of silently changing accounting policy', () => {
    expect(() => buildReportDateFilter({ basis: 'unknown' })).toThrow('Unsupported report date basis');
  });
});
