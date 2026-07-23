import { afterEach, describe, expect, it, vi } from 'vitest';
import { uploadImage } from './image-upload';

afterEach(() => vi.restoreAllMocks());

describe('uploadImage', () => {
  it('posts raw bytes with mime + filename headers and returns the url', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ id: 7, url: '/api/attachments/7' }), { status: 201 }),
    );
    const file = new File([new Uint8Array([1, 2])], 'shot.png', { type: 'image/png' });
    const result = await uploadImage(file);
    expect(result).toEqual({ id: 7, url: '/api/attachments/7' });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/attachments');
    expect((init!.headers as Record<string, string>)['content-type']).toBe('image/png');
    expect((init!.headers as Record<string, string>)['x-filename']).toBe('shot.png');
  });

  it('throws the API error message on failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'unsupported attachment type' }), { status: 415 }),
    );
    const file = new File([new Uint8Array([1])], 'x.pdf', { type: 'application/pdf' });
    await expect(uploadImage(file)).rejects.toThrow('unsupported attachment type');
  });
});
