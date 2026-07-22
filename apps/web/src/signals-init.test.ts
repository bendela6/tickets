import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const ensureAppDsnMock = vi.fn();
const initSignalsMock = vi.fn();

vi.mock('@bendela6/signals-react', () => ({
  ensureAppDsn: (...args: unknown[]) => ensureAppDsnMock(...args),
  initSignals: (...args: unknown[]) => initSignalsMock(...args),
}));

import { initWebSignals } from './signals-init';

beforeEach(() => {
  ensureAppDsnMock.mockReset();
  initSignalsMock.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

it('does nothing when VITE_SIGNALS_DISABLED=1 (no ensureAppDsn, no initSignals)', async () => {
  vi.stubEnv('VITE_SIGNALS_DISABLED', '1');
  await initWebSignals();
  expect(ensureAppDsnMock).not.toHaveBeenCalled();
  expect(initSignalsMock).not.toHaveBeenCalled();
});

it('uses VITE_SIGNALS_DSN directly when set, skipping ensureAppDsn', async () => {
  vi.stubEnv('VITE_SIGNALS_DSN', 'sgl://k@127.0.0.1:4640/1');
  await initWebSignals();
  expect(ensureAppDsnMock).not.toHaveBeenCalled();
  expect(initSignalsMock).toHaveBeenCalledWith({
    dsn: 'sgl://k@127.0.0.1:4640/1',
    environment: import.meta.env.MODE,
  });
});

it('falls back to ensureAppDsn({ name: "Tickets Web" }) and initializes with the resolved DSN', async () => {
  ensureAppDsnMock.mockResolvedValue('sgl://k@127.0.0.1:4640/2');
  await initWebSignals();
  expect(ensureAppDsnMock).toHaveBeenCalledWith({ name: 'Tickets Web' });
  expect(initSignalsMock).toHaveBeenCalledWith(
    expect.objectContaining({ dsn: 'sgl://k@127.0.0.1:4640/2' }),
  );
});

it('warns once and skips initSignals when ensureAppDsn resolves no dsn', async () => {
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  ensureAppDsnMock.mockResolvedValue(null);
  await initWebSignals();
  expect(initSignalsMock).not.toHaveBeenCalled();
  expect(warnSpy).toHaveBeenCalledTimes(1);
  warnSpy.mockRestore();
});
