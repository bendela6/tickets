import type { ComponentType } from 'react';
import * as v from 'valibot';
import { defineRegistry, type RegistryOf } from '@bh/registry';
import { rendererData, type RendererEntry, type RendererProps } from '@bh/template';

/** A renderer: its spec and its React component. */
export type RendererDefinition<O = Record<string, never>> = RendererEntry<
  ComponentType<RendererProps<O>>,
  O
>;

/** Renderers by name. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RendererRegistry = RegistryOf<RendererDefinition<any>>;

/** A React component: a function, a class, or a memo, forwardRef or lazy. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const componentSchema = v.custom<ComponentType<any>>((value) => {
  return (
    typeof value === 'function' ||
    (typeof value === 'object' && value !== null && '$$typeof' in value)
  );
}, 'its Component is a component');

/** The empty renderer registry. */
export const noRenderers = defineRegistry({
  name: 'renderer',
  schema: v.object({ ...rendererData.entries, Component: componentSchema }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  define: <O>(renderer: RendererDefinition<O>): RendererDefinition<any> => renderer,
});
