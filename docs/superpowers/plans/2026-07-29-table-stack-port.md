# Table Stack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a headless `@tickets/table` engine ported from items-core, extend it with grouping, build the styled adapter and column helpers in `@tickets/ui`, and migrate `all-items-screen.tsx` onto the result.

**Architecture:** The engine computes layout, sorting and virtualization, then calls a caller-supplied `TableRender` for every DOM node — it contains no styling and imports nothing from `@tickets/ui`. The adapter in `@tickets/ui/src/table/` supplies the Instrument-styled slots plus cell-content helpers. Ported verbatim first with items-core's own tests as the regression net, then extended.

**Tech Stack:** React 19 · TypeScript · `@tanstack/react-virtual` · Tailwind v4 · vitest + @testing-library/react · pnpm workspaces

Spec: `docs/superpowers/specs/2026-07-29-items-core-ui-port-design.md`
Source: `../items-core/packages/web/table/src/` and `../items-core/packages/web/ui/src/table/`
Prerequisite: **Plan 1 Task 1 must be merged** — the adapter's demos use `Stack`. Nothing else in Plan 1 is required.

## Global Constraints

- **The engine imports nothing from `@tickets/ui`.** That separation is the whole reason it is its own package. If a task seems to need a UI import, the thing you want belongs in a render slot instead.
- **Never copy items-core's markup.** Their table slots are `bg-slate-100 dark:bg-slate-900`, `text-14`, `border-1`, `px-12`, `text-[12px]`. Ports go through Instrument tokens: `bg-surface-raised`, `bg-gray-1`, `border-gray-6`, `text-gray-9/11/12`, `text-13/19`, `text-12/17`, `text-11/13`, and the tone scale via `toneClasses`.
- **No arbitrary `[...]` Tailwind values.** items-core's helpers use `text-[12px]`, `text-[12.5px]`, `text-[10px]`, `rounded-[4px]` — every one must become a named token or a round scale step.
- **THREE Tailwind namespaces are cleared in `tokens.css` and only the listed values exist.** Anything outside them compiles to *nothing* and renders unstyled. `tokens:verify` does **not** catch any of it, so review is the only gate.

  | Cleared | What exists | Dead → use instead |
  |---|---|---|
  | `--text-*` (line 569) | `--text-9` … `--text-24`, numeric only | `text-ui`→**`text-13/19`** · `text-meta`→**`text-12/17`** · `text-label`→**`text-11/13 tracking-wider`** · no `text-32` |
  | `--font-weight-*` (line 693) | `400`, `500`, `600` only | `font-semibold`→**`font-600`** · `font-medium`→**`font-500`** · no `font-bold` |
  | `--color-*` (line 380) | the named ramps only | see the tone rule below |

  Radius and spacing are **not** cleared — `rounded-md/lg/xl`, `p-3`, `gap-2` work normally.

- **`primary` / `danger` / `neutral` etc. are TONES, not colour families.** There is no `primary-11` or `primary-8` utility. Paint with **`toneClasses(tone, emphasis)`** — `toneClasses('primary','text')` resolves through `TONE_SCALE` (`primary` → `indigo`) to `text-indigo-11`. Never write a rung number against a tone name. `gray-*`, `red-*`, `indigo-*` and the other hues *can* be indexed directly.
- **Verbatim-port tasks change three things only:** the import specifier `@bw/table` → `@tickets/table`, the localStorage key prefix, and formatting. Do not "improve" logic in a port task — Task 4 and Task 5 are where changes belong.
- Tests assert observable behaviour. The engine's tests do this through `makeStubRender`, whose slots emit `data-slot` markers — assert on those, never on styled chrome.
- Conventional commits: `feat(table): …`, `feat(ui): …`, `refactor(web): …`. One commit per task.

## Three engine gaps found while reading the migration target

`all-items-screen.tsx` needs things items-core's engine cannot express. Tasks 4 and 5 add them; they are not optional polish.

| Gap | Why it blocks the migration | Fixed in |
|---|---|---|
| **Fixed `ROW_HEIGHT = 40`** | The screen has a density toggle — rows are `h-8` (32px) compact, `h-10.5` (42px) comfortable. A virtualizer with a hardcoded height would misposition every row in one of the two modes. | Task 4 — `rowHeight` prop |
| **Column widths are px-only** — `` `${widths[key] ?? col.width ?? 160}px` `` | The screen's Title column is `minmax(240px, 1fr)`, which no number can express. | Task 4 — `width?: number \| string` |
| **No grouping** | The screen groups by project or status kind with header rows between. items-core renders one flat list. | Task 5 — `groups` prop |

A fourth difference needs **no** engine change: the engine renders nothing when `rows` is empty and not loading, and the screen wants its `ScreenState`. The screen keeps rendering that itself and only mounts `<Table>` when it has rows.

## File Structure

```
packages/web/table/                              NEW PACKAGE
  package.json  tsconfig.json  vitest.config.ts                     Task 1
  src/
    types.ts                                                        Task 1
    sort-utils.ts        sort-utils.test.ts                         Task 1
    use-table-widths.ts  use-table-widths.test.ts                   Task 2
    use-column-resize.ts use-column-resize.test.tsx                 Task 2
    Table.tsx            Table.test.tsx                             Task 3
    render-stub.tsx                                                 Task 3
    flatten-groups.ts    flatten-groups.test.ts                     Task 5
    index.ts                                                  Tasks 1,3,4,5

packages/web/ui/src/table/                       NEW SUBTREE
  render-root.tsx  render-thead.tsx  render-th.tsx                  Task 6
  render-tbody.tsx render-tr.tsx     render-td.tsx                  Task 6
  render-skeleton-row.tsx  render-error.tsx                         Task 6
  render-group-header.tsx                                           Task 7
  table-render.ts                                             Tasks 6,7
  columns/text-column.tsx  number-column.tsx                        Task 8
  columns/date-column.tsx  link-column.tsx                          Task 8
  columns/badge-column.tsx image-column.tsx  actions-column.tsx     Task 9
  table.demo.tsx  index.ts                                          Task 10
packages/web/ui/src/index.ts                             modified: Task 10
packages/web/ui/package.json                             modified: Task 6

apps/web/src/components/all-items/all-items-screen.tsx   modified: Task 11
```

---

### Task 1: Scaffold @tickets/table with types and sort utils

**Files:**
- Create: `packages/web/table/package.json`, `tsconfig.json`, `vitest.config.ts`
- Create: `packages/web/table/src/types.ts`, `sort-utils.ts`, `sort-utils.test.ts`, `index.ts`

**Interfaces:**
- Produces: `Column<T>`, `Renderer<V>`, `SortBy<F>`, `TableRender<T>`, every `Render*Ctx`, `ROW_HEIGHT`, `toggleSort`, `multiSortToggle`. Everything downstream depends on these names.

- [ ] **Step 1: Get approval for the new dependency**

`@tanstack/react-virtual` is not in the workspace. **Invoke the `add-package` skill** before installing it — it presents candidates and waits for explicit approval. Do not run `pnpm add` first.

Once approved:

```bash
pnpm --filter @tickets/table add @tanstack/react-virtual
```

- [ ] **Step 2: Create the package manifest**

Create `packages/web/table/package.json`, mirroring `packages/web/form/package.json`'s toolchain pins:

```json
{
  "name": "@tickets/table",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "sideEffects": false,
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@tanstack/react-virtual": "^3.13.24"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.9.1",
    "@testing-library/react": "^16.3.2",
    "@types/react": "^19.2.14",
    "@typescript/native": "npm:typescript@^7.0.2",
    "@vitejs/plugin-react": "^6.0.1",
    "jsdom": "^29.1.1",
    "react": "^19.2.5",
    "react-dom": "^19.2.5",
    "typescript": "npm:@typescript/typescript6@^6.0.2",
    "vitest": "^4.1.10"
  },
  "peerDependencies": { "react": "^19.0.0" }
}
```

Create `packages/web/table/tsconfig.json`:

```json
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ES2022", "DOM"],
    "jsx": "react-jsx",
    "types": ["vitest/globals", "node", "@testing-library/jest-dom/vitest"]
  },
  "include": ["src"]
}
```

Create `packages/web/table/vitest.config.ts`:

```ts
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
```

Run: `pnpm install`
Expected: the workspace picks up the new package

- [ ] **Step 3: Port types.ts**

Copy `../items-core/packages/web/table/src/types.ts` to `packages/web/table/src/types.ts` **unchanged**. It has no imports to rewrite — it imports only from `react`. Keep `ROW_HEIGHT = 40` as the default; Task 4 makes it overridable rather than removing it.

- [ ] **Step 4: Write the failing test for the sort utils**

Create `packages/web/table/src/sort-utils.test.ts` by copying `../items-core/packages/web/table/src/sort-utils.test.ts` unchanged — it imports only `./sort-utils` and has no `@bw` references. It covers the asc → desc → cleared cycle and multi-sort add/cycle/remove.

- [ ] **Step 5: Run it to make sure it fails**

Run: `pnpm --filter @tickets/table test -- src/sort-utils.test.ts`
Expected: FAIL — `Failed to resolve import "./sort-utils"`

- [ ] **Step 6: Port sort-utils.ts**

Copy `../items-core/packages/web/table/src/sort-utils.ts` to `packages/web/table/src/sort-utils.ts` unchanged — its only import is `./types`.

- [ ] **Step 7: Run the test to verify it passes**

Run: `pnpm --filter @tickets/table test -- src/sort-utils.test.ts`
Expected: PASS

- [ ] **Step 8: Create the barrel**

Create `packages/web/table/src/index.ts`:

```ts
export type {
  Column,
  Renderer,
  SortBy,
  TableRender,
  RenderRootCtx,
  RenderTheadCtx,
  RenderThCtx,
  RenderThResize,
  RenderTbodyCtx,
  RenderTrCtx,
  RenderTdCtx,
  RenderSkeletonRowCtx,
  RenderErrorCtx,
} from './types';
export { ROW_HEIGHT } from './types';
export { toggleSort, multiSortToggle } from './sort-utils';
```

Run: `pnpm --filter @tickets/table typecheck`
Expected: exit 0

- [ ] **Step 9: Commit**

```bash
git add packages/web/table pnpm-lock.yaml
git commit -m "feat(table): scaffold @tickets/table with render types and sort utils"
```

---

### Task 2: Port the width and resize hooks

**Files:**
- Create: `packages/web/table/src/use-table-widths.ts`, `use-table-widths.test.ts`
- Create: `packages/web/table/src/use-column-resize.ts`, `use-column-resize.test.tsx`
- Modify: `packages/web/table/src/index.ts`

**Interfaces:**
- Produces: `useTableWidths(id) → readonly [Record<string, number>, (key, px) => void]`, `useColumnResize(opts) → UseColumnResizeHandlers`, `UseColumnResizeOptions`

**The one deliberate edit:** `use-table-widths.ts` persists under `` `bw:table:${id}:widths` ``. Change the prefix to `tickets:` — a `bw:` key in this app's localStorage is a leftover from another product.

- [ ] **Step 1: Write the failing tests**

Copy both test files across unchanged:
- `../items-core/packages/web/table/src/use-table-widths.test.ts` → `packages/web/table/src/use-table-widths.test.ts`
- `../items-core/packages/web/table/src/use-column-resize.test.tsx` → `packages/web/table/src/use-column-resize.test.tsx`

Then, in `use-table-widths.test.ts`, update any literal `bw:table:` key to `tickets:table:` so the test pins the new prefix.

- [ ] **Step 2: Run them to make sure they fail**

Run: `pnpm --filter @tickets/table test -- src/use-table-widths.test.ts src/use-column-resize.test.tsx`
Expected: FAIL — imports unresolved

- [ ] **Step 3: Port both hooks**

Copy `../items-core/packages/web/table/src/use-column-resize.ts` unchanged — it imports only from `react`.

Copy `../items-core/packages/web/table/src/use-table-widths.ts` and change exactly one line:

```ts
const KEY = (id: string) => `tickets:table:${id}:widths`;
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @tickets/table test -- src/use-table-widths.test.ts src/use-column-resize.test.tsx`
Expected: PASS

- [ ] **Step 5: Export from the barrel**

Append to `packages/web/table/src/index.ts`:

```ts
export { useTableWidths } from './use-table-widths';
export { useColumnResize } from './use-column-resize';
export type { UseColumnResizeOptions, UseColumnResizeHandlers } from './use-column-resize';
```

- [ ] **Step 6: Commit**

```bash
git add packages/web/table/src
git commit -m "feat(table): column resize and persisted width hooks"
```

---

### Task 3: Port the engine verbatim

**Files:**
- Create: `packages/web/table/src/Table.tsx`, `render-stub.tsx`, `Table.test.tsx`
- Modify: `packages/web/table/src/index.ts`

**Interfaces:**
- Consumes: `Column`, `SortBy`, `TableRender`, `ROW_HEIGHT` (Task 1); `toggleSort`, `multiSortToggle` (Task 1)
- Produces: `Table`, `TableProps<T>`, `makeStubRender<T>()`

**This task changes no logic.** It exists so the engine lands with a test suite you did not write, before Tasks 4 and 5 modify it. If a test fails here, the port is wrong — do not "fix" it by editing the test.

- [ ] **Step 1: Copy the test and the stub across**

Copy unchanged:
- `../items-core/packages/web/table/src/render-stub.tsx` → `packages/web/table/src/render-stub.tsx`
- `../items-core/packages/web/table/src/Table.test.tsx` → `packages/web/table/src/Table.test.tsx`

Both import only from `./Table`, `./render-stub` and `./types` — no `@bw` specifiers to rewrite. `Table.test.tsx` installs its own `ResizeObserver` mock in `beforeAll`, which jsdom needs and does not provide; keep it.

- [ ] **Step 2: Run it to make sure it fails**

Run: `pnpm --filter @tickets/table test -- src/Table.test.tsx`
Expected: FAIL — `Failed to resolve import "./Table"`

- [ ] **Step 3: Port Table.tsx**

Copy `../items-core/packages/web/table/src/Table.tsx` to `packages/web/table/src/Table.tsx` unchanged. Its imports are all relative (`./sort-utils`, `./types`) plus `react` and `@tanstack/react-virtual` — nothing to rewrite.

Read it once before moving on. The shape that matters for Tasks 4 and 5:

- `gridTemplate` is built by joining per-column px strings.
- `useVirtualizer` counts `rows.length` with `estimateSize: () => ROW_HEIGHT`.
- The `error` branch returns **before** `render.root`, so an errored table renders only the error slot.
- Skeleton rows appear only when `isLoading && rows.length === 0`.
- Every slot is invoked through a tiny `Render*` component wrapper, so slots may use hooks.

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @tickets/table test -- src/Table.test.tsx`
Expected: PASS, 11 tests across three describe blocks

- [ ] **Step 5: Export from the barrel**

Add to `packages/web/table/src/index.ts`:

```ts
export { Table } from './Table';
export type { TableProps } from './Table';
export { makeStubRender } from './render-stub';
```

`makeStubRender` is exported from the package, not kept test-local, because the `@tickets/ui` adapter's tests use it to drive a real engine without the styled chrome.

- [ ] **Step 6: Run the whole package and typecheck**

Run: `pnpm --filter @tickets/table test`
Expected: PASS

Run: `pnpm --filter @tickets/table typecheck`
Expected: exit 0

- [ ] **Step 7: Commit**

```bash
git add packages/web/table/src
git commit -m "feat(table): port the headless table engine from items-core"
```

---

### Task 4: Variable row height and flexible column widths

**Files:**
- Modify: `packages/web/table/src/types.ts`, `Table.tsx`, `Table.test.tsx`

**Interfaces:**
- Produces: `TableProps.rowHeight?: number` (defaults to `ROW_HEIGHT`), `Column.width?: number | string`

Both gaps come from `all-items-screen.tsx`: a density toggle switching rows between 32px and 42px, and a Title column of `minmax(240px, 1fr)`.

- [ ] **Step 1: Write the failing tests**

Append to `packages/web/table/src/Table.test.tsx`:

```tsx
describe('<Table> engine — sizing', () => {
  it('uses a caller-supplied row height for virtual positioning', () => {
    const { container } = render(<Harness rowHeight={64} />);
    const first = container.querySelectorAll('[data-slot="tr"]')[0] as HTMLElement;
    expect(first.style.height).toBe('64px');
  });

  it('falls back to the default row height', () => {
    const { container } = render(<Harness />);
    const first = container.querySelectorAll('[data-slot="tr"]')[0] as HTMLElement;
    expect(first.style.height).toBe('40px');
  });

  it('stacks rows by the supplied height rather than the default', () => {
    const { container } = render(<Harness rowHeight={64} />);
    const second = container.querySelectorAll('[data-slot="tr"]')[1] as HTMLElement;
    expect(second.style.transform).toBe('translateY(64px)');
  });

  it('emits a numeric column width as pixels', () => {
    const { container } = render(
      <Harness columns={[{ key: 'name', header: 'Name', value: (r) => r.name, width: 200 }]} />,
    );
    expect(container.querySelector('[data-slot="thead"]')).toHaveAttribute(
      'data-grid-template',
      '200px',
    );
  });

  // minmax(240px, 1fr) is what all-items-screen's Title column needs, and no
  // number can express it.
  it('emits a string column width verbatim so track functions survive', () => {
    const { container } = render(
      <Harness
        columns={[
          { key: 'name', header: 'Name', value: (r) => r.name, width: 'minmax(240px, 1fr)' },
        ]}
      />,
    );
    expect(container.querySelector('[data-slot="thead"]')).toHaveAttribute(
      'data-grid-template',
      'minmax(240px, 1fr)',
    );
  });

  it('lets a resized width override a string column width', () => {
    const { container } = render(
      <Harness
        columns={[
          { key: 'name', header: 'Name', value: (r) => r.name, width: 'minmax(240px, 1fr)' },
        ]}
        state={{ sort: [], widths: { name: 300 } }}
      />,
    );
    expect(container.querySelector('[data-slot="thead"]')).toHaveAttribute(
      'data-grid-template',
      '300px',
    );
  });
});
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `pnpm --filter @tickets/table test -- src/Table.test.tsx`
Expected: FAIL on the six new tests; the original 11 still PASS

- [ ] **Step 3: Widen the Column width type**

In `packages/web/table/src/types.ts`, change `Column<T>`'s width field:

```ts
  /** Track size for this column. A number is pixels. A string is emitted into
   *  grid-template-columns verbatim, so `minmax(240px, 1fr)` and other track
   *  functions work — a flexible column cannot be expressed as a number.
   *  A width the user has dragged always wins over both. */
  width?: number | string;
```

- [ ] **Step 4: Implement both changes in Table.tsx**

Add `rowHeight` to `TableProps<T>`:

```ts
  /** Height of a data row in pixels. The virtualizer needs it up front, so a
   *  caller with a density toggle must pass the height for the current mode
   *  rather than styling rows and hoping. Defaults to ROW_HEIGHT. */
  rowHeight?: number;
```

Destructure it with a default, and use it in the virtualizer and the row style:

```ts
  const { columns, rows, state, render, onSortChange, onWidthChange, onRowClick,
          isLoading, error, rowHeight = ROW_HEIGHT } = props;

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollEl,
    estimateSize: () => rowHeight,
    overscan: 8,
  });
```

In the row loop, replace `height: ROW_HEIGHT` with `height: rowHeight`.

Replace the `gridTemplate` line with a helper that respects string widths:

```ts
/** A dragged width always wins; then the authored width, numeric or track
 *  function; then a 160px fallback. */
function trackSize<T>(col: Column<T>, widths: Record<string, number>): string {
  const dragged = widths[col.key];
  if (dragged !== undefined) return `${dragged}px`;
  if (typeof col.width === 'string') return col.width;
  return `${col.width ?? 160}px`;
}
```

and use it:

```ts
  const gridTemplate = columns.map((c) => trackSize(c, state.widths)).join(' ');
```

There is a second place the width is read — the `resize.startWidth` computation inside the header map. A string width has no pixel start, so fall back to the default:

```ts
      const colWidth =
        state.widths[col.key] ?? (typeof col.width === 'number' ? col.width : 160);
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter @tickets/table test -- src/Table.test.tsx`
Expected: PASS, 17 tests — the original 11 unchanged

- [ ] **Step 6: Commit**

```bash
git add packages/web/table/src
git commit -m "feat(table): caller-supplied row height and track-function column widths"
```

---

### Task 5: Grouping

**Files:**
- Create: `packages/web/table/src/flatten-groups.ts`, `flatten-groups.test.ts`
- Modify: `packages/web/table/src/types.ts`, `Table.tsx`, `Table.test.tsx`, `render-stub.tsx`, `index.ts`

**Interfaces:**
- Consumes: `Column`, `TableRender` (Task 1)
- Produces: `TableGroup<T>`, `VirtualRow<T>`, `flattenGroups`, `GROUP_ROW_HEIGHT`, `TableProps.groups`, `TableRender.groupHeader`, `RenderGroupHeaderCtx`

Groups flatten into one virtualized list so the table keeps one scroll region and one sticky header — rendering a Table per group would give each its own of both. Flattening is a pure function, so it is tested on its own before the engine wires it in.

- [ ] **Step 1: Write the failing test for the flattener**

Create `packages/web/table/src/flatten-groups.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { flattenGroups } from './flatten-groups';

const groups = [
  { key: 'a', header: 'Group A', rows: [{ id: '1' }, { id: '2' }] },
  { key: 'b', header: 'Group B', rows: [{ id: '3' }] },
];

describe('flattenGroups', () => {
  it('emits a header before each group and its rows after', () => {
    expect(flattenGroups(groups).map((i) => i.kind)).toEqual([
      'group', 'row', 'row', 'group', 'row',
    ]);
  });

  it('carries each group key onto its header item', () => {
    const items = flattenGroups(groups);
    expect(items[0]).toMatchObject({ kind: 'group', key: 'a' });
    expect(items[3]).toMatchObject({ kind: 'group', key: 'b' });
  });

  it('numbers rows continuously across groups so onRowClick indices are unique', () => {
    const indices = flattenGroups(groups)
      .filter((i) => i.kind === 'row')
      .map((i) => (i.kind === 'row' ? i.index : -1));
    expect(indices).toEqual([0, 1, 2]);
  });

  it('keeps a group with no rows so an empty section still announces itself', () => {
    const items = flattenGroups([{ key: 'empty', header: 'Empty', rows: [] }]);
    expect(items.map((i) => i.kind)).toEqual(['group']);
  });

  it('returns nothing for no groups', () => {
    expect(flattenGroups([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `pnpm --filter @tickets/table test -- src/flatten-groups.test.ts`
Expected: FAIL — `Failed to resolve import "./flatten-groups"`

- [ ] **Step 3: Add the group types**

Append to `packages/web/table/src/types.ts`:

```ts
/** Height of a group header row in pixels. Exported so the adapter styling and
 *  the virtualizer's size estimate cannot disagree — if they do, every row
 *  below the first group sits at the wrong offset. */
export const GROUP_ROW_HEIGHT = 34;

export interface TableGroup<T> {
  key: string;
  header: ReactNode;
  rows: T[];
}

/** One entry in the flattened, virtualized list. Group headers and data rows
 *  share a single virtualizer so the table keeps one scroll region. */
export type VirtualRow<T> =
  | { kind: 'group'; key: string; header: ReactNode }
  | { kind: 'row'; row: T; index: number };

export interface RenderGroupHeaderCtx {
  key: string;
  header: ReactNode;
  gridTemplate: string;
  /** Virtualization positioning. MUST be applied or the header will not appear. */
  style: CSSProperties;
}
```

Add `groupHeader` to the `TableRender<T>` interface, after `td`:

```ts
  groupHeader: (ctx: RenderGroupHeaderCtx) => ReactNode;
```

- [ ] **Step 4: Implement the flattener**

Create `packages/web/table/src/flatten-groups.ts`:

```ts
import type { TableGroup, VirtualRow } from './types';

/**
 * Interleaves group headers with their rows into the single list the
 * virtualizer measures.
 *
 * Row indices run continuously across groups rather than restarting per group,
 * so `onRowClick` and the `tr` slot's `index` stay unique for the whole table —
 * a per-group index would collide the moment two groups both had a row 0.
 *
 * An empty group keeps its header: a section that filtered down to nothing
 * should say so rather than silently vanish.
 */
export function flattenGroups<T>(groups: TableGroup<T>[]): VirtualRow<T>[] {
  const out: VirtualRow<T>[] = [];
  let index = 0;
  for (const group of groups) {
    out.push({ kind: 'group', key: group.key, header: group.header });
    for (const row of group.rows) {
      out.push({ kind: 'row', row, index });
      index += 1;
    }
  }
  return out;
}
```

- [ ] **Step 5: Run the flattener test to verify it passes**

Run: `pnpm --filter @tickets/table test -- src/flatten-groups.test.ts`
Expected: PASS, 5 tests

- [ ] **Step 6: Write the failing engine test**

First add the slot to the stub. In `packages/web/table/src/render-stub.tsx`, add after the `td` slot:

```tsx
    groupHeader: ({ key, header, gridTemplate, style }) => {
      return (
        <div
          data-slot="group-header"
          data-key={key}
          data-grid-template={gridTemplate}
          style={style}
        >
          {header}
        </div>
      );
    },
```

Then append to `packages/web/table/src/Table.test.tsx`:

```tsx
describe('<Table> engine — grouping', () => {
  const grouped = [
    { key: 'a', header: 'Group A', rows: [{ id: '1', name: 'Alpha' }] },
    { key: 'b', header: 'Group B', rows: [{ id: '2', name: 'Beta' }] },
  ];

  it('renders a header per group through the groupHeader slot', () => {
    const { container } = render(<Harness rows={[]} groups={grouped} />);
    const headers = container.querySelectorAll('[data-slot="group-header"]');
    expect(headers.length).toBe(2);
    expect(headers[0]).toHaveTextContent('Group A');
  });

  it('renders each group\'s rows through the tr slot', () => {
    const { container } = render(<Harness rows={[]} groups={grouped} />);
    expect(container.querySelectorAll('[data-slot="tr"]').length).toBe(2);
  });

  it('positions group headers at their own height, not the row height', () => {
    const { container } = render(<Harness rows={[]} groups={grouped} rowHeight={40} />);
    const header = container.querySelector('[data-slot="group-header"]') as HTMLElement;
    expect(header.style.height).toBe('34px');
  });

  it('offsets the second group by its predecessor\'s header plus rows', () => {
    const { container } = render(<Harness rows={[]} groups={grouped} rowHeight={40} />);
    const headers = container.querySelectorAll('[data-slot="group-header"]');
    // group A header (34) + one row (40) = 74
    expect((headers[1] as HTMLElement).style.transform).toBe('translateY(74px)');
  });

  it('gives onRowClick the right row from the second group', () => {
    const onRowClick = vi.fn();
    const { container } = render(
      <Harness rows={[]} groups={grouped} onRowClick={onRowClick} />,
    );
    const trs = container.querySelectorAll('[data-slot="tr"]');
    fireEvent.click(trs[1] as HTMLElement);
    expect(onRowClick).toHaveBeenCalledWith(grouped[1].rows[0]);
  });

  it('still renders a flat list when given rows instead of groups', () => {
    const { container } = render(<Harness />);
    expect(container.querySelectorAll('[data-slot="group-header"]').length).toBe(0);
    expect(container.querySelectorAll('[data-slot="tr"]').length).toBe(2);
  });
});
```

- [ ] **Step 7: Run it to make sure it fails**

Run: `pnpm --filter @tickets/table test -- src/Table.test.tsx`
Expected: FAIL on the six grouping tests; the previous 17 still PASS

- [ ] **Step 8: Wire grouping into the engine**

In `packages/web/table/src/Table.tsx`:

Add to `TableProps<T>`:

```ts
  /** Grouped rows. Mutually exclusive with `rows` in practice — when present it
   *  wins, and `rows` is ignored. */
  groups?: TableGroup<T>[];
```

Build the flattened list before the virtualizer, and count it instead of `rows`:

```ts
  // An ungrouped table is one implicit group's worth of rows, so both shapes
  // go through the same virtualized list and the body loop below has one form.
  const items: VirtualRow<T>[] = groups
    ? flattenGroups(groups)
    : rows.map((row, index) => ({ kind: 'row' as const, row, index }));

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollEl,
    estimateSize: (i) => (items[i]?.kind === 'group' ? GROUP_ROW_HEIGHT : rowHeight),
    overscan: 8,
  });
```

Change the loading and empty guards to test `items.length` rather than `rows.length`.

In the body loop, branch on the item kind:

```ts
      children: virtualizer.getVirtualItems().map((vi) => {
        const item = items[vi.index];
        if (!item) return null;

        const style: CSSProperties = {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: item.kind === 'group' ? GROUP_ROW_HEIGHT : rowHeight,
          transform: `translateY(${vi.start}px)`,
        };

        if (item.kind === 'group') {
          return (
            <RenderGroupHeader
              key={vi.key}
              groupKey={item.key}
              header={item.header}
              gridTemplate={gridTemplate}
              style={style}
              slot={render.groupHeader}
            />
          );
        }

        const cells = columns.map((col) => (
          <Fragment key={col.key}>
            {render.td({ column: col, row: item.row, children: renderCellContent(col, item.row) })}
          </Fragment>
        ));
        return (
          <RenderTr
            key={vi.key}
            row={item.row}
            index={item.index}
            cells={cells}
            gridTemplate={gridTemplate}
            style={style}
            onClick={onRowClick ? () => onRowClick(item.row) : undefined}
            slot={render.tr}
          />
        );
      }),
```

Add the slot wrapper beside the existing `RenderTr` / `RenderTh` helpers:

```tsx
function RenderGroupHeader(props: {
  groupKey: string;
  header: ReactNode;
  gridTemplate: string;
  style: CSSProperties;
  slot: TableRender<never>['groupHeader'];
}): ReactNode {
  return props.slot({
    key: props.groupKey,
    header: props.header,
    gridTemplate: props.gridTemplate,
    style: props.style,
  });
}
```

The prop is named `groupKey`, not `key` — React would swallow a prop literally called `key`.

- [ ] **Step 9: Run the tests to verify they pass**

Run: `pnpm --filter @tickets/table test`
Expected: PASS, 28 tests. **Every test from Task 3 must still pass unchanged** — that is the point of having ported them first.

- [ ] **Step 10: Export the new names**

Add to `packages/web/table/src/index.ts`:

```ts
export { GROUP_ROW_HEIGHT } from './types';
export type { TableGroup, VirtualRow, RenderGroupHeaderCtx } from './types';
export { flattenGroups } from './flatten-groups';
```

Run: `pnpm --filter @tickets/table typecheck`
Expected: exit 0

- [ ] **Step 11: Commit**

```bash
git add packages/web/table/src
git commit -m "feat(table): grouped rows sharing one virtualized scroll region"
```

---

### Task 6: The styled render slots

**Files:**
- Modify: `packages/web/ui/package.json`
- Create: `packages/web/ui/src/table/render-root.tsx`, `render-thead.tsx`, `render-th.tsx`, `render-tbody.tsx`, `render-tr.tsx`, `render-td.tsx`, `render-skeleton-row.tsx`, `render-error.tsx`, `table-render.ts`, `table-render.test.tsx`

**Interfaces:**
- Consumes: every `Render*Ctx` type and `useColumnResize`, `ROW_HEIGHT` from `@tickets/table`; `cn`, `Icon` from `@tickets/ui`
- Produces: `tableRender` — a `TableRender` with all slots except `groupHeader`, which Task 7 adds

This is a **restyle**, not a copy. items-core's slots are the behavioural reference; every class is rewritten. Their `▲`/`▼` text glyphs become `Icon` entries, and their arbitrary values (`text-[10px]`, `w-8` resize handle) become tokens and round steps.

- [ ] **Step 1: Add the dependency**

In `packages/web/ui/package.json`, add to `dependencies`:

```json
    "@tickets/table": "workspace:*",
```

Run: `pnpm install`

- [ ] **Step 2: Write the failing test**

Create `packages/web/ui/src/table/table-render.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Table, type Column } from '@tickets/table';
import { tableRender } from './table-render';

interface Row { id: string; name: string; count: number }

const rows: Row[] = [
  { id: '1', name: 'Alpha', count: 3 },
  { id: '2', name: 'Beta', count: 7 },
];
const columns: Column<Row>[] = [
  { key: 'name', header: 'Name', value: (r) => r.name, sortable: true },
  { key: 'count', header: 'Count', value: (r) => r.count, align: 'right' },
];

function Harness(props: Partial<React.ComponentProps<typeof Table<Row>>>) {
  return (
    <div style={{ height: 400 }}>
      <Table<Row>
        columns={columns}
        rows={rows}
        state={{ sort: [], widths: {} }}
        onSortChange={() => {}}
        onWidthChange={() => {}}
        isLoading={false}
        render={tableRender}
        {...props}
      />
    </div>
  );
}

describe('tableRender', () => {
  it('exposes the table to assistive tech as a grid of rows and cells', () => {
    render(<Harness />);
    expect(screen.getAllByRole('row').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('columnheader')).toHaveLength(2);
    expect(screen.getAllByRole('cell').length).toBe(4);
  });

  it('renders each cell\'s value', () => {
    render(<Harness />);
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
  });

  it('makes only sortable headers activatable', () => {
    render(<Harness />);
    expect(screen.getByRole('button', { name: /Name/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Count/ })).not.toBeInTheDocument();
  });

  it('reports the sort direction on the sorted header', () => {
    render(<Harness state={{ sort: [{ field: 'name', direction: 'asc' }], widths: {} }} />);
    expect(screen.getByRole('columnheader', { name: /Name/ })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
  });

  it('sorts when a sortable header is activated', async () => {
    const onSortChange = vi.fn();
    render(<Harness onSortChange={onSortChange} />);
    await userEvent.click(screen.getByRole('button', { name: /Name/ }));
    expect(onSortChange).toHaveBeenCalledWith([{ field: 'name', direction: 'asc' }]);
  });

  it('offers a resize handle per resizable column', () => {
    render(<Harness />);
    expect(screen.getAllByRole('separator')).toHaveLength(2);
  });

  it('announces an error instead of the table', () => {
    render(<Harness error={new Error('boom')} />);
    expect(screen.getByRole('alert')).toHaveTextContent('boom');
    expect(screen.queryByRole('columnheader')).not.toBeInTheDocument();
  });

  it('shows placeholder rows while loading an empty table', () => {
    const { container } = render(<Harness rows={[]} isLoading />);
    expect(container.querySelectorAll('[data-skeleton-row]').length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 3: Run it to make sure it fails**

Run: `pnpm --filter @tickets/ui test -- src/table/table-render.test.tsx`
Expected: FAIL — `Failed to resolve import "./table-render"`

- [ ] **Step 4: Implement the eight slots**

Create `packages/web/ui/src/table/render-root.tsx`:

```tsx
import type { RenderRootCtx } from '@tickets/table';

export function renderRoot({ children }: RenderRootCtx) {
  return <div className="w-max font-sans text-13/19 text-gray-12">{children}</div>;
}
```

Create `packages/web/ui/src/table/render-thead.tsx`:

```tsx
import type { RenderTheadCtx } from '@tickets/table';

export function renderThead({ children, gridTemplate }: RenderTheadCtx) {
  return (
    <div
      role="row"
      className="sticky top-0 z-10 grid w-max border-b border-gray-6 bg-gray-1"
      style={{ gridTemplateColumns: gridTemplate }}
    >
      {children}
    </div>
  );
}
```

Create `packages/web/ui/src/table/render-th.tsx`:

```tsx
import { useColumnResize, type RenderThCtx, type RenderThResize } from '@tickets/table';
import { cn } from '../style';
import { Icon } from '../components/icon';

function alignClass(align: 'left' | 'right' | 'center' | undefined) {
  return align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';
}

/** Column headers carry aria-sort so a screen reader announces the sort state
 *  the caret shows visually. */
function ariaSort(direction: 'asc' | 'desc' | undefined) {
  if (direction === 'asc') return 'ascending' as const;
  if (direction === 'desc') return 'descending' as const;
  return 'none' as const;
}

function ResizeHandle({ resize }: { resize: RenderThResize }) {
  const handlers = useColumnResize({
    startWidth: resize.startWidth,
    minWidth: resize.minWidth,
    onChange: resize.onWidthChange,
  });
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      {...handlers}
      className="absolute top-0 right-0 h-full w-1 cursor-col-resize hover:bg-gray-8"
    />
  );
}

export function renderTh<T>({ column, sort, totalSorts, onSortClick, resize }: RenderThCtx<T>) {
  return (
    <div
      role="columnheader"
      aria-sort={column.sortable ? ariaSort(sort?.direction) : undefined}
      className={cn(
        'relative px-3 py-2',
        'font-sans text-11/13 font-500 tracking-wider text-gray-11 uppercase',
        alignClass(column.align),
      )}
    >
      {column.sortable ? (
        <button
          type="button"
          onClick={onSortClick}
          className="flex w-full items-center gap-1 hover:text-gray-12"
        >
          {column.header}
          {sort ? (
            <Icon name={sort.direction === 'asc' ? 'chevron-up' : 'chevron-down'} size="2xs" />
          ) : null}
          {/* The ordinal only means something once more than one column sorts. */}
          {totalSorts > 1 && sort ? (
            <span className="font-mono text-11 text-gray-9">{sort.index + 1}</span>
          ) : null}
        </button>
      ) : (
        column.header
      )}
      {resize ? <ResizeHandle resize={resize} /> : null}
    </div>
  );
}
```

If `chevron-up` is not in the icon registry, add it there per the registry's own conventions rather than falling back to a text glyph.

Create `packages/web/ui/src/table/render-tbody.tsx`:

```tsx
import type { RenderTbodyCtx } from '@tickets/table';

export function renderTbody({ children, totalSize }: RenderTbodyCtx) {
  return (
    <div
      role="rowgroup"
      style={{ height: totalSize, position: 'relative', minWidth: 'max-content' }}
    >
      {children}
    </div>
  );
}
```

Create `packages/web/ui/src/table/render-tr.tsx`:

```tsx
import type { RenderTrCtx } from '@tickets/table';
import { cn } from '../style';

export function renderTr<T>({ index, cells, gridTemplate, style, onClick }: RenderTrCtx<T>) {
  return (
    <div
      role="row"
      data-index={index}
      onClick={onClick}
      className={cn(
        // `group` is load-bearing: ActionsColumn reveals its buttons on
        // group-hover, so removing it silently hides every row action.
        'group grid border-b border-gray-6 transition-colors hover:bg-gray-1',
        onClick && 'cursor-pointer',
      )}
      // `right: auto` + `width: max-content` override the engine's stretched
      // absolute positioning so a row is as wide as its columns, letting the
      // whole table scroll horizontally as one.
      style={{ ...style, right: 'auto', width: 'max-content', gridTemplateColumns: gridTemplate }}
    >
      {cells}
    </div>
  );
}
```

Create `packages/web/ui/src/table/render-td.tsx`:

```tsx
import type { RenderTdCtx } from '@tickets/table';
import { cn } from '../style';

function alignClass(align: 'left' | 'right' | 'center' | undefined) {
  return align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start';
}

export function renderTd<T>({ column, children }: RenderTdCtx<T>) {
  return (
    <div className={cn('flex min-w-0 items-center px-3', alignClass(column.align))} role="cell">
      {children}
    </div>
  );
}
```

Create `packages/web/ui/src/table/render-skeleton-row.tsx`:

```tsx
import { ROW_HEIGHT, type RenderSkeletonRowCtx } from '@tickets/table';

export function renderSkeletonRow<T>({ columns, gridTemplate }: RenderSkeletonRowCtx<T>) {
  return (
    <div
      data-skeleton-row
      className="grid w-max min-w-full border-b border-gray-6"
      style={{ gridTemplateColumns: gridTemplate, height: ROW_HEIGHT }}
    >
      {columns.map((col) => (
        <div key={col.key} className="flex items-center px-3">
          <div className="h-2 w-3/5 animate-pulse rounded-sm bg-gray-4" />
        </div>
      ))}
    </div>
  );
}
```

Create `packages/web/ui/src/table/render-error.tsx`:

```tsx
import type { RenderErrorCtx } from '@tickets/table';
import { ScreenState } from '../components/screen-state';

/** Reuses ScreenState so a failed table looks like every other failed surface
 *  in the app rather than inventing a second error treatment. */
export function renderError({ error }: RenderErrorCtx) {
  return <ScreenState tone="danger" icon="alert-triangle" title="Couldn't load" body={error.message} />;
}
```

`ScreenState` renders no `role="alert"`. The test asserts one, so wrap it:

```tsx
  return (
    <div role="alert">
      <ScreenState tone="danger" icon="alert-triangle" title="Couldn't load" body={error.message} />
    </div>
  );
```

Check the icon registry for the exact alert glyph name before using `alert-triangle`; use whatever the registry actually exports.

Create `packages/web/ui/src/table/table-render.ts`:

```ts
import type { TableRender } from '@tickets/table';
import { renderRoot } from './render-root';
import { renderThead } from './render-thead';
import { renderTh } from './render-th';
import { renderTbody } from './render-tbody';
import { renderTr } from './render-tr';
import { renderTd } from './render-td';
import { renderSkeletonRow } from './render-skeleton-row';
import { renderError } from './render-error';

// groupHeader is added in Task 7 — the type will complain until then.
export const tableRender: TableRender = {
  root: renderRoot,
  thead: renderThead,
  th: renderTh,
  tbody: renderTbody,
  tr: renderTr,
  td: renderTd,
  skeletonRow: renderSkeletonRow,
  error: renderError,
};
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm --filter @tickets/ui test -- src/table/table-render.test.tsx`
Expected: PASS, 8 tests. Typecheck will still fail on the missing `groupHeader` — Task 7 closes it.

- [ ] **Step 6: Commit**

```bash
git add packages/web/ui/package.json packages/web/ui/src/table pnpm-lock.yaml
git commit -m "feat(ui): Instrument-styled table render slots"
```

---

### Task 7: The group header slot

**Files:**
- Create: `packages/web/ui/src/table/render-group-header.tsx`
- Modify: `packages/web/ui/src/table/table-render.ts`, `table-render.test.tsx`

**Interfaces:**
- Consumes: `RenderGroupHeaderCtx`, `GROUP_ROW_HEIGHT` from `@tickets/table` (Task 5)
- Produces: `renderGroupHeader`; completes `tableRender`

- [ ] **Step 1: Write the failing test**

Append to `packages/web/ui/src/table/table-render.test.tsx`:

```tsx
describe('tableRender — groups', () => {
  const grouped = [
    { key: 'a', header: <span>Group A</span>, rows: [rows[0]!] },
    { key: 'b', header: <span>Group B</span>, rows: [rows[1]!] },
  ];

  it('renders each group header', () => {
    render(<Harness rows={[]} groups={grouped} />);
    expect(screen.getByText('Group A')).toBeInTheDocument();
    expect(screen.getByText('Group B')).toBeInTheDocument();
  });

  it('renders each group\'s rows under it', () => {
    render(<Harness rows={[]} groups={grouped} />);
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
  });

  it('marks group headers as rows so the grid semantics stay whole', () => {
    render(<Harness rows={[]} groups={grouped} />);
    expect(screen.getAllByRole('row').length).toBeGreaterThanOrEqual(4);
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `pnpm --filter @tickets/ui test -- src/table/table-render.test.tsx`
Expected: FAIL — `render.groupHeader is not a function`

- [ ] **Step 3: Implement the slot**

Create `packages/web/ui/src/table/render-group-header.tsx`:

```tsx
import type { RenderGroupHeaderCtx } from '@tickets/table';

/**
 * A group's banner row. It does NOT take the column grid template: the header
 * is one continuous band, not a set of cells, so laying it out on the columns
 * would clip its content at the first column boundary.
 *
 * `role="row"` keeps the rowgroup's children uniform — a bare div between rows
 * makes the grid's accessibility tree invalid.
 */
export function renderGroupHeader({ header, style }: RenderGroupHeaderCtx) {
  return (
    <div
      role="row"
      className="flex items-center gap-2 border-b border-gray-6 bg-gray-1 px-4"
      style={{ ...style, right: 'auto', width: 'max-content', minWidth: '100%' }}
    >
      {header}
    </div>
  );
}
```

In `packages/web/ui/src/table/table-render.ts`, import it and add the slot after `td`, then delete the "added in Task 7" comment:

```ts
import { renderGroupHeader } from './render-group-header';
// …
  groupHeader: renderGroupHeader,
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @tickets/ui test -- src/table/table-render.test.tsx`
Expected: PASS, 11 tests

Run: `pnpm --filter @tickets/ui typecheck`
Expected: exit 0 — `tableRender` now satisfies `TableRender` completely

- [ ] **Step 5: Commit**

```bash
git add packages/web/ui/src/table
git commit -m "feat(ui): group header render slot"
```

---

### Task 8: Text, number, date and link column helpers

**Files:**
- Create: `packages/web/ui/src/table/columns/text-column.tsx`, `number-column.tsx`, `date-column.tsx`, `link-column.tsx`, `columns.test.tsx`

**Interfaces:**
- Consumes: `Renderer<V>` from `@tickets/table`; `RelativeDate` from `@tickets/ui`
- Produces: `TextColumn(opts?)`, `NumberColumn(opts?)`, `DateColumn(opts?)`, `LinkColumn(opts)` — each a factory returning a `Renderer`

**`DateColumn` drops items-core's `formatRelative`.** tickets already has a `RelativeDate` component; porting a second relative-time formatter would give the app two that disagree at the boundaries.

- [ ] **Step 1: Write the failing test**

Create `packages/web/ui/src/table/columns/columns.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DateColumn } from './date-column';
import { LinkColumn } from './link-column';
import { NumberColumn } from './number-column';
import { TextColumn } from './text-column';

describe('TextColumn', () => {
  it('renders the value', () => {
    const R = TextColumn();
    render(<>{R({ value: 'hello', row: {} })}</>);
    expect(screen.getByText('hello')).toBeInTheDocument();
  });

  it('renders nothing for a null value', () => {
    const R = TextColumn();
    const { container } = render(<>{R({ value: null, row: {} })}</>);
    expect(container.textContent).toBe('');
  });

  // The `mono` and `truncate` options change nothing but the classes the
  // helper picks for itself, which the project's testing ruling forbids
  // asserting — and jsdom would render them identically anyway. Accepting the
  // options is all that is checkable here; the faces are verified in the demo.
  it('accepts its options', () => {
    const R = TextColumn({ mono: true, truncate: false });
    render(<>{R({ value: 'abc', row: {} })}</>);
    expect(screen.getByText('abc')).toBeInTheDocument();
  });
});

describe('NumberColumn', () => {
  it('formats an integer without decimals', () => {
    const R = NumberColumn({ format: 'integer' });
    render(<>{R({ value: 1234.7, row: {} })}</>);
    expect(screen.getByText('1,235')).toBeInTheDocument();
  });

  it('shows an em dash for a missing value', () => {
    const R = NumberColumn();
    render(<>{R({ value: null, row: {} })}</>);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('shows an em dash for a value that is not a number', () => {
    const R = NumberColumn();
    render(<>{R({ value: 'abc', row: {} })}</>);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('formats a currency value with its symbol', () => {
    const R = NumberColumn({ format: 'currency', currency: 'USD' });
    render(<>{R({ value: 1234.5, row: {} })}</>);
    expect(screen.getByText(/1,234\.50/)).toBeInTheDocument();
  });

  it('parses a numeric string as a number', () => {
    const R = NumberColumn({ format: 'integer' });
    render(<>{R({ value: '1234', row: {} })}</>);
    expect(screen.getByText('1,234')).toBeInTheDocument();
  });
});
// Right-alignment and `tabular-nums` are deliberately not asserted: they are
// classes the helper picks for itself, and jsdom computes no layout, so the
// assertion would restate the implementation without proving digits line up.
// The demo is where that is checked.

describe('DateColumn', () => {
  it('renders a relative time for a valid date', () => {
    const R = DateColumn();
    const { container } = render(<>{R({ value: new Date().toISOString(), row: {} })}</>);
    expect(container.textContent).not.toBe('');
  });

  it('shows an em dash for a missing date', () => {
    const R = DateColumn();
    render(<>{R({ value: null, row: {} })}</>);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('shows an em dash for an unparseable date', () => {
    const R = DateColumn();
    render(<>{R({ value: 'not-a-date', row: {} })}</>);
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});

describe('LinkColumn', () => {
  it('links to the href derived from the row', () => {
    const R = LinkColumn({ href: (row) => `/items/${(row as { id: string }).id}` });
    render(<>{R({ value: 'Alpha', row: { id: '7' } })}</>);
    expect(screen.getByRole('link', { name: 'Alpha' })).toHaveAttribute('href', '/items/7');
  });

  it('opens external links safely', () => {
    const R = LinkColumn({ href: () => 'https://example.com', external: true });
    render(<>{R({ value: 'Out', row: {} })}</>);
    const link = screen.getByRole('link', { name: 'Out' });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `pnpm --filter @tickets/ui test -- src/table/columns/columns.test.tsx`
Expected: FAIL — imports unresolved

- [ ] **Step 3: Implement the four helpers**

Create `packages/web/ui/src/table/columns/text-column.tsx`:

```tsx
import type { Renderer } from '@tickets/table';
import { cn } from '../../style';

type TextColumnOpts = { mono?: boolean; truncate?: boolean };

export function TextColumn(opts: TextColumnOpts = {}): Renderer<string | null | undefined> {
  const { mono, truncate = true } = opts;
  return ({ value }) => {
    if (value == null) return null;
    return (
      <span className={cn('block', truncate && 'truncate', mono && 'font-mono text-12/17')}>
        {value}
      </span>
    );
  };
}
```

Create `packages/web/ui/src/table/columns/number-column.tsx`:

```tsx
import type { Renderer } from '@tickets/table';

type NumberColumnOpts = {
  format?: 'integer' | 'decimal' | 'currency';
  currency?: string;
  fractionDigits?: number;
};

function format(
  n: number,
  style: 'integer' | 'decimal' | 'currency',
  currency: string | undefined,
  fractionDigits: number | undefined,
): string {
  if (style === 'currency' && currency) {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      minimumFractionDigits: fractionDigits ?? 2,
      maximumFractionDigits: fractionDigits ?? 2,
    }).format(n);
  }
  if (style === 'integer') {
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n);
  }
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: fractionDigits ?? 0,
    maximumFractionDigits: fractionDigits ?? 6,
  }).format(n);
}

/** `tabular-nums` is what makes a numeric column readable — proportional
 *  digits make the ones and sevens wander out of alignment down the column. */
export function NumberColumn(opts: NumberColumnOpts = {}): Renderer<number | string | null> {
  const { format: style = 'decimal', currency, fractionDigits } = opts;
  return ({ value }) => {
    if (value == null || value === '') return <span className="text-gray-9">—</span>;
    const n = typeof value === 'string' ? Number(value) : value;
    if (Number.isNaN(n)) return <span className="text-gray-9">—</span>;
    return (
      <span className="block text-right font-mono text-12/17 tabular-nums">
        {format(n, style, currency, fractionDigits)}
      </span>
    );
  };
}
```

Create `packages/web/ui/src/table/columns/date-column.tsx`:

```tsx
import type { Renderer } from '@tickets/table';
import { RelativeDate } from '../../components/relative-date';

type DateColumnOpts = { style?: 'relative' | 'absolute' };

/** Uses the app's RelativeDate rather than porting items-core's formatRelative —
 *  two relative-time formatters would disagree at the day/month boundaries. */
export function DateColumn(
  opts: DateColumnOpts = {},
): Renderer<string | Date | null | undefined> {
  const style = opts.style ?? 'relative';
  return ({ value }) => {
    if (value == null) return <span className="text-gray-9">—</span>;
    const date = typeof value === 'string' ? new Date(value) : value;
    if (Number.isNaN(date.getTime())) return <span className="text-gray-9">—</span>;
    if (style === 'absolute') {
      return (
        <span className="font-mono text-12/17 text-gray-11" title={date.toISOString()}>
          {date.toLocaleString()}
        </span>
      );
    }
    return <RelativeDate value={date} />;
  };
}
```

Check `components/relative-date`'s actual prop name before wiring it — if it takes `date` rather than `value`, use that.

Create `packages/web/ui/src/table/columns/link-column.tsx`:

```tsx
import type { Renderer } from '@tickets/table';
import { cn, toneClasses } from '../../style';

type LinkColumnOpts = { href: (row: unknown) => string; external?: boolean };

export function LinkColumn(opts: LinkColumnOpts): Renderer<string> {
  return ({ value, row }) => (
    <a
      href={opts.href(row)}
      // Rows are usually clickable too; without this, following a link would
      // also open the row's drawer behind it.
      onClick={(e) => e.stopPropagation()}
      {...(opts.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      // `primary` is a TONE, not a colour family — there is no `primary-11`
      // utility. toneClasses('primary','text') resolves through TONE_SCALE
      // (primary -> indigo) and yields `text-indigo-11`.
      className={cn('truncate hover:underline', toneClasses('primary', 'text'))}
    >
      {value}
    </a>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @tickets/ui test -- src/table/columns/columns.test.tsx`
Expected: PASS, 13 tests

- [ ] **Step 5: Commit**

```bash
git add packages/web/ui/src/table/columns
git commit -m "feat(ui): text, number, date and link column helpers"
```

---

### Task 9: Badge, image and actions column helpers

**Files:**
- Create: `packages/web/ui/src/table/columns/badge-column.tsx`, `image-column.tsx`, `actions-column.tsx`
- Modify: `packages/web/ui/src/table/columns/columns.test.tsx`

**Interfaces:**
- Consumes: `Renderer` from `@tickets/table`; `Pill`, `Avatar`, `Button`, `Icon`, `type Tone`, `type IconName` from `@tickets/ui`
- Produces: `BadgeColumn(opts)`, `ImageColumn(opts?)`, `ActionsColumn(opts)`

**Correction to the spec.** It said `ActionsColumn → Menu`. That is wrong: the source renders a row of icon buttons revealed on row hover, not a menu. Build it from `Button` (ghost) plus the `Icon` registry, keeping the hover reveal. A menu would be a different component with different ergonomics, and nothing asked for one.

`BadgeColumn` uses `Pill`; `ImageColumn` falls back to `Avatar` instead of hand-rolling an initial disc.

- [ ] **Step 1: Write the failing tests**

Append to `packages/web/ui/src/table/columns/columns.test.tsx`:

```tsx
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { ActionsColumn } from './actions-column';
import { BadgeColumn } from './badge-column';
import { ImageColumn } from './image-column';

describe('BadgeColumn', () => {
  it('renders the value as a pill in the tone the mapper returns', () => {
    const R = BadgeColumn<string>({ tone: () => 'green' });
    render(<>{R({ value: 'done', row: {} })}</>);
    expect(screen.getByText('done')).toBeInTheDocument();
  });

  it('uses the label mapper when given one', () => {
    const R = BadgeColumn<string>({ tone: () => 'blue', label: (v) => v.toUpperCase() });
    render(<>{R({ value: 'open', row: {} })}</>);
    expect(screen.getByText('OPEN')).toBeInTheDocument();
  });

  it('renders nothing for a null value rather than an empty pill', () => {
    const R = BadgeColumn<string | null>({ tone: () => 'gray' });
    const { container } = render(<>{R({ value: null, row: {} })}</>);
    expect(container.textContent).toBe('');
  });
});

describe('ImageColumn', () => {
  it('renders the image when there is a src', () => {
    const R = ImageColumn();
    render(<>{R({ value: 'https://example.com/a.png', row: {} })}</>);
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://example.com/a.png');
  });

  it('falls back to an avatar built from the row', () => {
    const R = ImageColumn({ fallback: (row) => (row as { name: string }).name });
    render(<>{R({ value: null, row: { name: 'Alpha' } })}</>);
    expect(screen.getByText('A')).toBeInTheDocument();
  });
});

describe('ActionsColumn', () => {
  it('renders a labelled button per action', () => {
    const R = ActionsColumn({ items: [{ icon: 'trash', label: 'Delete', onClick: () => {} }] });
    render(<>{R({ value: undefined, row: {} })}</>);
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  it('calls the action with its row', async () => {
    const onClick = vi.fn();
    const R = ActionsColumn({ items: [{ icon: 'trash', label: 'Delete', onClick }] });
    render(<>{R({ value: undefined, row: { id: '9' } })}</>);
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onClick).toHaveBeenCalledWith({ id: '9' });
  });

  // Rows open a drawer on click; an action must not do both.
  it('does not let the click reach the row', async () => {
    const onRowClick = vi.fn();
    const R = ActionsColumn({ items: [{ icon: 'trash', label: 'Delete', onClick: () => {} }] });
    render(<div onClick={onRowClick}>{R({ value: undefined, row: {} })}</div>);
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onRowClick).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `pnpm --filter @tickets/ui test -- src/table/columns/columns.test.tsx`
Expected: FAIL on the eight new tests; the previous 12 still PASS

- [ ] **Step 3: Implement the three helpers**

Create `packages/web/ui/src/table/columns/badge-column.tsx`:

```tsx
import type { Renderer } from '@tickets/table';
import { Pill } from '../../components/pill';
import type { Tone } from '../../style';

type BadgeColumnOpts<V> = {
  tone: (value: V) => Tone;
  label?: (value: V) => string;
};

export function BadgeColumn<V>(opts: BadgeColumnOpts<V>): Renderer<V> {
  return ({ value }) => {
    if (value == null) return null;
    return <Pill size="sm" tone={opts.tone(value)} label={opts.label ? opts.label(value) : String(value)} />;
  };
}
```

Create `packages/web/ui/src/table/columns/image-column.tsx`:

```tsx
import type { Renderer } from '@tickets/table';
import { Avatar } from '../../components/avatar';

type ImageColumnOpts = {
  /** Derives the name an Avatar falls back to when there is no image. */
  fallback?: (row: unknown) => string | undefined;
};

/** Falls back to Avatar rather than hand-rolling an initial disc, so a row
 *  thumbnail and the same person's avatar elsewhere look identical. */
export function ImageColumn(opts: ImageColumnOpts = {}): Renderer<string | null | undefined> {
  return ({ value, row }) => {
    if (value) {
      return (
        <img
          src={value}
          alt=""
          loading="lazy"
          className="size-6 rounded-sm object-cover"
        />
      );
    }
    return <Avatar name={opts.fallback?.(row) ?? '?'} size="sm" />;
  };
}
```

Check `components/avatar`'s real props before wiring — if it takes `initials` or a `user` object rather than `name`, adapt and keep the fallback mapper returning a display name.

Create `packages/web/ui/src/table/columns/actions-column.tsx`:

```tsx
import type { Renderer } from '@tickets/table';
import { Button } from '../../components/button';
import type { IconName } from '../../components/icon';
import type { Tone } from '../../style';

type ActionItem = {
  icon: IconName;
  label: string;
  onClick: (row: unknown) => void;
  tone?: Tone;
};

type ActionsColumnOpts = { items: ActionItem[] };

/**
 * Inline row actions, revealed on row hover.
 *
 * The reveal rides on `group-hover`, which requires the `group` class the `tr`
 * slot sets — if row actions ever stop appearing, that class went missing.
 * The buttons stay in the tree rather than being conditionally rendered, so
 * they remain keyboard-reachable when nothing is hovered.
 */
export function ActionsColumn(opts: ActionsColumnOpts): Renderer<unknown> {
  return ({ row }) => (
    <div className="flex items-center justify-end gap-1">
      {opts.items.map((item) => (
        <Button
          key={item.label}
          variant="ghost"
          size="sm"
          tone={item.tone}
          icon={item.icon}
          aria-label={item.label}
          title={item.label}
          className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
          onClick={(e) => {
            // The row opens a drawer on click; without this an action would do
            // its own job and open the drawer behind it.
            e.stopPropagation();
            item.onClick(row);
          }}
        />
      ))}
    </div>
  );
}
```

Check `components/button`'s props for the icon-only form — if it takes `icon` as an element rather than an `IconName`, pass `<Icon name={item.icon} />`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @tickets/ui test -- src/table/columns/columns.test.tsx`
Expected: PASS, 20 tests

- [ ] **Step 5: Commit**

```bash
git add packages/web/ui/src/table/columns
git commit -m "feat(ui): badge, image and actions column helpers"
```

---

### Task 10: Barrel and demo

**Files:**
- Create: `packages/web/ui/src/table/index.ts`, `table.demo.tsx`
- Modify: `packages/web/ui/src/index.ts`

**Interfaces:**
- Produces: the public `@tickets/ui` table surface — `tableRender` and all seven column helpers

- [ ] **Step 1: Create the barrel**

Create `packages/web/ui/src/table/index.ts`:

```ts
// The engine is @tickets/table. This subtree is the styled adapter: the
// default `tableRender` plus the cell-content helpers in `columns/`.
export { tableRender } from './table-render';
export { TextColumn } from './columns/text-column';
export { NumberColumn } from './columns/number-column';
export { DateColumn } from './columns/date-column';
export { LinkColumn } from './columns/link-column';
export { BadgeColumn } from './columns/badge-column';
export { ImageColumn } from './columns/image-column';
export { ActionsColumn } from './columns/actions-column';
```

In `packages/web/ui/src/index.ts`, add after the `./forms` line (or after `./components` if Plan 1 has not landed):

```ts
export * from './table';
```

- [ ] **Step 2: Add the demo**

Create `packages/web/ui/src/table/table.demo.tsx`:

```tsx
import { useState } from 'react';
import { Table, useTableWidths, type Column, type SortBy } from '@tickets/table';
import { tableRender } from './table-render';
import { BadgeColumn } from './columns/badge-column';
import { DateColumn } from './columns/date-column';
import { NumberColumn } from './columns/number-column';
import { TextColumn } from './columns/text-column';

export const meta = { title: 'Table', group: 'Components', size: 'full' };

type Row = { id: string; name: string; status: string; count: number; updated: string };

const ROWS: Row[] = Array.from({ length: 40 }, (_, i) => ({
  id: String(i),
  name: `Item ${i + 1}`,
  status: ['open', 'done', 'blocked'][i % 3]!,
  count: (i + 1) * 3,
  updated: new Date(2026, 6, 1 + (i % 28)).toISOString(),
}));

const STATUS_TONE: Record<string, 'blue' | 'green' | 'red'> = {
  open: 'blue',
  done: 'green',
  blocked: 'red',
};

const COLUMNS: Column<Row>[] = [
  { key: 'name', header: 'Name', value: (r) => r.name, as: TextColumn(), sortable: true, width: 'minmax(200px, 1fr)' },
  { key: 'status', header: 'Status', value: (r) => r.status, as: BadgeColumn<string>({ tone: (v) => STATUS_TONE[v] ?? 'gray' }), width: 120 },
  { key: 'count', header: 'Count', value: (r) => r.count, as: NumberColumn({ format: 'integer' }), align: 'right', width: 100, sortable: true },
  { key: 'updated', header: 'Updated', value: (r) => r.updated, as: DateColumn(), width: 140 },
];

function Demo({ grouped, loading, error }: { grouped?: boolean; loading?: boolean; error?: boolean }) {
  const [sort, setSort] = useState<SortBy[]>([]);
  const [widths, setWidth] = useTableWidths('demo');
  const groups = grouped
    ? Object.entries(
        ROWS.reduce<Record<string, Row[]>>((acc, row) => {
          (acc[row.status] ??= []).push(row);
          return acc;
        }, {}),
      ).map(([key, rows]) => ({
        key,
        header: (
          <>
            <span className="font-sans text-13/19 font-600 text-gray-12">{key}</span>
            <span className="font-mono text-11 text-gray-9">{rows.length}</span>
          </>
        ),
        rows,
      }))
    : undefined;
  return (
    <div className="h-100 w-full">
      <Table<Row>
        columns={COLUMNS}
        rows={grouped ? [] : ROWS}
        groups={groups}
        state={{ sort, widths }}
        onSortChange={setSort}
        onWidthChange={setWidth}
        onRowClick={() => {}}
        isLoading={Boolean(loading)}
        error={error ? new Error('The server said no.') : null}
        render={tableRender}
      />
    </div>
  );
}

export const states = [
  { name: 'Flat', render: () => <Demo /> },
  { name: 'Grouped', render: () => <Demo grouped /> },
  { name: 'Loading', render: () => <Demo loading /> },
  { name: 'Error', render: () => <Demo error /> },
];
```

- [ ] **Step 3: Run every check**

Run: `pnpm --filter @tickets/ui test`
Expected: PASS

Run: `pnpm --filter @tickets/ui typecheck`
Expected: exit 0

Run: `pnpm --filter @tickets/ui tokens:verify`
Expected: exit 0

- [ ] **Step 4: Look at it**

Start the playground per `running-the-stack` and open the Table page. Check all four states, drag a column edge, click a sortable header, and scroll a grouped table far enough to confirm rows below the first group land at the right offsets — an off-by-one in `estimateSize` shows up as rows drifting, and no test catches it.

- [ ] **Step 5: Commit**

```bash
git add packages/web/ui/src/table packages/web/ui/src/index.ts
git commit -m "feat(ui): table adapter barrel and gallery demo"
```

---

### Task 11: Migrate all-items-screen

**Files:**
- Modify: `apps/web/src/components/all-items/all-items-screen.tsx`
- Verify unchanged: `all-items-screen.test.tsx`, `shared-fields.ts`, `columns-popover.tsx`, `global-filter-chips.tsx`, `global-views.ts`

**Interfaces:**
- Consumes: `Table`, `useTableWidths`, `type Column`, `type SortBy`, `type TableGroup` from `@tickets/table`; `tableRender` from `@tickets/ui`

**The acceptance gate is `all-items-screen.test.tsx`, all 313 lines, passing unmodified.** If a test needs changing to accommodate the new implementation, that is a signal the migration changed behaviour — stop and reconsider rather than editing the test.

**What already lines up:** the screen's `groups` array is built as `{ key, header: ReactNode, rows: Row[] }[]` — exactly `TableGroup<Row>`. It needs no reshaping.

- [ ] **Step 1: Run the existing tests and record the baseline**

Run: `pnpm --filter @tickets/web test -- src/components/all-items`
Expected: PASS. Note the count — it must be identical at the end.

- [ ] **Step 2: Add the dependency**

In `apps/web/package.json`, add to `dependencies`:

```json
    "@tickets/table": "workspace:*",
```

Run: `pnpm install`

- [ ] **Step 3: Build the column definitions**

In `all-items-screen.tsx`, replace the hand-built `gridTemplateColumns` array (around line 341) with a `Column<Row>[]`. The two fixed columns keep their exact track sizes, and the dynamic ones keep `columnWidthFor`'s output — which is why Task 4 made `width` accept a string:

```tsx
const columns: Column<Row>[] = [
  {
    key: 'key',
    header: 'Key',
    width: '96px',
    render: (row) => (
      <ItemKey prefix={row.entry.project.itemPrefix} number={row.ticket.number} />
    ),
  },
  {
    key: 'title',
    header: 'Title',
    width: 'minmax(240px, 1fr)',
    render: (row) => (
      <span className="truncate font-sans text-13/19 text-gray-12">
        {String(row.ticket.values.title ?? '')}
      </span>
    ),
  },
  ...visibleColumns.map((id) => ({
    key: id,
    header: columnLabelFor(id, sharedByKey),
    width: columnWidthFor(id, sharedByKey),
    render: (row: Row) => cell(id, row),
  })),
];
```

`columnWidthFor` returns CSS track strings today, so its return type is already `string` — no change needed there.

- [ ] **Step 4: Replace the rendering**

Delete the sticky header block and the `groups.map(...)` row loop (roughly lines 555–615). Keep the surrounding scroll container and the `ScreenState` empty branch — the engine renders nothing for an empty table, so the screen keeps owning that:

```tsx
<div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-t-[12px] border border-gray-6 bg-surface-raised">
  {allRows.length === 0 ? (
    <ScreenState
      className="flex-1 justify-center py-16"
      tone="neutral"
      icon="search"
      title={totalCount > 0 ? 'No items match these filters' : 'No items yet'}
      body={
        totalCount > 0
          ? `Filters are hiding all ${totalCount} items across ${entries.length} projects.`
          : 'Nothing here yet — create an item in any project.'
      }
    />
  ) : (
    <Table<Row>
      columns={columns}
      groups={groups}
      state={{ sort, widths }}
      onSortChange={setSort}
      onWidthChange={setWidth}
      onRowClick={(row) =>
        setSelected({ projectKey: row.entry.project.key, ticketId: row.ticket.id })
      }
      rowHeight={config.density === 'compact' ? 32 : 42}
      isLoading={false}
      render={tableRender}
    />
  )}
</div>
```

`rowHeight` carries the density toggle — `h-8` is 32px and `h-10.5` is 42px, and those numbers must match or the virtualizer misplaces every row.

Note `overflow-auto` became `overflow-hidden` on the wrapper: the engine owns its own scroll container, and two nested scrollers would fight.

- [ ] **Step 5: Add the sort and width state**

Near the other `useState` calls:

```tsx
const [sort, setSort] = useState<SortBy[]>([]);
const [widths, setWidth] = useTableWidths('all-items');
```

Sorting is now live where it was not before. The screen already sorts rows inside each group by ticket number; leave that as the default ordering and let `sort` reorder on top of it — apply it in the group-building code where rows are sorted, or leave the columns non-sortable in this task and enable them in a follow-up. **Prefer leaving `sortable` off every column here.** Turning it on without wiring `sort` into the actual row ordering would give the user a control that does nothing, which is worse than no control.

- [ ] **Step 6: Run the acceptance gate**

Run: `pnpm --filter @tickets/web test -- src/components/all-items`
Expected: PASS with the same test count as Step 1, **no test file edited**

- [ ] **Step 7: Run every check**

Run: `pnpm typecheck`
Run: `pnpm --filter @tickets/web test`
Run: `pnpm --filter @tickets/ui test`
Run: `pnpm --filter @tickets/table test`
Run: `pnpm build`
Expected: all exit 0

- [ ] **Step 8: Verify in the running app**

Start the stack per `running-the-stack` and open All items. Check: both grouping modes, the density toggle (rows must not drift), the columns popover adding and removing columns, clicking a row opening the drawer, dragging a column edge, and scrolling a long list to the bottom.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/components/all-items/all-items-screen.tsx apps/web/package.json pnpm-lock.yaml
git commit -m "refactor(web): render All items through the shared Table"
```

---

## Self-Review

**Spec coverage.** `@tickets/table` scaffold and engine → Tasks 1–3; grouping → Task 5; the ui adapter and its eight slots → Tasks 6–7; the seven column helpers → Tasks 8–9; all-items migration → Task 11. The barrel, demo and dependency wiring fold into the tasks that need them.

**Three corrections to the spec.** Found by reading the migration target, and the plan supersedes the spec on all three:

1. **The engine needs a `rowHeight` prop.** all-items has a density toggle (32px / 42px); a hardcoded `ROW_HEIGHT` would misposition every row in one mode. Task 4.
2. **`Column.width` must accept a string.** The Title column is `minmax(240px, 1fr)`, which no number expresses. Task 4.
3. **`ActionsColumn` uses `Button` + `Icon`, not `Menu`.** The spec said Menu; the source is inline icon buttons revealed on row hover, and nothing asked for a menu. Task 9.

A fourth item needed no change: the empty state stays with the screen, since the engine renders nothing for zero rows and `ScreenState` is already what the screen shows.

**Placeholder scan.** No TBD/TODO. The verbatim-port steps name an exact source path and the exact edits (import specifier, one localStorage prefix) — that is a precise instruction against a file that exists, not a placeholder. Four steps say "check the real props before wiring" for `RelativeDate`, `Avatar`, `Button`'s icon form and the icon registry's alert glyph; each states what to do in both cases rather than leaving it open.

**Type consistency.** `TableGroup<T>`, `VirtualRow<T>`, `GROUP_ROW_HEIGHT`, `RenderGroupHeaderCtx` are defined in Task 5 and used under those names in Tasks 7 and 11. `tableRender` is built in Task 6, completed in Task 7, exported in Task 10, consumed in Task 11. `flattenGroups` is produced and consumed in Task 5. The `RenderGroupHeader` wrapper takes `groupKey`, not `key`, in both its definition and its call site — React would swallow the latter.

**Known follow-up, deliberately not in this plan.** Column sorting is wired through to `onSortChange` but Task 11 leaves every all-items column `sortable: false`, because making it real means changing how rows are ordered inside groups. Shipping a sort control that reorders nothing would be worse than shipping none.
