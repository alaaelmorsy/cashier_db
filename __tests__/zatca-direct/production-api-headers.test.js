'use strict';

const { ZatcaApiClient } = require('@talha7k/zatca');

test('production API requests use the uppercase Accept-Language required by ZATCA', async () => {
  const originalFetch = global.fetch;
  global.fetch = jest.fn(async () => ({
    status: 401,
    headers: { forEach: () => {} },
    text: async () => JSON.stringify({ errors: [{ message: 'Unauthorized' }] }),
  }));

  try {
    const client = new ZatcaApiClient({
      environment: 'production',
      productionUrl: 'https://gw-fatoora.zatca.gov.sa/e-invoicing/core',
    });
    await client.requestProductionCSID(
      { binarySecurityToken: 'invalid-token', secret: 'invalid-secret' },
      'invalid-request-id'
    );

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ 'Accept-Language': 'EN' }),
      })
    );
  } finally {
    global.fetch = originalFetch;
  }
});
