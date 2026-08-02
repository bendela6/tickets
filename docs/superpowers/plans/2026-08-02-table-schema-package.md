# Table Schema Package Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A pure-TypeScript package that turns a declarative table definition into compiled columns, validates it against injected registries, and evaluates filters — with no React, no DOM and no ticket-domain knowledge.

**Architecture:** `@tickets/table-schema` owns the data model (`TableDef`, `ColumnDef`, `CellPart`) and four pure functions over it: path resolution, binding resolution, validation, and compilation. Compilation is generic over the host's node type (`TNode`), so React arrives only inside the `cells` registry the host supplies — the same package can drive a React table, a server renderer or a CSV export. Filter evaluation is shared by all three filter levels (source prefilter, table-wide, per-column).

**Tech Stack:** TypeScript (strict, `verbatimModuleSyntax`, `noUncheckedIndexedAccess`), vitest. Zero runtime dependencies.

## Global Constraints

- **No React, no DOM, no `@tickets/ui`, no `@tickets/table` imports.** This package must be usable outside this repo. A dependency on any of those is a plan failure.
- **No ticket-domain vocabulary.** No `Item`, `Board`, `Project`, `scheme`, `ticket`. The word "field" is generic and allowed.
- Package name `@tickets/table-schema`, at `packages/web/table-schema/`, `"private": true`, matching `packages/web/table/package.json` exactly in structure.
- TypeScript config extends the repo root the same way `packages/web/table/tsconfig.json` does.
- Test command is `pnpm --filter @tickets/table-schema test`, which runs `vitest run`.
- Conventional commits scoped `feat(table-schema):` / `test(table-schema):`.
- Every test must fail before its implementation exists. vitest's esbuild transform strips types without checking them, so a test can go green for the wrong reason — verify red first.

---

### Task 1: Package scaffold and the data model

**Files:**
- Create: `packages/web/table-schema/package.json`
- Create: `packages/web/table-schema/tsconfig.json`
- Create: `packages/web/table-schema/vitest.config.ts`
- Create: `packages/web/table-schema/src/types.ts`
- Create: `packages/web/table-schema/src/index.ts`
- Test: `packages/web/table-schema/src/types.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `TableDef`, `ColumnDef`, `CellDef`, `CellPart`, `Binding`, `FilterRule`, `SourceDef`, `WidthDef`, `FieldKind`, `CellLayout` — every later task imports from here.

- [ ] **Step 1: Write the failing test**

`src/types.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { isBindingField, isBindingFn, type TableDef } from './index';

describe('model', () => {
  it('accepts a definition using every part of the model', () => {
    const def: TableDef = {
      key: 'tickets',
      name: 'Tickets',
      source: { from: 'items', params: { project: 'core' }, prefilter: [] },
      filters: [],
      columns: [
        {
          key: 'ticket',
          label: 'Ticket',
          width: { mode: 'fill', min: 240 },
          align: 'left',
          sortBy: 'title',
          sortDir: 'asc',
          pinned: 'left',
          hidden: false,
          cell: {
            layout: 'lines',
            gap: 2,
            lines: [[{ renderer: 'link', field: 'key', props: { to: 'ticket' }, empty: '—' }]],
          },
        },
      ],
    };
    expect(def.columns[0]?.cell.lines[0]?.[0]?.renderer).toBe('link');
  });

  it('tells the three binding forms apart', () => {
    expect(isBindingField({ $field: 'a' })).toBe(true);
    expect(isBindingField('a')).toBe(false);
    expect(isBindingFn({ $fn: 'tone' })).toBe(true);
    expect(isBindingFn({ $field: 'a' })).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @tickets/table-schema test`
Expected: FAIL — the package does not exist yet.

- [ ] **Step 3: Write minimal implementation**

`package.json` (copy the shape of `packages/web/table/package.json`; it has no dependencies):

```json
{
  "name": "@tickets/table-schema",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "scripts": { "test": "vitest run", "typecheck": "tsc -p tsconfig.json" },
  "devDependencies": { "typescript": "^5.6.0", "vitest": "^4.0.0" }
}
```

`tsconfig.json` and `vitest.config.ts`: copy `packages/web/table/`'s versions verbatim, except `vitest.config.ts` drops the React plugin and sets `environment: 'node'` — there is no DOM here.

`src/types.ts`:

```ts
/** What a field holds. Drives which renderers and operators a builder offers. */
export type FieldKind =
  | 'text' | 'number' | 'boolean' | 'date' | 'option' | 'user' | 'url' | 'json';

/** A dot path into a row: "title", "values.status", "project.key". */
export type FieldPath = string;

/**
 * A prop value. Three sources and a literal — deliberately no more. The
 * definition declares STRUCTURE and BINDING; anything needing computation is a
 * named function in the `fns` registry. That line is what stops this becoming
 * a poor programming language.
 *
 * A literal string containing `{path}` is interpolated against the row, so a
 * URL template needs no marker of its own.
 */
export type Binding =
  | string | number | boolean | null
  | { $field: FieldPath }
  | { $fn: string };

export function isBindingField(b: Binding): b is { $field: FieldPath } {
  return typeof b === 'object' && b !== null && '$field' in b;
}

export function isBindingFn(b: Binding): b is { $fn: string } {
  return typeof b === 'object' && b !== null && '$fn' in b;
}

/** One rendered thing inside a cell. Always a leaf — parts never nest. */
export interface CellPart {
  /** Key into the `cells` registry. */
  renderer: string;
  /** The part's primary datum. Mutually exclusive with `const`. */
  field?: FieldPath;
  /** A literal primary datum, for a fixed icon or a separator. */
  const?: unknown;
  props?: Record<string, Binding>;
  /** Rendered when the datum is empty. `''` hides the part. Ignored when
   *  `const` is set — a literal can never be missing. Defaults to '—'. */
  empty?: string;
}

/**
 * How a cell arranges its parts. A closed set, not a registry: each layout
 * needs both a compiler behaviour and a builder editor, so an open extension
 * point would be one nobody could use.
 */
export type CellLayout = 'lines' | 'inline' | 'wrap' | 'grid';

export interface CellDef {
  layout: CellLayout;
  /** Spacing step between parts. A Tailwind-style number, not pixels. */
  gap?: number;
  /** Track count. Only meaningful when layout is 'grid'. */
  columns?: number;
  /** Exactly two levels: lines, and parts within a line. Layouts other than
   *  'lines' flatten these, which is why the shape does not change per mode. */
  lines: CellPart[][];
}

/**
 * Column width. `auto` sizes to content, `fixed` pins to `value`, `fill` takes
 * the leftover. `min` and `max` apply to `auto` and `fill`.
 */
export interface WidthDef {
  mode: 'auto' | 'fixed' | 'fill';
  value?: number;
  min?: number;
  max?: number;
}

export interface FilterRule {
  field: FieldPath;
  /** Key into the `operators` registry. */
  op: string;
  value?: unknown;
}

/** A filter a column exposes to the end user in its header. */
export interface ColumnFilterDef {
  field: FieldPath;
  op: string;
  control: 'select' | 'multi-select' | 'text' | 'number-range' | 'date-range' | 'boolean';
  default?: unknown;
}

export interface ColumnDef {
  /** Stable identity. Sort, dragged widths, pinning and visibility are stored
   *  against this, never against `label` — two columns may share a label. */
  key: string;
  label: string;
  cell: CellDef;
  /** Present means the column sorts, on this path. Absent means it does not.
   *  There is deliberately no separate `sortable` flag to contradict it. */
  sortBy?: FieldPath;
  sortDir?: 'asc' | 'desc';
  filter?: ColumnFilterDef;
  footer?: Binding;
  width?: WidthDef;
  align?: 'left' | 'right' | 'center';
  pinned?: 'left' | 'right';
  hidden?: boolean;
}

export interface SourceDef {
  /** Key into the `datasets` registry. */
  from: string;
  params?: Record<string, unknown>;
  /** Applied before any row reaches the table. End users never see or change
   *  it — distinct from `TableDef.filters`, which they do. */
  prefilter?: FilterRule[];
}

export interface TableDef {
  key: string;
  name: string;
  source: SourceDef;
  columns: ColumnDef[];
  /** Table-wide filters the end user can change. */
  filters?: FilterRule[];
}
```

`src/index.ts`:

```ts
export type {
  Binding, CellDef, CellLayout, CellPart, ColumnDef, ColumnFilterDef, FieldKind,
  FieldPath, FilterRule, SourceDef, TableDef, WidthDef,
} from './types';
export { isBindingField, isBindingFn } from './types';
```

Add the package to the workspace if `pnpm-workspace.yaml` does not already glob `packages/web/*`, then run `pnpm install`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @tickets/table-schema test`
Expected: PASS, 2 tests.
Then: `pnpm --filter @tickets/table-schema typecheck` — expected clean.

- [ ] **Step 5: Commit**

```bash
git add packages/web/table-schema pnpm-workspace.yaml pnpm-lock.yaml
git commit -m "feat(table-schema): the declarative table definition model"
```

---

### Task 2: Path resolution and the emptiness rule

**Files:**
- Create: `packages/web/table-schema/src/resolve-path.ts`
- Modify: `packages/web/table-schema/src/index.ts`
- Test: `packages/web/table-schema/src/resolve-path.test.ts`

**Interfaces:**
- Consumes: `FieldPath` from Task 1.
- Produces: `resolvePath(row: unknown, path: FieldPath): unknown` and `isEmpty(value: unknown): boolean`.

- [ ] **Step 1: Write the failing test**

`src/resolve-path.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { isEmpty, resolvePath } from './index';

const row = {
  title: 'Ship it',
  number: 12,
  project: { key: 'core', owner: null },
  values: { status: 'open', tags: ['a', 'b'] },
};

describe('resolvePath', () => {
  it('reads a top-level key', () => {
    expect(resolvePath(row, 'title')).toBe('Ship it');
  });

  it('walks a dot path', () => {
    expect(resolvePath(row, 'project.key')).toBe('core');
  });

  it('reads an array whole', () => {
    expect(resolvePath(row, 'values.tags')).toEqual(['a', 'b']);
  });

  it('indexes into an array', () => {
    expect(resolvePath(row, 'values.tags.1')).toBe('b');
  });

  // A missing path is not an error. A definition outlives the shape it was
  // written against, and a table that throws on a renamed field is worse than
  // one that shows an em dash.
  it('returns undefined for a path that does not exist', () => {
    expect(resolvePath(row, 'values.nope')).toBeUndefined();
  });

  it('stops at a null rather than throwing', () => {
    expect(resolvePath(row, 'project.owner.name')).toBeUndefined();
  });

  it('returns undefined for a non-object row', () => {
    expect(resolvePath(null, 'title')).toBeUndefined();
  });
});

describe('isEmpty', () => {
  it.each([
    [null, true],
    [undefined, true],
    ['', true],
    [[], true],
    [0, false],
    [false, false],
    ['x', false],
    [['a'], false],
  ])('treats %p as empty=%p', (value, expected) => {
    expect(isEmpty(value)).toBe(expected);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @tickets/table-schema test`
Expected: FAIL — `resolvePath is not a function`.

- [ ] **Step 3: Write minimal implementation**

`src/resolve-path.ts`:

```ts
import type { FieldPath } from './types';

/**
 * Read a dot path out of a row.
 *
 * Never throws. A definition outlives the shape it was written against, so a
 * renamed or deleted field must degrade to `undefined` and let the part's
 * `empty` text handle it — a table that throws on a stale path is worse than
 * one showing an em dash.
 *
 * Numeric segments index arrays, so "tags.0" works without separate syntax.
 */
export function resolvePath(row: unknown, path: FieldPath): unknown {
  let current: unknown = row;
  for (const segment of path.split('.')) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (Array.isArray(current)) {
      const index = Number(segment);
      current = Number.isInteger(index) ? current[index] : undefined;
      continue;
    }
    if (typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

/**
 * Whether a part should fall back to its `empty` text.
 *
 * An empty ARRAY counts, because a multi-value field with nothing in it reads
 * as missing to a person even though it is a perfectly good value. Zero and
 * false do NOT count — they are answers, not absences, and hiding them behind
 * an em dash loses real information.
 */
export function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined || value === '') {
    return true;
  }
  return Array.isArray(value) && value.length === 0;
}
```

Append to `src/index.ts`:

```ts
export { resolvePath, isEmpty } from './resolve-path';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @tickets/table-schema test`
Expected: PASS, 16 tests total.

- [ ] **Step 5: Commit**

```bash
git add packages/web/table-schema/src
git commit -m "feat(table-schema): dot-path resolution and the emptiness rule"
```

---

### Task 3: Binding resolution

**Files:**
- Create: `packages/web/table-schema/src/resolve-binding.ts`
- Modify: `packages/web/table-schema/src/index.ts`
- Test: `packages/web/table-schema/src/resolve-binding.test.ts`

**Interfaces:**
- Consumes: `resolvePath` (Task 2), `Binding` (Task 1).
- Produces: `type FnRegistry = Record<string, { label: string; returns: string; call: (row: unknown) => unknown }>` and `resolveBinding(binding: Binding, row: unknown, fns: FnRegistry): unknown` and `resolveProps(props: Record<string, Binding> | undefined, row: unknown, fns: FnRegistry): Record<string, unknown>`.

- [ ] **Step 1: Write the failing test**

`src/resolve-binding.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { resolveBinding, resolveProps, type FnRegistry } from './index';

const row = { number: 12, project: { key: 'core' }, status: 'open' };
const fns: FnRegistry = {
  statusTone: { label: 'Status tone', returns: 'text', call: () => 'green' },
};

describe('resolveBinding', () => {
  it('passes a plain literal through', () => {
    expect(resolveBinding(42, row, fns)).toBe(42);
    expect(resolveBinding(true, row, fns)).toBe(true);
    expect(resolveBinding(null, row, fns)).toBe(null);
  });

  it('reads a field binding', () => {
    expect(resolveBinding({ $field: 'project.key' }, row, fns)).toBe('core');
  });

  it('calls a registered function', () => {
    expect(resolveBinding({ $fn: 'statusTone' }, row, fns)).toBe('green');
  });

  // An unregistered function is a stale definition, not a crash. The builder
  // flags it; the viewer degrades.
  it('resolves an unknown function to undefined rather than throwing', () => {
    expect(resolveBinding({ $fn: 'gone' }, row, fns)).toBeUndefined();
  });

  it('interpolates a string containing a path', () => {
    expect(resolveBinding('/p/{project.key}/t/{number}', row, fns)).toBe('/p/core/t/12');
  });

  it('leaves a string with no braces untouched', () => {
    expect(resolveBinding('plain', row, fns)).toBe('plain');
  });

  it('substitutes an empty string for a missing path', () => {
    expect(resolveBinding('/x/{nope}', row, fns)).toBe('/x/');
  });

  it('escapes a doubled brace so a literal brace survives', () => {
    expect(resolveBinding('{{number}}', row, fns)).toBe('{number}');
  });
});

describe('resolveProps', () => {
  it('resolves every value and leaves keys alone', () => {
    expect(
      resolveProps({ tone: { $fn: 'statusTone' }, size: 'compact', to: '/t/{number}' }, row, fns),
    ).toEqual({ tone: 'green', size: 'compact', to: '/t/12' });
  });

  it('returns an empty object when there are no props', () => {
    expect(resolveProps(undefined, row, fns)).toEqual({});
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @tickets/table-schema test`
Expected: FAIL — `resolveBinding is not a function`.

- [ ] **Step 3: Write minimal implementation**

`src/resolve-binding.ts`:

```ts
import { resolvePath } from './resolve-path';
import { isBindingField, isBindingFn, type Binding } from './types';

export interface FnEntry {
  label: string;
  /** What the function yields, so a builder can offer only the functions whose
   *  output fits the prop being edited. */
  returns: string;
  call: (row: unknown) => unknown;
}

export type FnRegistry = Record<string, FnEntry>;

/** `{path}`, but not `{{escaped}}`. */
const TEMPLATE = /\{\{|\}\}|\{([^{}]+)\}/g;

/**
 * Resolve one prop value against a row.
 *
 * String interpolation is implicit — any string containing `{path}` is a
 * template — because the alternative was a `$t` marker, and a builder user
 * types a URL into a text box without knowing what a marker is. `{{` and `}}`
 * escape to literal braces for the rare string that wants them.
 */
export function resolveBinding(binding: Binding, row: unknown, fns: FnRegistry): unknown {
  if (isBindingField(binding)) {
    return resolvePath(row, binding.$field);
  }
  if (isBindingFn(binding)) {
    // Absent rather than thrown: an unregistered function means a stale
    // definition, which the builder surfaces and the viewer survives.
    return fns[binding.$fn]?.call(row);
  }
  if (typeof binding !== 'string' || !binding.includes('{')) {
    return binding;
  }
  return binding.replace(TEMPLATE, (match, path: string | undefined) => {
    if (match === '{{') return '{';
    if (match === '}}') return '}';
    const value = resolvePath(row, path ?? '');
    return value === null || value === undefined ? '' : String(value);
  });
}

export function resolveProps(
  props: Record<string, Binding> | undefined,
  row: unknown,
  fns: FnRegistry,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, binding] of Object.entries(props ?? {})) {
    out[key] = resolveBinding(binding, row, fns);
  }
  return out;
}
```

Append to `src/index.ts`:

```ts
export { resolveBinding, resolveProps } from './resolve-binding';
export type { FnEntry, FnRegistry } from './resolve-binding';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @tickets/table-schema test`
Expected: PASS, 26 tests total.

- [ ] **Step 5: Commit**

```bash
git add packages/web/table-schema/src
git commit -m "feat(table-schema): binding resolution with implicit interpolation"
```

---

### Task 4: The registry contracts

**Files:**
- Create: `packages/web/table-schema/src/registries.ts`
- Modify: `packages/web/table-schema/src/index.ts`
- Test: `packages/web/table-schema/src/registries.test.ts`

**Interfaces:**
- Consumes: `FieldKind`, `FilterRule` (Task 1), `FnRegistry` (Task 3).
- Produces: `CellEntry<TRow, TNode>`, `CellRegistry<TRow, TNode>`, `FieldEntry`, `FieldRegistry`, `RouteEntry`, `RouteRegistry`, `OperatorEntry`, `OperatorRegistry`, `ActionEntry`, `ActionRegistry`, `DatasetEntry`, `DatasetRegistry`, `Registries<TRow, TNode>`, and `emptyRegistries<TRow, TNode>(): Registries<TRow, TNode>`.

- [ ] **Step 1: Write the failing test**

`src/registries.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { emptyRegistries, type Registries } from './index';

describe('registries', () => {
  it('gives every registry an empty default so a host can supply only some', () => {
    const r = emptyRegistries<Record<string, unknown>, string>();
    expect(Object.keys(r).sort()).toEqual([
      'actions', 'cells', 'datasets', 'fields', 'fns', 'operators', 'routes',
    ]);
    expect(r.cells).toEqual({});
  });

  it('accepts a populated registry set', () => {
    const r: Registries<{ n: number }, string> = {
      ...emptyRegistries<{ n: number }, string>(),
      cells: {
        text: {
          label: 'Text',
          group: 'Content',
          accepts: ['text'],
          render: (ctx) => String(ctx.value),
        },
      },
    };
    expect(r.cells.text?.render({ value: 7, props: {}, row: { n: 7 } })).toBe('7');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @tickets/table-schema test`
Expected: FAIL — `emptyRegistries is not a function`.

- [ ] **Step 3: Write minimal implementation**

`src/registries.ts`:

```ts
import type { FieldKind, FieldPath, FilterRule } from './types';
import type { FnRegistry } from './resolve-binding';

/**
 * What a renderer receives. Generic over the host's node type: React never
 * enters this package, it arrives inside whatever `TNode` the host chooses.
 * That is what lets one definition drive a React table, a server renderer or
 * a CSV export.
 */
export interface CellRenderCtx<TRow> {
  value: unknown;
  props: Record<string, unknown>;
  row: TRow;
}

export interface CellEntry<TRow, TNode> {
  label: string;
  /** Section heading in a builder's renderer picker. */
  group?: string;
  icon?: string;
  /** Field kinds this renderer can display. A builder narrows its field picker
   *  to these, and narrows the renderer list to those a chosen field allows. */
  accepts?: FieldKind[];
  /** Prop schema, as control descriptors a builder turns into a form. Opaque
   *  here — this package never renders it. */
  props?: Record<string, unknown>;
  /** True when the renderer writes back, so a builder can mark it and a viewer
   *  can require an `onCellChange`. */
  writes?: boolean;
  render: (ctx: CellRenderCtx<TRow>) => TNode;
}

export type CellRegistry<TRow, TNode> = Record<string, CellEntry<TRow, TNode>>;

/** One field a definition may bind to. Supplied by the host from whatever it
 *  calls a schema — this package has no opinion about where fields come from. */
export interface FieldEntry {
  path: FieldPath;
  label: string;
  kind: FieldKind;
  array?: boolean;
  options?: { value: string; label: string }[];
}

export type FieldRegistry = Record<FieldPath, FieldEntry>;

export interface RouteEntry {
  label: string;
  href: (row: unknown) => string;
}

export type RouteRegistry = Record<string, RouteEntry>;

export interface OperatorEntry {
  label: string;
  accepts: FieldKind[];
  /** What the builder must collect: nothing, one value, several, or two ends. */
  control: 'none' | 'value' | 'values' | 'range';
  toPredicate: (value: unknown, rule: FilterRule) => boolean;
}

export type OperatorRegistry = Record<string, OperatorEntry>;

export interface ActionEntry {
  label: string;
  icon?: string;
  tone?: string;
  confirm?: string;
  run: (row: unknown) => void;
}

export type ActionRegistry = Record<string, ActionEntry>;

/**
 * A dataset a table can draw from. `fields` lives here rather than beside it
 * because choosing a source is what determines which fields exist — a builder
 * must invalidate its field pickers when the source changes.
 */
export interface DatasetEntry {
  label: string;
  params?: Record<string, unknown>;
  fields: FieldRegistry;
}

export type DatasetRegistry = Record<string, DatasetEntry>;

export interface Registries<TRow, TNode> {
  cells: CellRegistry<TRow, TNode>;
  fields: FieldRegistry;
  datasets: DatasetRegistry;
  routes: RouteRegistry;
  fns: FnRegistry;
  operators: OperatorRegistry;
  actions: ActionRegistry;
}

/** Every registry empty, so a host can spread and supply only what it uses. */
export function emptyRegistries<TRow, TNode>(): Registries<TRow, TNode> {
  return { cells: {}, fields: {}, datasets: {}, routes: {}, fns: {}, operators: {}, actions: {} };
}
```

Append to `src/index.ts`:

```ts
export { emptyRegistries } from './registries';
export type {
  ActionEntry, ActionRegistry, CellEntry, CellRegistry, CellRenderCtx, DatasetEntry,
  DatasetRegistry, FieldEntry, FieldRegistry, OperatorEntry, OperatorRegistry,
  Registries, RouteEntry, RouteRegistry,
} from './registries';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @tickets/table-schema test`
Expected: PASS, 28 tests total.

- [ ] **Step 5: Commit**

```bash
git add packages/web/table-schema/src
git commit -m "feat(table-schema): the seven injected registry contracts"
```

---

### Task 5: Filter evaluation

**Files:**
- Create: `packages/web/table-schema/src/filters.ts`
- Modify: `packages/web/table-schema/src/index.ts`
- Test: `packages/web/table-schema/src/filters.test.ts`

**Interfaces:**
- Consumes: `resolvePath` (Task 2), `OperatorRegistry` (Task 4), `FilterRule` (Task 1).
- Produces: `baseOperators: OperatorRegistry` and `matchesFilters(row: unknown, rules: FilterRule[] | undefined, operators: OperatorRegistry): boolean`.

- [ ] **Step 1: Write the failing test**

`src/filters.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { baseOperators, matchesFilters } from './index';

const row = { status: 'open', points: 5, title: 'Ship the thing', done: false, tags: ['a'] };

describe('baseOperators', () => {
  it('ships the operators a builder needs out of the box', () => {
    expect(Object.keys(baseOperators).sort()).toEqual([
      'any-of', 'between', 'contains', 'empty', 'eq', 'gt', 'lt', 'ne', 'none-of', 'not-empty',
    ]);
  });
});

describe('matchesFilters', () => {
  const m = (rules: Parameters<typeof matchesFilters>[1]) =>
    matchesFilters(row, rules, baseOperators);

  it('passes a row when there are no rules', () => {
    expect(m(undefined)).toBe(true);
    expect(m([])).toBe(true);
  });

  it('matches equality', () => {
    expect(m([{ field: 'status', op: 'eq', value: 'open' }])).toBe(true);
    expect(m([{ field: 'status', op: 'eq', value: 'done' }])).toBe(false);
  });

  it('matches any-of and none-of', () => {
    expect(m([{ field: 'status', op: 'any-of', value: ['open', 'wip'] }])).toBe(true);
    expect(m([{ field: 'status', op: 'none-of', value: ['open'] }])).toBe(false);
  });

  it('matches contains case-insensitively', () => {
    expect(m([{ field: 'title', op: 'contains', value: 'SHIP' }])).toBe(true);
  });

  it('matches numeric comparison and between', () => {
    expect(m([{ field: 'points', op: 'gt', value: 3 }])).toBe(true);
    expect(m([{ field: 'points', op: 'between', value: [1, 5] }])).toBe(true);
    expect(m([{ field: 'points', op: 'between', value: [6, 9] }])).toBe(false);
  });

  it('matches emptiness, counting an empty array as empty', () => {
    expect(m([{ field: 'missing', op: 'empty' }])).toBe(true);
    expect(m([{ field: 'tags', op: 'not-empty' }])).toBe(true);
  });

  // false is a value, not an absence.
  it('does not treat false as empty', () => {
    expect(m([{ field: 'done', op: 'empty' }])).toBe(false);
  });

  it('ANDs every rule together', () => {
    expect(
      m([
        { field: 'status', op: 'eq', value: 'open' },
        { field: 'points', op: 'gt', value: 99 },
      ]),
    ).toBe(false);
  });

  // A rule naming an operator nobody registered must not silently pass every
  // row — that would widen a filter into showing more than it should.
  it('fails a row on an unregistered operator rather than passing it', () => {
    expect(m([{ field: 'status', op: 'nope', value: 'x' }])).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @tickets/table-schema test`
Expected: FAIL — `baseOperators is not defined`.

- [ ] **Step 3: Write minimal implementation**

`src/filters.ts`:

```ts
import { isEmpty, resolvePath } from './resolve-path';
import type { OperatorRegistry } from './registries';
import type { FilterRule } from './types';

const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const text = (v: unknown): string => (v === null || v === undefined ? '' : String(v).toLowerCase());
const num = (v: unknown): number => Number(v);

/**
 * The operators every host gets for free. A host may add its own — this is a
 * default, not a closed set.
 *
 * Each is a pure predicate over an already-resolved value, so the same entry
 * serves the source prefilter, the table-wide filters and a column's own
 * filter. The three levels differ in WHERE they run and WHO may change them,
 * never in what an operator means.
 */
export const baseOperators: OperatorRegistry = {
  eq: { label: 'is', accepts: ['text', 'number', 'boolean', 'option', 'date'], control: 'value',
    toPredicate: (v, r) => v === r.value },
  ne: { label: 'is not', accepts: ['text', 'number', 'boolean', 'option', 'date'], control: 'value',
    toPredicate: (v, r) => v !== r.value },
  'any-of': { label: 'is any of', accepts: ['option', 'text', 'user'], control: 'values',
    toPredicate: (v, r) => asArray(r.value).includes(v) },
  'none-of': { label: 'is none of', accepts: ['option', 'text', 'user'], control: 'values',
    toPredicate: (v, r) => !asArray(r.value).includes(v) },
  contains: { label: 'contains', accepts: ['text'], control: 'value',
    toPredicate: (v, r) => text(v).includes(text(r.value)) },
  gt: { label: 'is more than', accepts: ['number', 'date'], control: 'value',
    toPredicate: (v, r) => num(v) > num(r.value) },
  lt: { label: 'is less than', accepts: ['number', 'date'], control: 'value',
    toPredicate: (v, r) => num(v) < num(r.value) },
  between: { label: 'is between', accepts: ['number', 'date'], control: 'range',
    toPredicate: (v, r) => {
      const [lo, hi] = asArray(r.value);
      return num(v) >= num(lo) && num(v) <= num(hi);
    } },
  empty: { label: 'is empty', accepts: ['text', 'number', 'boolean', 'option', 'date', 'user'],
    control: 'none', toPredicate: (v) => isEmpty(v) },
  'not-empty': { label: 'is not empty', accepts: ['text', 'number', 'boolean', 'option', 'date', 'user'],
    control: 'none', toPredicate: (v) => !isEmpty(v) },
};

/**
 * Whether a row survives every rule. Rules AND together.
 *
 * An unregistered operator FAILS the row rather than passing it. Passing would
 * quietly widen the filter — a stale definition would show rows the author
 * meant to exclude, which is the dangerous direction to be wrong in.
 */
export function matchesFilters(
  row: unknown,
  rules: FilterRule[] | undefined,
  operators: OperatorRegistry,
): boolean {
  for (const rule of rules ?? []) {
    const operator = operators[rule.op];
    if (!operator) {
      return false;
    }
    if (!operator.toPredicate(resolvePath(row, rule.field), rule)) {
      return false;
    }
  }
  return true;
}
```

Append to `src/index.ts`:

```ts
export { baseOperators, matchesFilters } from './filters';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @tickets/table-schema test`
Expected: PASS, 39 tests total.

- [ ] **Step 5: Commit**

```bash
git add packages/web/table-schema/src
git commit -m "feat(table-schema): filter operators shared by all three filter levels"
```

---

### Task 6: Validation

**Files:**
- Create: `packages/web/table-schema/src/validate.ts`
- Modify: `packages/web/table-schema/src/index.ts`
- Test: `packages/web/table-schema/src/validate.test.ts`

**Interfaces:**
- Consumes: `TableDef` (Task 1), `Registries` (Task 4).
- Produces: `interface DefIssue { path: string; code: string; message: string }` and `validateDef<TRow, TNode>(def: TableDef, registries: Registries<TRow, TNode>): DefIssue[]`.

- [ ] **Step 1: Write the failing test**

`src/validate.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { emptyRegistries, validateDef, type Registries, type TableDef } from './index';

const registries: Registries<unknown, string> = {
  ...emptyRegistries<unknown, string>(),
  cells: { text: { label: 'Text', render: () => '' } },
  fields: { title: { path: 'title', label: 'Title', kind: 'text' } },
  datasets: { items: { label: 'Items', fields: {} } },
  routes: { ticket: { label: 'Ticket', href: () => '/t/1' } },
};

const def = (over: Partial<TableDef> = {}): TableDef => ({
  key: 't',
  name: 'T',
  source: { from: 'items' },
  columns: [
    {
      key: 'a',
      label: 'A',
      cell: { layout: 'lines', lines: [[{ renderer: 'text', field: 'title' }]] },
    },
  ],
  ...over,
});

const codes = (d: TableDef) => validateDef(d, registries).map((i) => i.code).sort();

describe('validateDef', () => {
  it('finds nothing wrong with a sound definition', () => {
    expect(validateDef(def(), registries)).toEqual([]);
  });

  it('rejects two columns sharing a key', () => {
    const d = def();
    d.columns.push({ ...d.columns[0]!, label: 'B' });
    expect(codes(d)).toContain('duplicate-key');
  });

  it('rejects a column with no key', () => {
    const d = def();
    d.columns[0]!.key = '';
    expect(codes(d)).toContain('missing-key');
  });

  it('reports an unregistered dataset', () => {
    expect(codes(def({ source: { from: 'nope' } }))).toContain('unknown-dataset');
  });

  it('reports an unregistered renderer', () => {
    const d = def();
    d.columns[0]!.cell.lines[0]![0]!.renderer = 'sparkline';
    expect(codes(d)).toContain('unknown-renderer');
  });

  it('reports a field that is not in the registry', () => {
    const d = def();
    d.columns[0]!.cell.lines[0]![0]!.field = 'gone';
    expect(codes(d)).toContain('unknown-field');
  });

  it('reports an unregistered route named by a prop', () => {
    const d = def();
    d.columns[0]!.cell.lines[0]![0]!.props = { to: 'nowhere' };
    expect(codes(d)).toContain('unknown-route');
  });

  it('reports a sortBy naming a field that does not exist', () => {
    const d = def();
    d.columns[0]!.sortBy = 'gone';
    expect(codes(d)).toContain('unknown-field');
  });

  // A part must show something. Neither a field nor a const means a blank cell
  // that looks like a data problem but is a definition problem.
  it('reports a part with neither field nor const', () => {
    const d = def();
    delete d.columns[0]!.cell.lines[0]![0]!.field;
    expect(codes(d)).toContain('no-value');
  });

  it('locates each issue by path so a builder can point at it', () => {
    const d = def();
    d.columns[0]!.cell.lines[0]![0]!.renderer = 'nope';
    expect(validateDef(d, registries)[0]?.path).toBe('columns.0.cell.lines.0.0.renderer');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @tickets/table-schema test`
Expected: FAIL — `validateDef is not a function`.

- [ ] **Step 3: Write minimal implementation**

`src/validate.ts`:

```ts
import type { Registries } from './registries';
import { isBindingFn, type TableDef } from './types';

export interface DefIssue {
  /** Dotted location inside the definition, so a builder can select the exact
   *  control that is wrong rather than saying "something is broken". */
  path: string;
  code: string;
  message: string;
}

/**
 * Check a definition against the registries it will run under.
 *
 * Every issue is a DANGLING REFERENCE or a structural mistake, never a taste
 * judgement — a definition outlives the registries it was written against, so
 * this is what turns "the table looks broken" into "the `sparkline` renderer
 * is no longer registered".
 *
 * Returns every issue rather than the first: a builder shows them all at once.
 */
export function validateDef<TRow, TNode>(
  def: TableDef,
  registries: Registries<TRow, TNode>,
): DefIssue[] {
  const issues: DefIssue[] = [];
  const add = (path: string, code: string, message: string) =>
    issues.push({ path, code, message });

  if (!registries.datasets[def.source.from]) {
    add('source.from', 'unknown-dataset', `No dataset named "${def.source.from}" is registered.`);
  }

  const seen = new Set<string>();
  def.columns.forEach((column, ci) => {
    const at = `columns.${ci}`;
    if (!column.key) {
      add(`${at}.key`, 'missing-key', 'A column needs a key; sort and width are stored against it.');
    } else if (seen.has(column.key)) {
      add(`${at}.key`, 'duplicate-key', `Key "${column.key}" is already used by another column.`);
    } else {
      seen.add(column.key);
    }

    if (column.sortBy && !registries.fields[column.sortBy]) {
      add(`${at}.sortBy`, 'unknown-field', `No field at "${column.sortBy}".`);
    }

    column.cell.lines.forEach((line, li) => {
      line.forEach((part, pi) => {
        const pAt = `${at}.cell.lines.${li}.${pi}`;
        if (!registries.cells[part.renderer]) {
          add(`${pAt}.renderer`, 'unknown-renderer', `No renderer named "${part.renderer}".`);
        }
        if (part.field === undefined && part.const === undefined) {
          add(pAt, 'no-value', 'A part needs either a field or a static value.');
        }
        if (part.field !== undefined && !registries.fields[part.field]) {
          add(`${pAt}.field`, 'unknown-field', `No field at "${part.field}".`);
        }
        for (const [key, binding] of Object.entries(part.props ?? {})) {
          if (isBindingFn(binding) && !registries.fns[binding.$fn]) {
            add(`${pAt}.props.${key}`, 'unknown-fn', `No function named "${binding.$fn}".`);
          }
          // `to` is the route prop by convention across every link-shaped
          // renderer, so it is checked here rather than per renderer.
          if (key === 'to' && typeof binding === 'string' && !registries.routes[binding]) {
            add(`${pAt}.props.to`, 'unknown-route', `No route named "${binding}".`);
          }
        }
      });
    });
  });

  return issues;
}
```

Append to `src/index.ts`:

```ts
export { validateDef } from './validate';
export type { DefIssue } from './validate';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @tickets/table-schema test`
Expected: PASS, 49 tests total.

- [ ] **Step 5: Commit**

```bash
git add packages/web/table-schema/src
git commit -m "feat(table-schema): validate a definition against its registries"
```

---

### Task 7: Compilation

**Files:**
- Create: `packages/web/table-schema/src/compile.ts`
- Modify: `packages/web/table-schema/src/index.ts`
- Test: `packages/web/table-schema/src/compile.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 1–4.
- Produces: `interface CompiledCell<TNode> { layout: CellLayout; gap?: number; columns?: number; lines: TNode[][] }`, `interface CompiledColumn<TRow, TNode> { key: string; label: string; width: string; align?: 'left'|'right'|'center'; pinned?: 'left'|'right'; sortBy?: string; sortDir?: 'asc'|'desc'; cell: (row: TRow) => CompiledCell<TNode>; footer?: TNode }`, `compileColumns<TRow, TNode>(def, registries): CompiledColumn<TRow, TNode>[]`, and `trackSize(width: WidthDef | undefined): string`.

- [ ] **Step 1: Write the failing test**

`src/compile.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  compileColumns, emptyRegistries, trackSize, type Registries, type TableDef,
} from './index';

interface Row { title: string; status: string | null; n: number }

const registries: Registries<Row, string> = {
  ...emptyRegistries<Row, string>(),
  cells: {
    text: { label: 'Text', render: (c) => `T(${String(c.value)})` },
    pill: { label: 'Pill', render: (c) => `P(${String(c.value)}|${String(c.props.tone)})` },
  },
  fields: {
    title: { path: 'title', label: 'Title', kind: 'text' },
    status: { path: 'status', label: 'Status', kind: 'option' },
  },
  fns: { tone: { label: 'Tone', returns: 'text', call: () => 'green' } },
};

const def: TableDef = {
  key: 't', name: 'T', source: { from: 'items' },
  columns: [{
    key: 'main',
    label: 'Main',
    width: { mode: 'fill', min: 240 },
    sortBy: 'title',
    cell: {
      layout: 'lines',
      lines: [
        [{ renderer: 'text', field: 'title' }],
        [{ renderer: 'pill', field: 'status', props: { tone: { $fn: 'tone' } }, empty: '—' }],
      ],
    },
  }],
};

const row: Row = { title: 'Ship', status: 'open', n: 1 };

describe('trackSize', () => {
  it.each([
    [undefined, '160px'],
    [{ mode: 'fixed' as const, value: 120 }, '120px'],
    [{ mode: 'fill' as const }, 'minmax(160px, 1fr)'],
    [{ mode: 'fill' as const, min: 240 }, 'minmax(240px, 1fr)'],
    [{ mode: 'fill' as const, min: 240, max: 400 }, 'minmax(240px, 400px)'],
    [{ mode: 'auto' as const }, 'max-content'],
    [{ mode: 'auto' as const, min: 80 }, 'minmax(80px, max-content)'],
  ])('turns %p into %p', (width, expected) => {
    expect(trackSize(width)).toBe(expected);
  });
});

describe('compileColumns', () => {
  it('carries key, label, track and sort through', () => {
    const [col] = compileColumns(def, registries);
    expect(col?.key).toBe('main');
    expect(col?.label).toBe('Main');
    expect(col?.width).toBe('minmax(240px, 1fr)');
    expect(col?.sortBy).toBe('title');
  });

  it('renders each part through its registered renderer', () => {
    const cell = compileColumns(def, registries)[0]!.cell(row);
    expect(cell.lines).toEqual([['T(Ship)'], ['P(open|green)']]);
  });

  it('keeps the layout so a host can arrange the parts', () => {
    expect(compileColumns(def, registries)[0]!.cell(row).layout).toBe('lines');
  });

  it('substitutes the empty text when the value is missing', () => {
    const cell = compileColumns(def, registries)[0]!.cell({ ...row, status: null });
    expect(cell.lines[1]).toEqual(['T(—)']);
  });

  // An unregistered renderer must not take the table down with it.
  it('renders an unknown renderer as its empty text instead of throwing', () => {
    const broken: TableDef = {
      ...def,
      columns: [{
        key: 'x', label: 'X',
        cell: { layout: 'lines', lines: [[{ renderer: 'gone', field: 'title', empty: '?' }]] },
      }],
    };
    expect(compileColumns(broken, registries)[0]!.cell(row).lines).toEqual([['T(?)']]);
  });

  it('drops hidden columns', () => {
    const hidden: TableDef = { ...def, columns: [{ ...def.columns[0]!, hidden: true }] };
    expect(compileColumns(hidden, registries)).toHaveLength(0);
  });

  it('renders a static part from const, ignoring empty text', () => {
    const staticDef: TableDef = {
      ...def,
      columns: [{
        key: 'x', label: 'X',
        cell: { layout: 'inline', lines: [[{ renderer: 'text', const: '·', empty: '—' }]] },
      }],
    };
    expect(compileColumns(staticDef, registries)[0]!.cell(row).lines).toEqual([['T(·)']]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @tickets/table-schema test`
Expected: FAIL — `compileColumns is not a function`.

- [ ] **Step 3: Write minimal implementation**

`src/compile.ts`:

```ts
import { resolveProps } from './resolve-binding';
import { isEmpty, resolvePath } from './resolve-path';
import type { Registries } from './registries';
import type { CellLayout, CellPart, TableDef, WidthDef } from './types';

export interface CompiledCell<TNode> {
  layout: CellLayout;
  gap?: number;
  columns?: number;
  lines: TNode[][];
}

export interface CompiledColumn<TRow, TNode> {
  key: string;
  label: string;
  /** A CSS grid track. The one place this package emits a CSS string, because
   *  a track is the only sizing language a grid-based table understands. */
  width: string;
  align?: 'left' | 'right' | 'center';
  pinned?: 'left' | 'right';
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  cell: (row: TRow) => CompiledCell<TNode>;
  footer?: TNode;
}

const DEFAULT_WIDTH = 160;

/**
 * Turn a width into a grid track.
 *
 * `auto` is max-content, `fixed` is a pixel track, `fill` is a flexible one.
 * `min` and `max` narrow the flexible and content modes; a fixed column
 * ignores them, since it already has exactly one size.
 */
export function trackSize(width: WidthDef | undefined): string {
  if (!width) {
    return `${DEFAULT_WIDTH}px`;
  }
  if (width.mode === 'fixed') {
    return `${width.value ?? DEFAULT_WIDTH}px`;
  }
  const min = `${width.min ?? DEFAULT_WIDTH}px`;
  const max = width.max === undefined ? (width.mode === 'auto' ? 'max-content' : '1fr') : `${width.max}px`;
  if (width.mode === 'auto' && width.min === undefined && width.max === undefined) {
    return 'max-content';
  }
  return `minmax(${min}, ${max})`;
}

/**
 * Compile a definition into columns a host can render.
 *
 * Generic over `TNode`: this package never knows what a rendered thing is, it
 * only knows the registry produced one. That is what keeps it free of React
 * and reusable by a server renderer or an exporter.
 *
 * Hidden columns are dropped here rather than by the caller, so every consumer
 * agrees on what "the columns" means.
 */
export function compileColumns<TRow, TNode>(
  def: TableDef,
  registries: Registries<TRow, TNode>,
): CompiledColumn<TRow, TNode>[] {
  const renderPart = (part: CellPart, row: TRow): TNode => {
    const isStatic = part.const !== undefined;
    const raw = isStatic ? part.const : resolvePath(row, part.field ?? '');
    // A static value can never be missing, so `empty` does not apply to it.
    const value = !isStatic && isEmpty(raw) ? (part.empty ?? '—') : raw;
    const entry = registries.cells[part.renderer];
    if (!entry) {
      // A stale renderer degrades to plain text rather than taking the table
      // down. `validateDef` is what tells the author about it.
      const fallback = registries.cells.text;
      return fallback
        ? fallback.render({ value: part.empty ?? '—', props: {}, row })
        : (undefined as TNode);
    }
    return entry.render({ value, props: resolveProps(part.props, row, registries.fns), row });
  };

  return def.columns
    .filter((column) => !column.hidden)
    .map((column) => ({
      key: column.key,
      label: column.label,
      width: trackSize(column.width),
      align: column.align,
      pinned: column.pinned,
      sortBy: column.sortBy,
      sortDir: column.sortDir,
      cell: (row: TRow): CompiledCell<TNode> => ({
        layout: column.cell.layout,
        gap: column.cell.gap,
        columns: column.cell.columns,
        lines: column.cell.lines.map((line) => line.map((part) => renderPart(part, row))),
      }),
    }));
}
```

Append to `src/index.ts`:

```ts
export { compileColumns, trackSize } from './compile';
export type { CompiledCell, CompiledColumn } from './compile';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @tickets/table-schema test`
Expected: PASS, 63 tests total.
Then: `pnpm --filter @tickets/table-schema typecheck` and `pnpm typecheck` — both expected clean.

- [ ] **Step 5: Commit**

```bash
git add packages/web/table-schema/src
git commit -m "feat(table-schema): compile a definition into host-agnostic columns"
```

---

### Task 8: Guard the package's independence

**Files:**
- Test: `packages/web/table-schema/src/independence.test.ts`

**Interfaces:**
- Consumes: the whole package.
- Produces: nothing — this is a gate.

- [ ] **Step 1: Write the failing test**

This mirrors `packages/db/src/schema/independence.test.ts`, which already guards a package boundary in this repo the same way. Read it first and follow its idiom.

`src/independence.test.ts`:

```ts
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// `fileURLToPath`, not `import.meta.dirname` — the latter needs Node 20.11+.
const SRC = dirname(fileURLToPath(import.meta.url));
const files = readdirSync(SRC).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'));

/**
 * The whole value of this package is that it runs anywhere. An import of
 * React, of the DOM, or of anything in this monorepo would quietly end that,
 * and nothing else would fail — so it is asserted rather than trusted.
 */
describe('package independence', () => {
  it('imports nothing from React, the DOM, or another workspace package', () => {
    const offenders: string[] = [];
    for (const file of files) {
      const src = readFileSync(join(SRC, file), 'utf8');
      for (const match of src.matchAll(/from '([^']+)'/g)) {
        const spec = match[1] ?? '';
        const local = spec.startsWith('.');
        const nodeBuiltin = spec.startsWith('node:');
        if (!local && !nodeBuiltin) {
          offenders.push(`${file}: ${spec}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('names nothing from the ticket domain', () => {
    const banned = /\b(ticket|Ticket|board|Board|project|Project|scheme|Scheme)\b/;
    const offenders = files.filter((f) => banned.test(readFileSync(join(SRC, f), 'utf8')));
    expect(offenders).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @tickets/table-schema test`
Expected: FAIL — the domain test finds "project" in `resolve-binding.ts`'s doc comments and `compile.ts` uses `columns` phrasing. This failure is the point: fix the *comments*, not the test. Reword any example paths using `project.` to a neutral noun such as `group.`.

- [ ] **Step 3: Reword the offending comments**

Change example paths in doc comments from `project.key` to `group.key`, and any prose naming a ticket to name "a row". No logic changes.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @tickets/table-schema test`
Expected: PASS, 65 tests total.

- [ ] **Step 5: Commit**

```bash
git add packages/web/table-schema/src
git commit -m "test(table-schema): guard the package against React, DOM and domain imports"
```

---

## What this plan deliberately leaves out

Four further plans, each producing working software on its own. They are listed so a reader knows where this one stops, not as work to start here.

| Plan | Subsystem | Depends on |
| --- | --- | --- |
| 2 | `@tickets/table-schema/builder` — the headless reducer, selectors and dirty tracking that edit a `TableDef` | this plan |
| 3 | `structure.table_defs` migration, the API routes, and `views.config.tableDefId` | this plan |
| 4 | `baseCells` in `@tickets/ui` — the ~22 renderers — plus the `CompiledColumn` → `Column<T>` adapter for `@tickets/table` | this plan |
| 5 | The builder UI: the ten missing library components, then the screen itself | plans 2 and 4 |

The DataTable work (spec `2026-07-30-table-component-design.md`, phases 6–8) meets this stack at plan 3: `SourceDef.from` is the dataset key, and `params` plus `prefilter` are what the keyset endpoint receives.
