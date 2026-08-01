import { act, renderHook, waitFor } from '@testing-library/react';
import { useReducer } from 'react';
import { describe, expect, it } from 'vitest';
import { emptyDocument } from '../doc/defaults';
import { memoryStore, type DocumentStore } from '../doc/persist';
import { editorReducer, initialState } from '../doc/store';
import type { DocumentSummary, IconDoc } from '../doc/types';
import { useDocuments } from './use-documents';

/** A promise this test settles by hand, standing in for the IndexedDB round-trip. */
function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

/**
 * A store whose `list`/`load` hang until the test releases them, so a boot
 * can be paused mid-round-trip. Everything else — `save`/`create`/`remove`,
 * and any `list()` call after the first — delegates to a real `memoryStore`,
 * so the effects of what runs *after* boot (a `create` and a `refresh`) are
 * genuine rather than another thing the test has to fake.
 */
function bootGatedStore(backing: DocumentStore) {
  const list = deferred<DocumentSummary[]>();
  const load = deferred<IconDoc | null>();
  let listCalls = 0;
  const store: DocumentStore = {
    list: () => {
      listCalls += 1;
      return listCalls === 1 ? list.promise : backing.list();
    },
    load: () => load.promise,
    save: (id, doc) => backing.save(id, doc),
    create: (name, artboard) => backing.create(name, artboard),
    remove: (id) => backing.remove(id),
  };
  return { store, list, load };
}

/** `useDocuments` needs a live `EditorState`/`dispatch` pair, the same as `App` gives it. */
function useHarness(store: DocumentStore) {
  const [state, dispatch] = useReducer(editorReducer, emptyDocument('untitled.icon'), initialState);
  const documents = useDocuments({ state, dispatch, store });
  return { state, dispatch, documents };
}

describe('the boot load, when it resolves mid-edit', () => {
  it('adopts the newest saved document when nothing was edited before it resolved', async () => {
    const backing = memoryStore();
    const seeded = await backing.create('wallet.icon');
    const summary = await backing.save(seeded.id, seeded.doc);
    const { store, list, load } = bootGatedStore(backing);

    const { result } = renderHook(() => useHarness(store));

    list.resolve([summary]);
    load.resolve(seeded.doc);
    await waitFor(() => expect(result.current.documents.currentId).toBe(seeded.id));

    // Today's behaviour, unchanged: the saved document is what's showing,
    // clean, with the saved timestamp carried over.
    expect(result.current.state.doc.name).toBe('wallet.icon');
    expect(result.current.documents.dirty).toBe(false);
    expect(result.current.documents.savedAgo).not.toBe('never');
    expect(result.current.documents.list).toEqual([summary]);
  });

  it('keeps an in-progress edit instead of replacing it, and gives it a savable identity', async () => {
    const backing = memoryStore();
    const seeded = await backing.create('wallet.icon');
    const summary = await backing.save(seeded.id, seeded.doc);
    const { store, list, load } = bootGatedStore(backing);

    const { result } = renderHook(() => useHarness(store));

    // The user draws before the round-trip above has anywhere resolved.
    act(() => {
      result.current.dispatch({ type: 'addObject', kind: 'rect' });
    });
    expect(result.current.state.past).toHaveLength(1);

    list.resolve([summary]);
    load.resolve(seeded.doc);
    await waitFor(() => expect(result.current.documents.currentId).not.toBeNull());

    // The loaded document never landed — what's in memory is still the edit.
    expect(result.current.state.doc.objects).toHaveLength(1);
    // It's a new entry, not the one that was loaded, so the old save is untouched.
    expect(result.current.documents.currentId).not.toBe(seeded.id);
    // `dirty` compares against `savedDoc`, which is the empty document `create`
    // just made — so the edit reads as unsaved, exactly as it should.
    expect(result.current.documents.dirty).toBe(true);
    // `savedAt` was left null rather than borrowed from the loaded document.
    expect(result.current.documents.savedAgo).toBe('never');
    // The list was refreshed: both the original save and the new empty entry are in it.
    expect(result.current.documents.list).toHaveLength(2);
  });
});
