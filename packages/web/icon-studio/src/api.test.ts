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
