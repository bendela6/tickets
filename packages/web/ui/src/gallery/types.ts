import type { ReactNode } from 'react';

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
}

export type CollectedDemo =
  | { slug: string; meta: DemoMeta; states: (DemoState & { slug: string })[] }
  | { path: string; error: string };

export function isDemoError(d: CollectedDemo): d is { path: string; error: string } {
  return 'error' in d;
}
