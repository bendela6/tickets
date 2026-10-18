import type { ComponentType, ReactNode } from 'react';
import * as v from 'valibot';
import { defineRegistry, type RegistryOf } from '@bh/registry';
import { layoutData, type LayoutEntry, type LayoutProps } from '@bh/template';
import { componentSchema } from './renderer-registry';

/** What a template layout lays out. */
export type TemplateLayoutProps<O> = LayoutProps<O, ReactNode>;

/** A template layout: its spec and its React component. */
export type TemplateLayoutDefinition<O> = LayoutEntry<ComponentType<TemplateLayoutProps<O>>, O>;

/** Template layouts by name: bh's, and an app's own. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TemplateLayoutRegistry = RegistryOf<TemplateLayoutDefinition<any>>;

/** The empty template layout registry. `baseTemplateLayouts` registers bh's on it. */
export const noTemplateLayouts = defineRegistry({
  name: 'layout',
  schema: v.object({ ...layoutData.entries, Component: componentSchema }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  define: <O>(layout: TemplateLayoutDefinition<O>): TemplateLayoutDefinition<any> => layout,
});

/** Defines a template layout: checks it, types it by its options. Not a form's layout. */
export const defineTemplateLayout = noTemplateLayouts.define;
