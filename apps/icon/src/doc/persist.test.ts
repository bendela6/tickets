import { describe, expect, it } from 'vitest';
import { emptyDocument } from './defaults';
import { memoryStore } from './persist';

describe('DocumentStore contract', () => {
  it('creates a document and hands back both its id and its content', async () => {
    const store = memoryStore();
    const { id, doc } = await store.create('wallet.icon');
    expect(doc.name).toBe('wallet.icon');
    expect(await store.load(id)).toEqual(doc);
  });

  it('lists newest first', async () => {
    let now = 0;
    const store = memoryStore([], () => now);
    const first = await store.create('first');
    now = 10;
    const second = await store.create('second');
    now = 20;
    await store.save(first.id, first.doc);
    expect((await store.list()).map((s) => s.id)).toEqual([first.id, second.id]);
  });

  it('reports the saved name and size, not the ones it was created with', async () => {
    const store = memoryStore();
    const { id } = await store.create('untitled.icon');
    const summary = await store.save(id, { ...emptyDocument('wallet.icon', 1024) });
    expect(summary).toMatchObject({ name: 'wallet.icon', size: 1024 });
  });

  it('stores a copy, so mutating the document afterwards cannot change what was saved', async () => {
    const store = memoryStore();
    const doc = emptyDocument('wallet.icon');
    const { id } = await store.create('wallet.icon');
    await store.save(id, doc);
    doc.name = 'mutated';
    expect((await store.load(id))?.name).toBe('wallet.icon');
  });

  it('returns null for a document that is not there', async () => {
    expect(await memoryStore().load('nope')).toBeNull();
  });

  it('removes a document', async () => {
    const store = memoryStore();
    const { id } = await store.create('doomed');
    await store.remove(id);
    expect(await store.load(id)).toBeNull();
    expect(await store.list()).toEqual([]);
  });

  it('removing something absent is not an error', async () => {
    await expect(memoryStore().remove('nope')).resolves.toBeUndefined();
  });
});
