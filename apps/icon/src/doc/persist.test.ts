import { describe, expect, it } from 'vitest';
import { emptyDocument, newObject } from './defaults';
import { polygonPoints } from './geometry';
import { memoryStore } from './persist';
import { everyShape } from './tree';
import type { Geometry, IconDoc, IconObject } from './types';

/** The 512-square board most of these fixtures assume. */
const BOARD = { width: 512, height: 512 };

/** The shapes a loaded document holds. Every fixture here is a flat list. */
const shapes = (doc: IconDoc | null | undefined): IconObject[] =>
  doc ? everyShape(doc.objects) : [];

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

  it('keeps a path’s commands through a save and a reopen, curves and flags and all', async () => {
    const store = memoryStore();
    const { id } = await store.create('spinner.icon');
    const drawn: IconDoc = {
      ...emptyDocument('spinner.icon'),
      objects: [
        {
          ...newObject('path', 1, BOARD),
          geometry: {
            kind: 'path',
            segments: [
              { c: 'M', x: 10, y: 20 },
              { c: 'Q', x1: 30, y1: 40, x: 50, y: 60 },
              { c: 'C', x1: 1, y1: 2, x2: 3, y2: 4, x: 5, y: 6 },
              { c: 'A', rx: 7, ry: 8, rotation: 9, large: true, sweep: false, x: 11, y: 12 },
              { c: 'Z' },
            ],
          },
        },
      ],
    };
    await store.save(id, drawn);
    expect(shapes(await store.load(id))[0]?.geometry).toEqual(shapes(drawn)[0]?.geometry);
  });

  it('reopens the arc preset as the same arc it was saved as', async () => {
    const store = memoryStore();
    const { id } = await store.create('arc.icon');
    const doc = { ...emptyDocument('arc.icon'), objects: [newObject('path', 1, BOARD)] };
    await store.save(id, doc);
    expect(await store.load(id)).toEqual(doc);
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

const storeHolding = (doc: IconDoc) =>
  memoryStore([{ id: 'old', name: doc.name, artboard: doc.artboard, updatedAt: 0, doc }]);

describe('documents saved before a polygon was a list of points', () => {
  /** A polygon as it used to be stored: a centre, a radius and a side count. */
  const REGULAR = { kind: 'polygon', cx: 256, cy: 256, r: 120, sides: 6 } as unknown as Geometry;

  const savedBefore = (): IconDoc => ({
    ...emptyDocument('legacy.icon'),
    objects: [{ ...newObject('polygon', 1, BOARD), geometry: REGULAR }],
  });

  it('open as the same hexagon, now as the points a polygon actually is', async () => {
    const loaded = await storeHolding(savedBefore()).load('old');
    expect(shapes(loaded)[0]?.geometry).toEqual({
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

describe('documents saved while the editor could animate', () => {
  /** What the object was, and is again, once the motion field comes off it. */
  const drawn = (): IconObject => ({
    ...newObject('rect', 1, BOARD),
    rotation: 30,
    // Below the floor the pose engine held a moving object's opacity above.
    opacity: 0,
  });

  /**
   * A document as it used to be stored: three named states, one of them
   * sustained, a timing block, and a `motion` field on the object.
   */
  const savedAnimated = (): IconDoc =>
    ({
      ...emptyDocument('spinner.icon'),
      objects: [{ ...drawn(), motion: { takesPart: true, role: 'spins', pace: 2 } }],
      states: [
        { id: 's0', name: 'idle', sustain: null },
        { id: 's1', name: 'loading', sustain: 'turning' },
        { id: 's2', name: 'done', sustain: null },
      ],
      timing: { speed: 1.5, ramp: 'soft', rest: 0.18 },
    }) as unknown as IconDoc;

  it('open as one static picture, with the states, the timing and the motion gone', async () => {
    const loaded = await storeHolding(savedAnimated()).load('old');
    // Compared whole rather than field by field: an equality against the
    // document the new model would have written is what proves `states`,
    // `timing` and `motion` were left behind rather than carried along.
    expect(loaded).toEqual({ ...emptyDocument('spinner.icon'), objects: [drawn()] });
  });

  it('keep the first state’s pose, which is the geometry exactly as it was drawn', async () => {
    const loaded = await storeHolding(savedAnimated()).load('old');
    const object = shapes(loaded)[0];
    expect(object?.geometry).toEqual(drawn().geometry);
    expect(object?.rotation).toBe(30);
    // The pose engine's opacity floor went with the loop it protected.
    expect(object?.opacity).toBe(0);
  });

  it('survive a round trip: saving what was opened and reopening it changes nothing', async () => {
    const store = storeHolding(savedAnimated());
    const opened = await store.load('old');
    expect(opened).not.toBeNull();
    if (!opened) return;
    await store.save('old', opened);
    expect(await store.load('old')).toEqual(opened);
  });

  it('leave a document that never animated exactly as it was, so it does not read as edited', async () => {
    const current = { ...emptyDocument('current.icon'), objects: [newObject('rect', 1, BOARD)] };
    const store = storeHolding(current);
    expect(await store.load('old')).toBe(current);
  });

  it('keep a material through the rewrite, since a named field is the point of it', async () => {
    // This migration rebuilds every object field by field, which is what stops
    // `motion` travelling along inside a spread — and is also what would drop a
    // field added afterwards without anyone noticing.
    const saved = {
      ...savedAnimated(),
      objects: [{ ...drawn(), material: 'glass', motion: { takesPart: true } }],
    } as unknown as IconDoc;
    const loaded = await storeHolding(saved).load('old');
    expect(shapes(loaded)[0]?.material).toBe('glass');
  });
});

describe('documents saved before a shape could wear a material', () => {
  it('open unchanged, because no field is missing from them', async () => {
    // No migration runs at all: a material is optional, and its absence *is*
    // none. The identity check is the whole assertion — anything that rebuilt
    // the document would hand back an equal one and mark it edited.
    const before = { ...emptyDocument('plain.icon'), objects: [newObject('rect', 1, BOARD)] };
    expect(await storeHolding(before).load('old')).toBe(before);
    expect(Object.hasOwn(shapes(before)[0]!, 'material')).toBe(false);
  });

  it('a material survives a save and a reopen, whole and unchanged', async () => {
    const store = memoryStore();
    const { id } = await store.create('dressed.icon');
    const doc: IconDoc = {
      ...emptyDocument('dressed.icon'),
      objects: [
        { ...newObject('rect', 1, BOARD), material: 'glass' },
        { ...newObject('circle', 2, BOARD), material: 'paper' },
        newObject('line', 3, BOARD),
      ],
    };
    await store.save(id, doc);
    const reopened = await store.load(id);
    expect(reopened).toEqual(doc);
    expect(shapes(reopened).map((shape) => shape.material)).toEqual([
      'glass',
      'paper',
      undefined,
    ]);
  });
});
