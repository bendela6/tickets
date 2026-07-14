import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { handleModelsRequest } from '../../vite-plugins/models-api';

const VALID = JSON.stringify({
  meta: { title: 'T' },
  groups: [{ id: 'z', label: 'Z' }],
  entities: [{ id: 'e', group: 'z', fields: [{ name: 'id', type: 'serial', role: 'pk' }] }],
});

// Track every mkdtempSync dir so it can be removed after its test — otherwise
// each run leaves scratch directories behind in the OS tmpdir.
const createdDirs: string[] = [];
const dir = () => {
  const d = mkdtempSync(join(tmpdir(), 'eer-models-'));
  createdDirs.push(d);
  return d;
};

afterEach(() => {
  for (const d of createdDirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe('models api', () => {
  it('lists, creates, gets, saves and deletes models', async () => {
    const d = dir();
    expect((await handleModelsRequest(d, 'GET', '/', null)).body).toEqual([]);
    const created = await handleModelsRequest(d, 'POST', '/', VALID);
    expect(created.status).toBe(201);
    const id = (created.body as { id: string }).id;
    expect(id).toBe('t');
    expect(((await handleModelsRequest(d, 'GET', '/', null)).body as unknown[]).length).toBe(1);
    expect((await handleModelsRequest(d, 'GET', `/${id}`, null)).status).toBe(200);
    expect((await handleModelsRequest(d, 'PUT', `/${id}`, VALID)).status).toBe(200);
    expect(JSON.parse(readFileSync(join(d, 't.json'), 'utf8')).meta.title).toBe('T');
    expect((await handleModelsRequest(d, 'DELETE', `/${id}`, null)).status).toBe(200);
    expect((await handleModelsRequest(d, 'GET', `/${id}`, null)).status).toBe(404);
  });

  it('rejects traversal slugs, invalid bodies, and duplicate titles', async () => {
    const d = dir();
    expect((await handleModelsRequest(d, 'GET', '/../secrets', null)).status).toBe(400);
    expect((await handleModelsRequest(d, 'POST', '/', '{"groups":[]}')).status).toBe(422);
    await handleModelsRequest(d, 'POST', '/', VALID);
    expect((await handleModelsRequest(d, 'POST', '/', VALID)).status).toBe(409);
  });

  it('skips unparsable files when listing instead of failing the whole request', async () => {
    const d = dir();
    await handleModelsRequest(d, 'POST', '/', VALID);
    writeFileSync(join(d, 'broken.json'), '{oops', 'utf8');
    const res = await handleModelsRequest(d, 'GET', '/', null);
    expect(res.status).toBe(200);
    expect(res.body as { id: string; title: string }[]).toEqual([{ id: 't', title: 'T' }]);
  });

  it('PUT on a non-existent slug 404s and does not create the file (save-after-delete must not resurrect it)', async () => {
    const d = dir();
    const res = await handleModelsRequest(d, 'PUT', '/does-not-exist', VALID);
    expect(res.status).toBe(404);
    expect(existsSync(join(d, 'does-not-exist.json'))).toBe(false);
  });

  it('handles concurrent PUTs to the same slug without a torn write', async () => {
    const d = dir();
    await handleModelsRequest(d, 'POST', '/', VALID);
    const payloadA = JSON.stringify({
      meta: { title: 'T' },
      groups: [{ id: 'z', label: 'Z' }],
      entities: [{ id: 'e', group: 'z', fields: [{ name: 'id', type: 'serial', role: 'pk' }] }],
      note: 'A',
    });
    const payloadB = JSON.stringify({
      meta: { title: 'T' },
      groups: [{ id: 'z', label: 'Z' }],
      entities: [{ id: 'e', group: 'z', fields: [{ name: 'id', type: 'serial', role: 'pk' }] }],
      note: 'B',
    });
    const [r1, r2] = await Promise.all([
      handleModelsRequest(d, 'PUT', '/t', payloadA),
      handleModelsRequest(d, 'PUT', '/t', payloadB),
    ]);
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    // Must parse cleanly (no torn write from a shared tmp path) and match
    // exactly one full payload, not an interleaved mix of the two.
    const onDisk = JSON.parse(readFileSync(join(d, 't.json'), 'utf8')) as { note: string };
    expect(['A', 'B']).toContain(onDisk.note);
    const winner = onDisk.note === 'A' ? payloadA : payloadB;
    expect(onDisk).toEqual(JSON.parse(winner));
  });
});
