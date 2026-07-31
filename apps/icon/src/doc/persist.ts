import { emptyDocument } from './defaults';
import type { ArtboardSize, DocumentSummary, IconDoc } from './types';

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
  create(name: string, size?: ArtboardSize): Promise<{ id: string; doc: IconDoc }>;
  remove(id: string): Promise<void>;
}

interface Record_ {
  id: string;
  name: string;
  size: ArtboardSize;
  updatedAt: number;
  doc: IconDoc;
}

const summaryOf = (record: Record_): DocumentSummary => ({
  id: record.id,
  name: record.name,
  size: record.size,
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
      return records.get(id)?.doc ?? null;
    },
    async save(id, doc) {
      const record: Record_ = {
        id,
        name: doc.name,
        size: doc.size,
        updatedAt: clock(),
        doc: structuredClone(doc),
      };
      records.set(id, record);
      return summaryOf(record);
    },
    async create(name, size = 512) {
      counter += 1;
      const id = `doc-${counter}`;
      const doc = emptyDocument(name, size);
      records.set(id, { id, name, size, updatedAt: clock(), doc });
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
      return record?.doc ?? null;
    },
    async save(id, doc) {
      const record: Record_ = {
        id,
        name: doc.name,
        size: doc.size,
        updatedAt: clock(),
        // structuredClone up front rather than trusting IndexedDB's own: it
        // throws on anything unclonable, and failing here names the document
        // rather than the transaction.
        doc: structuredClone(doc),
      };
      await withStore('readwrite', (store) => store.put(record));
      return summaryOf(record);
    },
    async create(name, size = 512) {
      const id = `doc-${clock()}-${Math.random().toString(36).slice(2, 8)}`;
      const doc = emptyDocument(name, size);
      await withStore('readwrite', (store) =>
        store.put({ id, name, size, updatedAt: clock(), doc } satisfies Record_),
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
