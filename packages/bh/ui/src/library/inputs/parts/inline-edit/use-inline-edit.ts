import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type SyntheticEvent,
} from 'react';
import type { Commit } from '../../contract';

/** What `useInlineEdit` is given: the committed value, where a commit goes, and when one happens. */
export interface UseInlineEditOptions<T> {
  /** The committed value: what the field shows while nobody is editing it. */
  value: T;
  /**
   * Takes a changed draft, and the event that committed it where there is one
   * (the Enter, the blur; none for a pause, the window or an unmount).
   *
   * Returning `false` refuses it: the draft stays, for the reader to put
   * right. The controls never do; it's the seam a parse step builds on — a
   * draft that doesn't parse is kept rather than replaced by the last good
   * value. Anything else, `undefined` included, takes it.
   */
  onCommit: (next: T, event?: SyntheticEvent) => unknown;
  /** When a draft commits. At `'change'` there's no draft: every change commits. */
  commit: Commit;
  /** The draft, each time the reader changes it: a keystroke, a step, an Escape. */
  onDraft?: (draft: T) => void;
  /**
   * Whether two values are the same, so an unchanged draft commits nothing.
   * `Object.is` unless given.
   */
  equals?: (a: T, b: T) => boolean;
}

/** What `useInlineEdit` gives a control: what to show, and the handlers that move the draft. */
export interface InlineEdit<T> {
  /** What the field shows: the draft while there is one, else the committed value. */
  draft: T;
  /** Whether the field holds a draft the committed value doesn't have yet. */
  pending: boolean;
  /** The reader changed the field (a keystroke, a step): it becomes the draft, or commits at `'change'`. */
  change: (next: T, event?: SyntheticEvent) => void;
  /** Commits the draft now, if it differs from the value. */
  flush: (event?: SyntheticEvent) => void;
  /** Drops the draft and shows the committed value again; whether there was one to drop. */
  revert: () => boolean;
  /**
   * Enter commits and Escape reverts. `{ enter: false }` leaves Enter to the
   * field (a textarea's new line) and commits on Ctrl/Cmd+Enter instead.
   */
  onKeyDown: (event: KeyboardEvent, options?: { enter?: boolean }) => void;
  /** Leaving the field commits. A control made of several elements checks that focus left all of them first. */
  onBlur: (event: FocusEvent) => void;
}

/** What the window events and the unmount read: they outlive the render that set them up. */
interface Live<T> {
  held: { draft: T } | null;
  value: T;
  commit: Commit;
  onCommit: UseInlineEditOptions<T>['onCommit'];
  onDraft: UseInlineEditOptions<T>['onDraft'];
  equals: (a: T, b: T) => boolean;
}

/**
 * The draft behind a text control's `commit` prop: what you type is held here
 * and handed to `onCommit` when the field commits.
 *
 * - It commits only a changed value: a draft typed back to the value commits
 *   nothing.
 * - While nobody is editing, it shows `value`, so a change made elsewhere
 *   lands without remounting the field. While a draft is held, the draft
 *   stays: what you're typing isn't replaced under you.
 * - After a commit it shows `value` again, whatever the caller did with it: a
 *   "+ add" input that keeps its value `''` empties, a field whose caller
 *   saves shows the saved value.
 * - Escape drops the draft and shows the committed value.
 * - A draft still waiting for its pause commits at once when you leave the
 *   field or the window, or when the field unmounts, so a draft is never lost.
 *
 * Internal to the controls: not exported until a caller that isn't one of
 * them needs it.
 */
export function useInlineEdit<T>({
  value,
  onCommit,
  commit,
  onDraft,
  equals = Object.is,
}: UseInlineEditOptions<T>): InlineEdit<T> {
  const [held, setHeld] = useState<{ draft: T } | null>(null);

  // A draft the value has caught up with is no draft any more: typed back to
  // where it started, or committed by someone else (a form's Save takes it
  // while you're still in the field). Dropped now, during render, so a later
  // change from outside shows rather than this stale copy coming back.
  let current = held;
  if (held !== null && (commit === 'change' || equals(held.draft, value))) {
    current = null;
    setHeld(null);
  }

  const live = useRef<Live<T>>({ held: current, value, commit, onCommit, onDraft, equals });
  useLayoutEffect(() => {
    live.current = { held: current, value, commit, onCommit, onDraft, equals };
  });

  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  function stopTimer() {
    if (timer.current !== undefined) {
      clearTimeout(timer.current);
      timer.current = undefined;
    }
  }

  // Read from `live`, not this render's closure: the pause, the window and the
  // unmount call it long after. And it clears `held` there before anything
  // else, so two triggers in one tick (the field's blur, then the window's)
  // commit once.
  function flush(event?: SyntheticEvent) {
    stopTimer();
    const now = live.current;
    const draft = now.held;
    if (draft === null) {
      return;
    }
    now.held = null;
    if (now.equals(draft.draft, now.value)) {
      setHeld(null);
      return;
    }
    if (now.onCommit(draft.draft, event) === false) {
      now.held = draft;
      return;
    }
    setHeld(null);
  }

  function revert() {
    stopTimer();
    const now = live.current;
    if (now.held === null) {
      return false;
    }
    now.held = null;
    setHeld(null);
    now.onDraft?.(now.value);
    return true;
  }

  function change(next: T, event?: SyntheticEvent) {
    const now = live.current;
    now.onDraft?.(next);
    if (now.commit === 'change') {
      now.onCommit(next, event);
      return;
    }
    const draft = { draft: next };
    now.held = draft;
    setHeld(draft);
    stopTimer();
    const pause = now.commit;
    if (typeof pause === 'object') {
      timer.current = setTimeout(() => flush(), pause.after);
    }
  }

  // Leaving the window while a draft is held: switching apps or tabs, or
  // closing the page, none of which blurs the field everywhere.
  const holding = current !== null;
  useEffect(() => {
    if (!holding) {
      return;
    }
    const leave = () => flush();
    const hidden = () => {
      if (document.visibilityState === 'hidden') {
        flush();
      }
    };
    window.addEventListener('blur', leave);
    window.addEventListener('pagehide', leave);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      window.removeEventListener('blur', leave);
      window.removeEventListener('pagehide', leave);
      document.removeEventListener('visibilitychange', hidden);
    };
    // `flush` reads `live`, so the listeners never go stale.
  }, [holding]);

  // Unmounting with a draft held commits it: a dialog closed, a row scrolled
  // away. Mount-only, so it runs once, at the end.
  useEffect(() => {
    return () => flush();
  }, []);

  return {
    draft: current === null ? value : current.draft,
    pending: holding,
    change,
    flush,
    revert,
    onKeyDown(event, options) {
      if (event.key === 'Enter') {
        // An IME's Enter picks a candidate; it isn't the reader's.
        if (event.nativeEvent.isComposing) {
          return;
        }
        if (options?.enter !== false || event.metaKey || event.ctrlKey) {
          flush(event);
        }
      } else if (event.key === 'Escape' && revert()) {
        // Only an Escape that dropped something is spent here; one with
        // nothing to drop still reaches the dialog around the field.
        event.preventDefault();
        event.stopPropagation();
      }
    },
    onBlur(event) {
      flush(event);
    },
  };
}
