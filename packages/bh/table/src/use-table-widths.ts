import { useCallback } from 'react';
import { usePersistedState } from '@bh/hooks';

// The app names the key and the engine only appends what it keeps under it,
// as @bh/ui's panels do (`${storageKey}:width`). No prefix of its own: two
// apps on one origin stay apart by the keys they hand in (`shop:orders`).
const KEY = (storageKey: string) => `${storageKey}:widths`;

const NONE: Record<string, number> = {};

/** Stored widths: an object, or unset for anything else. */
function parseWidths(raw: string): Record<string, number> | undefined {
  const parsed: unknown = JSON.parse(raw);
  return typeof parsed === 'object' && parsed !== null
    ? (parsed as Record<string, number>)
    : undefined;
}

// A table that has not been given a name has no business writing to a user's
// localStorage under a made-up key, and a hook cannot be called
// conditionally, so the choice has to live in here rather than at the call
// site: without a key, usePersistedState is plain state.
/**
 * Column widths, saved per table under `${storageKey}:widths`: the state a
 * `<Table>` takes as `state.widths`, and the setter it takes as
 * `onWidthChange`.
 *
 * Without a `storageKey` the widths live as long as the component. A storage
 * that can't be read or written (turned off, or full) is treated as empty.
 * Two tables under one key, on the page or in the app's other tabs, share
 * their widths.
 *
 * @param storageKey The app's name for this table, such as `shop:orders`.
 * @returns The widths by column key, and a setter taking a key and a width.
 */
export function useTableWidths(
  storageKey?: string | null,
): readonly [Record<string, number>, (k: string, px: number) => void] {
  const [widths, setWidths] = usePersistedState({
    key: storageKey ? KEY(storageKey) : undefined,
    defaultValue: NONE,
    parse: parseWidths,
  });

  const setWidth = useCallback(
    (colKey: string, px: number) => {
      setWidths((prev) => ({ ...prev, [colKey]: px }));
    },
    [setWidths],
  );

  return [widths, setWidth] as const;
}
