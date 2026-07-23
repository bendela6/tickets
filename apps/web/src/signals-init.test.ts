import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const ensureAppDsnMock = vi.fn();
const initSignalsMock = vi.fn();
const captureEventMock = vi.fn();

vi.mock('@bendela6/signals-react', () => ({
  ensureAppDsn: (...args: unknown[]) => ensureAppDsnMock(...args),
  initSignals: (...args: unknown[]) => initSignalsMock(...args),
  captureEvent: (...args: unknown[]) => captureEventMock(...args),
}));

// `initWebSignals` guards `web.mount` with module-level state so it only
// fires once per page load. Re-import the module fresh (via resetModules)
// in every test so that guard doesn't leak across otherwise-independent
// test cases.
async function importInitWebSignals() {
  const mod = await import('./signals-init');
  return mod.initWebSignals;
}

beforeEach(() => {
  vi.resetModules();
  ensureAppDsnMock.mockReset();
  initSignalsMock.mockReset();
  captureEventMock.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

it('does nothing when VITE_SIGNALS_DISABLED=1 (no ensureAppDsn, no initSignals, no captureEvent)', async () => {
  vi.stubEnv('VITE_SIGNALS_DISABLED', '1');
  const initWebSignals = await importInitWebSignals();
  await initWebSignals();
  expect(ensureAppDsnMock).not.toHaveBeenCalled();
  expect(initSignalsMock).not.toHaveBeenCalled();
  expect(captureEventMock).not.toHaveBeenCalled();
});

it('uses VITE_SIGNALS_DSN directly when set, skipping ensureAppDsn', async () => {
  vi.stubEnv('VITE_SIGNALS_DSN', 'sgl://k@127.0.0.1:4640/1');
  const initWebSignals = await importInitWebSignals();
  await initWebSignals();
  expect(ensureAppDsnMock).not.toHaveBeenCalled();
  expect(initSignalsMock).toHaveBeenCalledWith({
    dsn: 'sgl://k@127.0.0.1:4640/1',
    environment: import.meta.env.MODE,
    captureConsole: true,
    logLevel: 'warning',
  });
});

it('passes VITE_SIGNALS_LOG_LEVEL through as logLevel when set', async () => {
  vi.stubEnv('VITE_SIGNALS_DSN', 'sgl://k@127.0.0.1:4640/1');
  vi.stubEnv('VITE_SIGNALS_LOG_LEVEL', 'info');
  const initWebSignals = await importInitWebSignals();
  await initWebSignals();
  expect(initSignalsMock).toHaveBeenCalledWith(
    expect.objectContaining({ captureConsole: true, logLevel: 'info' }),
  );
});

it('falls back to ensureAppDsn({ name: "Tickets Web" }) and initializes with the resolved DSN', async () => {
  ensureAppDsnMock.mockResolvedValue('sgl://k@127.0.0.1:4640/2');
  const initWebSignals = await importInitWebSignals();
  await initWebSignals();
  expect(ensureAppDsnMock).toHaveBeenCalledWith({ name: 'Tickets Web' });
  expect(initSignalsMock).toHaveBeenCalledWith(
    expect.objectContaining({ dsn: 'sgl://k@127.0.0.1:4640/2', captureConsole: true }),
  );
});

it('warns once and skips initSignals and captureEvent when ensureAppDsn resolves no dsn', async () => {
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  ensureAppDsnMock.mockResolvedValue(null);
  const initWebSignals = await importInitWebSignals();
  await initWebSignals();
  expect(initSignalsMock).not.toHaveBeenCalled();
  expect(captureEventMock).not.toHaveBeenCalled();
  expect(warnSpy).toHaveBeenCalledTimes(1);
  warnSpy.mockRestore();
});

it('emits captureEvent("web.mount") exactly once after a successful init', async () => {
  vi.stubEnv('VITE_SIGNALS_DSN', 'sgl://k@127.0.0.1:4640/1');
  const initWebSignals = await importInitWebSignals();
  await initWebSignals();
  expect(captureEventMock).toHaveBeenCalledTimes(1);
  expect(captureEventMock).toHaveBeenCalledWith('web.mount');
});

it('does not re-emit captureEvent("web.mount") on a second call to initWebSignals (guarded)', async () => {
  vi.stubEnv('VITE_SIGNALS_DSN', 'sgl://k@127.0.0.1:4640/1');
  const initWebSignals = await importInitWebSignals();
  await initWebSignals();
  await initWebSignals();
  const mountCalls = captureEventMock.mock.calls.filter(([name]) => name === 'web.mount');
  expect(mountCalls).toHaveLength(1);
});
