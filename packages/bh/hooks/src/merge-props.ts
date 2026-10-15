import type { Ref, RefCallback } from 'react';

// How a prop getter merges the caller's props for an element with its own,
// as "Writing a hook" lays out: both handlers run, the caller's first; both
// refs get the node; the hook's `id`, `role`, `aria-*` and anything else it
// sets win, since they point at each other; the rest passes through. Not
// exported from the package: each hook's getters use it.

/** One ref that hands the node to each of `refs`, and takes it back from each. */
export function mergeRefs<T>(...refs: (Ref<T> | undefined)[]): RefCallback<T> {
  return (node) => {
    const cleanups = refs.map((ref) => {
      if (typeof ref === 'function') {
        return ref(node);
      }
      if (ref) {
        ref.current = node;
      }
      return undefined;
    });
    return () => {
      refs.forEach((ref, index) => {
        const cleanup = cleanups[index];
        if (typeof cleanup === 'function') {
          cleanup();
        } else if (typeof ref === 'function') {
          ref(null);
        } else if (ref) {
          ref.current = null;
        }
      });
    };
  };
}

const HANDLER = /^on[A-Z]/;

type Handler = (...args: unknown[]) => void;

/**
 * The caller's props for an element with the hook's merged in. Each handler
 * the two share runs the caller's first, then the hook's; a ref is the
 * hook's to merge, with `mergeRefs`, before it gets here.
 *
 * @param own The caller's props, or nothing.
 * @param hook What the hook sets on the element.
 */
export function mergeProps<Own extends object, Hook extends object>(
  own: Own | undefined,
  hook: Hook,
): Omit<Own, keyof Hook> & Hook {
  const merged: Record<string, unknown> = { ...own };
  const theirs = (own ?? {}) as Record<string, unknown>;
  for (const [name, value] of Object.entries(hook)) {
    const before = theirs[name];
    if (HANDLER.test(name) && typeof before === 'function' && typeof value === 'function') {
      merged[name] = (...args: unknown[]) => {
        (before as Handler)(...args);
        (value as Handler)(...args);
      };
    } else {
      merged[name] = value;
    }
  }
  return merged as Omit<Own, keyof Hook> & Hook;
}
