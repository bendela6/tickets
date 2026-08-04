import { useState } from 'react';

const KEY = (id: string) => `tickets:table:${id}:widths`;

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

/**
 * Column widths, persisted per table.
 *
 * `id` is optional. Without one the widths still work, they just live as long
 * as the component — which is what a gallery demo, a test fixture or a
 * one-off panel wants. A table that has not been given a name has no business
 * writing to a user's localStorage under a made-up key, and a hook cannot be
 * called conditionally, so the choice has to live in here rather than at the
 * call site.
 */
export function useTableWidths(
  id?: string | null,
): readonly [Record<string, number>, (k: string, px: number) => void] {
  const [widths, setWidths] = useState<Record<string, number>>(
    () => (id ? safeParse(localStorage.getItem(KEY(id))) : null) ?? {},
  );

  const setWidth = (colKey: string, px: number) => {
    setWidths((prev) => {
      const next = { ...prev, [colKey]: px };
      if (id) {
        localStorage.setItem(KEY(id), JSON.stringify(next));
      }
      return next;
    });
  };

  return [widths, setWidth] as const;
}
