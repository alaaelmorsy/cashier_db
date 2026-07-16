const {
  createInternationalTransportSettingService,
  SETTING_KEY,
  SETTING_ERRORS,
} = require('../src/main/international-transport-settings');

function connectionWithCurrent(value) {
  return {
    beginTransaction: jest.fn(),
    commit: jest.fn(),
    rollback: jest.fn(),
    release: jest.fn(),
    query: jest.fn()
      .mockResolvedValueOnce([[{ international_transport_zero_rate_enabled: value }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ insertId: 9 }]),
  };
}

function service(overrides = {}) {
  return createInternationalTransportSettingService({
    isSecondaryDevice: () => false,
    authenticatedUserForEvent: () => ({ id: 4, username: 'admin', full_name: 'مدير', role: 'admin' }),
    assertPermission: jest.fn().mockResolvedValue(undefined),
    getConnection: jest.fn(),
    broadcast: jest.fn(),
    logger: { error: jest.fn() },
    ...overrides,
  });
}

describe('international transport setting mutation', () => {
  test('rejects mutations on secondary devices before opening a connection', async () => {
    const getConnection = jest.fn();
    const result = await service({ isSecondaryDevice: () => true, getConnection }).set({}, true);

    expect(result).toEqual({ ok: false, error: SETTING_ERRORS.PRIMARY_REQUIRED });
    expect(getConnection).not.toHaveBeenCalled();
  });

  test('requires a sender-bound authenticated actor and settings permission', async () => {
    const missing = await service({ authenticatedUserForEvent: () => null }).set({}, true);
    expect(missing).toEqual({ ok: false, error: SETTING_ERRORS.AUTH_REQUIRED });

    const forbiddenError = Object.assign(new Error('forbidden'), { code: 'FORBIDDEN' });
    const forbidden = await service({
      assertPermission: jest.fn().mockRejectedValue(forbiddenError),
    }).set({}, true);
    expect(forbidden).toEqual({ ok: false, error: SETTING_ERRORS.FORBIDDEN });
  });

  test('does not write an audit row or broadcast for a no-op', async () => {
    const conn = connectionWithCurrent(1);
    const broadcast = jest.fn();
    const result = await service({ getConnection: async () => conn, broadcast }).set({}, true);

    expect(result).toEqual({ ok: true, changed: false, enabled: true });
    expect(conn.query).toHaveBeenCalledTimes(1);
    expect(conn.commit).toHaveBeenCalledTimes(1);
    expect(broadcast).not.toHaveBeenCalled();
  });

  test('atomically updates and audits one actual transition before broadcasting', async () => {
    const conn = connectionWithCurrent(0);
    const broadcast = jest.fn();
    const result = await service({ getConnection: async () => conn, broadcast }).set({ sender: { id: 8 } }, true);

    expect(result).toEqual({ ok: true, changed: true, enabled: true });
    expect(conn.beginTransaction).toHaveBeenCalledTimes(1);
    expect(conn.query.mock.calls[1]).toEqual([
      'UPDATE app_settings SET international_transport_zero_rate_enabled=? WHERE id=1',
      [1],
    ]);
    expect(conn.query.mock.calls[2][0]).toContain('INSERT INTO settings_audit_log');
    expect(conn.query.mock.calls[2][1]).toEqual([SETTING_KEY, '0', '1', 4, 'مدير']);
    expect(conn.commit).toHaveBeenCalledTimes(1);
    expect(broadcast).toHaveBeenCalledWith({
      international_transport_zero_rate_enabled: true,
    });
    expect(conn.commit.mock.invocationCallOrder[0]).toBeLessThan(broadcast.mock.invocationCallOrder[0]);
  });

  test('rolls back and never broadcasts when persistence fails', async () => {
    const conn = connectionWithCurrent(0);
    conn.query.mockReset().mockRejectedValueOnce(new Error('database unavailable'));
    const broadcast = jest.fn();
    const result = await service({ getConnection: async () => conn, broadcast }).set({}, true);

    expect(result).toEqual({ ok: false, error: SETTING_ERRORS.SAVE_FAILED });
    expect(conn.rollback).toHaveBeenCalledTimes(1);
    expect(broadcast).not.toHaveBeenCalled();
    expect(conn.release).toHaveBeenCalledTimes(1);
  });
});
