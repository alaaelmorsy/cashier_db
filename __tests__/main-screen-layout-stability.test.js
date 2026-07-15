const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');

describe('Main screen layout stability', () => {
  test('shows a meaningful loader while the cards are hidden', () => {
    const html = fs.readFileSync(
      path.join(projectRoot, 'src/renderer/main/index.html'),
      'utf8'
    );

    expect(html).toMatch(/<body[^>]*class="[^"]*main-screen-loading/);
    expect(html).toMatch(/id="mainScreenLoader"[^>]*role="status"/);
    expect(html).toContain('جاري تجهيز الشاشة الرئيسية');
    expect(html).toMatch(/\.main-screen-loading > :not\(#mainScreenLoader\)/);
  });

  test('uses cached permissions and card settings on return navigation', () => {
    const renderer = fs.readFileSync(
      path.join(projectRoot, 'src/renderer/main/renderer.js'),
      'utf8'
    );

    expect(renderer).toContain("localStorage.getItem('pos_perms')");
    expect(renderer).toContain("const MAIN_CARD_SETTINGS_CACHE_KEY = 'pos_main_card_settings'");
    expect(renderer).toContain('localStorage.getItem(MAIN_CARD_SETTINGS_CACHE_KEY)');
    expect(renderer).toMatch(/if \(cachedState\)[\s\S]*applyCardVisibility/);
  });

  test('waits for permissions, settings, and saved zoom before revealing', () => {
    const renderer = fs.readFileSync(
      path.join(projectRoot, 'src/renderer/main/renderer.js'),
      'utf8'
    );

    expect(renderer).toMatch(/await Promise\.all\(\[\s*refreshMainCardVisibility\(\),\s*window\.api\.zoom_ready\(\)/);
    expect(renderer).toMatch(/classList\.remove\('main-screen-loading'\)/);
    expect(renderer).toMatch(/if \(mainScreenReady\) refreshMainCardVisibility\(\)/);
  });

  test('requires both permission and enabled setting for configurable cards', () => {
    const { visibleCardIds } = require('../src/renderer/main/card-visibility');

    const visibleCards = visibleCardIds(
      ['appointments', 'shifts'],
      { show_appointments: false, show_shifts: true }
    );

    expect(visibleCards.has('cardAppointments')).toBe(false);
    expect(visibleCards.has('cardShifts')).toBe(true);
  });

  test('never lets settings reveal a card denied by permissions', () => {
    const { visibleCardIds } = require('../src/renderer/main/card-visibility');

    const visibleCards = visibleCardIds([], {
      show_appointments: true,
      show_shifts: true
    });

    expect(visibleCards.has('cardAppointments')).toBe(false);
    expect(visibleCards.has('cardShifts')).toBe(false);
  });
});
