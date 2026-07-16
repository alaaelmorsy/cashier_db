const fs = require('fs');
const path = require('path');

function source(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

describe('international transport schema contracts', () => {
  test('settings schema is default-off and audit-compatible', () => {
    const settingsSource = source('src/main/settings.js');
    expect(settingsSource).toContain('international_transport_zero_rate_enabled TINYINT NOT NULL DEFAULT 0');
    expect(settingsSource).toContain('CREATE TABLE IF NOT EXISTS settings_audit_log');
    expect(settingsSource).toContain('created_by_user_id INT NULL');
    expect(settingsSource).toContain('FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL');
  });

  test('products schema keeps international eligibility separate from VAT exemption', () => {
    const productsSource = source('src/main/products.js');
    expect(productsSource).toContain('is_international_transport_service TINYINT NOT NULL DEFAULT 0');
    expect(productsSource).toContain("SHOW COLUMNS FROM products LIKE 'is_international_transport_service'");
  });

  test('sales schema stores an enum treatment and immutable route snapshots', () => {
    const salesSource = source('src/main/sales.js');
    expect(salesSource).toContain("tax_treatment ENUM('standard','international_transport_zero_rate') NOT NULL DEFAULT 'standard'");
    expect(salesSource).not.toContain('transport_origin_country_code CHAR(2) NULL');
    expect(salesSource).toContain('is_international_transport_service_snapshot TINYINT NOT NULL DEFAULT 0');
    expect(salesSource).toContain('CREATE INDEX idx_tax_treatment_created_at ON sales(tax_treatment, created_at)');
  });
});
