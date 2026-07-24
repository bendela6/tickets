import type { ReactNode } from 'react';
import type { AnyPlayground } from './controls';

// How much horizontal room this component needs to render honestly. Drives
// the states-grid column width (and nothing else) — a Spinner in a 340px cell
// looks lost, a MessageStream in a 220px one wraps into nonsense.
export const DEMO_SIZES = ['sm', 'md', 'lg', 'full'] as const;
export type DemoSize = (typeof DEMO_SIZES)[number];

export interface DemoMeta {
  title: string;
  group: string;
  order?: number;
  /** Container width for this demo's state cells. Defaults to 'md'. */
  size?: DemoSize;
  /**
   * The component file(s) behind this demo, shown in the Implementation tab.
   * Paths are relative to the demo file. Defaults to the demo's own path with
   * `.demo` dropped (`pill.demo.tsx` -> `pill.tsx`).
   */
  impl?: string | string[];
}

export interface DemoState {
  name: string;
  render: () => ReactNode;
}

export interface DemoModule {
  meta: DemoMeta;
  states: DemoState[];
  playground?: AnyPlayground;
}

export type CollectedDemo =
  | { path: string; slug: string; meta: DemoMeta; states: (DemoState & { slug: string })[]; playground?: AnyPlayground }
  | { path: string; error: string };

export function isDemoError(d: CollectedDemo): d is { path: string; error: string } {
  return 'error' in d;
}
