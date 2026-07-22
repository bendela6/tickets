import { afterEach, describe, expect, it, vi } from 'vitest';
import { listModels, saveModel } from './models-client';

const { captureError } = vi.hoisted(() => ({ captureError: vi.fn() }));
vi.mock('@bendela6/signals-react', () => ({ captureError }));

afterEach(() => {
  vi.unstubAllGlobals();
  captureError.mockClear();
});

describe('models-client capture', () => {
  it('captures a network failure and degrades to null', async () => {
    const networkError = new TypeError('Failed to fetch');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(networkError));

    await expect(listModels()).resolves.toBeNull();
    expect(captureError).toHaveBeenCalledTimes(1);
    expect(captureError).toHaveBeenCalledWith(
      networkError,
      { mechanism: 'manual', contexts: { http: { url: '/api/models' } } },
    );
  });

  it('captures a 5xx response and degrades to null', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));

    await expect(listModels()).resolves.toBeNull();
    expect(captureError).toHaveBeenCalledTimes(1);
    expect(captureError).toHaveBeenCalledWith(
      expect.any(Error),
      { mechanism: 'manual', contexts: { http: { url: '/api/models', status: 503 } } },
    );
  });

  it('does NOT capture an expected 404 (dev API absent / not found)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));

    await expect(listModels()).resolves.toBeNull();
    expect(captureError).not.toHaveBeenCalled();
  });

  it('captures a 5xx on saveModel and returns false', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    await expect(saveModel('m', {})).resolves.toBe(false);
    expect(captureError).toHaveBeenCalledTimes(1);
    expect(captureError).toHaveBeenCalledWith(
      expect.any(Error),
      { mechanism: 'manual', contexts: { http: { url: '/api/models/m', status: 500 } } },
    );
  });

  it('does NOT capture a 4xx on saveModel', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));

    await expect(saveModel('m', {})).resolves.toBe(false);
    expect(captureError).not.toHaveBeenCalled();
  });
});
