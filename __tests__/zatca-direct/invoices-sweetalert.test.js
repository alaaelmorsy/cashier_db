const fs = require('fs');
const path = require('path');

const invoiceScreenPath = path.join(__dirname, '../../src/renderer/invoices');
const html = fs.readFileSync(path.join(invoiceScreenPath, 'index.html'), 'utf8');
const script = fs.readFileSync(path.join(invoiceScreenPath, 'renderer.js'), 'utf8');

describe('Invoices SweetAlert2 notifications', () => {
  test('loads the bundled SweetAlert2 assets', () => {
    expect(html).toContain('../vendor/sweetalert2/sweetalert2.min.css');
    expect(html).toContain('../vendor/sweetalert2/sweetalert2.all.min.js');
  });

  test('removes legacy notification containers and custom ZATCA dialogs', () => {
    ['error', 'empToast', 'empEditError', 'zatcaModal', 'zatcaContent', 'zatcaClose', 'failedZatcaModal']
      .forEach(id => expect(html).not.toContain(`id="${id}"`));
  });

  test('uses SweetAlert2 for loading, results, and ZATCA response details', () => {
    expect(script).toContain('window.Swal.fire');
    expect(script).toContain('window.Swal.showLoading');
    expect(script).toContain('window.Swal.close');
    expect(script).toContain('text: formatZatcaResponse(rawResponse)');
  });

  test('does not retain legacy or native notification functions', () => {
    expect(script).not.toMatch(/\bsetError\s*\(/);
    expect(script).not.toMatch(/\bshowEmpToast\s*\(/);
    expect(script).not.toMatch(/\bshowZatcaResponseModal\s*\(/);
    expect(script).not.toMatch(/\balert\s*\(/);
    expect(script).not.toMatch(/\bconfirm\s*\(/);
  });
});
