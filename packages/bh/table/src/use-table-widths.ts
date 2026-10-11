import { useState } from 'react';

// The app names the key and the engine only appends what it keeps under it,
// as @bh/ui's panels do (`${storageKey}:width`). No prefix of its own: two
// apps on one origin stay apart by the keys they hand in (`shop:orders`).
const KEY = (storageKey: string) => `${storageKey}:widths`;

function safeParse(raw: string | null): Record<string, number> | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as Record<string, number>)
      : null;
  } catch {
    return null;
  }
}

// Remembering widths is a convenience, not something to fail over.
// `localStorage` throws outright when site data is blocked (a browser
// setting, an enterprise policy, a sandboxed frame), and `setItem` throws
// again on a full quota. The read runs in a `useState` initializer and the
// write inside a state update, both during render, so an unguarded throw
// would take the whole table down — as @bh/ui's panels and @bh/shell's theme
// already guard against.
function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // See readStored: the width still changes, it just isn't remembered.
  }
}

// A table that has not been given a name has no business writing to a user's
// localStorage under a made-up key, and a hook cannot be called
// conditionally, so the choice has to live in here rather than at the call
// site.
/**
 * Column widths, saved per table under `${storageKey}:widths`: the state a
 * `<Table>` takes as `state.widths`, and the setter it takes as
 * `onWidthChange`.
 *
 * Without a `storageKey` the widths live as long as the component. A storage
 * that can't be read or written (turned off, or full) is treated as empty.
 *
 * @param storageKey The app's name for this table, such as `shop:orders`.
 * @returns The widths by column key, and a setter taking a key and a width.
 */
export function useTableWidths(
  storageKey?: string | null,
): readonly [Record<string, number>, (k: string, px: number) => void] {
  const [widths, setWidths] = useState<Record<string, number>>(
    () => (storageKey ? safeParse(readStored(KEY(storageKey))) : null) ?? {},
  );

  const setWidth = (colKey: string, px: number) => {
    setWidths((prev) => {
      const next = { ...prev, [colKey]: px };
      if (storageKey) {
        writeStored(KEY(storageKey), JSON.stringify(next));
      }
      return next;
    });
  };

  return [widths, setWidth] as const;
}
