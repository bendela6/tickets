import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { resetDb, testDb } from '../test/db';
import { buildApp } from '../app';

beforeEach(resetDb);
afterAll(resetDb);

describe('attachments routes', () => {
  it('uploads an image and serves it back', async () => {
    const app = buildApp({ db: testDb });
    const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47]); // PNG magic
    const upload = await app.inject({
      method: 'POST',
      url: '/api/attachments',
      headers: { 'content-type': 'image/png', 'x-filename': encodeURIComponent('shot.png') },
      payload: bytes,
    });
    expect(upload.statusCode).toBe(201);
    const { id, url } = upload.json() as { id: number; url: string };
    expect(url).toBe(`/api/attachments/${id}`);

    const download = await app.inject({ method: 'GET', url });
    expect(download.statusCode).toBe(200);
    expect(download.headers['content-type']).toBe('image/png');
    expect(download.headers['cache-control']).toContain('immutable');
    expect(download.rawPayload.equals(bytes)).toBe(true);
    await app.close();
  });

  it('rejects non-image content types and 404s unknown ids', async () => {
    const app = buildApp({ db: testDb });
    const bad = await app.inject({
      method: 'POST',
      url: '/api/attachments',
      headers: { 'content-type': 'application/pdf' },
      payload: Buffer.from('x'),
    });
    expect(bad.statusCode).toBe(415);
    const missing = await app.inject({ method: 'GET', url: '/api/attachments/999999' });
    expect(missing.statusCode).toBe(404);
    await app.close();
  });
});
