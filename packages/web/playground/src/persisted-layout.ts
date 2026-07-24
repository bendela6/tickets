import type { Layout } from 'react-resizable-panels';

// react-resizable-panels v4 dropped `autoSaveId` (v2's built-in localStorage
// persistence) in favor of `defaultLayout` + `onLayoutChanged`, leaving
// storage to the app. These two functions are the storage half — plain and
// unit-testable without touching the panels lib or a DOM.
export function loadLayout(key: string): Layout | undefined {
  let raw: string | null;
  try {
    raw = localStorage.getItem(key);
  } catch {
    return undefined;
  }
  if (!raw) return undefined;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Layout;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

export function saveLayout(key: string, layout: Layout): void {
  try {
    localStorage.setItem(key, JSON.stringify(layout));
  } catch {
    // Storage unavailable/full — persistence is a nice-to-have, not fatal.
  }
}
