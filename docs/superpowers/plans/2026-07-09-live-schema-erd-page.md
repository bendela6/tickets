# Live Schema ERD Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an always-current ER-diagram page at `/schema` in `apps/web`, whose data is derived live from the drizzle schema and whose tables are visually grouped by a hand-declared config.

**Architecture:** `packages/db` gains a table registry + `SCHEMA_GROUPS` config + a pure `describeSchema()` that introspects the drizzle table objects with `getTableConfig()`. `apps/api` exposes it at `GET /api/schema`. `apps/web` ports the verified artifact diagram engine into `renderErd(container, graph)` and mounts it from a TanStack Router route.

**Tech Stack:** drizzle-orm (`getTableConfig`), Fastify, React 19, TanStack Router + Query, Tailwind v4 (preflight OFF) with instrument tokens, vitest.

## Global Constraints

- Package manager is **pnpm**; run package scripts with `pnpm --filter <pkg> <script>`. (verbatim from repo)
- API routes are prefixed **`/api`** (e.g. `app.get('/api/schema', …)`).
- Web is **React 19 + TanStack Router**; standalone pages register in `apps/web/src/router.ts` via `rootRoute.addChildren([...])` (the `/gallery` route is the precedent).
- **Tailwind preflight is OFF.** Scope all diagram CSS under a `.erd` root class; never rely on preflight resets. Use instrument tokens: `--color-app|raised|inset|hairline|control|ink|ink-2|ink-3`, `--ins-shadow-sm`, and option hues `--ins-opt-<hue>` / `--ins-opt-<hue>-subtle` (hues: red orange yellow green teal cyan blue indigo purple pink gray).
- Group colors in `SCHEMA_GROUPS` are instrument option **hue names** (e.g. `"indigo"`), not hex.
- Conventional commits scoped by app: `feat(db): …`, `feat(api): …`, `feat(web): …`.
- Timestamps type label: normalize drizzle's `"timestamp with time zone"` to `"timestamptz"` for display.

---

## File Structure

- `packages/db/src/schema/registry.ts` — **new.** `allTables` array of every `pgTable` object.
- `packages/db/src/schema/schema-groups.ts` — **new.** `SCHEMA_GROUPS` config + `SchemaGroup` type.
- `packages/db/src/schema/describe-schema.ts` — **new.** `describeSchema()` + `SchemaGraph`/`TableMeta`/`ColumnMeta`/`UniqueMeta`/`GroupMeta` types + `resolveGroupKey()` helper.
- `packages/db/src/schema/describe-schema.test.ts` — **new.** Unit tests.
- `packages/db/src/schema/index.ts` — **modify.** Re-export `allTables`, `SCHEMA_GROUPS`, `describeSchema`, and the types.
- `apps/api/src/routes/schema.routes.ts` — **new.** `GET /api/schema`.
- `apps/api/src/routes/schema.routes.test.ts` — **new.** Route test.
- `apps/api/src/app.ts` — **modify.** Register the route.
- `apps/web/src/components/schema/erd-types.ts` — **new.** Web-side payload types (mirror of `SchemaGraph`).
- `apps/web/src/components/schema/erd-engine.ts` — **new.** `renderErd(container, graph)`.
- `apps/web/src/components/schema/erd.css` — **new.** Scoped `.erd` styles.
- `apps/web/src/components/schema/erd-engine.test.ts` — **new.** DOM-structure test.
- `apps/web/src/routes/schema-route.tsx` — **new.** `/schema` page.
- `apps/web/src/router.ts` — **modify.** Add `schemaRoute`.

---

### Task 1: DB metadata layer (`describeSchema`)

**Files:**
- Create: `packages/db/src/schema/registry.ts`
- Create: `packages/db/src/schema/schema-groups.ts`
- Create: `packages/db/src/schema/describe-schema.ts`
- Test: `packages/db/src/schema/describe-schema.test.ts`
- Modify: `packages/db/src/schema/index.ts`

**Interfaces:**
- Produces: `describeSchema(): SchemaGraph`; `allTables` (array of drizzle tables); `SCHEMA_GROUPS: SchemaGroup[]`; `resolveGroupKey(tableName: string, groups: SchemaGroup[]): string` (throws if the table is in no group or >1 group).
- Types (exported): `SchemaGraph`, `TableMeta`, `ColumnMeta`, `UniqueMeta`, `GroupMeta`, `SchemaGroup` — shapes exactly as in the design spec's Types section.

- [ ] **Step 1: Write `registry.ts`**

```ts
// packages/db/src/schema/registry.ts
import { comments } from './comments';
import { commentReactions } from './comment-reactions';
import { fieldOptions } from './field-options';
import { fields } from './fields';
import { linkTypeTargetTypes } from './link-type-target-types';
import { linkTypes } from './link-types';
import { projects } from './projects';
import { schemes } from './schemes';
import { statusTransitions } from './status-transitions';
import { statuses } from './statuses';
import { ticketEvents } from './ticket-events';
import { ticketLinks } from './ticket-links';
import { ticketTypeChildTypes } from './ticket-type-child-types';
import { ticketTypes } from './ticket-types';
import { ticketValues } from './ticket-values';
import { tickets } from './tickets';
import { users } from './users';
import { views } from './views';

// Every pgTable in the schema. Add new tables here; the group invariant test
// then forces them into SCHEMA_GROUPS.
export const allTables = [
  schemes, ticketTypes, ticketTypeChildTypes,
  fields, fieldOptions, statuses, statusTransitions, linkTypes, linkTypeTargetTypes,
  projects, users, views,
  tickets, comments, commentReactions, ticketEvents, ticketValues, ticketLinks,
];
```

- [ ] **Step 2: Write `schema-groups.ts`**

```ts
// packages/db/src/schema/schema-groups.ts

// A declared ownership group. `color` is an instrument option hue name.
// `tables` lists sql table names in render order. Order of groups = layout order.
export type SchemaGroup = {
  key: string;
  label: string;
  color: string;
  tables: string[];
};

export const SCHEMA_GROUPS: SchemaGroup[] = [
  {
    key: 'structure',
    label: 'Schemes',
    color: 'indigo',
    tables: ['schemes', 'ticket_types'],
  },
  {
    key: 'owned',
    label: 'Type-owned config',
    color: 'teal',
    tables: [
      'fields',
      'field_options',
      'statuses',
      'status_transitions',
      'link_types',
      'link_type_target_types',
      'ticket_type_child_types',
    ],
  },
  {
    key: 'workspace',
    label: 'Workspace',
    color: 'blue',
    tables: ['projects', 'users', 'views'],
  },
  {
    key: 'records',
    label: 'Ticket data',
    color: 'orange',
    tables: [
      'tickets',
      'comments',
      'comment_reactions',
      'ticket_events',
      'ticket_values',
      'ticket_links',
    ],
  },
];
```

- [ ] **Step 3: Write the failing test**

```ts
// packages/db/src/schema/describe-schema.test.ts
import { describe, expect, it } from 'vitest';
import { describeSchema, resolveGroupKey } from './describe-schema';
import { SCHEMA_GROUPS } from './schema-groups';

describe('describeSchema', () => {
  const graph = describeSchema();
  const byName = new Map(graph.tables.map((t) => [t.name, t]));

  it('includes the post-0007 tables', () => {
    expect(byName.has('comment_reactions')).toBe(true);
    expect(byName.has('ticket_type_child_types')).toBe(true);
    expect(byName.has('comments')).toBe(true);
  });

  it('derives a single-column FK', () => {
    const cr = byName.get('comment_reactions')!;
    const commentId = cr.columns.find((c) => c.name === 'comment_id')!;
    expect(commentId.fk).toEqual({ table: 'comments', column: 'id' });
    expect(commentId.notNull).toBe(true);
  });

  it('derives a nullable self-FK', () => {
    const comments = byName.get('comments')!;
    const parentId = comments.columns.find((c) => c.name === 'parent_id')!;
    expect(parentId.fk).toEqual({ table: 'comments', column: 'id' });
    expect(parentId.notNull).toBe(false);
  });

  it('derives a composite primary key', () => {
    const cct = byName.get('ticket_type_child_types')!;
    expect([...cct.primaryKey].sort()).toEqual(['child_type_id', 'parent_type_id']);
    expect(cct.columns.find((c) => c.name === 'parent_type_id')!.pk).toBe(true);
  });

  it('normalizes timestamp types', () => {
    const comments = byName.get('comments')!;
    expect(comments.columns.find((c) => c.name === 'created_at')!.type).toBe('timestamptz');
  });

  it('assigns every table to exactly one group', () => {
    for (const t of graph.tables) {
      expect(graph.groups.some((g) => g.key === t.group)).toBe(true);
    }
  });

  it('exposes groups with their table lists', () => {
    const records = graph.groups.find((g) => g.key === 'records')!;
    expect(records.color).toBe('orange');
    expect(records.tables).toContain('comment_reactions');
  });
});

describe('resolveGroupKey', () => {
  it('throws when a table is in no group', () => {
    expect(() => resolveGroupKey('nope', SCHEMA_GROUPS)).toThrow(/no group/i);
  });
  it('resolves a known table', () => {
    expect(resolveGroupKey('tickets', SCHEMA_GROUPS)).toBe('records');
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `pnpm --filter @tickets/db test describe-schema`
Expected: FAIL — `describe-schema` module not found / `describeSchema is not a function`.

- [ ] **Step 5: Write `describe-schema.ts`**

```ts
// packages/db/src/schema/describe-schema.ts
import { getTableName } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { allTables } from './registry';
import { SCHEMA_GROUPS, type SchemaGroup } from './schema-groups';

export type ColumnMeta = {
  name: string;
  type: string;
  notNull: boolean;
  pk: boolean;
  fk: { table: string; column: string } | null;
};
export type UniqueMeta = { name: string; columns: string[] };
export type TableMeta = {
  name: string;
  group: string;
  columns: ColumnMeta[];
  primaryKey: string[];
  uniques: UniqueMeta[];
};
export type GroupMeta = { key: string; label: string; color: string; tables: string[] };
export type SchemaGraph = { tables: TableMeta[]; groups: GroupMeta[] };

const normalizeType = (t: string): string =>
  t === 'timestamp with time zone' ? 'timestamptz' : t;

// Every table must belong to exactly one group. Throws otherwise, so the config
// can't silently fall behind the schema.
export function resolveGroupKey(tableName: string, groups: SchemaGroup[]): string {
  const owners = groups.filter((g) => g.tables.includes(tableName));
  if (owners.length === 0) throw new Error(`table "${tableName}" is in no group`);
  if (owners.length > 1) {
    throw new Error(`table "${tableName}" is in multiple groups: ${owners.map((g) => g.key).join(', ')}`);
  }
  return owners[0]!.key;
}

export function describeSchema(): SchemaGraph {
  const metas: TableMeta[] = allTables.map((table) => {
    const cfg = getTableConfig(table);
    const name = cfg.name;

    // composite PK columns (inline `.primaryKey()` marks the column instead)
    const compositePk = cfg.primaryKeys.flatMap((pk) => pk.columns.map((c) => c.name));
    const pkNames = new Set<string>([
      ...cfg.columns.filter((c) => c.primary).map((c) => c.name),
      ...compositePk,
    ]);

    // local column name -> { table, column } from foreign keys (all single-column here)
    const fkByColumn = new Map<string, { table: string; column: string }>();
    for (const fk of cfg.foreignKeys) {
      const ref = fk.reference();
      const local = ref.columns[0]!.name;
      fkByColumn.set(local, {
        table: getTableName(ref.foreignTable),
        column: ref.foreignColumns[0]!.name,
      });
    }

    const columns: ColumnMeta[] = cfg.columns.map((c) => ({
      name: c.name,
      type: normalizeType(c.getSQLType()),
      notNull: c.notNull,
      pk: pkNames.has(c.name),
      fk: fkByColumn.get(c.name) ?? null,
    }));

    return {
      name,
      group: resolveGroupKey(name, SCHEMA_GROUPS),
      columns,
      primaryKey: [...pkNames],
      uniques: cfg.uniqueConstraints.map((u) => ({
        name: u.name,
        columns: u.columns.map((c) => c.name),
      })),
    };
  });

  // order tables by group declaration for deterministic output
  const order = new Map<string, number>();
  SCHEMA_GROUPS.forEach((g, gi) =>
    g.tables.forEach((t, ti) => order.set(t, gi * 1000 + ti)),
  );
  metas.sort((a, b) => (order.get(a.name) ?? 0) - (order.get(b.name) ?? 0));

  const groups: GroupMeta[] = SCHEMA_GROUPS.map((g) => ({
    key: g.key,
    label: g.label,
    color: g.color,
    tables: [...g.tables],
  }));

  return { tables: metas, groups };
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm --filter @tickets/db test describe-schema`
Expected: PASS (9 tests).

- [ ] **Step 7: Re-export from `index.ts`**

Add to `packages/db/src/schema/index.ts`:

```ts
export { allTables } from './registry';
export { SCHEMA_GROUPS, type SchemaGroup } from './schema-groups';
export {
  describeSchema,
  resolveGroupKey,
  type SchemaGraph,
  type TableMeta,
  type ColumnMeta,
  type UniqueMeta,
  type GroupMeta,
} from './describe-schema';
```

- [ ] **Step 8: Typecheck + commit**

Run: `pnpm --filter @tickets/db typecheck && pnpm --filter @tickets/db test`
Expected: typecheck clean; all tests pass.

```bash
git add packages/db/src/schema/registry.ts packages/db/src/schema/schema-groups.ts packages/db/src/schema/describe-schema.ts packages/db/src/schema/describe-schema.test.ts packages/db/src/schema/index.ts
git commit -m "feat(db): describeSchema() + SCHEMA_GROUPS derived from drizzle metadata"
```

---

### Task 2: API route `GET /api/schema`

**Files:**
- Create: `apps/api/src/routes/schema.routes.ts`
- Test: `apps/api/src/routes/schema.routes.test.ts`
- Modify: `apps/api/src/app.ts`

**Interfaces:**
- Consumes: `describeSchema(): SchemaGraph` from `@tickets/db`.
- Produces: `registerSchemaRoutes(app: FastifyInstance, context: { db: Db }): void`; endpoint `GET /api/schema` → `200` with `SchemaGraph` JSON.

- [ ] **Step 1: Write the failing test**

Match the existing route-test pattern (check an existing `*.routes.test.ts` for the `buildApp`/`inject` helper; this uses Fastify's `app.inject`).

```ts
// apps/api/src/routes/schema.routes.test.ts
import { describe, expect, it } from 'vitest';
import { buildApp } from '../app';
import { createDbClient } from '@tickets/db';

describe('GET /api/schema', () => {
  it('returns the schema graph', async () => {
    const { db } = createDbClient({ max: 1 });
    const app = buildApp({ db });
    const res = await app.inject({ method: 'GET', url: '/api/schema' });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { tables: unknown[]; groups: unknown[] };
    expect(Array.isArray(body.tables)).toBe(true);
    expect(body.tables.length).toBeGreaterThan(0);
    const tickets = (body.tables as { name: string; group: string }[]).find(
      (t) => t.name === 'tickets',
    );
    expect(tickets?.group).toBe('records');
    await app.close();
  });
});
```

Note: `describeSchema()` does not touch the DB, so no live postgres is needed even though a client is constructed. If the existing route tests use a shared harness/helper instead of `createDbClient`, follow that harness.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @tickets/api test schema.routes`
Expected: FAIL — route returns 404 (not registered).

- [ ] **Step 3: Write the route**

```ts
// apps/api/src/routes/schema.routes.ts
import type { FastifyInstance } from 'fastify';
import type { Db } from '@tickets/db';
import { describeSchema } from '@tickets/db';

// context kept for signature consistency with the other route modules; the
// schema graph is derived from the drizzle table objects, not the database.
export function registerSchemaRoutes(app: FastifyInstance, _context: { db: Db }) {
  app.get('/api/schema', async () => describeSchema());
}
```

- [ ] **Step 4: Register in `app.ts`**

Add the import and call alongside the others in `apps/api/src/app.ts`:

```ts
import { registerSchemaRoutes } from './routes/schema.routes';
// ...inside buildApp, with the other register* calls:
registerSchemaRoutes(app, context);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @tickets/api test schema.routes`
Expected: PASS.

- [ ] **Step 6: Typecheck + commit**

Run: `pnpm --filter @tickets/api typecheck`
Expected: clean.

```bash
git add apps/api/src/routes/schema.routes.ts apps/api/src/routes/schema.routes.test.ts apps/api/src/app.ts
git commit -m "feat(api): GET /api/schema serves the drizzle-derived schema graph"
```

---

### Task 3: Web ERD engine + styles

**Files:**
- Create: `apps/web/src/components/schema/erd-types.ts`
- Create: `apps/web/src/components/schema/erd-engine.ts`
- Create: `apps/web/src/components/schema/erd.css`
- Test: `apps/web/src/components/schema/erd-engine.test.ts`

**Interfaces:**
- Consumes: the `GET /api/schema` payload, typed locally as `SchemaGraph` (mirror of `@tickets/db`'s type).
- Produces: `renderErd(container: HTMLElement, graph: SchemaGraph): () => void` — builds the diagram DOM/SVG into `container` and returns a cleanup function. Layout is one column per group (declared order); edges route orthogonally from measured card positions with per-gutter vertical lanes and a shared bottom channel; hovering a table or FK row traces its relations.

- [ ] **Step 1: Write the payload types**

```ts
// apps/web/src/components/schema/erd-types.ts
// Mirror of @tickets/db's SchemaGraph (the GET /api/schema payload). Kept local
// so the web bundle takes no runtime dependency on the db package.
export type ColumnMeta = {
  name: string;
  type: string;
  notNull: boolean;
  pk: boolean;
  fk: { table: string; column: string } | null;
};
export type UniqueMeta = { name: string; columns: string[] };
export type TableMeta = {
  name: string;
  group: string;
  columns: ColumnMeta[];
  primaryKey: string[];
  uniques: UniqueMeta[];
};
export type GroupMeta = { key: string; label: string; color: string; tables: string[] };
export type SchemaGraph = { tables: TableMeta[]; groups: GroupMeta[] };
```

- [ ] **Step 2: Write the failing DOM-structure test**

jsdom returns zeroed geometry, so this asserts DOM structure only (cards, group boxes, badges, FK rows) — not pixel routing (covered by manual verification in Task 4).

```ts
// apps/web/src/components/schema/erd-engine.test.ts
import { describe, expect, it, beforeEach } from 'vitest';
import { renderErd } from './erd-engine';
import type { SchemaGraph } from './erd-types';

const graph: SchemaGraph = {
  groups: [
    { key: 'records', label: 'Ticket data', color: 'orange', tables: ['comments', 'comment_reactions'] },
  ],
  tables: [
    {
      name: 'comments',
      group: 'records',
      primaryKey: ['id'],
      uniques: [],
      columns: [
        { name: 'id', type: 'serial', notNull: true, pk: true, fk: null },
        { name: 'parent_id', type: 'integer', notNull: false, pk: false, fk: { table: 'comments', column: 'id' } },
      ],
    },
    {
      name: 'comment_reactions',
      group: 'records',
      primaryKey: ['id'],
      uniques: [{ name: 'comment_reactions_comment_user_emoji', columns: ['comment_id', 'user_id', 'emoji'] }],
      columns: [
        { name: 'id', type: 'serial', notNull: true, pk: true, fk: null },
        { name: 'comment_id', type: 'integer', notNull: true, pk: false, fk: { table: 'comments', column: 'id' } },
      ],
    },
  ],
};

describe('renderErd', () => {
  let container: HTMLElement;
  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('renders one card per table', () => {
    renderErd(container, graph);
    expect(container.querySelectorAll('.erd-card')).toHaveLength(2);
  });

  it('renders a group box with its label', () => {
    renderErd(container, graph);
    const label = container.querySelector('.erd-g-label');
    expect(label?.textContent).toBe('Ticket data');
  });

  it('marks FK rows and nullability', () => {
    renderErd(container, graph);
    const row = container.querySelector('[data-row="comments.parent_id"]');
    expect(row?.classList.contains('erd-fk')).toBe(true);
    expect(row?.classList.contains('erd-nul')).toBe(true);
  });

  it('cleanup empties the container', () => {
    const cleanup = renderErd(container, graph);
    cleanup();
    expect(container.querySelectorAll('.erd-card')).toHaveLength(0);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @tickets/web test erd-engine`
Expected: FAIL — `renderErd` not found.

- [ ] **Step 4: Write `erd-engine.ts`**

```ts
// apps/web/src/components/schema/erd-engine.ts
import type { SchemaGraph, TableMeta, GroupMeta } from './erd-types';

type Edge = { src: string; tgt: string; rowKey: string; nul: boolean; el?: SVGGElement };
const NS = 'http://www.w3.org/2000/svg';

const el = (tag: string, cls?: string) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  return n;
};
const txt = (cls: string, s: string) => {
  const n = el('span', cls);
  n.textContent = s;
  return n;
};

export function renderErd(container: HTMLElement, graph: SchemaGraph): () => void {
  container.innerHTML = '';
  container.classList.add('erd');
  const groupsLayer = el('div', 'erd-groups');
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'erd-wires');
  const cols = el('div', 'erd-cols');
  container.append(groupsLayer, svg, cols);

  const tableByName = new Map(graph.tables.map((t) => [t.name, t]));
  const groupByKey = new Map(graph.groups.map((g) => [g.key, g]));
  const cardEl = new Map<string, HTMLElement>();
  const rowEl = new Map<string, HTMLElement>();
  const boxEl = new Map<string, HTMLElement>();
  const colOf = new Map<string, number>();
  const edges: Edge[] = [];

  graph.groups.forEach((group, ci) => {
    const col = el('div', 'erd-col');
    cols.append(col);
    for (const name of group.tables) {
      const t = tableByName.get(name);
      if (!t) continue;
      colOf.set(name, ci);
      const card = buildCard(t, group);
      cardEl.set(name, card);
      col.append(card);
      for (const c of t.columns) {
        const rk = `${name}.${c.name}`;
        const r = card.querySelector<HTMLElement>(`[data-row="${cssEscape(rk)}"]`);
        if (r) rowEl.set(rk, r);
        if (c.fk && tableByName.has(c.fk.table)) {
          edges.push({ src: name, tgt: c.fk.table, rowKey: rk, nul: !c.notNull });
        }
      }
    }
    const box = el('div', 'erd-group-box');
    box.style.setProperty('--gc', `var(--ins-opt-${group.color})`);
    box.style.setProperty('--gc-s', `var(--ins-opt-${group.color}-subtle)`);
    const head = el('div', 'erd-group-head');
    head.append(txt('erd-g-label', group.label));
    box.append(head);
    boxEl.set(group.key, box);
    groupsLayer.append(box);
  });

  function rel(r: DOMRect, base: DOMRect) {
    return {
      left: r.left - base.left, right: r.right - base.left,
      top: r.top - base.top, bottom: r.bottom - base.top,
      cy: (r.top + r.bottom) / 2 - base.top,
    };
  }

  function roundedPath(pts: { x: number; y: number }[], rad = 9): string {
    const p = pts.filter((pt, i) => i === 0 ||
      Math.abs(pt.x - pts[i - 1]!.x) > 0.5 || Math.abs(pt.y - pts[i - 1]!.y) > 0.5);
    if (p.length < 2) return '';
    let d = `M ${p[0]!.x} ${p[0]!.y}`;
    for (let i = 1; i < p.length - 1; i++) {
      const a = p[i - 1]!, b = p[i]!, c = p[i + 1]!;
      const r = Math.min(rad, Math.hypot(b.x - a.x, b.y - a.y) / 2, Math.hypot(c.x - b.x, c.y - b.y) / 2);
      d += ` L ${b.x - Math.sign(b.x - a.x) * r} ${b.y - Math.sign(b.y - a.y) * r}` +
           ` Q ${b.x} ${b.y} ${b.x + Math.sign(c.x - b.x) * r} ${b.y + Math.sign(c.y - b.y) * r}`;
    }
    d += ` L ${p[p.length - 1]!.x} ${p[p.length - 1]!.y}`;
    return d;
  }

  function draw() {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    svg.setAttribute('width', String(container.scrollWidth));
    svg.setAttribute('height', String(container.scrollHeight));
    const base = container.getBoundingClientRect();

    // group boxes hug their columns
    const PAD = 14, HEAD = 34;
    const colNodes = [...cols.children] as HTMLElement[];
    const colRects = colNodes.map((c) => rel(c.getBoundingClientRect(), base));
    graph.groups.forEach((g, ci) => {
      const box = boxEl.get(g.key)!;
      const r = colRects[ci]!;
      box.style.left = `${r.left - PAD}px`;
      box.style.top = `${r.top - HEAD}px`;
      box.style.width = `${r.right - r.left + PAD * 2}px`;
      box.style.height = `${r.bottom - r.top + HEAD + PAD}px`;
    });

    // vertical gutters between columns (+ outer edges); one bottom channel
    const gutter: number[] = [colRects[0]!.left - 30];
    for (let i = 1; i < colRects.length; i++) {
      gutter.push((colRects[i - 1]!.right + colRects[i]!.left) / 2);
    }
    gutter.push(colRects[colRects.length - 1]!.right + 30);
    const bottomY = Math.max(...colRects.map((r) => r.bottom)) + 44;

    // plan each edge; lane-pack verticals per gutter and the bottom channel
    type Plan = { e: Edge; sx: number; sy: number; tx: number; ty: number;
      sSide: 1 | -1; tSide: 1 | -1; sg: number; tg: number };
    const plans: Plan[] = [];
    for (const e of edges) {
      const s = colOf.get(e.src)!, t = colOf.get(e.tgt)!;
      const sc = rel(cardEl.get(e.src)!.getBoundingClientRect(), base);
      const tc = rel(cardEl.get(e.tgt)!.getBoundingClientRect(), base);
      const srow = rel(rowEl.get(e.rowKey)!.getBoundingClientRect(), base);
      const trow = rel(rowEl.get(`${e.tgt}.id`)!.getBoundingClientRect(), base);
      // exit toward the gutter nearest the target (or right for self/adjacent)
      const sSide: 1 | -1 = t >= s ? 1 : -1;
      const tSide: 1 | -1 = t > s ? -1 : t < s ? 1 : 1;
      plans.push({
        e,
        sx: sSide === 1 ? sc.right : sc.left, sy: srow.cy,
        tx: tSide === 1 ? tc.right : tc.left, ty: trow.cy,
        sSide, tSide,
        sg: s + (sSide === 1 ? 1 : 0),
        tg: t + (tSide === 1 ? 1 : 0),
      });
    }
    const laneOffset = (key: number, list: Plan[], p: Plan, gap: number) => {
      const idx = list.indexOf(p);
      return (idx - (list.length - 1) / 2) * gap;
    };
    const perGutter = new Map<number, Plan[]>();
    plans.forEach((p) => {
      for (const g of new Set([p.sg, p.tg])) {
        if (!perGutter.has(g)) perGutter.set(g, []);
        perGutter.get(g)!.push(p);
      }
    });
    const bottomUsers = plans.filter((p) => p.sg !== p.tg);

    for (const p of plans) {
      const sGX = gutter[p.sg]! + laneOffset(p.sg, perGutter.get(p.sg)!, p, 7);
      const pts: { x: number; y: number }[] = [{ x: p.sx, y: p.sy }, { x: sGX, y: p.sy }];
      if (p.sg !== p.tg) {
        const by = bottomY + laneOffset(-1, bottomUsers, p, 6);
        const tGX = gutter[p.tg]! + laneOffset(p.tg, perGutter.get(p.tg)!, p, 7);
        pts.push({ x: sGX, y: by }, { x: tGX, y: by }, { x: tGX, y: p.ty });
      } else {
        pts.push({ x: sGX, y: p.ty });
      }
      pts.push({ x: p.tx, y: p.ty });

      const g = document.createElementNS(NS, 'g');
      g.setAttribute('class', 'erd-edge');
      g.setAttribute('fill', 'none');
      g.setAttribute('stroke', `var(--ins-opt-${groupByKey.get(tableByName.get(p.e.tgt)!.group)!.color})`);
      g.setAttribute('stroke-width', '1.5');
      const path = document.createElementNS(NS, 'path');
      path.setAttribute('d', roundedPath(pts));
      g.appendChild(path);
      const sd = Math.sign(pts[1]!.x - pts[0]!.x) || 1;
      const foot = document.createElementNS(NS, 'path');
      foot.setAttribute('d', `M ${p.sx + sd * 10} ${p.sy} L ${p.sx} ${p.sy - 5} M ${p.sx + sd * 10} ${p.sy} L ${p.sx} ${p.sy + 5}`);
      g.appendChild(foot);
      if (p.e.nul) {
        const circ = document.createElementNS(NS, 'circle');
        circ.setAttribute('cx', String(p.sx + sd * 16));
        circ.setAttribute('cy', String(p.sy));
        circ.setAttribute('r', '3.2');
        circ.setAttribute('fill', 'var(--color-app)');
        g.appendChild(circ);
      }
      const td = Math.sign(pts[pts.length - 2]!.x - p.tx) || 1;
      const bar = document.createElementNS(NS, 'path');
      bar.setAttribute('d', `M ${p.tx + td * 8} ${p.ty - 5} L ${p.tx + td * 8} ${p.ty + 5}`);
      g.appendChild(bar);
      svg.appendChild(g);
      p.e.el = g;
    }
  }

  // hover-to-trace
  function focusEdges(lit: Edge[], selfTable?: string) {
    container.classList.add('erd-focusing');
    const litTables = new Set<string>(selfTable ? [selfTable] : []);
    for (const e of edges) {
      const on = lit.includes(e);
      e.el?.classList.toggle('erd-lit', on);
      if (on) { litTables.add(e.src); litTables.add(e.tgt); }
    }
    for (const e of lit) rowEl.get(e.rowKey)?.classList.add('erd-hot');
    for (const [n, c] of cardEl) c.classList.toggle('erd-lit', litTables.has(n));
  }
  function blur() {
    container.classList.remove('erd-focusing');
    for (const e of edges) e.el?.classList.remove('erd-lit');
    for (const c of cardEl.values()) c.classList.remove('erd-lit');
    for (const r of rowEl.values()) r.classList.remove('erd-hot');
  }
  const onOver = (ev: Event) => {
    const target = ev.target as HTMLElement;
    const row = target.closest<HTMLElement>('[data-row]');
    const card = target.closest<HTMLElement>('[data-table]');
    if (row) {
      const key = row.dataset.row!;
      const [tbl, col] = key.split('.');
      const hit = col === 'id'
        ? edges.filter((e) => e.tgt === tbl)
        : edges.filter((e) => e.rowKey === key);
      if (hit.length) { focusEdges(hit, tbl); return; }
    }
    if (card) focusEdges(edges.filter((e) => e.src === card.dataset.table || e.tgt === card.dataset.table), card.dataset.table);
    else blur();
  };
  container.addEventListener('mouseover', onOver);
  container.addEventListener('mouseleave', blur);

  draw();
  document.fonts?.ready.then(draw).catch(() => {});
  // ResizeObserver is absent in jsdom (unit test env) — guard so tests don't throw.
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => draw()) : null;
  ro?.observe(container);

  return () => {
    ro?.disconnect();
    container.removeEventListener('mouseover', onOver);
    container.removeEventListener('mouseleave', blur);
    container.classList.remove('erd', 'erd-focusing');
    container.innerHTML = '';
  };
}

function buildCard(t: TableMeta, group: GroupMeta): HTMLElement {
  const card = el('article', 'erd-card');
  card.dataset.table = t.name;
  card.style.setProperty('--cc', `var(--ins-opt-${group.color})`);
  card.style.setProperty('--cc-s', `var(--ins-opt-${group.color}-subtle)`);
  const head = el('header', 'erd-card-head');
  head.append(txt('erd-card-title', t.name));
  card.append(head);
  const rows = el('div', 'erd-rows');
  for (const c of t.columns) {
    const cls = ['erd-row'];
    if (!c.notNull) cls.push('erd-nul');
    if (c.fk) cls.push('erd-fk');
    const row = el('div', cls.join(' '));
    row.dataset.row = `${t.name}.${c.name}`;
    const badges = el('span', 'erd-badges');
    if (c.pk) badges.append(txt('erd-badge erd-pk', 'PK'));
    if (c.fk) badges.append(txt('erd-badge erd-fk-badge', 'FK'));
    row.append(badges, txt('erd-name', c.name));
    row.append(txt('erd-type', c.fk ? `→ ${c.fk.table}${c.notNull ? '' : '?'}` : c.type + (c.notNull ? '' : '?')));
    if (c.fk) row.title = `${t.name}.${c.name} → ${c.fk.table}.${c.fk.column}${c.notNull ? '' : ' (nullable)'}`;
    rows.append(row);
  }
  card.append(rows);
  if (t.uniques.length) {
    const notes = el('footer', 'erd-notes');
    for (const u of t.uniques) notes.append(txt('erd-note', `UQ (${u.columns.join(', ')})`));
    card.append(notes);
  }
  return card;
}

// CSS.escape for attribute selectors (dots in table.column keys)
function cssEscape(s: string): string {
  return typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(s) : s.replace(/[^\w-]/g, '\\$&');
}
```

- [ ] **Step 5: Write `erd.css`**

```css
/* apps/web/src/components/schema/erd.css — scoped under .erd (preflight is OFF) */
.erd { position: relative; min-width: max-content; padding: 24px 40px 96px; font-size: 14px; }
.erd-groups, .erd-wires { position: absolute; inset: 0; z-index: 0; pointer-events: none; }
.erd-group-box {
  position: absolute;
  border: 1px solid color-mix(in srgb, var(--gc) 22%, var(--color-hairline));
  border-radius: 12px;
  background: color-mix(in srgb, var(--gc-s) 40%, transparent);
  transition: opacity 130ms ease;
}
.erd-focusing .erd-group-box { opacity: 0.55; }
.erd-group-head { padding: 8px 14px; }
.erd-g-label {
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 10.5px; font-weight: 600; letter-spacing: 0.09em;
  text-transform: uppercase; color: var(--gc); white-space: nowrap;
}
.erd-cols { position: relative; z-index: 1; display: flex; align-items: flex-start; gap: 96px; }
.erd-col { display: flex; flex-direction: column; gap: 28px; width: 284px; flex: none; }
.erd-card {
  background: var(--color-raised);
  border: 1px solid var(--color-hairline);
  border-radius: 8px;
  box-shadow: var(--ins-shadow-sm);
  overflow: hidden;
  transition: opacity 130ms ease, box-shadow 130ms ease;
}
.erd-focusing .erd-card { opacity: 0.45; }
.erd-focusing .erd-card.erd-lit { opacity: 1; box-shadow: var(--ins-shadow-sm), 0 0 0 1.5px var(--cc); }
.erd-card-head { padding: 8px 12px 7px; background: var(--cc-s); border-bottom: 1px solid var(--color-hairline); }
.erd-card-title { font-family: var(--font-mono, ui-monospace, monospace); font-size: 13px; font-weight: 600; color: var(--color-ink); }
.erd-rows { padding: 5px 0; }
.erd-row {
  display: grid; grid-template-columns: 34px 1fr auto; align-items: center; gap: 6px;
  padding: 2.5px 12px 2.5px 8px; font-family: var(--font-mono, ui-monospace, monospace); font-size: 12px;
}
.erd-row.erd-hot { background: var(--color-inset); }
.erd-badges { display: flex; gap: 2px; }
.erd-badge { font-size: 8.5px; font-weight: 600; letter-spacing: 0.04em; padding: 0 3px; border-radius: 3px; line-height: 14px; }
.erd-pk { background: var(--color-inset); color: var(--color-ink-2); border: 1px solid var(--color-control); }
.erd-fk-badge { color: var(--cc); border: 1px solid color-mix(in srgb, var(--cc) 45%, transparent); }
.erd-name { color: var(--color-ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.erd-row.erd-nul .erd-name { color: var(--color-ink-2); }
.erd-type { font-size: 10.5px; color: var(--color-ink-3); white-space: nowrap; }
.erd-notes { border-top: 1px solid var(--color-hairline); padding: 5px 12px 6px; display: flex; flex-direction: column; gap: 1px; }
.erd-note { font-family: var(--font-mono, ui-monospace, monospace); font-size: 10px; color: var(--color-ink-3); white-space: nowrap; }
.erd-edge { transition: opacity 130ms ease; }
.erd-focusing .erd-edge { opacity: 0.1; }
.erd-focusing .erd-edge.erd-lit { opacity: 1; }
@media (prefers-reduced-motion: reduce) { .erd * { transition: none !important; } }
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm --filter @tickets/web test erd-engine`
Expected: PASS (4 tests).

- [ ] **Step 7: Typecheck + commit**

Run: `pnpm --filter @tickets/web typecheck`
Expected: clean.

```bash
git add apps/web/src/components/schema/erd-types.ts apps/web/src/components/schema/erd-engine.ts apps/web/src/components/schema/erd.css apps/web/src/components/schema/erd-engine.test.ts
git commit -m "feat(web): ERD diagram engine (renderErd) + scoped instrument styles"
```

---

### Task 4: `/schema` route + wiring + manual verification

**Files:**
- Create: `apps/web/src/routes/schema-route.tsx`
- Modify: `apps/web/src/router.ts`

**Interfaces:**
- Consumes: `renderErd`, `SchemaGraph` (Task 3); the `GET /api/schema` endpoint (Task 2). Reuse the app's existing fetch/query helper — inspect a sibling route (e.g. `all-tickets-route.tsx` or the `api/` folder) for the base-URL + `useQuery` pattern and follow it rather than hand-writing `fetch`.

- [ ] **Step 1: Write the route**

Adjust the import of the query/fetch helper to match the app's convention (see the Interfaces "Consumes" note above — inspect `apps/web/src/api/` and a sibling route first).

```tsx
// apps/web/src/routes/schema-route.tsx
import { createRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { renderErd } from '../components/schema/erd-engine';
import type { SchemaGraph } from '../components/schema/erd-types';
import '../components/schema/erd.css';
import { rootRoute } from './root-route';

function SchemaPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { data, isLoading, error } = useQuery<SchemaGraph>({
    queryKey: ['schema'],
    queryFn: async () => {
      const res = await fetch('/api/schema');
      if (!res.ok) throw new Error(`schema fetch failed: ${res.status}`);
      return res.json();
    },
  });

  useEffect(() => {
    if (!data || !containerRef.current) return;
    const cleanup = renderErd(containerRef.current, data);
    return cleanup;
  }, [data]);

  return (
    <div style={{ height: '100vh', overflow: 'auto', background: 'var(--color-app)', color: 'var(--color-ink)' }}>
      {isLoading && <p style={{ padding: 24 }}>Loading schema…</p>}
      {error && <p style={{ padding: 24, color: 'var(--color-danger)' }}>Failed to load schema.</p>}
      <div ref={containerRef} />
    </div>
  );
}

export const schemaRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/schema',
  component: SchemaPage,
});
```

- [ ] **Step 2: Register in `router.ts`**

Add the import and include `schemaRoute` in the `rootRoute.addChildren([...])` array (alongside `galleryRoute`):

```ts
import { schemaRoute } from './routes/schema-route';
// ...
const routeTree = rootRoute.addChildren([
  // ...existing routes...
  galleryRoute,
  schemaRoute,
  // ...
]);
```

- [ ] **Step 3: Typecheck + build**

Run: `pnpm --filter @tickets/web typecheck && pnpm --filter @tickets/web build`
Expected: both clean.

- [ ] **Step 4: Manual verification in the running app**

The docker stack is up (api on 4600, web on 4610). The `/api/schema` endpoint needs the rebuilt api image from Task 2 — rebuild if not already done:

Run: `docker compose up -d --build api web`

Then drive a browser to `http://localhost:4610/schema` (or the dev server per running-the-stack). Verify with an in-page geometry check that **no edge path crosses a table card** — run this in the page console (or via the chrome-devtools MCP `evaluate_script`):

```js
(() => {
  const base = document.querySelector('.erd').getBoundingClientRect();
  const cards = [...document.querySelectorAll('.erd-card')].map((c) => {
    const r = c.getBoundingClientRect();
    return { left: r.left - base.left, right: r.right - base.left, top: r.top - base.top, bottom: r.bottom - base.top };
  });
  const bad = [];
  document.querySelectorAll('.erd-edge path').forEach((path, i) => {
    const len = path.getTotalLength();
    for (let d = 6; d < len - 6; d += 4) {
      const p = path.getPointAtLength(d);
      for (const c of cards) if (p.x > c.left + 2 && p.x < c.right - 2 && p.y > c.top + 2 && p.y < c.bottom - 2) { bad.push(i); break; }
    }
  });
  return { edges: document.querySelectorAll('.erd-edge').length, crossings: [...new Set(bad)] };
})();
```

Expected: `crossings: []`. Also confirm visually: four group boxes (Schemes / Type-owned config / Workspace / Ticket data), crow's-foot FK edges, hover-tracing dims non-related tables, and the page follows the app's light/dark theme. If crossings are non-empty, widen `.erd-cols` gap or bump the bottom-channel lane gap in `draw()` and recheck (do not merge with crossings).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/routes/schema-route.tsx apps/web/src/router.ts
git commit -m "feat(web): /schema live ERD page mounting renderErd over GET /api/schema"
```

---

## Notes for the implementer

- **Verify drizzle's introspection API names** while doing Task 1: `getTableConfig()` returns `{ name, columns, foreignKeys, primaryKeys, uniqueConstraints }`; a column exposes `.name`, `.notNull`, `.primary`, `.getSQLType()`; a foreign key's `.reference()` returns `{ columns, foreignTable, foreignColumns }`. If a name differs in the installed `drizzle-orm@0.45.2`, adapt and keep the test assertions as the contract.
- **Route-test harness:** Task 2's test sketch constructs a client directly; if the API package has a shared test harness (look for a `test/` helper or existing `*.routes.test.ts`), use it instead.
- **Web query/fetch helper:** Task 4 hand-writes `fetch('/api/schema')`; if the app centralizes its API base URL / fetch wrapper (check `apps/web/src/api/`), route the call through it.
```
