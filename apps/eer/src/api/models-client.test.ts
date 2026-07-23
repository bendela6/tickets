import { afterEach, describe, expect, it, vi } from 'vitest';
import { getModel, listModels, saveModel } from './models-client';

const { captureError, captureEvent } = vi.hoisted(() => ({ captureError: vi.fn(), captureEvent: vi.fn() }));
vi.mock('@bendela6/signals-react', () => ({ captureError, captureEvent }));

afterEach(() => {
  vi.unstubAllGlobals();
  captureError.mockClear();
  captureEvent.mockClear();
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

  it('emits eer.model.export with modelName on a successful saveModel', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));

    await expect(saveModel('m', {})).resolves.toBe(true);
    expect(captureEvent).toHaveBeenCalledWith('eer.model.export', { modelName: 'm' });
  });

  it('does NOT emit eer.model.export when saveModel fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    await expect(saveModel('m', {})).resolves.toBe(false);
    expect(captureEvent).not.toHaveBeenCalled();
  });

  it('emits eer.model.import with modelName on a successful getModel', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({ tables: [] }) }),
    );

    await expect(getModel('m')).resolves.toEqual({ tables: [] });
    expect(captureEvent).toHaveBeenCalledWith('eer.model.import', { modelName: 'm' });
  });

  it('does NOT emit eer.model.import when getModel fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 404, json: () => Promise.resolve({ error: 'not found' }) }),
    );

    await expect(getModel('m')).rejects.toThrow();
    expect(captureEvent).not.toHaveBeenCalled();
  });
});
