# Porting Layout, Forms and Table from items-core — Design

Bring five things from `../items-core` into tickets: `Stack`, `Row`, a compound `Card`, the form
input/registry layer, and the full table stack (headless engine + styled adapter + column helpers),
finishing with `all-items-screen.tsx` migrated onto the new `Table`.

Everything ported is restyled onto Instrument tokens. items-core's UI predates the design system —
it hardcodes `bg-slate-100 dark:bg-slate-900`, `text-12`, `rounded-4`, `p-20`, has no tone scale and
no `variants()`. **Nothing is copy-pasted.** The source is a reference for behaviour and API, not for
markup.

## Decisions (locked with user)

1. **The form engine stays where it is.** `@tickets/form` and items-core's `@bw/form` export
   identical API surfaces, line for line — it is already a clean fork. No engine work.
2. **The form binding layer lives in `@tickets/ui`**, at `src/forms/`, and ships a ready-made
   `formRegistry` alongside the raw maps. `@tickets/ui` therefore gains a runtime dependency on
   `@tickets/form`. Considered and rejected: a third `@tickets/form-ui` package.
3. **The table keeps items-core's two-package split.** A new headless `@tickets/table` owns the
   logic and `@tanstack/react-virtual` and imports nothing from `@tickets/ui`; the styled adapter
   (`tableRender` + column helpers) lives at `@tickets/ui/src/table/`.
4. **Grouping goes into the engine**, and `all-items-screen.tsx` migrates onto the result. This is
   a feature items-core never built — its `Table` renders one flat virtualized list.
5. **Spacing uses Tailwind's own numbers**, as an enumerable union: `gap={4}`, `padding={4}`. Not a
   named `xs|sm|md|lg|xl` scale. See "Why not a named spacing scale" below.
6. **`Card` is compound** — `Card` / `CardHeader` / `CardTitle` / `CardBody` — and subsumes
   items-core's `SectionCard`, which is not ported.
7. **Delivery is Approach 1: faithful port, then extend.** The table engine lands as a verbatim
   port with items-core's tests, goes green, and only then gains grouping.

### Why not a named spacing scale

`docs/design/foundation-tokens.md` records spacing as a *deliberate* omission, not a gap:

> **Spacing** — Tailwind's default scale is already 4px-based. Tokenize only when density mode
> becomes real.
> **Control height** — Tailwind's `h-*` is already a numbered 4px scale. A size token would
> duplicate it.

items-core's `gap="md"` is exactly the duplication that second row rejects. A named scale would also
create two ways to say 16px — `gap="md"` on `Stack`, `gap-4` in every other component.

The values must still be **enumerable**: the safelist pipeline (`variants()` enumerates → Vite-SSR
extractor → `@source inline` → `tokens:verify` gates) cannot see a class built by interpolating a
free-form number. So `gap` is a union of the allowed Tailwind units, mapped through `variants()`.

## Package topology

```
@tickets/form      engine — UNCHANGED
@tickets/table     NEW — headless engine; owns @tanstack/react-virtual; zero UI imports
@tickets/ui        + components/{stack,row,card}
                   + src/forms/    binding layer + formRegistry
                   + src/table/    tableRender + render-* + column helpers
apps/web           src/form/registry.tsx shrinks
                   components/all-items/all-items-screen.tsx migrates
```

New dependency edges:

| Edge | Kind | Why |
|---|---|---|
| `@tickets/ui` → `@tickets/form` | value | `defineRegistry` in `forms/registry.ts`. The inputs themselves import only `import type { InputProps }`. |
| `@tickets/ui` → `@tickets/table` | value | Types for the adapter; the value import is the gallery demo rendering a real `Table`. |
| `@tickets/table` → `@tanstack/react-virtual` | value | The only new external dependency in the project. |

`@tanstack/react-virtual` is not currently in the workspace. The `add-package` skill runs before it
is installed.

`@tickets/ui` keeps `sideEffects: false`, so consumers that never import a form or a table still
tree-shake both subsystems out of their entry chunk.

## Stack and Row

```tsx
type Gap = 0 | 1 | 2 | 3 | 4 | 6 | 8;
type Align = 'start' | 'center' | 'end' | 'stretch';
type RowAlign = 'start' | 'center' | 'end' | 'baseline' | 'stretch';
type Justify = 'start' | 'center' | 'end' | 'between';

<Stack gap={4} align="start" />
<Row gap={2} align="center" justify="between" />
```

Both are built with `variants()`, every option a literal class string, so the extractor enumerates
them and `tokens:verify` passes. `Stack` is `flex flex-col`; `Row` is `flex flex-row` and defaults
to `align="center"`, which is what every call site in the ported layouts wants.

Neither takes a `tone`. They are structure, not surface.

## Card

```tsx
type CardRadius = 'md' | 'lg' | 'xl';
type Padding = Gap;   // same enumerable Tailwind units; applies to Card, CardHeader, CardBody

<Card radius="xl" padding={0} interactive>
  <CardHeader><CardTitle>Filters</CardTitle></CardHeader>
  <CardBody>…</CardBody>
</Card>
```

`Card` is surface only: `bg-surface-raised border border-gray-6 rounded-* overflow-hidden`, plus
`hover:border-gray-7 cursor-pointer` under `interactive`. `radius` covers `md|lg|xl` because all
three appear in the code being replaced.

**Padding rule.** `padding` lives on `Card` and defaults to `0`. `CardHeader` and `CardBody` carry
their own padding. So:

- A headerless card — the common case — writes `<Card padding={4}>…</Card>`.
- A card *with* a header leaves `padding` at `0`, so `CardHeader`'s bottom rule bleeds edge to edge.

Setting `padding` on `Card` *and* using `CardHeader` is the one combination that looks wrong. It is
a documented rule rather than a context-based mechanism, because the mechanism costs more than the
rule.

No `tone` axis. All 37 hand-rolled card surfaces in `apps/web` today are neutral; a tinted card would
be speculative.

### What Card replaces

`apps/web` hand-rolls the surface 37 times: `rounded-xl border border-gray-6` (26 sites),
`rounded-lg` (6), `rounded-md` (5), all on `bg-surface-raised`. Variance is confined to padding
(`p-3.5`, `p-4`, `px-4 py-3`, `px-5 py-4.5`), an optional `shadow-sm`, and `hover:border-gray-7` on
the clickable ones. Migrating those call sites is **not** in scope here — `Card` ships with demos,
and the sweep is a follow-up.

## Form layer — `@tickets/ui/src/forms/`

```
packages/web/ui/src/forms/
  inputs/{text,textarea,number,select,multi-select,toggle,json}/
  layouts.tsx        card · group · row · column
  field-wrapper.tsx
  root-wrapper.tsx
  registry.ts        baseInputs · baseLayouts · formRegistry
  index.ts
```

Every input is a thin adapter onto a primitive `@tickets/ui` already owns:

| Key | Wraps | Config | Value type |
|---|---|---|---|
| `text` | `Input` | `placeholder`, `mono`, `prefix` | `string` |
| `textarea` | `Textarea` | `rows`, `placeholder` | `string` |
| `number` | `NumberInput` | `min`, `max`, `step`, `suffix` | `number` |
| `select` | `Combobox` | `options` \| `loadOptions`, `placeholder`, `searchable` | `string` |
| `multi-select` | `MultiCombobox` | same | `string[]` |
| `toggle` | `Switch` | — | `boolean` |
| `json` | `Textarea` + `FieldError` | `rows`, `placeholder` | `string` |

Two deliberate improvements on the source, because tickets' primitives are better than items-core's:
`number` uses the dedicated `NumberInput` rather than `<Input type="number">`, and `multi-select`
uses `MultiCombobox` rather than a `multi` flag on `Combobox`.

Behaviours carried over from the source, each with a test:

- `number` clamps to `min`/`max` on change and ignores `NaN`.
- `toggle` calls `onBlur()` immediately after `onChange` so validation runs on toggle — a switch is
  never blurred in the normal sense.
- `json` re-parses on every value change (including external resets) and renders
  `Invalid JSON: <message>` through `FieldError`.
- `select` / `multi-select` are disabled while `loading` as well as while `disabled`.

`FieldWrapper` renders `FieldLabel` (with the required `*`), the input, an optional `description`,
and `FieldError`. The error line is **reserved and opacity-gated on `touched`** so the form does not
jump when a message appears. `RootWrapper` is `<Stack gap={4}>`.

Layouts: `card` → `Card`/`CardHeader`/`CardBody` · `group` → `Stack` with a top rule and optional
title/description · `row` → `Row` · `column` → `Stack`.

`registry.ts` exports three things: `baseInputs`, `baseLayouts`, and a ready-made `formRegistry`
assembled from them. **`formRegistry` has no consumer today** — apps/web needs `directory`, so it
assembles its own from the base maps. It ships for consumers that need no app-specific inputs, and
is an accepted piece of dead weight; if a second app never appears, delete it rather than let it
drift out of sync with the maps.

### apps/web registry after the change

`DirectoryPicker` imports terminal components and calls `/api/workdir-roots`, so it cannot move into
`@tickets/ui` without breaking `components/domain-free.test.ts`. The app keeps a short registry:

```tsx
export const formRegistry = defineRegistry({
  inputs: { ...baseInputs, directory: { Component: DirectoryInput, defaultValue: '' } },
  layouts: baseLayouts,
  field: { Component: FieldWrapper },
  root: { Component: RootWrapper },
});
```

Down from 41 lines to about 10, gaining six inputs, four layouts and a root wrapper. The only
consumer today is `apps/web/src/components/terminal/new-session-dialog.tsx`, so the blast radius is
one screen.

## Table — `@tickets/table`

### Phase B — verbatim port

`Table.tsx`, `types.ts`, `sort-utils.ts`, `use-column-resize.ts`, `use-table-widths.ts`,
`render-stub.tsx`, and their tests (`Table.test.tsx` 155 lines, `sort-utils.test.ts` 43,
`use-column-resize.test.tsx` 37, `use-table-widths.test.ts` 26). The only edits are `@bw/table` →
`@tickets/table` and the test runner config. This suite is the regression net for Phase C, so it
goes green before anything else moves.

The engine is render-injected: it computes layout, sort and virtualization, then calls the caller's
`TableRender` for every DOM node. It contains no styling and no `@tickets/ui` import.

### Phase C — grouping

The engine flattens groups into a single virtualized list:

```ts
type VirtualRow<T> =
  | { kind: 'group'; key: string; header: ReactNode }
  | { kind: 'row'; row: T; index: number };
```

Changes, all additive:

- `TableProps<T>` accepts `groups?: TableGroup<T>[]` as an alternative to `rows`.
- `useVirtualizer` counts the flattened list; `estimateSize(i)` returns `GROUP_ROW_HEIGHT` for a
  group item and `ROW_HEIGHT` for a data row. `GROUP_ROW_HEIGHT` is a new exported constant
  alongside the existing `ROW_HEIGHT` (40), so the adapter and the engine cannot disagree about it.
- `TableRender<T>` gains `groupHeader: (ctx: RenderGroupHeaderCtx) => ReactNode`.
- One scroll region and one sticky column header for the whole table; group headers scroll with the
  content. This matches what `all-items-screen` does today.

An ungrouped table is unchanged — `rows` still works, and the flattened list is just the rows.

## Table adapter — `@tickets/ui/src/table/`

`tableRender` plus `render-root`, `render-thead`, `render-th`, `render-tbody`, `render-tr`,
`render-td`, `render-skeleton-row`, `render-error`, `render-group-header`, restyled onto tokens
(`border-gray-6`, `bg-surface-raised`, `bg-gray-1`, `text-ui`, `text-meta`, the tone scale).

Seven column helpers. Three collapse onto components tickets already owns:

| Helper | Implementation |
|---|---|
| `TextColumn` | truncating text |
| `NumberColumn` | right-aligned, `tabular-nums` |
| `DateColumn` | **`RelativeDate`** |
| `LinkColumn` | anchor |
| `BadgeColumn` | **`Pill`** |
| `ImageColumn` | **`Avatar`** |
| `ActionsColumn` | **`Menu`** |

## all-items migration

`apps/web/src/components/all-items/all-items-screen.tsx` is 631 lines and hand-rolls the table:
`gridTemplateColumns` computed by hand, a sticky header block, `role="row"` divs, and grouping by
project or status kind.

Deleted: the grid template, the sticky header, the row loop.
Kept: `ColumnsPopover`, `GlobalFilterChips`, `global-views.ts`, `shared-fields.ts`, `getCellContent`.
Mapped: `columnWidthFor(id, sharedByKey)` → `Column.width`; the two grouping modes → `groups`.
Gained: column sorting and drag resize, which the screen does not have today.

Its 313 lines of tests (`all-items-screen.test.tsx`) are the acceptance gate and must stay green
without being rewritten to match the implementation.

## Sequencing

| Phase | Contents | Gate |
|---|---|---|
| A1 | `Stack`, `Row` | ui tests + demos + `tokens:verify` |
| A2 | `Card`, `CardHeader`, `CardTitle`, `CardBody` | ui tests + demos + `tokens:verify` |
| A3 | `src/forms/` + shrink apps/web registry | ui tests, new-session-dialog still works |
| B | `@tickets/table` verbatim port | items-core's ported tests green |
| C | grouping in the engine | new grouping tests + Phase B tests still green |
| D1 | `src/table/` adapter + column helpers | ui tests + demos |
| D2 | all-items-screen migration | its existing 313 lines of tests green |

A and B/C/D are independent tracks; A ships first because it is smaller, carries no new dependency,
and the form layouts depend on `Stack`/`Row`/`Card`.

One commit per phase, conventional and scoped: `feat(ui): …`, `feat(table): …`, `refactor(web): …`.

## Verification

- `pnpm typecheck`
- `pnpm --filter @tickets/web test`
- `pnpm --filter @tickets/ui test` · `pnpm --filter @tickets/table test`
- `pnpm --filter @tickets/ui tokens:verify` — the safelist gate must accept the new enumerable
  `gap-*`, `p-*` and `rounded-*` classes
- `pnpm build`
- Gallery demos for `Stack`, `Row`, `Card`, `Table` (grouped and flat), each column helper and each
  form input, reachable at `/gallery/:slug/:tab`

Per `verifying-a-component`: tests assert observable behaviour, not CSS class strings or DOM shape.

## Out of scope

- Migrating the 37 existing card surfaces onto `Card` — follow-up sweep.
- The other 16 components missing from items-core (`Page`, `PageHeader`, `Sidebar`,
  `SidebarNavItem`, `SidebarUserCard`, `Skeleton`, `SearchInput`, `StatCard`, `EmptyState`,
  `Toolbar`, `ThemeSelector`, `themes.ts`, `useDebouncedValue`, `useViewport`, `BREAKPOINTS`,
  `SectionCard`). `Toolbar` and `SectionCard` are deliberately dropped, not deferred — `Toolbar` is
  dead code in items-core and `Row` covers it; `SectionCard` is subsumed by `Card`.
- Any change to `@tickets/form`.

## Types

Types named above and not defined inline:

```ts
// @tickets/table
interface Column<T> {
  key: string;
  header: string;
  value?: (row: T) => unknown;
  render?: (row: T) => ReactNode;
  as?: Renderer<any>;
  sortable?: boolean;
  width?: number;
  minWidth?: number;
  align?: 'left' | 'right' | 'center';
  resizable?: boolean;
}

type Renderer<V = unknown> = (props: { value: V; row: unknown }) => ReactNode;

interface SortBy<F extends string = string> { field: F; direction: 'asc' | 'desc' }

interface TableGroup<T> { key: string; header: ReactNode; rows: T[] }

interface RenderGroupHeaderCtx {
  key: string;
  header: ReactNode;
  gridTemplate: string;
  style: CSSProperties;   // virtualization positioning; MUST be applied
}

interface TableRender<T = unknown> {
  root: (ctx: RenderRootCtx) => ReactNode;
  thead: (ctx: RenderTheadCtx) => ReactNode;
  th: (ctx: RenderThCtx<T>) => ReactNode;
  tbody: (ctx: RenderTbodyCtx) => ReactNode;
  tr: (ctx: RenderTrCtx<T>) => ReactNode;
  td: (ctx: RenderTdCtx<T>) => ReactNode;
  groupHeader: (ctx: RenderGroupHeaderCtx) => ReactNode;   // added in Phase C
  skeletonRow: (ctx: RenderSkeletonRowCtx<T>) => ReactNode;
  error: (ctx: RenderErrorCtx) => ReactNode;
}

interface TableProps<T> {
  columns: Column<T>[];
  rows?: T[];
  groups?: TableGroup<T>[];        // added in Phase C; alternative to rows
  state: { sort: SortBy[]; widths: Record<string, number> };
  onSortChange: (next: SortBy[]) => void;
  onWidthChange: (key: string, px: number) => void;
  onRowClick?: (row: T) => void;
  isLoading: boolean;
  error?: Error | null;
  render: TableRender<T>;
}

// @tickets/form (existing — reproduced verbatim from
// packages/web/form/src/types/registry.ts, unchanged by this work)
interface InputProps<TConfigResolved, TValue> {
  name: string;
  value: TValue;
  onChange: (next: TValue) => void;
  onBlur: () => void;
  config: TConfigResolved;
  error?: string;
  disabled?: boolean;
  loading: boolean;
  configError?: Error;
}

interface FieldWrapperProps {
  name: string;
  label?: string;          // string, not ReactNode
  description?: string;
  required: boolean;       // required, not optional
  error?: string;
  touched: boolean;
  loading: boolean;
  configError?: Error;
  children: ReactNode;
}

interface RootWrapperProps { children: ReactNode }

interface LayoutComponentProps<TProps> { props: TProps; children: ReactNode }
```
