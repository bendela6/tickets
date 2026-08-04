import { emptyDocument } from './defaults';
import { polygonPoints } from './geometry';
import { isGroup } from './tree';
import type { Artboard, DocumentSummary, Geometry, IconDoc, IconNode, IconObject } from './types';

/** What a polygon was before `<polygon>` was taken literally: a regular n-gon. */
interface RegularPolygon {
  cx: number;
  cy: number;
  r: number;
  sides: number;
}

function asRegularPolygon(geometry: Geometry): RegularPolygon | null {
  if (geometry.kind !== 'polygon') return null;
  const legacy = geometry as unknown as Partial<RegularPolygon>;
  if (
    typeof legacy.cx !== 'number' ||
    typeof legacy.cy !== 'number' ||
    typeof legacy.r !== 'number' ||
    typeof legacy.sides !== 'number'
  ) {
    return null;
  }
  return { cx: legacy.cx, cy: legacy.cy, r: legacy.r, sides: legacy.sides };
}

/** What a document carried while it could animate. */
interface Animated {
  states?: unknown;
  timing?: unknown;
}

/** What an object carried while it could animate. */
interface Moving {
  motion?: unknown;
}

/** What a shape carried while a surface could be picked from a list by name. */
interface Dressed {
  material?: unknown;
}

/**
 * The node with any named surface taken off it, and the very node back when
 * there was none. Nothing is put in its place: a `glass` was a bundle of a
 * dozen filter primitives, and guessing which blur radius somebody would have
 * picked instead would be inventing an edit they never made.
 *
 * This one walks into groups, unlike the two repairs below it — materials
 * arrived long *after* groups did, so a save really can hold one three levels
 * down.
 */
function undressed(node: IconNode): IconNode {
  if (isGroup(node)) {
    const children = node.children.map(undressed);
    return children.every((child, index) => child === node.children[index])
      ? node
      : { ...node, children };
  }
  if (!('material' in node)) return node;
  const { material: _withdrawn, ...bare } = node as IconObject & Dressed;
  return bare;
}

/**
 * The object as the one surviving picture holds it.
 *
 * A state never varied geometry — it was a phase number that the pose engine
 * derived a rotation, an offset and an opacity from, and the first state's
 * phase was 0, which derived none of them. So the first state resolved to
 * exactly what was stored, and keeping the stored object *is* keeping the first
 * pose.
 *
 * With one deliberate exception: the pose engine also held every moving
 * object's opacity above a floor, so that a loop could never fade one entirely
 * away. That floor is a property of the loop, not of the object, and the
 * properties panel always showed the stored value rather than the floored one.
 * The stored value is what is kept, so an object set to fully transparent stays
 * fully transparent rather than being nudged back into view by machinery that
 * no longer exists.
 *
 * Every field is named rather than spread, so a field added to `IconObject`
 * later fails to compile here instead of silently going missing.
 */
function stillObject(object: IconObject): IconObject {
  const still: IconObject = {
    id: object.id,
    name: object.name,
    geometry: object.geometry,
    fill: object.fill,
    stroke: object.stroke,
    strokeWidth: object.strokeWidth,
    opacity: object.opacity,
    rotation: object.rotation,
    hidden: object.hidden,
    locked: object.locked,
  };
  // Each carried only when it is there, so a document that never had one does
  // not come back out of here holding the key with nothing in it. No document
  // this function ever runs on can have either — effects arrived long after
  // animation left — but a field named nowhere is a field silently dropped, and
  // that is the trap this whole function is shaped to avoid.
  if (object.blur !== undefined) still.blur = object.blur;
  if (object.shadow !== undefined) still.shadow = object.shadow;
  return still;
}

/**
 * Bring a document that was saved against an older model up to the current one.
 *
 * Two changes have happened so far.
 *
 * A polygon used to be a centre, a radius and a side count — a regular n-gon,
 * which is not an SVG element and so not something a document may hold. Saved
 * hexagons are turned into the point lists `<polygon>` has always meant, which
 * draws the same hexagon it always did.
 *
 * A document used to hold several named states, a timing block, and a `motion`
 * field on every object. Animation is gone: a document is one static picture
 * with one pose, so the first state's pose is kept and the rest is dropped
 * without a word. That silence is the product decision — the states after the
 * first were never data anybody typed, they were derived from a phase number.
 *
 * A third change needed no migration at all, and saying why is the point of
 * this paragraph. The object list became a tree: a group is a node with
 * children, and a shape is a node without. Every document written before that
 * is a flat list of shapes — which is a tree of depth one, already valid, with
 * no marker missing from it. That is not luck; it is why a group is told apart
 * by *having children* rather than by a `kind` field it would have to be given.
 * A migration here would walk every document ever saved and hand each one back
 * unchanged, and the only thing it could achieve is marking them all dirty.
 *
 * A third that *did* need one, and it is the case worth studying because it is
 * the one that went wrong. A shape could briefly name a surface — `glass`,
 * `metal`, four more — and that field names a treatment no renderer here can
 * draw any more, so it is dropped whole. Taking a field away costs one
 * function, which is the argument for optional fields over preset enumerations.
 *
 * A fourth needs no migration at all, and is the shape every future one should
 * take: an object may now carry a blur and a shadow, both optional, and having
 * neither *is* having no effects. There is nothing to fill in.
 *
 * On read rather than on write, because this is the only place a document from
 * before any of these can enter — nothing will ever write one again. The
 * document is returned unchanged, and identical, when there was nothing to do:
 * `dirty` is measured by comparing the open document against what was loaded,
 * and a migration that rebuilt every document would report them all edited.
 */
export function migrate(doc: IconDoc): IconDoc {
  let changed = false;
  const objects = doc.objects.map((node) => {
    const object = undressed(node);
    if (object !== node) changed = true;
    // A group cannot be either of the two things left to repair: both predate
    // groups entirely, so no document that holds one can hold them.
    if (isGroup(object)) return object;
    const regular = asRegularPolygon(object.geometry);
    const moved = (object as IconObject & Moving).motion !== undefined;
    if (!regular && !moved) return object;
    changed = true;
    const still = moved ? stillObject(object) : object;
    if (!regular) return still;
    return {
      ...still,
      geometry: {
        kind: 'polygon' as const,
        points: polygonPoints(regular.cx, regular.cy, regular.r, regular.sides),
      },
    };
  });

  const animated = doc as IconDoc & Animated;
  if (animated.states === undefined && animated.timing === undefined) {
    return changed ? { ...doc, objects } : doc;
  }
  // Rebuilt field by field rather than spread, so `states` and `timing` are
  // left behind rather than carried along inside the spread.
  return {
    name: doc.name,
    artboard: doc.artboard,
    snap: doc.snap,
    background: doc.background,
    objects,
  };
}

/**
 * Where documents live.
 *
 * Everything above this file talks to the interface and nothing else touches
 * IndexedDB, so replacing the browser store with a server-backed one later is
 * a new implementation of four methods rather than a change to any component.
 */
export interface DocumentStore {
  /** Newest first. */
  list(): Promise<DocumentSummary[]>;
  load(id: string): Promise<IconDoc | null>;
  save(id: string, doc: IconDoc): Promise<DocumentSummary>;
  create(name: string, artboard?: Artboard): Promise<{ id: string; doc: IconDoc }>;
  remove(id: string): Promise<void>;
}

interface Record_ {
  id: string;
  name: string;
  artboard: Artboard;
  updatedAt: number;
  doc: IconDoc;
}

const summaryOf = (record: Record_): DocumentSummary => ({
  id: record.id,
  name: record.name,
  artboard: record.artboard,
  updatedAt: record.updatedAt,
});

const byNewest = (a: DocumentSummary, b: DocumentSummary) => b.updatedAt - a.updatedAt;

/**
 * An in-memory store. Backs the tests, and is what the app falls back to when
 * IndexedDB is unavailable (private windows, and a handful of embedded
 * browsers) — a session that cannot persist is better than one that will not
 * start.
 */
export function memoryStore(
  seed: Record_[] = [],
  // Real time by default, the same as the IndexedDB store: this is a fallback
  // people actually run in, not only a test double, and a fixed clock would
  // have every save read `saved 20666d ago`. Tests pass their own.
  clock: () => number = () => Date.now(),
): DocumentStore {
  const records = new Map(seed.map((record) => [record.id, record]));
  let counter = seed.length;

  return {
    async list() {
      return [...records.values()].map(summaryOf).sort(byNewest);
    },
    async load(id) {
      const doc = records.get(id)?.doc;
      return doc ? migrate(doc) : null;
    },
    async save(id, doc) {
      const record: Record_ = {
        id,
        name: doc.name,
        artboard: doc.artboard,
        updatedAt: clock(),
        doc: structuredClone(doc),
      };
      records.set(id, record);
      return summaryOf(record);
    },
    async create(name, artboard = { width: 512, height: 512 }) {
      counter += 1;
      const id = `doc-${counter}`;
      const doc = emptyDocument(name, artboard);
      records.set(id, { id, name, artboard, updatedAt: clock(), doc });
      return { id, doc };
    },
    async remove(id) {
      records.delete(id);
    },
  };
}

const DB_NAME = 'icon-editor';
const DB_VERSION = 1;
const STORE = 'documents';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('indexedDB.open failed'));
  });
}

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDatabase();
  try {
    return await promisify(fn(db.transaction(STORE, mode).objectStore(STORE)));
  } finally {
    db.close();
  }
}

export function indexedDbStore(clock: () => number = () => Date.now()): DocumentStore {
  return {
    async list() {
      const records = await withStore<Record_[]>('readonly', (store) => store.getAll());
      return records.map(summaryOf).sort(byNewest);
    },
    async load(id) {
      const record = await withStore<Record_ | undefined>('readonly', (store) => store.get(id));
      return record ? migrate(record.doc) : null;
    },
    async save(id, doc) {
      const record: Record_ = {
        id,
        name: doc.name,
        artboard: doc.artboard,
        updatedAt: clock(),
        // structuredClone up front rather than trusting IndexedDB's own: it
        // throws on anything unclonable, and failing here names the document
        // rather than the transaction.
        doc: structuredClone(doc),
      };
      await withStore('readwrite', (store) => store.put(record));
      return summaryOf(record);
    },
    async create(name, artboard = { width: 512, height: 512 }) {
      const id = `doc-${clock()}-${Math.random().toString(36).slice(2, 8)}`;
      const doc = emptyDocument(name, artboard);
      await withStore('readwrite', (store) =>
        store.put({ id, name, artboard, updatedAt: clock(), doc } satisfies Record_),
      );
      return { id, doc };
    },
    async remove(id) {
      await withStore('readwrite', (store) => store.delete(id));
    },
  };
}

/**
 * The store the app uses: IndexedDB where it exists, memory where it does not.
 * The check is for the global rather than a try/catch around the first write,
 * so a private window degrades before anything is lost rather than after.
 */
export function defaultStore(): DocumentStore {
  return typeof indexedDB === 'undefined' ? memoryStore() : indexedDbStore();
}
