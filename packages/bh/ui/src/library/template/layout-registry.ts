import type { ComponentType, ReactNode } from 'react';
import {
  baseLayoutSpecs,
  type BaseLayouts,
  type LayoutEntry,
  type LayoutProps,
} from '@bh/template';
import { FlexLayout, GridLayout, RepeatLayout } from './layouts';

/** What a template layout is given: its options and its items, already drawn. */
export type TemplateLayoutProps<O> = LayoutProps<O, ReactNode>;

/**
 * A template layout as @bh/ui registers it: its spec from @bh/template (its
 * options' schema, whether it repeats) and the component that lays out its
 * items.
 */
export type TemplateLayoutDefinition<O> = LayoutEntry<ComponentType<TemplateLayoutProps<O>>, O>;

/** Template layouts by the name a layout node gives: bh's three, and an app's own beside them. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TemplateLayoutRegistry = Record<string, TemplateLayoutDefinition<any>>;

/**
 * bh's three template layouts, one set for every host: flex, grid and
 * repeat. An app spreads them and adds its own, as a form's layouts are; an
 * overlay, layers anchored on a base part, is an app's to register:
 * `{ ...baseTemplateLayouts, overlay: { options: overlayOptions, Component: Overlay } }`.
 * Not `baseLayouts`, which are a form's.
 */
export const baseTemplateLayouts = {
  flex: { ...baseLayoutSpecs.flex, Component: FlexLayout },
  grid: { ...baseLayoutSpecs.grid, Component: GridLayout },
  repeat: { ...baseLayoutSpecs.repeat, Component: RepeatLayout },
} satisfies { [K in keyof BaseLayouts]: TemplateLayoutDefinition<BaseLayouts[K]> };
