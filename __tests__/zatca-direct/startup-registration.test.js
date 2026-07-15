'use strict';

const fs = require('fs');
const path = require('path');

test('يسجل قنوات الربط المباشر قبل إنشاء النافذة الرئيسية', () => {
  const mainSource = fs.readFileSync(path.join(__dirname, '../../src/main/main.js'), 'utf8');
  const readyBlock = mainSource.slice(mainSource.indexOf('app.whenReady().then'));

  expect(readyBlock.indexOf('registerZatcaDirectIPC()')).toBeGreaterThan(-1);
  expect(readyBlock.indexOf('registerZatcaDirectIPC()')).toBeLessThan(readyBlock.indexOf('createMainWindow()'));
});
