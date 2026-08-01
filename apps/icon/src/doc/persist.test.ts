import { describe, expect, it } from 'vitest';
import { emptyDocument, newObject } from './defaults';
import { polygonPoints } from './geometry';
import { memoryStore } from './persist';
import type { Geometry, IconDoc } from './types';

/** The 512-square board most of these fixtures assume. */
const BOARD = { width: 512, height: 512 };

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
    const summary = await store.save(id, { ...emptyDocument('wallet.icon', { width: 1024, height: 1024 }) });
    expect(summary).toMatchObject({
      name: 'wallet.icon',
      artboard: { width: 1024, height: 1024 },
    });
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

describe('documents saved before a polygon was a list of points', () => {
  /** A polygon as it used to be stored: a centre, a radius and a side count. */
  const REGULAR = { kind: 'polygon', cx: 256, cy: 256, r: 120, sides: 6 } as unknown as Geometry;

  const savedBefore = (): IconDoc => ({
    ...emptyDocument('legacy.icon'),
    objects: [{ ...newObject('polygon', 1, BOARD), geometry: REGULAR }],
  });

  const storeHolding = (doc: IconDoc) =>
    memoryStore([
      { id: 'old', name: doc.name, artboard: doc.artboard, updatedAt: 0, doc },
    ]);

  it('open as the same hexagon, now as the points a polygon actually is', async () => {
    const loaded = await storeHolding(savedBefore()).load('old');
    expect(loaded?.objects[0]?.geometry).toEqual({
      kind: 'polygon',
      points: polygonPoints(256, 256, 120, 6),
    });
  });

  it('survive a round trip: saving what was opened and reopening it changes nothing', async () => {
    const store = storeHolding(savedBefore());
    const opened = await store.load('old');
    expect(opened).not.toBeNull();
    if (!opened) return;
    await store.save('old', opened);
    expect(await store.load('old')).toEqual(opened);
  });

  it('leave a document that needs nothing exactly as it was, so it does not read as edited', async () => {
    const current = { ...emptyDocument('current.icon'), objects: [newObject('polygon', 1, BOARD)] };
    const store = storeHolding(current);
    expect(await store.load('old')).toBe(current);
  });
});
