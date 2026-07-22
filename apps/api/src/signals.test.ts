import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const ensureAppDsnMock = vi.fn();
const initSignalsMock = vi.fn();

vi.mock('@bendela6/signals-node', () => ({
  ensureAppDsn: (...args: unknown[]) => ensureAppDsnMock(...args),
  initSignals: (...args: unknown[]) => initSignalsMock(...args),
}));

import { environment } from './environment';
import { initApiSignals } from './signals';

const originalEnv = { ...environment };

beforeEach(() => {
  ensureAppDsnMock.mockReset();
  initSignalsMock.mockReset();
  Object.assign(environment, originalEnv);
});

afterEach(() => {
  Object.assign(environment, originalEnv);
});

it('returns null without calling the SDK when SIGNALS_DISABLED', async () => {
  environment.signalsDisabled = true;
  const result = await initApiSignals();
  expect(result).toBeNull();
  expect(ensureAppDsnMock).not.toHaveBeenCalled();
  expect(initSignalsMock).not.toHaveBeenCalled();
});

it('uses SIGNALS_DSN directly when set, skipping ensureAppDsn', async () => {
  environment.signalsDsn = 'sgl://k@127.0.0.1:4640/1';
  initSignalsMock.mockReturnValue({ fake: 'client' });
  const result = await initApiSignals();
  expect(ensureAppDsnMock).not.toHaveBeenCalled();
  expect(initSignalsMock).toHaveBeenCalledWith({
    dsn: 'sgl://k@127.0.0.1:4640/1',
    environment: environment.nodeEnv,
    exitOnUncaught: environment.nodeEnv === 'production',
    registerProcessHandlers: true,
  });
  expect(result).toEqual({ fake: 'client' });
});

it('falls back to ensureAppDsn using the configured collector url and name', async () => {
  ensureAppDsnMock.mockResolvedValue('sgl://k@127.0.0.1:4640/2');
  initSignalsMock.mockReturnValue({ fake: 'client2' });
  const result = await initApiSignals();
  expect(ensureAppDsnMock).toHaveBeenCalledWith({
    collectorUrl: environment.signalsCollectorUrl,
    name: 'Tickets API',
  });
  expect(initSignalsMock).toHaveBeenCalledWith(expect.objectContaining({ dsn: 'sgl://k@127.0.0.1:4640/2' }));
  expect(result).toEqual({ fake: 'client2' });
});

it('warns once and returns null when ensureAppDsn resolves no dsn', async () => {
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  ensureAppDsnMock.mockResolvedValue(null);
  const result = await initApiSignals();
  expect(result).toBeNull();
  expect(initSignalsMock).not.toHaveBeenCalled();
  expect(warnSpy).toHaveBeenCalledTimes(1);
  warnSpy.mockRestore();
});
