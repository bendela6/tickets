import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Action, EditorState } from '../doc/store';
import { defaultStore, type DocumentStore } from '../doc/persist';
import type { DocumentSummary, IconDoc } from '../doc/types';

const UNTITLED = 'untitled.icon';

export interface Documents {
  /** Every saved document, newest first. */
  list: DocumentSummary[];
  /** The one being edited. */
  currentId: string | null;
  dirty: boolean;
  /** Relative wording for the top bar — `2m ago`, `just now`, `never`. */
  savedAgo: string;
  save: () => void;
  open: (id: string) => void;
  create: () => void;
}

function agoOf(at: number | null, now: number): string {
  if (at === null) return 'never';
  const seconds = Math.max(0, Math.round((now - at) / 1000));
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/**
 * The document lifecycle: which one is open, whether it has unsaved work, and
 * the four things the top bar's popover can do.
 *
 * Everything goes through the `DocumentStore` interface, so swapping the
 * browser store for a server-backed one later touches this file's `store`
 * default and nothing else.
 */
export function useDocuments({
  state,
  dispatch,
  store: given,
  now = () => Date.now(),
}: {
  state: EditorState;
  dispatch: (action: Action) => void;
  store?: DocumentStore;
  now?: () => number;
}): Documents {
  // Pinned on first render rather than defaulted in the parameter list: a
  // default argument is evaluated on EVERY render, which would build a fresh
  // store each time — every save would write into an object that was
  // discarded before anything could read it back.
  const [store] = useState(() => given ?? defaultStore());
  const [list, setList] = useState<DocumentSummary[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [savedDoc, setSavedDoc] = useState<IconDoc | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const booted = useRef(false);

  const refresh = useCallback(async () => setList(await store.list()), [store]);

  // Boot: open the most recent document, or start one if there is none. The
  // ref guards against React's development double-invoke creating two.
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    void (async () => {
      const existing = await store.list();
      const newest = existing[0];
      if (newest) {
        const doc = await store.load(newest.id);
        if (doc) {
          dispatch({ type: 'replaceDocument', doc });
          setCurrentId(newest.id);
          setSavedDoc(doc);
          setSavedAt(newest.updatedAt);
          setList(existing);
          return;
        }
      }
      const created = await store.create(UNTITLED);
      dispatch({ type: 'replaceDocument', doc: created.doc });
      setCurrentId(created.id);
      setSavedDoc(created.doc);
      setSavedAt(null);
      await refresh();
    })();
  }, [dispatch, refresh, store]);

  // Dirtiness is measured against what was actually saved rather than tracked
  // with a flag: undoing back to the saved state should leave the document
  // clean, and a flag cannot know that.
  const dirty = useMemo(
    () => savedDoc !== null && JSON.stringify(state.doc) !== JSON.stringify(savedDoc),
    [savedDoc, state.doc],
  );

  const save = useCallback(() => {
    if (!currentId) return;
    const snapshot = state.doc;
    void (async () => {
      const summary = await store.save(currentId, snapshot);
      setSavedDoc(snapshot);
      setSavedAt(summary.updatedAt);
      await refresh();
    })();
  }, [currentId, refresh, state.doc, store]);

  const open = useCallback(
    (id: string) => {
      void (async () => {
        const doc = await store.load(id);
        if (!doc) return;
        dispatch({ type: 'replaceDocument', doc });
        setCurrentId(id);
        setSavedDoc(doc);
        setSavedAt(list.find((summary) => summary.id === id)?.updatedAt ?? null);
      })();
    },
    [dispatch, list, store],
  );

  const create = useCallback(() => {
    void (async () => {
      const created = await store.create(UNTITLED);
      dispatch({ type: 'replaceDocument', doc: created.doc });
      setCurrentId(created.id);
      setSavedDoc(created.doc);
      setSavedAt(null);
      await refresh();
    })();
  }, [dispatch, refresh, store]);

  return { list, currentId, dirty, savedAgo: agoOf(savedAt, now()), save, open, create };
}

export { agoOf };
