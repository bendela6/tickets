import { useRef, useState } from 'react';

/** What the viewer's undo stack offers. */
export interface JsonHistory {
  /** Records the document being replaced and hands the new one to the owner. */
  commit: (current: unknown, next: unknown) => void;
  undo: (current: unknown) => void;
  redo: (current: unknown) => void;
  canUndo: boolean;
  canRedo: boolean;
  /**
   * The last document handed back from here. The viewer compares the incoming one against it to
   * tell an edit of its own from a document that arrived from somewhere else - an edit keeps the
   * folds the reader has set, a replacement re-derives them.
   */
  emitted: unknown;
}

/**
 * Undo and redo for a controlled document.
 *
 * The viewer does not own the document - the caller does - so history cannot be a stack of states
 * the viewer swaps between. It is a stack of documents to hand *back*: undo calls `onChange` with
 * the previous one and lets it arrive as a prop like any other change.
 *
 * That only holds while the caller echoes what it is given, so the last emitted document is kept
 * and compared on every render. A document that arrives without having been emitted here came from
 * somewhere else - a refetch, a reset, a caller that ignored the change - and the stack is dropped,
 * because undoing onto a document that is no longer on screen would be worse than not undoing.
 */
export function useJsonHistory(value: unknown, onChange?: (next: unknown) => void): JsonHistory {
  const [past, setPast] = useState<unknown[]>([]);
  const [future, setFuture] = useState<unknown[]>([]);
  const emitted = useRef<unknown>(value);

  if (!Object.is(value, emitted.current)) {
    emitted.current = value;
    if (past.length > 0 || future.length > 0) {
      setPast([]);
      setFuture([]);
    }
  }

  const emit = (next: unknown) => {
    emitted.current = next;
    onChange?.(next);
  };

  return {
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    emitted: emitted.current,
    commit: (current, next) => {
      setPast((stack) => [...stack, current]);
      setFuture([]);
      emit(next);
    },
    undo: (current) => {
      const previous = past.at(-1);
      if (past.length === 0) {
        return;
      }
      setPast((stack) => stack.slice(0, -1));
      setFuture((stack) => [...stack, current]);
      emit(previous);
    },
    redo: (current) => {
      const next = future.at(-1);
      if (future.length === 0) {
        return;
      }
      setFuture((stack) => stack.slice(0, -1));
      setPast((stack) => [...stack, current]);
      emit(next);
    },
  };
}
