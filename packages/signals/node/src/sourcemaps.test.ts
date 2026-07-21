import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { uploadSourcemaps } from './sourcemaps';

function tempDist(): string {
  const dir = mkdtempSync(join(tmpdir(), 'signals-maps-'));
  writeFileSync(join(dir, 'index-abc.js.map'), '{"version":3}');
  mkdirSync(join(dir, 'assets'));
  writeFileSync(join(dir, 'assets', 'vendor.js.map'), '{"version":3}');
  writeFileSync(join(dir, 'index.js'), 'not a map');
  mkdirSync(join(dir, 'node_modules'));
  writeFileSync(join(dir, 'node_modules', 'skip.js.map'), '{}');
  return dir;
}

describe('uploadSourcemaps', () => {
  it('finds maps recursively (skipping node_modules) and posts them to the DSN sourcemap URL', async () => {
    const calls: { url: string; body: { release: string; files: { filename: string }[] } }[] = [];
    const result = await uploadSourcemaps({
      dir: tempDist(), release: '1.2.0', dsn: 'sgl://k@127.0.0.1:4640/1',
      fetchFn: (async (url: string, init: { body: string }) => {
        calls.push({ url, body: JSON.parse(init.body) });
        return { status: 201, text: async () => '' };
      }) as unknown as typeof fetch,
    });
    expect(calls[0]!.url).toBe('http://127.0.0.1:4640/ingest/k/sourcemaps');
    expect(calls[0]!.body.release).toBe('1.2.0');
    expect(calls[0]!.body.files.map((f) => f.filename).sort()).toEqual(['index-abc.js.map', 'vendor.js.map']);
    expect(result.uploaded).toHaveLength(2);
  });

  it('throws with server detail on non-201', async () => {
    await expect(uploadSourcemaps({
      dir: tempDist(), release: 'r', dsn: 'sgl://k@h/1',
      fetchFn: (async () => ({ status: 403, text: async () => '{"error":"unknown ingest key"}' })) as unknown as typeof fetch,
    })).rejects.toThrow(/403.*unknown ingest key/);
  });
});
