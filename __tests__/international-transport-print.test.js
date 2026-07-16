const fs = require('fs');
const path = require('path');

const read = (name) => fs.readFileSync(path.join(__dirname, '..', 'src/renderer/sales', name), 'utf8');

describe.each(['print.html', 'print-a4.html'])('%s international transport output', (template) => {
  test('uses persisted treatment, zero VAT, and QR without route or tax-reason notes', () => {
    const html = read(template);

    expect(html).toContain("sale.tax_treatment === 'international_transport_zero_rate'");
    expect(html).not.toContain('sale.transport_origin');
    expect(html).not.toContain('sale.transport_destination');
    expect(html).not.toContain('sale.shipment_reference');
    expect(html).not.toContain('internationalTransportInfo');
    expect(html).not.toContain('sale.zero_rate_reason_code');
    expect(html).not.toContain('VATEX-SA-34-1');
    expect(html).not.toContain('settings.invoice_footer_note');
    expect(html).toContain('sale.zatca_qr');
    expect(html).toContain('sale.vat_total');
  });

  test('fails QR readiness instead of presenting Base64 text as a QR', () => {
    const html = read(template);

    expect(html).toContain('window.__QR_READY__ = false');
    expect(html).toContain('window.__QR_ERROR');
    expect(html).not.toContain("pre.textContent = 'ZATCA QR (Base64):");
  });

  test('uses the same readiness flag when QR generation succeeds and printing is checked', () => {
    const html = read(template);

    expect(html).toContain('window.__QR_READY__ = true');
    expect(html).toContain('window.__QR_READY__ !== true');
    expect(html).not.toMatch(/window\.__QR_READY(?!_)/);
  });
});

describe('print-a4.html international transport item totals', () => {
  test('keeps the detailed tax columns and prints net, 0%, zero VAT, and gross per item', () => {
    const html = read('print-a4.html');

    expect(html).toContain('const showDetailedTaxColumns = vatPercent > 0 || isInternationalZeroRate;');
    expect(html).toContain("itemsTable.classList.toggle('no-vat', !showDetailedTaxColumns);");
    expect(html).toContain('if(!showDetailedTaxColumns){');
    expect(html).toContain('if(showDetailedTaxColumns){');
    expect(html).toContain("(isInternationalZeroRate ? '0%' : '0')");
    expect(html).toContain('<td class="num">${fmt(displayNet)}</td>');
    expect(html).toContain('<td class="num">${fmt(vatAmt)}</td>');
    expect(html).toContain('<td class="num">${fmt(gross)}</td>');
  });

  test('does not print the general footer-notes box', () => {
    const html = read('print-a4.html');

    expect(html).not.toContain('generalNotesContainer');
    expect(html).not.toContain('generalNotesContent');
    expect(html).not.toContain('settings.invoice_footer_note');
  });
});
