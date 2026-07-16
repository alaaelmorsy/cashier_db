'use strict';

const fs = require('fs');
const path = require('path');

const read = relativePath => fs.readFileSync(path.resolve(__dirname, '..', relativePath), 'utf8');

describe('international transport quotation contract', () => {
  const salesRenderer = read('src/renderer/sales/renderer.js');
  const quotationTemplate = read('src/renderer/sales/quotation.html');
  const quotationsRenderer = read('src/renderer/quotations/renderer.js');
  const quotationsMain = read('src/main/quotations.js');

  test('passes the selected treatment from sales to the quotation preview', () => {
    const quotationClick = salesRenderer.slice(
      salesRenderer.indexOf("btnQuotation.addEventListener('click'"),
      salesRenderer.indexOf('// فتح نافذة عرض السعر')
    );

    expect(quotationClick).toContain('tax_treatment: selectedTaxTreatment()');
  });

  test('renders international transport quotation lines and totals at zero rate', () => {
    expect(quotationTemplate).toContain("totals.tax_treatment === 'international_transport_zero_rate'");
    expect(quotationTemplate).toContain('const effectiveVatRate = isInternationalZeroRate ? 0 : vatRate');
    expect(quotationTemplate).toContain('نقل دولي بنسبة صفر');
  });

  test('persists treatment and restores it for preview and invoice conversion', () => {
    expect(quotationsMain).toContain('tax_treatment VARCHAR(50)');
    expect(quotationsMain).toContain('data.tax_treatment');
    expect((quotationsRenderer.match(/tax_treatment: q\.tax_treatment \|\| 'standard'/g) || []).length).toBeGreaterThanOrEqual(2);
    expect(salesRenderer).toContain('restoreInternationalTransportState(totals)');
  });
});
