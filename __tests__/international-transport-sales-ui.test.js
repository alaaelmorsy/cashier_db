'use strict';

const fs = require('fs');
const path = require('path');

const renderer = fs.readFileSync(path.resolve(__dirname, '../src/renderer/sales/renderer.js'), 'utf8');
const html = fs.readFileSync(path.resolve(__dirname, '../src/renderer/sales/index.html'), 'utf8');

describe('international transport sales renderer contract', () => {
  test('uses one effective rate and includes the treatment payload in every save path', () => {
    expect(renderer).toContain('function effectiveVatPercent()');
    expect(renderer).toContain("selectedTaxTreatment() === 'international_transport_zero_rate'");
    expect((renderer.match(/\.\.\.internationalTransportPayload\(\)/g) || []).length).toBeGreaterThanOrEqual(4);
  });

  test('preserves/restores treatment state and resets unavailable carts to standard', () => {
    expect(renderer).toContain('...internationalTransportPayload()');
    expect(renderer).toContain("toggle.checked = state?.tax_treatment === 'international_transport_zero_rate'");
    expect(renderer).toContain('toggle.checked = false');
    expect((renderer.match(/resetInternationalTransportForm\(\);/g) || []).length).toBeGreaterThanOrEqual(5);
  });

  test('does not render route fields or send route data', () => {
    for (const id of ['internationalTransportRoute', 'transportOriginCountry', 'transportOrigin', 'transportDestinationCountry', 'transportDestination', 'shipmentReference']) {
      expect(html).not.toContain(`id="${id}"`);
      expect(renderer).not.toContain(`getElementById('${id}')`);
    }

    const payloadStart = renderer.indexOf('function internationalTransportPayload()');
    const payloadEnd = renderer.indexOf('\n}\n\nfunction validateInternationalTransportForm', payloadStart) + 2;
    const payloadFunction = renderer.slice(payloadStart, payloadEnd);
    expect(payloadFunction).toContain('tax_treatment: selectedTaxTreatment()');
    expect(payloadFunction).not.toContain('transport:');
  });

  test('renders one compact checkbox beside the add-customer button instead of a treatment dropdown', () => {
    const customerButtonStart = html.indexOf('id="btnAddCustomer"');
    const customerRowEnd = html.indexOf('</div>', customerButtonStart);
    const toggleStart = html.indexOf('id="internationalTransportToggleContainer"');

    expect(customerButtonStart).toBeGreaterThan(-1);
    expect(toggleStart).toBeGreaterThan(customerButtonStart);
    expect(toggleStart).toBeLessThan(customerRowEnd);
    expect(html).toContain('id="internationalTransportToggle"');
    expect(html).toContain('\u0646\u0642\u0644 \u062f\u0648\u0644\u064a 0%');
    expect(html).not.toContain('id="taxTreatment"');
    expect(html).not.toContain('<select id="taxTreatment"');
  });

  test('derives treatment from checkbox state and only recomputes totals on change', () => {
    expect(renderer).toContain("document.getElementById('internationalTransportToggle')?.checked");
    expect(renderer).toContain("document.getElementById('internationalTransportToggle')?.addEventListener('change', syncInternationalTransportUi)");
    expect(renderer).not.toContain("document.getElementById('internationalTransportRoute')");
    expect(renderer).toContain('scheduleComputeTotals();');
  });

  test('copies product international-transport eligibility into every new cart item', () => {
    const addToCartStart = renderer.indexOf('async function addToCart(p)');
    const scanStart = renderer.indexOf('async function __doScanCode(code)');
    const addToCartSource = renderer.slice(addToCartStart, scanStart);
    const scanEnd = renderer.indexOf('async function __processScanQueue()', scanStart);
    const scanSource = renderer.slice(scanStart, scanEnd);

    expect(renderer).toContain('function internationalTransportProductFlag(product)');
    expect(addToCartSource).toContain('is_international_transport_service: internationalTransportProductFlag(p)');
    expect((scanSource.match(/is_international_transport_service: internationalTransportProductFlag\(p\)/g) || []).length).toBe(2);
  });
});
