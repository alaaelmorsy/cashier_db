const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', 'src/main/products.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '..', 'src/renderer/products/index.html'), 'utf8');
const renderer = fs.readFileSync(path.join(__dirname, '..', 'src/renderer/products/renderer.js'), 'utf8');

describe('international transport product eligibility', () => {
  test('persists and returns eligibility independently from VAT exemption', () => {
    expect(source).toMatch(/INSERT INTO products[^`']*is_vat_exempt[^`']*is_international_transport_service/s);
    expect(source).toMatch(/UPDATE products SET[^`']*is_vat_exempt=\?[^`']*is_international_transport_service=\?/s);
    expect(source).toMatch(/SELECT[^`']*is_vat_exempt[^`']*is_international_transport_service[^`']*FROM products/s);
  });

  test('product form has separate eligibility guidance and renderer bindings', () => {
    expect(html).toContain('id="f_is_international_transport_service"');
    expect(html).toContain('خدمة نقل دولي');
    expect(renderer).toContain('f_is_international_transport_service');
    expect(renderer).toContain('is_international_transport_service:');
  });
});
