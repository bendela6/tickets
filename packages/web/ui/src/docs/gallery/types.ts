import type { ReactNode } from 'react';
import type { AnyPlayground } from './controls';
import type { DefinedState, StateView } from './states';

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

/** The pre-`defineState` literal. Still valid, still ignored when the demo has
 *  a playground to derive axes from — see `defineState` for why. */
export interface DemoState {
  name: string;
  render: () => ReactNode;
}

export type AnyDemoState = DemoState | DefinedState;

/** Both forms, normalised: `title` and `name` become one field, and `defined`
 *  records which form it arrived in — the flag the state grid reads to decide
 *  between the authored page and the derived one. */
export interface CollectedState {
  name: string;
  /** Takes the view whether or not it wants it — a legacy `() => ReactNode`
   *  is assignable here, which is how sections that predate a view setting
   *  keep working without being touched. */
  render: (view: StateView) => ReactNode;
  slug: string;
  defined: boolean;
}

export interface DemoModule {
  meta: DemoMeta;
  /** Optional: a demo with a playground and nothing authored gets the derived
   *  page, which is most of them. */
  states?: AnyDemoState[];
  playground?: AnyPlayground;
}

export type CollectedDemo =
  | { path: string; slug: string; meta: DemoMeta; states: CollectedState[]; playground?: AnyPlayground }
  | { path: string; error: string };

export function isDemoError(d: CollectedDemo): d is { path: string; error: string } {
  return 'error' in d;
}
