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

export function useTableWidths(
  id: string,
): readonly [Record<string, number>, (k: string, px: number) => void] {
  const [widths, setWidths] = useState<Record<string, number>>(
    () => safeParse(localStorage.getItem(KEY(id))) ?? {},
  );

  const setWidth = (colKey: string, px: number) => {
    setWidths((prev) => {
      const next = { ...prev, [colKey]: px };
      localStorage.setItem(KEY(id), JSON.stringify(next));
      return next;
    });
  };

  return [widths, setWidth] as const;
}
