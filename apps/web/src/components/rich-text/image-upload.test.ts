import { afterEach, describe, expect, it, vi } from 'vitest';
import { FakeXHR } from './test-fake-xhr';
import { uploadImage } from './image-upload';

afterEach(() => {
  vi.unstubAllGlobals();
  FakeXHR.reset();
});

describe('uploadImage', () => {
  it('posts raw bytes with mime + filename headers and returns the url', async () => {
    vi.stubGlobal('XMLHttpRequest', FakeXHR);
    const file = new File([new Uint8Array([1, 2])], 'shot.png', { type: 'image/png' });

    const pending = uploadImage(file);
    const xhr = FakeXHR.last();
    expect(xhr.method).toBe('POST');
    expect(xhr.url).toBe('/api/attachments');
    expect(xhr.headers['content-type']).toBe('image/png');
    expect(xhr.headers['x-filename']).toBe('shot.png');

    xhr.respond(201, { id: 7, url: '/api/attachments/7' });
    await expect(pending).resolves.toEqual({ id: 7, url: '/api/attachments/7' });
  });

  it('throws the API error message on failure', async () => {
    vi.stubGlobal('XMLHttpRequest', FakeXHR);
    const file = new File([new Uint8Array([1])], 'x.pdf', { type: 'application/pdf' });

    const pending = uploadImage(file);
    FakeXHR.last().respond(415, { error: 'unsupported attachment type' });

    await expect(pending).rejects.toThrow('unsupported attachment type');
  });

  it('reports upload progress via onProgress as bytes are sent', () => {
    vi.stubGlobal('XMLHttpRequest', FakeXHR);
    const file = new File([new Uint8Array([1, 2, 3, 4])], 'shot.png', { type: 'image/png' });
    const onProgress = vi.fn();

    void uploadImage(file, onProgress);
    FakeXHR.last().progress(2, 4);
    FakeXHR.last().progress(4, 4);

    expect(onProgress).toHaveBeenNthCalledWith(1, 2, 4);
    expect(onProgress).toHaveBeenNthCalledWith(2, 4, 4);
  });
});
