const { createSenderSessionStore } = require('../src/main/auth-session');

describe('trusted Electron sender sessions', () => {
  test('keeps authenticated users isolated by webContents sender id', () => {
    const sessions = createSenderSessionStore();

    sessions.bind(11, { id: 1, username: 'admin', full_name: 'Admin', role: 'admin' });
    sessions.bind(22, { id: 2, username: 'cashier', full_name: 'Cashier', role: 'cashier' });

    expect(sessions.current(11)).toEqual({
      id: 1,
      username: 'admin',
      full_name: 'Admin',
      role: 'admin',
    });
    expect(sessions.current(22).id).toBe(2);
  });

  test('returns defensive copies so renderer-bound data cannot mutate the session', () => {
    const sessions = createSenderSessionStore();
    const user = { id: 7, username: 'operator', full_name: 'Operator', role: 'user' };

    sessions.bind(31, user);
    user.role = 'admin';
    const exposed = sessions.current(31);
    exposed.role = 'admin';

    expect(sessions.current(31).role).toBe('user');
  });

  test('clears only the sender that logs out or is destroyed', () => {
    const sessions = createSenderSessionStore();
    sessions.bind(41, { id: 1, username: 'one', role: 'user' });
    sessions.bind(42, { id: 2, username: 'two', role: 'user' });

    sessions.clear(41);

    expect(sessions.current(41)).toBeNull();
    expect(sessions.current(42).id).toBe(2);
  });

  test('rejects malformed sender ids and users', () => {
    const sessions = createSenderSessionStore();

    expect(() => sessions.bind(null, { id: 1, username: 'admin', role: 'admin' }))
      .toThrow('Valid sender id is required');
    expect(() => sessions.bind(1, { username: 'admin', role: 'admin' }))
      .toThrow('Valid authenticated user is required');
  });
});
