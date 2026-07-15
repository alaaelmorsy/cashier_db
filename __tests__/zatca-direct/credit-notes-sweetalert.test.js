'use strict';

const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '../../src/renderer/credit_notes/index.html');
const rendererPath = path.join(__dirname, '../../src/renderer/credit_notes/renderer.js');

describe('credit notes SweetAlert2 notifications', () => {
  test('loads bundled SweetAlert2 and removes legacy notification containers', () => {
    const html = fs.readFileSync(htmlPath, 'utf8');

    expect(html).toMatch(/sweetalert2\.min\.css/);
    expect(html).toMatch(/sweetalert2\.all\.min\.js/);
    ['toast', 'error', 'zatcaModal', 'zatcaContent', 'zatcaClose']
      .forEach((id) => expect(html).not.toMatch(new RegExp(`id=["']${id}["']`)));
  });

  test('uses SweetAlert2 for loading, success, errors, and ZATCA response details', () => {
    const source = fs.readFileSync(rendererPath, 'utf8');

    expect(source).toMatch(/Swal\.fire/);
    expect(source).toMatch(/Swal\.showLoading\(\)/);
    expect(source).toMatch(/Swal\.close\(\)/);
    expect(source).not.toMatch(/\bshowToast\s*\(/);
    expect(source).not.toMatch(/\bsetError\s*\(/);
    expect(source).not.toMatch(/\b(?:alert|confirm)\s*\(/);
  });

  test('renders authority responses as text instead of injectable HTML', () => {
    const source = fs.readFileSync(rendererPath, 'utf8');

    expect(source).toMatch(/text:\s*formatZatcaResponse\(raw\)/);
    expect(source).not.toMatch(/html:\s*formatZatcaResponse\(raw\)/);
  });
});
