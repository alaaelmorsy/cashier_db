'use strict';

const fs = require('fs');
const path = require('path');

const api = fs.readFileSync(path.resolve(__dirname, '../src/main/api-server.js'), 'utf8');
const main = fs.readFileSync(path.resolve(__dirname, '../src/main/main.js'), 'utf8');

describe('international transport device capability', () => {
  test('secondary sales init is read-only but includes product eligibility', () => {
    expect(api).toContain('settings.international_transport_zero_rate_can_mutate = false');
    expect(api).toContain('is_international_transport_service');
    expect(api).toContain("error: 'PRIMARY_DEVICE_REQUIRED'");
  });

  test('primary sales init exposes mutation capability and the same eligibility field', () => {
    expect(main).toContain('settings.international_transport_zero_rate_can_mutate = true');
    expect(main).toContain('is_international_transport_service');
  });
});
