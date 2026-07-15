'use strict';

jest.useFakeTimers();

const mockGetMode = jest.fn(async () => 'direct');
const mockRetryUnsent = jest.fn(async () => ({ outcomes: [] }));

jest.mock('../../src/main/zatca/router', () => ({
  getMode: mockGetMode,
  retryUnsent: mockRetryUnsent,
}));
jest.mock('../../src/main/local-zatca', () => ({ getInstance: jest.fn() }));
jest.mock('../../src/db/db-adapter', () => ({ dbAdapter: {}, DB_NAME: 'test' }));
jest.mock('../../src/main/backup', () => ({ emailDbBackup: jest.fn(), writeDbBackupToDir: jest.fn() }));
jest.mock('electron', () => ({ app: {}, BrowserWindow: {}, ipcMain: {} }));

const { submitUnsentInvoicesHourly, stopUnsentInvoicesScheduler } = require('../../src/main/scheduler');

describe('ZATCA unsent invoice scheduler', () => {
  afterEach(() => {
    stopUnsentInvoicesScheduler();
    jest.clearAllTimers();
    jest.clearAllMocks();
  });

  test('يفحص فور تشغيله ثم كل 15 دقيقة', async () => {
    submitUnsentInvoicesHourly();
    await Promise.resolve();
    await Promise.resolve();

    expect(mockRetryUnsent).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(15 * 60 * 1000);
    expect(mockRetryUnsent).toHaveBeenCalledTimes(2);
  });
});
