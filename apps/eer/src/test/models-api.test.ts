import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { handleModelsRequest } from '../../vite-plugins/models-api';

const VALID = JSON.stringify({
  meta: { title: 'T' },
  groups: [{ id: 'z', label: 'Z' }],
  entities: [{ id: 'e', group: 'z', fields: [{ name: 'id', type: 'serial', role: 'pk' }] }],
});

const dir = () => mkdtempSync(join(tmpdir(), 'eer-models-'));

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
});
