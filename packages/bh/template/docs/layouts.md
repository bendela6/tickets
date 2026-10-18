---
title: Layouts
summary: A layout places a template's nodes. bh registers its own; an app adds more.
order: 2
related: [Overview, Renderers, Formats]
---

[//]: # 'written from layouts.doc.yaml by pnpm docs:sync; edit that file, not this one'

# Layouts

A layout node places the nodes it holds. It names a layout in `layout`
and sets its `options`.

**Every layout**

```tsx
import type { TemplateField, TemplateNode } from '@bh/template';
import { Template } from '@bh/ui';

const FIELDS: TemplateField[] = [
  { key: 'title', label: 'Title', type: { kind: 'text' } },
  {
    key: 'status',
    label: 'Status',
    type: {
      kind: 'option',
      settings: { options: [{ value: 'open', label: 'Open', color: 'green' }] },
    },
  },
  { key: 'seats', label: 'Seats', type: { kind: 'number' } },
  { key: 'floor', label: 'Floor', type: { kind: 'number' } },
  { key: 'booked', label: 'Booked', type: { kind: 'date' } },
  { key: 'tags', label: 'Tags', type: { kind: 'text', many: true } },
];

const RECORD = {
  title: 'Repaint the hall',
  status: 'open',
  seats: 40,
  floor: 2,
  booked: '2026-07-13',
  tags: ['paint', 'walls', 'floor', 'stairs', 'doors'],
};

const TEMPLATE: TemplateNode = {
  layout: 'stack',
  options: { gap: 3 },
  nodes: [
    {
      layout: 'row',
      options: { justify: 'between', gap: 2 },
      nodes: [{ field: 'title', options: { weight: 600 } }, { field: 'status' }],
    },
    {
      layout: 'grid',
      options: { columns: 3, gap: 2 },
      nodes: [{ text: '{seats} seats' }, { text: 'Floor {floor}' }, { field: 'booked' }],
    },
    {
      layout: 'repeat',
      options: { field: 'tags', max: 3, gap: 1 },
      nodes: [{ field: 'tags', renderer: 'pill' }],
    },
  ],
};

export function EveryLayout() {
  return <Template template={TEMPLATE} record={RECORD} fields={FIELDS} />;
}
```

## The registry

`defineTemplateLayout`, in `@bh/ui`, checks a layout's options schema,
how it repeats and its component, and types it by its options.

`packages/web/ui/src/library/template/layout-registry.ts`, line 1:

```ts
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
```

## The layouts

`gap` is a spacing step: `0`, `1`, `2`, `3`, `4`, `6` or `8`.
`repeat` gives each pass one entry of `field`, up to `max`.

| Name     | Description                                                               | Options                                                      |
| -------- | ------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `row`    | Its items side by side.                                                   | `justify`, `align`, `gap`, `wrap`                            |
| `stack`  | Its items one under another.                                              | `align`, `gap`                                               |
| `grid`   | Its items in columns.                                                     | `columns` (required), `gap`, `align`                         |
| `repeat` | Its items once per entry of a list field, in a row, then "+N" past `max`. | `field` (required), `max`, `justify`, `align`, `gap`, `wrap` |

### row

`packages/web/ui/src/library/template/layouts/row.tsx`, line 1:

```tsx
import * as v from 'valibot';
import { cn } from '../../../style';
import { Row } from '../../layout/components/row';
import { defineTemplateLayout, type TemplateLayoutProps } from '../layout-registry';
import { gap } from './options';
import { placed } from './placed';

/** Row's options; repeat takes them too. */
export const rowEntries = {
  /** Along the row. Default `start`. */
  justify: v.optional(v.picklist(['start', 'center', 'end', 'between'])),
  /** Across the row. Default `center`. */
  align: v.optional(v.picklist(['start', 'center', 'end', 'stretch', 'baseline'])),
  /** Space between nodes. Default `0`. */
  gap: v.optional(gap),
  /** Wraps nodes that don't fit. Default `false`. */
  wrap: v.optional(v.boolean()),
};

const rowOptions = v.strictObject(rowEntries);

export type RowOptions = v.InferOutput<typeof rowOptions>;

/** Its items side by side. */
export function TemplateRowLayout({ options, items }: TemplateLayoutProps<RowOptions>) {
  const { justify, align = 'center', gap = 0, wrap } = options;
  return (
    <Row gap={gap} align={align} justify={justify} className={cn('min-w-0', wrap && 'flex-wrap')}>
      {placed(items)}
    </Row>
  );
}

export const rowLayout = defineTemplateLayout({
  options: rowOptions,
  Component: TemplateRowLayout,
});
```

### stack

`packages/web/ui/src/library/template/layouts/stack.tsx`, line 1:

```tsx
import * as v from 'valibot';
import { Stack } from '../../layout/components/stack';
import { defineTemplateLayout, type TemplateLayoutProps } from '../layout-registry';
import { gap } from './options';
import { placed } from './placed';

const stackOptions = v.strictObject({
  /** Across the stack. Default `stretch`. */
  align: v.optional(v.picklist(['start', 'center', 'end', 'stretch'])),
  /** Space between nodes. Default `0`. */
  gap: v.optional(gap),
});

export type StackOptions = v.InferOutput<typeof stackOptions>;

/** Its items one under another. */
export function TemplateStackLayout({ options, items }: TemplateLayoutProps<StackOptions>) {
  const { align, gap = 0 } = options;
  return (
    <Stack gap={gap} align={align} className="min-w-0">
      {placed(items)}
    </Stack>
  );
}

export const stackLayout = defineTemplateLayout({
  options: stackOptions,
  Component: TemplateStackLayout,
});
```

### grid

`packages/web/ui/src/library/template/layouts/grid.tsx`, line 1:

```tsx
import * as v from 'valibot';
import { cn } from '../../../style';
import { ALIGN, GAP } from '../../layout/components/stack';
import { defineTemplateLayout, type TemplateLayoutProps } from '../layout-registry';
import { count, gap } from './options';
import { placed } from './placed';

const gridOptions = v.strictObject({
  /** A count (`2`), or as many as fit at a least width (`{ min: 160 }`). */
  columns: v.union([count, v.strictObject({ min: count })]),
  /** Space between rows and columns. Default `0`. */
  gap: v.optional(gap),
  /** Each node in its cell. Default `stretch`. */
  align: v.optional(v.picklist(['start', 'center', 'end', 'stretch'])),
});

export type GridOptions = v.InferOutput<typeof gridOptions>;

/** Its items in columns. */
export function TemplateGridLayout({ options, items }: TemplateLayoutProps<GridOptions>) {
  const { columns, gap = 0, align = 'stretch' } = options;
  // A count, or as many as fit: no class spells every one.
  const tracks =
    typeof columns === 'number'
      ? `repeat(${columns}, minmax(0, 1fr))`
      : `repeat(auto-fill, minmax(min(100%, ${columns.min}px), 1fr))`;
  return (
    <div
      className={cn('grid min-w-0', GAP[gap], ALIGN[align])}
      style={{ gridTemplateColumns: tracks }}
    >
      {placed(items)}
    </div>
  );
}

export const gridLayout = defineTemplateLayout({
  options: gridOptions,
  Component: TemplateGridLayout,
});
```

### repeat

`packages/web/ui/src/library/template/layouts/repeat.tsx`, line 1:

```tsx
import * as v from 'valibot';
import { defineTemplateLayout, type TemplateLayoutProps } from '../layout-registry';
import { count } from './options';
import { rowEntries, TemplateRowLayout } from './row';

const repeatOptions = v.strictObject({
  ...rowEntries,
  /** The list field: a many field, or a json list. */
  field: v.pipe(v.string(), v.nonEmpty()),
  /** The most entries drawn; the rest show as "+N". Default all. */
  max: v.optional(count),
});

export type RepeatOptions = v.InferOutput<typeof repeatOptions>;

/** Its items once per entry of a list field, in a row, then "+N" past `max`. */
export function TemplateRepeatLayout({ options, items, more }: TemplateLayoutProps<RepeatOptions>) {
  const counted =
    more > 0 ? (
      <span className="text-gray-11 tabular-nums">
        +{more}
        <span className="sr-only"> more</span>
      </span>
    ) : null;
  return (
    <TemplateRowLayout options={options} items={counted ? [...items, counted] : items} more={0} />
  );
}

export const repeatLayout = defineTemplateLayout({
  options: repeatOptions,
  repeats: ({ field, max }) => {
    return max === undefined ? { field } : { field, max };
  },
  Component: TemplateRepeatLayout,
});
```

## Registering them

`baseTemplateLayouts` registers bh's layouts. `BaseLayouts` types their
options: a `TemplateNode<BaseLayouts>` checks its layouts.

`packages/web/ui/src/library/template/base-layouts.ts`, line 1:

```ts
import { noTemplateLayouts } from './layout-registry';
import { gridLayout, type GridOptions } from './layouts/grid';
import { repeatLayout, type RepeatOptions } from './layouts/repeat';
import { rowLayout, type RowOptions } from './layouts/row';
import { stackLayout, type StackOptions } from './layouts/stack';

/**
 * bh's layouts, by name, with their options. A template typed with them:
 * `TemplateNode<BaseLayouts>`. An app's extend them.
 */
export interface BaseLayouts {
  row: RowOptions;
  stack: StackOptions;
  grid: GridOptions;
  repeat: RepeatOptions;
}

/** bh's four template layouts. Not `baseLayouts`, which are a form's. */
export const baseTemplateLayouts = noTemplateLayouts.register({
  row: rowLayout,
  stack: stackLayout,
  grid: gridLayout,
  repeat: repeatLayout,
});
```

## Your own layout

Define a layout with `defineTemplateLayout`, then register it. `register`
returns a new registry; `baseTemplateLayouts` is unchanged. The component
gets its options and its `items`, already drawn.

```tsx
import * as v from 'valibot';
import { baseTemplateLayouts, defineTemplateLayout, type TemplateLayoutProps } from '@bh/ui';

const overlay = v.strictObject({ corner: v.picklist(['start', 'end']) });

// The first node, with the rest over one of its corners.
function Overlay({
  options,
  items: [base, ...layers],
}: TemplateLayoutProps<v.InferOutput<typeof overlay>>) {
  const corner = options.corner === 'end' ? 'right-0' : 'left-0';
  return (
    <div className="relative">
      {base}
      <div className={`absolute top-0 ${corner}`}>{layers}</div>
    </div>
  );
}

export const layouts = baseTemplateLayouts.register({
  overlay: defineTemplateLayout({ options: overlay, Component: Overlay }),
});
```

```ts
type TemplateLayoutProps<O> = LayoutProps<O, ReactNode>;
```

What a template layout lays out.

| Member               | Type           | Default | Description                                          |
| -------------------- | -------------- | ------- | ---------------------------------------------------- |
| `options` (required) | `O`            |         | Its options, as the node gives them.                 |
| `items` (required)   | `readonly N[]` |         | Its drawn nodes, in order. Empty parts are left out. |
| `more` (required)    | `number`       |         | Entries past `max`, for a repeating layout. Else 0.  |
