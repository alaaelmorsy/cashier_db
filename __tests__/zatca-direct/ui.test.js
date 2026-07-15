'use strict';

const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '../../src/renderer/zatca/direct/index.html');
const jsPath = path.join(__dirname, '../../src/renderer/zatca/direct/renderer.js');
const invoicesHtmlPath = path.join(__dirname, '../../src/renderer/invoices/index.html');
const invoicesJsPath = path.join(__dirname, '../../src/renderer/invoices/renderer.js');

describe('ZATCA direct professional screen', () => {
  test('loads bundled SweetAlert2 assets and preserves access to the legacy screen', () => {
    const html = fs.readFileSync(htmlPath, 'utf8');
    expect(html).toMatch(/sweetalert2\.min\.css/);
    expect(html).toMatch(/sweetalert2\.all\.min\.js/);
    expect(html).toMatch(/id=["']btnOpenLegacyScreen["']/);
    expect(html).toMatch(/id=["']btnUseLegacy["']/);
  });

  test('uses SweetAlert2 for ZATCA notifications and confirmations', () => {
    const js = fs.readFileSync(jsPath, 'utf8');
    expect(js).toMatch(/Swal\.fire/);
    expect(js).not.toMatch(/\bconfirm\s*\(/);
    expect(js).not.toMatch(/\balert\s*\(/);
  });

  test('does not show status notices, dashboard, or resend tools', () => {
    const html = fs.readFileSync(htmlPath, 'utf8');
    const js = fs.readFileSync(jsPath, 'utf8');

    ['legacyWarning', 'useDirectHint', 'statusCard', 'certAlert', 'btnRefresh', 'btnRetry']
      .forEach((id) => expect(html).not.toMatch(new RegExp(`id=["']${id}["']`)));
    expect(js).not.toMatch(/retryUnsent/);
  });

  test('does not interpolate API error messages into HTML', () => {
    const js = fs.readFileSync(jsPath, 'utf8');
    expect(js).not.toMatch(/innerHTML\s*=.*(?:e|error)\.message/);
  });

  test('summarizes successful compliance checks and reports failures through notifications', () => {
    const js = fs.readFileSync(jsPath, 'utf8');

    expect(js).toMatch(/successLine\.textContent\s*=\s*['"]تم['"]/);
    expect(js).not.toMatch(/\(res\.checks\s*\|\|\s*\[\]\)\.forEach/);
    expect(js).toMatch(/catch\s*\(e\)[\s\S]*?box\.classList\.add\(['"]hidden['"]\)[\s\S]*?notify\(e\.message,\s*false\)/);
  });
});

describe('manual invoice submission notification', () => {
  test('loads bundled SweetAlert2 and uses it after a successful manual submission', () => {
    const html = fs.readFileSync(invoicesHtmlPath, 'utf8');
    const js = fs.readFileSync(invoicesJsPath, 'utf8');

    expect(html).toMatch(/sweetalert2\.min\.css/);
    expect(html).toMatch(/sweetalert2\.all\.min\.js/);
    expect(js).toMatch(/Swal\.fire\s*\(\s*\{[\s\S]*?icon:\s*['"]success['"]/);
  });

  test('refreshes invoice statuses after an automatic ZATCA status change', () => {
    const js = fs.readFileSync(invoicesJsPath, 'utf8');

    expect(js).toMatch(/on_sales_changed/);
    expect(js).toMatch(/zatca_status_changed/);
  });
});
