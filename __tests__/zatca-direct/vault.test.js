'use strict';

const vault = require('../../src/main/zatca/vault');

describe('zatca vault (AES-256-GCM)', () => {
  beforeEach(() => vault.setStoredKey('test-vault-key-1'));

  test('يشفر ويفك بنفس المفتاح المخزن', () => {
    const enc = vault.encryptSecret('سر ZATCA');
    expect(enc.split(':')).toHaveLength(3); // iv:tag:cipher
    expect(vault.decryptSecret(enc)).toBe('سر ZATCA');
  });

  test('كل تشفير يولد ناتجًا مختلفًا (IV عشوائي)', () => {
    expect(vault.encryptSecret('x')).not.toBe(vault.encryptSecret('x'));
  });

  test('مفتاح خاطئ يفشل الفك برسالة عربية', () => {
    const enc = vault.encryptSecret('secret');
    vault.setStoredKey('another-key');
    expect(() => vault.decryptSecret(enc)).toThrow(/تعذر فك تشفير/);
  });

  test('نص مشوه يرفض', () => {
    expect(() => vault.decryptSecret('abc')).toThrow(/غير صالحة/);
  });

  test('لا مفتاح إطلاقًا → خطأ واضح', () => {
    vault.setStoredKey(null);
    const oldEnv = process.env.ZATCA_SECRET_KEY;
    delete process.env.ZATCA_SECRET_KEY;
    try {
      expect(() => vault.encryptSecret('x')).toThrow(/مفتاح تشفير ZATCA غير متاح/);
    } finally {
      if (oldEnv) process.env.ZATCA_SECRET_KEY = oldEnv;
    }
  });
});
