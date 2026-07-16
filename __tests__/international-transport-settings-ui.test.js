const fs = require('fs');
const path = require('path');

const read = (relativePath) => fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');

describe('international transport settings and sales controls', () => {
  test('settings contains an Arabic RTL zero-rate control that distinguishes zero-rated from exempt', () => {
    const html = read('src/renderer/settings/index.html');

    expect(html).toContain('id="internationalTransportSetting"');
    expect(html).toContain('id="f_international_transport_zero_rate"');
    expect(html).toContain('خاضعة لنسبة صفر');
    expect(html).toContain('وليست معفاة');
  });

  test('settings renderer uses the dedicated IPC and honors mutation capability', () => {
    const source = read('src/renderer/settings/renderer.js');

    expect(source).toContain('international_transport_zero_rate_can_mutate');
    expect(source).toContain('settings_set_international_transport_zero_rate');
  });

  test('sales markup uses only a compact treatment checkbox', () => {
    const html = read('src/renderer/sales/index.html');

    expect(html).toContain('id="internationalTransportToggle"');
    expect(html).toContain('id="internationalTransportToggleContainer"');
    expect(html).toContain('\u0646\u0642\u0644 \u062f\u0648\u0644\u064a 0%');
    expect(html).not.toContain('id="taxTreatment"');
    expect(html).not.toContain('id="internationalTransportRoute"');
    expect(html).not.toContain('id="transportOriginCountry"');
    expect(html).not.toContain('id="transportDestinationCountry"');
    expect(html).not.toContain('id="shipmentReference"');
  });
});
