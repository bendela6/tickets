import { DEFAULT_CONFIG } from './config';
import { fetchConfig } from './api';

test('fetchConfig returns the served config', async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => DEFAULT_CONFIG,
  });
  vi.stubGlobal('fetch', fetchMock);

  await expect(fetchConfig()).resolves.toEqual(DEFAULT_CONFIG);
  // `json()` forwards its optional init, so the call carries a second
  // `undefined` argument — assert the real call, not a tidier one.
  expect(fetchMock).toHaveBeenCalledWith('/__icons/config', undefined);

  vi.unstubAllGlobals();
});

test('fetchConfig throws when the endpoint is unavailable', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403 }));
  await expect(fetchConfig()).rejects.toThrow(/403/);
  vi.unstubAllGlobals();
});

test('json() surfaces server error messages when present', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: false,
    status: 400,
    json: async () => ({ error: 'body.config.chip must be a 6-digit hex color' }),
  }));
  await expect(fetchConfig()).rejects.toThrow('body.config.chip must be a 6-digit hex color');
  vi.unstubAllGlobals();
});

test('json() handles invalid JSON body gracefully', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: false,
    status: 500,
    json: async () => {
      throw new Error('invalid json');
    },
  }));
  await expect(fetchConfig()).rejects.toThrow(/500/);
  vi.unstubAllGlobals();
});

test('json() falls back to status message when error field is missing', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: false,
    status: 400,
    json: async () => ({ message: 'some other field' }),
  }));
  await expect(fetchConfig()).rejects.toThrow('/__icons/config (400)');
  vi.unstubAllGlobals();
});
