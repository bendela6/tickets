import type { ReactNode } from 'react';
import type { AnyPlayground } from './controls';

export interface DemoMeta {
  title: string;
  group: string;
  order?: number;
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
