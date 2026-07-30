# Live Schema Introspection Implementation Plan (Phase 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/schema` show the schema actually deployed in a **selectable** database, read from `pg_catalog`, instead of the schema the drizzle code declares.

**Architecture:** A new introspector in `packages/db` reads `pg_catalog` and returns the *same* `SchemaGraph` shape `describeSchema()` already returns, so the existing renderer consumes it unchanged. `GET /api/schema` keeps its path and payload and only changes source; a sibling route lists selectable databases. Web gains a `schema` rail mode whose panel holds the database dropdown, with selection carried in the `?database=` search param.

**Tech Stack:** TypeScript, `postgres` (postgres.js) tagged templates, Fastify (`app.inject` for route tests), vitest (node env), React 19, TanStack Router + Query, `@tickets/ui`.

Spec: [`docs/superpowers/specs/2026-07-30-schema-browser-design.md`](../specs/2026-07-30-schema-browser-design.md)

## Global Constraints

- **Phase 2 is a separate plan.** This plan does not move `apps/eer`, does not retheme anything, and does not delete the legacy renderer. The renderer stays exactly as it is.
- **`describeSchema()` must keep working, unchanged.** It is the SSOT check in `packages/db/src/schema/model-conformance.test.ts`. Only the *route* stops calling it.
- **The `SchemaGraph` payload shape must not change.** Both paths return `{ tables, groups, enums }`. Same field names, same `qualifiedName` convention for `GroupMeta.tables`.
- **`GroupMeta.color` is an Instrument option hue NAME**, never a hex — `'blue'`, `'indigo'`, `'orange'`, `'teal'`, `'green'`, `'cyan'`, `'purple'`, `'red'`, `'yellow'`, `'pink'`. The renderer interpolates it into `var(--ins-opt-${color})`. Emitting a hex or an unknown name produces an invalid CSS variable.
- **Connection safety, non-negotiable:** host, port, user and password always come from `environment.postgres`. Only the database *name* varies, and it must be validated against the live `pg_database` enumeration before it reaches a connection URL. An unknown name is a `400`, never a connection attempt.
- **The introspector issues reads only** — catalog `SELECT`s. No DDL, no DML.
- **`packages/db` tests run against `tickets_test`** (forced by `src/test/setup-env.ts`) with `fileParallelism: false`. Node environment.
- Conventional commits scoped by app: `feat(db):`, `feat(api):`, `feat(web):`.

## Known pre-existing breakage (do not chase)

`--ins-opt-*` is referenced by `apps/web/src/components/schema/erd-engine.ts` (lines 67, 68, 183, 266, 267) and **defined nowhere in the repo**. The legacy ERD's group boxes, cards and edge strokes therefore have no colour today. This is pre-existing, unrelated to this plan, and is resolved in Phase 2 when that renderer is deleted. **Verify Phase 1 on structure — table names, columns, PK/FK badges, grouping, edges, the dropdown — not on colour.**

## File Structure

**Created in `packages/db/src/schema/introspect/`** — one reader per catalog concern, each independently testable:

| File | Responsibility |
|---|---|
| `connect.ts` | Open/close a validated, short-lived connection to a named database |
| `read-tables.ts` | `pg_class`/`pg_namespace` + `pg_attribute` → tables with columns |
| `read-constraints.ts` | `pg_constraint` → pk / unique / fk / check per table |
| `read-indexes.ts` | `pg_index` → non-primary indexes with method and partial predicate |
| `read-enums.ts` | `pg_type`/`pg_enum` → enum declarations |
| `group-tables.ts` | Curated `SCHEMA_GROUPS` membership with per-namespace fallback |
| `introspect-database.ts` | Orchestrates the readers into a `SchemaGraph` |

**Also created:** `packages/db/src/schema/list-databases.ts`, `apps/web/src/components/shell/schema-panel.tsx`, `apps/web/src/api/use-schema.ts`.

**Modified:** `packages/db/src/schema/describe-schema.ts` (extract `findGroupKey`), `packages/db/src/schema/index.ts`, `apps/api/src/routes/schema.routes.ts`, `apps/web/src/routes/schema-route.tsx`, `apps/web/src/components/shell/{mode-for-path.ts,activity-rail.tsx,mode-panel.tsx}`.

---

### Task 1: Non-throwing group resolution

`resolveGroupKey` throws when a table belongs to no group — correct for the code-derived path, fatal when introspecting a database whose tables the config never declared. Extract the lookup so both callers share one source of truth.

**Files:**
- Modify: `packages/db/src/schema/describe-schema.ts` (the `resolveGroupKey` block, ~line 88-113)
- Test: `packages/db/src/schema/describe-schema.test.ts`

**Interfaces:**
- Produces: `findGroupKey(tableName: string, groups: SchemaGroup[], schema?: string | null): string | null` — returns `null` where `resolveGroupKey` would throw "in no group". It still **throws** on genuine ambiguity (a table or schema claimed by two groups), because that is a config bug in every context.
- Produces: `resolveGroupKey` keeps its exact existing signature and throwing behaviour.

- [ ] **Step 1: Write the failing tests**

Append to `packages/db/src/schema/describe-schema.test.ts`:

```ts
import { findGroupKey, resolveGroupKey } from './describe-schema';
import type { SchemaGroup } from './schema-groups';

describe('findGroupKey', () => {
  const groups: SchemaGroup[] = [
    { key: 'ws', label: 'Workspace', color: 'blue', tables: ['users'] },
    { key: 'core', label: 'Workdirs', color: 'green', tables: [], schemas: ['core'] },
  ];

  it('resolves a hand-listed table regardless of its schema', () => {
    expect(findGroupKey('users', groups, 'core')).toBe('ws');
  });

  it('falls back to schema ownership when no table is listed', () => {
    expect(findGroupKey('workdirs', groups, 'core')).toBe('core');
  });

  it('returns null instead of throwing for an unknown table', () => {
    expect(findGroupKey('audit_log', groups, null)).toBeNull();
  });

  it('returns null instead of throwing for an unowned schema', () => {
    expect(findGroupKey('jobs', groups, 'scheduler')).toBeNull();
  });

  it('still throws when a table is claimed by two groups', () => {
    const dupe: SchemaGroup[] = [
      { key: 'a', label: 'A', color: 'blue', tables: ['items'] },
      { key: 'b', label: 'B', color: 'red', tables: ['items'] },
    ];
    expect(() => findGroupKey('items', dupe, null)).toThrow(/multiple groups/);
  });

  it('resolveGroupKey still throws for an unknown table', () => {
    expect(() => resolveGroupKey('audit_log', groups, null)).toThrow(/in no group/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @tickets/db test -- describe-schema`
Expected: FAIL — `findGroupKey is not a function` / no export named `findGroupKey`.

- [ ] **Step 3: Extract the lookup**

In `packages/db/src/schema/describe-schema.ts`, replace the body of `resolveGroupKey` with a delegating pair. Keep the existing explanatory comment above `findGroupKey`, since it documents the lookup rules themselves:

```ts
/**
 * Group membership lookup, or null when the table belongs to no configured
 * group. Genuine ambiguity (one table or schema claimed by two groups) still
 * throws — that is a config bug regardless of caller.
 *
 * Live introspection needs the null: a database the config never described
 * (or a table added to the database but not the code) has no curated group,
 * and that is expected rather than fatal. See introspect/group-tables.ts.
 */
export function findGroupKey(
  tableName: string,
  groups: SchemaGroup[],
  schema: string | null = null,
): string | null {
  const byTable = groups.filter((g) => g.tables.includes(tableName));
  if (byTable.length > 1) {
    throw new Error(`table "${tableName}" is in multiple groups: ${byTable.map((g) => g.key).join(', ')}`);
  }
  if (byTable.length === 1) return byTable[0]!.key;
  if (schema !== null) {
    const owners = groups.filter((g) => g.schemas?.includes(schema));
    if (owners.length > 1) {
      throw new Error(`schema "${schema}" is in multiple groups: ${owners.map((g) => g.key).join(', ')}`);
    }
    return owners[0]?.key ?? null;
  }
  return null;
}

/**
 * Every table in the drizzle registry must belong to exactly one group.
 * Throws otherwise, so the config can't silently fall behind the schema.
 */
export function resolveGroupKey(
  tableName: string,
  groups: SchemaGroup[],
  schema: string | null = null,
): string {
  const key = findGroupKey(tableName, groups, schema);
  if (key !== null) return key;
  if (schema !== null) throw new Error(`schema "${schema}" (table "${tableName}") is in no group`);
  throw new Error(`table "${tableName}" is in no group`);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @tickets/db test -- describe-schema`
Expected: PASS, including every pre-existing `describeSchema` test — the refactor must not change the throwing path's behaviour.

- [ ] **Step 5: Export it**

In `packages/db/src/schema/index.ts`, add `findGroupKey` to the existing `export { describeSchema, resolveGroupKey, ... } from './describe-schema';` block.

- [ ] **Step 6: Commit**

```bash
git add packages/db/src/schema/describe-schema.ts packages/db/src/schema/describe-schema.test.ts packages/db/src/schema/index.ts
git commit -m "refactor(db): extract findGroupKey, the non-throwing half of resolveGroupKey"
```

---

### Task 2: List and validate selectable databases

**Files:**
- Create: `packages/db/src/schema/list-databases.ts`
- Test: `packages/db/src/schema/list-databases.test.ts`

**Interfaces:**
- Consumes: `environment` from `../environment`.
- Produces:
  - `listDatabases(): Promise<string[]>` — non-template, connectable databases on the configured server, sorted.
  - `assertKnownDatabase(name: string): Promise<string>` — returns `name` if it is in `listDatabases()`, else throws `UnknownDatabaseError`.
  - `class UnknownDatabaseError extends Error` with `readonly database: string`.

- [ ] **Step 1: Write the failing test**

Create `packages/db/src/schema/list-databases.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { assertKnownDatabase, listDatabases, UnknownDatabaseError } from './list-databases';

describe('listDatabases', () => {
  it('includes the test database and excludes templates', async () => {
    const names = await listDatabases();
    expect(names).toContain('tickets_test');
    expect(names).not.toContain('template0');
    expect(names).not.toContain('template1');
  });

  it('is sorted', async () => {
    const names = await listDatabases();
    expect([...names].sort()).toEqual(names);
  });
});

describe('assertKnownDatabase', () => {
  it('returns a known name unchanged', async () => {
    await expect(assertKnownDatabase('tickets_test')).resolves.toBe('tickets_test');
  });

  it('rejects an unknown name', async () => {
    await expect(assertKnownDatabase('no_such_db')).rejects.toBeInstanceOf(UnknownDatabaseError);
  });

  it('rejects an injection attempt rather than connecting', async () => {
    await expect(assertKnownDatabase('tickets_test?host=evil')).rejects.toBeInstanceOf(
      UnknownDatabaseError,
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @tickets/db test -- list-databases`
Expected: FAIL — cannot find module `./list-databases`.

- [ ] **Step 3: Implement**

Create `packages/db/src/schema/list-databases.ts`:

```ts
import postgres from 'postgres';
import { environment } from '../environment';

/**
 * A database name the caller asked for that is not on this server. Carries the
 * name so the route can put it in a 400 body without re-deriving it.
 */
export class UnknownDatabaseError extends Error {
  constructor(readonly database: string) {
    super(`unknown database "${database}"`);
    this.name = 'UnknownDatabaseError';
  }
}

// Catalog reads connect to a database that is guaranteed to exist and to be
// connectable — the configured one — and ask it about its siblings. `max: 1`
// and an immediate close keep this from holding a pool open between requests.
async function withAdminConnection<T>(fn: (sql: postgres.Sql) => Promise<T>): Promise<T> {
  const { host, port, user, password, database } = environment.postgres;
  const sql = postgres({ host, port, user, password, database, max: 1 });
  try {
    return await fn(sql);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

/** Non-template, connectable databases on the configured server, sorted. */
export async function listDatabases(): Promise<string[]> {
  return withAdminConnection(async (sql) => {
    const rows = await sql<{ datname: string }[]>`
      SELECT datname
      FROM pg_database
      WHERE NOT datistemplate AND datallowconn
      ORDER BY datname
    `;
    return rows.map((r) => r.datname);
  });
}

/**
 * The ONLY sanctioned path from a caller-supplied string to a database name.
 * Membership in the live enumeration is the whole check — a name that is not
 * on the server can never reach a connection URL, so no escaping or pattern
 * matching is needed or attempted.
 */
export async function assertKnownDatabase(name: string): Promise<string> {
  const names = await listDatabases();
  if (!names.includes(name)) throw new UnknownDatabaseError(name);
  return name;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @tickets/db test -- list-databases`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/schema/list-databases.ts packages/db/src/schema/list-databases.test.ts
git commit -m "feat(db): enumerate and validate selectable databases"
```

---

### Task 3: Validated connection helper

**Files:**
- Create: `packages/db/src/schema/introspect/connect.ts`
- Test: `packages/db/src/schema/introspect/connect.test.ts`

**Interfaces:**
- Consumes: `assertKnownDatabase`, `UnknownDatabaseError` (Task 2).
- Produces: `withDatabase<T>(name: string, fn: (sql: postgres.Sql) => Promise<T>): Promise<T>` — validates the name, opens a `max: 1` connection to it, always closes it, and rethrows `UnknownDatabaseError` without connecting.

- [ ] **Step 1: Write the failing test**

Create `packages/db/src/schema/introspect/connect.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { UnknownDatabaseError } from '../list-databases';
import { withDatabase } from './connect';

describe('withDatabase', () => {
  it('runs a query against the named database', async () => {
    const rows = await withDatabase('tickets_test', async (sql) => {
      return sql<{ name: string }[]>`SELECT current_database() AS name`;
    });
    expect(rows[0]?.name).toBe('tickets_test');
  });

  it('refuses an unknown database without connecting', async () => {
    await expect(
      withDatabase('no_such_db', async () => 'unreachable'),
    ).rejects.toBeInstanceOf(UnknownDatabaseError);
  });

  it('closes the connection even when the callback throws', async () => {
    await expect(
      withDatabase('tickets_test', async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    // A leaked pool would keep the process alive past the suite; a second call
    // succeeding proves the first released cleanly.
    const rows = await withDatabase('tickets_test', async (sql) => sql`SELECT 1 AS ok`);
    expect(rows.length).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @tickets/db test -- introspect/connect`
Expected: FAIL — cannot find module `./connect`.

- [ ] **Step 3: Implement**

Create `packages/db/src/schema/introspect/connect.ts`:

```ts
import postgres from 'postgres';
import { environment } from '../../environment';
import { assertKnownDatabase } from '../list-databases';

/**
 * Open a short-lived, read-only connection to a NAMED database and hand the
 * caller the raw postgres.js handle.
 *
 * Only the database name varies — host, port, user and password always come
 * from `environment.postgres`, so no caller can redirect this at another
 * server. The name is validated against the live `pg_database` enumeration
 * BEFORE a connection is attempted (assertKnownDatabase), which is what keeps
 * a caller string from ever reaching a connection URL unchecked.
 *
 * `max: 1` plus an unconditional close in `finally`: introspection runs once
 * per dropdown change, so a pool cached per database would hold idle handles
 * open against every database anyone ever looked at.
 */
export async function withDatabase<T>(
  name: string,
  fn: (sql: postgres.Sql) => Promise<T>,
): Promise<T> {
  const database = await assertKnownDatabase(name);
  const { host, port, user, password } = environment.postgres;
  const sql = postgres({ host, port, user, password, database, max: 1 });
  try {
    return await fn(sql);
  } finally {
    await sql.end({ timeout: 5 });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @tickets/db test -- introspect/connect`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/schema/introspect/connect.ts packages/db/src/schema/introspect/connect.test.ts
git commit -m "feat(db): validated short-lived connection to a named database"
```

---

### Task 4: Read tables and columns

**Files:**
- Create: `packages/db/src/schema/introspect/read-tables.ts`
- Test: `packagesteps/db/src/schema/introspect/read-tables.test.ts` → **correct path:** `packages/db/src/schema/introspect/read-tables.test.ts`

**Interfaces:**
- Consumes: `withDatabase` (Task 3).
- Produces:
  - `type RawTable = { oid: number; name: string; schema: string | null; columns: RawColumn[] }`
  - `type RawColumn = { attnum: number; name: string; type: string; notNull: boolean }`
  - `readTables(sql: postgres.Sql): Promise<RawTable[]>` — ordinary and partitioned tables in user namespaces, columns in `attnum` order, dropped columns excluded. `schema` is `null` for `public`, matching `TableMeta.schema`.

- [ ] **Step 1: Write the failing test**

Create `packages/db/src/schema/introspect/read-tables.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { withDatabase } from './connect';
import { readTables } from './read-tables';

describe('readTables', () => {
  it('reads user tables with their columns', async () => {
    const tables = await withDatabase('tickets_test', (sql) => readTables(sql));
    expect(tables.length).toBeGreaterThan(0);

    const items = tables.find((t) => t.name === 'items');
    expect(items).toBeDefined();
    expect(items!.columns.some((c) => c.name === 'id')).toBe(true);
  });

  it('reports public tables with a null schema', async () => {
    const tables = await withDatabase('tickets_test', (sql) => readTables(sql));
    for (const t of tables) {
      expect(t.schema).not.toBe('public');
    }
  });

  it('excludes system catalogs', async () => {
    const tables = await withDatabase('tickets_test', (sql) => readTables(sql));
    expect(tables.some((t) => t.schema === 'pg_catalog')).toBe(false);
    expect(tables.some((t) => t.schema === 'information_schema')).toBe(false);
  });

  it('orders columns by attnum', async () => {
    const tables = await withDatabase('tickets_test', (sql) => readTables(sql));
    for (const t of tables) {
      const nums = t.columns.map((c) => c.attnum);
      expect([...nums].sort((a, b) => a - b)).toEqual(nums);
    }
  });

  it('carries notNull off the catalog', async () => {
    const tables = await withDatabase('tickets_test', (sql) => readTables(sql));
    const items = tables.find((t) => t.name === 'items')!;
    expect(items.columns.find((c) => c.name === 'id')!.notNull).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @tickets/db test -- read-tables`
Expected: FAIL — cannot find module `./read-tables`.

- [ ] **Step 3: Implement**

Create `packages/db/src/schema/introspect/read-tables.ts`:

```ts
import type postgres from 'postgres';

export type RawColumn = {
  attnum: number;
  name: string;
  type: string;
  notNull: boolean;
};

export type RawTable = {
  oid: number;
  name: string;
  /** null = public, matching TableMeta.schema. */
  schema: string | null;
  columns: RawColumn[];
};

// 'r' ordinary, 'p' partitioned. Views, matviews, indexes and sequences are
// deliberately absent — the ERD draws tables.
const TABLE_KINDS = ['r', 'p'];

/**
 * Tables and their columns, straight from the catalog.
 *
 * `format_type` rather than a `pg_type` join: it is what renders
 * `numeric(10,2)`, `varchar(64)` and `integer[]` the way Postgres itself
 * prints them, which is the same spelling the drizzle-derived path produces.
 */
export async function readTables(sql: postgres.Sql): Promise<RawTable[]> {
  const tableRows = await sql<{ oid: number; name: string; schema: string }[]>`
    SELECT c.oid::int AS oid, c.relname AS name, n.nspname AS schema
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = ANY(${TABLE_KINDS})
      AND n.nspname NOT IN ('pg_catalog', 'information_schema')
      AND n.nspname NOT LIKE 'pg\\_toast%'
      AND n.nspname NOT LIKE 'pg\\_temp%'
    ORDER BY n.nspname, c.relname
  `;
  if (tableRows.length === 0) return [];

  const oids = tableRows.map((t) => t.oid);
  const columnRows = await sql<
    { attrelid: number; attnum: number; name: string; type: string; not_null: boolean }[]
  >`
    SELECT a.attrelid::int AS attrelid,
           a.attnum::int   AS attnum,
           a.attname       AS name,
           format_type(a.atttypid, a.atttypmod) AS type,
           a.attnotnull    AS not_null
    FROM pg_attribute a
    WHERE a.attrelid = ANY(${oids})
      AND a.attnum > 0
      AND NOT a.attisdropped
    ORDER BY a.attrelid, a.attnum
  `;

  const byTable = new Map<number, RawColumn[]>();
  for (const r of columnRows) {
    const list = byTable.get(r.attrelid) ?? [];
    list.push({ attnum: r.attnum, name: r.name, type: r.type, notNull: r.not_null });
    byTable.set(r.attrelid, list);
  }

  return tableRows.map((t) => ({
    oid: t.oid,
    name: t.name,
    schema: t.schema === 'public' ? null : t.schema,
    columns: byTable.get(t.oid) ?? [],
  }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @tickets/db test -- read-tables`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/schema/introspect/read-tables.ts packages/db/src/schema/introspect/read-tables.test.ts
git commit -m "feat(db): read tables and columns from pg_catalog"
```

---

### Task 5: Read constraints

**Files:**
- Create: `packages/db/src/schema/introspect/read-constraints.ts`
- Test: `packages/db/src/schema/introspect/read-constraints.test.ts`

**Interfaces:**
- Consumes: `RawTable` (Task 4).
- Produces:
  - `type RawConstraints = { primaryKey: string[]; uniques: UniqueMeta[]; checks: CheckMeta[]; fks: RawFk[] }`
  - `type RawFk = { column: string; refSchema: string | null; refTable: string; refColumn: string }`
  - `readConstraints(sql: postgres.Sql, tables: RawTable[]): Promise<Map<number, RawConstraints>>` keyed by table oid.

`conkey`/`confkey` are `attnum` arrays, so column names are resolved through the `RawTable` columns already read — that is why this takes `tables` rather than querying `pg_attribute` again.

- [ ] **Step 1: Write the failing test**

Create `packages/db/src/schema/introspect/read-constraints.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { withDatabase } from './connect';
import { readConstraints } from './read-constraints';
import { readTables } from './read-tables';

describe('readConstraints', () => {
  it('reads the primary key by column name', async () => {
    const { tables, constraints } = await withDatabase('tickets_test', async (sql) => {
      const tables = await readTables(sql);
      return { tables, constraints: await readConstraints(sql, tables) };
    });
    const items = tables.find((t) => t.name === 'items')!;
    expect(constraints.get(items.oid)!.primaryKey).toEqual(['id']);
  });

  it('resolves foreign keys to their referenced table and column', async () => {
    const { tables, constraints } = await withDatabase('tickets_test', async (sql) => {
      const tables = await readTables(sql);
      return { tables, constraints: await readConstraints(sql, tables) };
    });
    const withFk = tables.find((t) => (constraints.get(t.oid)?.fks.length ?? 0) > 0);
    expect(withFk).toBeDefined();
    const fk = constraints.get(withFk!.oid)!.fks[0]!;
    expect(typeof fk.column).toBe('string');
    expect(typeof fk.refTable).toBe('string');
    expect(typeof fk.refColumn).toBe('string');
    // Resolved names, never raw attnums.
    expect(fk.column).not.toMatch(/^\d+$/);
  });

  it('returns an entry for every table, even one with no constraints', async () => {
    const { tables, constraints } = await withDatabase('tickets_test', async (sql) => {
      const tables = await readTables(sql);
      return { tables, constraints: await readConstraints(sql, tables) };
    });
    for (const t of tables) {
      expect(constraints.has(t.oid)).toBe(true);
    }
  });

  it('renders check expressions as text', async () => {
    const { tables, constraints } = await withDatabase('tickets_test', async (sql) => {
      const tables = await readTables(sql);
      return { tables, constraints: await readConstraints(sql, tables) };
    });
    for (const t of tables) {
      for (const c of constraints.get(t.oid)!.checks) {
        expect(typeof c.expression).toBe('string');
        expect(c.expression.length).toBeGreaterThan(0);
      }
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @tickets/db test -- read-constraints`
Expected: FAIL — cannot find module `./read-constraints`.

- [ ] **Step 3: Implement**

Create `packages/db/src/schema/introspect/read-constraints.ts`:

```ts
import type postgres from 'postgres';
import type { CheckMeta, UniqueMeta } from '../describe-schema';
import type { RawTable } from './read-tables';

export type RawFk = {
  column: string;
  /** The REFERENCED table's schema (null = public), never the referencing one. */
  refSchema: string | null;
  refTable: string;
  refColumn: string;
};

export type RawConstraints = {
  primaryKey: string[];
  uniques: UniqueMeta[];
  checks: CheckMeta[];
  fks: RawFk[];
};

/**
 * pk / unique / check / fk per table, keyed by table oid.
 *
 * `conkey` and `confkey` are attnum arrays, not names, so this resolves them
 * through the columns `readTables` already read rather than re-querying
 * pg_attribute. A referenced table outside the introspected set (impossible
 * today, since readTables covers every user namespace) yields no fk rather
 * than a dangling name.
 */
export async function readConstraints(
  sql: postgres.Sql,
  tables: RawTable[],
): Promise<Map<number, RawConstraints>> {
  const out = new Map<number, RawConstraints>();
  for (const t of tables) {
    out.set(t.oid, { primaryKey: [], uniques: [], checks: [], fks: [] });
  }
  if (tables.length === 0) return out;

  // oid -> (attnum -> column name), for both sides of a foreign key.
  const nameByAttnum = new Map<number, Map<number, string>>();
  const tableByOid = new Map<number, RawTable>();
  for (const t of tables) {
    tableByOid.set(t.oid, t);
    nameByAttnum.set(t.oid, new Map(t.columns.map((c) => [c.attnum, c.name])));
  }

  const rows = await sql<
    {
      conrelid: number;
      name: string;
      contype: string;
      conkey: number[] | null;
      confrelid: number;
      confkey: number[] | null;
      expression: string | null;
    }[]
  >`
    SELECT c.conrelid::int AS conrelid,
           c.conname       AS name,
           c.contype::text AS contype,
           c.conkey::int[] AS conkey,
           c.confrelid::int AS confrelid,
           c.confkey::int[] AS confkey,
           pg_get_expr(c.conbin, c.conrelid) AS expression
    FROM pg_constraint c
    WHERE c.conrelid = ANY(${tables.map((t) => t.oid)})
      AND c.contype IN ('p', 'u', 'f', 'c')
    ORDER BY c.conrelid, c.conname
  `;

  const columnsOf = (oid: number, keys: number[] | null): string[] => {
    const names = nameByAttnum.get(oid);
    if (!names || !keys) return [];
    return keys.map((k) => names.get(k)).filter((n): n is string => n !== undefined);
  };

  for (const row of rows) {
    const entry = out.get(row.conrelid);
    if (!entry) continue;

    if (row.contype === 'p') {
      entry.primaryKey = columnsOf(row.conrelid, row.conkey);
    } else if (row.contype === 'u') {
      entry.uniques.push({ name: row.name, columns: columnsOf(row.conrelid, row.conkey) });
    } else if (row.contype === 'c') {
      entry.checks.push({ name: row.name, expression: row.expression ?? '' });
    } else if (row.contype === 'f') {
      const local = columnsOf(row.conrelid, row.conkey);
      const foreign = columnsOf(row.confrelid, row.confkey);
      const refTable = tableByOid.get(row.confrelid);
      if (!refTable) continue;
      // ColumnMeta.fk is single-column; a composite fk contributes one entry
      // per column pair, which is how the drizzle-derived path models it too.
      for (const [i, column] of local.entries()) {
        const refColumn = foreign[i];
        if (refColumn === undefined) continue;
        entry.fks.push({
          column,
          refSchema: refTable.schema,
          refTable: refTable.name,
          refColumn,
        });
      }
    }
  }

  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @tickets/db test -- read-constraints`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/schema/introspect/read-constraints.ts packages/db/src/schema/introspect/read-constraints.test.ts
git commit -m "feat(db): read pk/unique/check/fk constraints from pg_catalog"
```

---

### Task 6: Read indexes and enums

Two small readers, one commit — neither is worth its own review gate, and they share the "everything else the catalog carries" role.

**Files:**
- Create: `packages/db/src/schema/introspect/read-indexes.ts`
- Create: `packages/db/src/schema/introspect/read-enums.ts`
- Test: `packages/db/src/schema/introspect/read-indexes.test.ts`
- Test: `packages/db/src/schema/introspect/read-enums.test.ts`

**Interfaces:**
- Consumes: `RawTable` (Task 4).
- Produces:
  - `readIndexes(sql: postgres.Sql, tables: RawTable[]): Promise<Map<number, IndexMeta[]>>` — non-primary indexes only (the pk index restates the pk constraint).
  - `readEnums(sql: postgres.Sql): Promise<EnumMeta[]>` — values in `enumsortorder`.

- [ ] **Step 1: Write the failing tests**

Create `packages/db/src/schema/introspect/read-indexes.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { withDatabase } from './connect';
import { readIndexes } from './read-indexes';
import { readTables } from './read-tables';

describe('readIndexes', () => {
  it('returns an entry for every table', async () => {
    const { tables, indexes } = await withDatabase('tickets_test', async (sql) => {
      const tables = await readTables(sql);
      return { tables, indexes: await readIndexes(sql, tables) };
    });
    for (const t of tables) expect(indexes.has(t.oid)).toBe(true);
  });

  it('names index columns rather than attnums, and carries the method', async () => {
    const { tables, indexes } = await withDatabase('tickets_test', async (sql) => {
      const tables = await readTables(sql);
      return { tables, indexes: await readIndexes(sql, tables) };
    });
    const withIndex = tables.find((t) => (indexes.get(t.oid)?.length ?? 0) > 0);
    expect(withIndex).toBeDefined();
    const ix = indexes.get(withIndex!.oid)![0]!;
    expect(ix.name.length).toBeGreaterThan(0);
    expect(ix.method).toBe('btree');
    for (const c of ix.columns) expect(c).not.toMatch(/^\d+$/);
  });

  it('excludes the primary key index', async () => {
    const { tables, indexes } = await withDatabase('tickets_test', async (sql) => {
      const tables = await readTables(sql);
      return { tables, indexes: await readIndexes(sql, tables) };
    });
    const items = tables.find((t) => t.name === 'items')!;
    expect(indexes.get(items.oid)!.some((ix) => ix.name === 'items_pkey')).toBe(false);
  });
});
```

Create `packages/db/src/schema/introspect/read-enums.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { withDatabase } from './connect';
import { readEnums } from './read-enums';

describe('readEnums', () => {
  it('reads enum declarations with ordered values', async () => {
    const enums = await withDatabase('tickets_test', (sql) => readEnums(sql));
    for (const e of enums) {
      expect(e.name.length).toBeGreaterThan(0);
      expect(e.values.length).toBeGreaterThan(0);
    }
  });

  it('reports public enums with a null schema', async () => {
    const enums = await withDatabase('tickets_test', (sql) => readEnums(sql));
    for (const e of enums) expect(e.schema).not.toBe('public');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @tickets/db test -- read-indexes read-enums`
Expected: FAIL — cannot find modules `./read-indexes`, `./read-enums`.

- [ ] **Step 3: Implement the index reader**

Create `packages/db/src/schema/introspect/read-indexes.ts`:

```ts
import type postgres from 'postgres';
import type { IndexMeta } from '../describe-schema';
import type { RawTable } from './read-tables';

/**
 * Non-primary indexes per table oid.
 *
 * The pk's backing index is excluded (`NOT indisprimary`): it restates the
 * primary key constraint readConstraints already reports, and drawing it as an
 * index too would double-count.
 *
 * `indkey` is an int2vector of attnums where 0 means "an expression". Expression
 * columns are rendered from `pg_get_indexdef` rather than named, matching the
 * drizzle-derived path's use of rendered SQL text for expression columns.
 */
export async function readIndexes(
  sql: postgres.Sql,
  tables: RawTable[],
): Promise<Map<number, IndexMeta[]>> {
  const out = new Map<number, IndexMeta[]>();
  for (const t of tables) out.set(t.oid, []);
  if (tables.length === 0) return out;

  const nameByAttnum = new Map<number, Map<number, string>>(
    tables.map((t) => [t.oid, new Map(t.columns.map((c) => [c.attnum, c.name]))]),
  );

  const rows = await sql<
    {
      indrelid: number;
      name: string;
      is_unique: boolean;
      method: string;
      where_expr: string | null;
      indkey: string;
      definition: string;
    }[]
  >`
    SELECT i.indrelid::int    AS indrelid,
           ic.relname         AS name,
           i.indisunique      AS is_unique,
           am.amname          AS method,
           pg_get_expr(i.indpred, i.indrelid) AS where_expr,
           i.indkey::text     AS indkey,
           pg_get_indexdef(i.indexrelid)      AS definition
    FROM pg_index i
    JOIN pg_class ic ON ic.oid = i.indexrelid
    JOIN pg_am am    ON am.oid = ic.relam
    WHERE i.indrelid = ANY(${tables.map((t) => t.oid)})
      AND NOT i.indisprimary
    ORDER BY i.indrelid, ic.relname
  `;

  for (const row of rows) {
    const names = nameByAttnum.get(row.indrelid);
    if (!names) continue;
    // int2vector prints space-separated; 0 marks an expression column.
    const attnums = row.indkey.split(' ').filter((s) => s.length > 0).map(Number);
    const columns = attnums.map((n) => names.get(n) ?? expressionColumn(row.definition));
    out.get(row.indrelid)!.push({
      name: row.name,
      columns,
      unique: row.is_unique,
      method: row.method,
      where: row.where_expr,
    });
  }

  return out;
}

/**
 * The parenthesised column list from `CREATE INDEX … ON t USING m (…)`, used
 * verbatim for an expression column. Deliberately coarse: the exact rendering
 * of an expression index is display text, and the alternative — reimplementing
 * Postgres' expression deparser — buys nothing the ERD can use.
 */
function expressionColumn(definition: string): string {
  const open = definition.indexOf('(');
  const close = definition.lastIndexOf(')');
  return open >= 0 && close > open ? definition.slice(open + 1, close) : definition;
}
```

- [ ] **Step 4: Implement the enum reader**

Create `packages/db/src/schema/introspect/read-enums.ts`:

```ts
import type postgres from 'postgres';
import type { EnumMeta } from '../describe-schema';

/**
 * Enum declarations, values in declaration order.
 *
 * `enumsortorder`, not `enumlabel`: the label order is the enum's meaning
 * (a status ladder, a priority scale), and sorting alphabetically would
 * silently reorder it.
 */
export async function readEnums(sql: postgres.Sql): Promise<EnumMeta[]> {
  const rows = await sql<{ name: string; schema: string; value: string }[]>`
    SELECT t.typname  AS name,
           n.nspname  AS schema,
           e.enumlabel AS value
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    JOIN pg_enum e      ON e.enumtypid = t.oid
    WHERE t.typtype = 'e'
      AND n.nspname NOT IN ('pg_catalog', 'information_schema')
    ORDER BY n.nspname, t.typname, e.enumsortorder
  `;

  const byId = new Map<string, EnumMeta>();
  for (const row of rows) {
    const schema = row.schema === 'public' ? null : row.schema;
    const id = `${row.schema}.${row.name}`;
    const existing = byId.get(id);
    if (existing) existing.values.push(row.value);
    else byId.set(id, { name: row.name, schema, values: [row.value] });
  }
  return [...byId.values()];
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @tickets/db test -- read-indexes read-enums`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add packages/db/src/schema/introspect/read-indexes.ts packages/db/src/schema/introspect/read-indexes.test.ts packages/db/src/schema/introspect/read-enums.ts packages/db/src/schema/introspect/read-enums.test.ts
git commit -m "feat(db): read indexes and enums from pg_catalog"
```

---

### Task 7: Hybrid grouping

**Files:**
- Create: `packages/db/src/schema/introspect/group-tables.ts`
- Test: `packages/db/src/schema/introspect/group-tables.test.ts`

**Interfaces:**
- Consumes: `findGroupKey` (Task 1), `SCHEMA_GROUPS`, `qualifiedName`, `TableMeta`, `GroupMeta`.
- Produces: `groupTables(tables: Omit<TableMeta, 'group'>[]): { tables: TableMeta[]; groups: GroupMeta[] }` — assigns each table a group key and returns the group list in curated-then-namespace order.

Curated groups keep their configured `key`, `label` and `color`. A fallback group gets key `ns:<schema>` (or `ns:public`), label = the namespace name upper-cased, and a colour cycled from `FALLBACK_HUES`. Empty curated groups are dropped, so introspecting an unrelated database shows only its own namespaces.

- [ ] **Step 1: Write the failing test**

Create `packages/db/src/schema/introspect/group-tables.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { groupTables } from './group-tables';

type Input = Parameters<typeof groupTables>[0][number];

const table = (name: string, schema: string | null = null): Input => ({
  name,
  schema,
  columns: [],
  primaryKey: [],
  uniques: [],
  checks: [],
  indexes: [],
});

describe('groupTables', () => {
  it('gives a curated table its configured group', () => {
    const { tables, groups } = groupTables([table('items')]);
    expect(tables[0]!.group).toBe('rc');
    expect(groups.find((g) => g.key === 'rc')?.label).toBe('Records');
  });

  it('keeps the curated grouping that ignores a table real schema', () => {
    // core.users renders in WORKSPACE, not WORKDIRS — see schema-groups.ts.
    const { tables } = groupTables([table('users', 'core')]);
    expect(tables[0]!.group).toBe('ws');
  });

  it('falls back to a per-namespace group for an unknown table', () => {
    const { tables, groups } = groupTables([table('audit_log', 'billing')]);
    expect(tables[0]!.group).toBe('ns:billing');
    const fallback = groups.find((g) => g.key === 'ns:billing')!;
    expect(fallback.label).toBe('BILLING');
    expect(fallback.tables).toEqual(['billing.audit_log']);
  });

  it('groups an unknown public table under ns:public', () => {
    const { tables } = groupTables([table('legacy_rows')]);
    expect(tables[0]!.group).toBe('ns:public');
  });

  it('emits only Instrument option hue names as colours', () => {
    const valid = new Set([
      'gray', 'red', 'orange', 'yellow', 'green',
      'teal', 'cyan', 'blue', 'indigo', 'purple', 'pink',
    ]);
    const { groups } = groupTables([
      table('items'),
      table('a', 'one'),
      table('b', 'two'),
      table('c', 'three'),
    ]);
    for (const g of groups) expect(valid.has(g.color)).toBe(true);
  });

  it('drops curated groups that matched nothing', () => {
    const { groups } = groupTables([table('audit_log', 'billing')]);
    expect(groups.every((g) => g.tables.length > 0)).toBe(true);
    expect(groups.some((g) => g.key === 'rc')).toBe(false);
  });

  it('lists group tables by qualified name', () => {
    const { groups } = groupTables([table('sessions', 'terminal')]);
    const group = groups.find((g) => g.tables.length > 0)!;
    expect(group.tables).toContain('terminal.sessions');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @tickets/db test -- group-tables`
Expected: FAIL — cannot find module `./group-tables`.

- [ ] **Step 3: Implement**

Create `packages/db/src/schema/introspect/group-tables.ts`:

```ts
import { findGroupKey, qualifiedName, type GroupMeta, type TableMeta } from '../describe-schema';
import { SCHEMA_GROUPS } from '../schema-groups';

/**
 * Hues for namespace fallback groups, ordered so the first few are maximally
 * distinct. Instrument option hue NAMES — the renderer interpolates these into
 * `var(--ins-opt-<name>)`, so a hex or an invented name yields an invalid
 * custom property. `gray` is absent: it reads as "no group" rather than a hue.
 */
const FALLBACK_HUES = ['blue', 'green', 'orange', 'purple', 'teal', 'cyan', 'pink', 'red', 'yellow'];

const fallbackKey = (schema: string | null) => `ns:${schema ?? 'public'}`;

/**
 * Assign every table a group, curated where the config knows it and per
 * Postgres namespace where it does not.
 *
 * The fallback is what makes this safe to point at ANY database: SCHEMA_GROUPS
 * describes the tickets schema, so introspecting anything else — or a tickets
 * database carrying a table the code has not declared — would otherwise throw
 * (resolveGroupKey) or silently drop the table. A table the code does not know
 * about SHOWING UP is the point: this screen exists to reveal what is actually
 * deployed.
 *
 * Curated groups that matched nothing are dropped, so a foreign database does
 * not render seven empty tickets zones.
 */
export function groupTables(
  tables: Omit<TableMeta, 'group'>[],
): { tables: TableMeta[]; groups: GroupMeta[] } {
  const assigned: TableMeta[] = tables.map((t) => ({
    ...t,
    group: findGroupKey(t.name, SCHEMA_GROUPS, t.schema) ?? fallbackKey(t.schema),
  }));

  const tablesIn = (key: string) =>
    assigned.filter((t) => t.group === key).map((t) => qualifiedName(t.schema, t.name));

  // Curated first, in declaration order — that order is the layout order.
  const curated: GroupMeta[] = SCHEMA_GROUPS.map((g) => ({
    key: g.key,
    label: g.label,
    color: g.color,
    tables: tablesIn(g.key),
  })).filter((g) => g.tables.length > 0);

  // Then one group per namespace that needed a fallback, in first-seen order.
  const fallbackKeys: string[] = [];
  for (const t of assigned) {
    if (t.group.startsWith('ns:') && !fallbackKeys.includes(t.group)) fallbackKeys.push(t.group);
  }
  const fallback: GroupMeta[] = fallbackKeys.map((key, i) => ({
    key,
    label: key.slice('ns:'.length).toUpperCase(),
    color: FALLBACK_HUES[i % FALLBACK_HUES.length]!,
    tables: tablesIn(key),
  }));

  return { tables: assigned, groups: [...curated, ...fallback] };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @tickets/db test -- group-tables`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/schema/introspect/group-tables.ts packages/db/src/schema/introspect/group-tables.test.ts
git commit -m "feat(db): hybrid grouping — curated groups with per-namespace fallback"
```

---

### Task 8: Assemble `introspectDatabase`

**Files:**
- Create: `packages/db/src/schema/introspect/introspect-database.ts`
- Test: `packages/db/src/schema/introspect/introspect-database.test.ts`
- Modify: `packages/db/src/schema/index.ts`

**Interfaces:**
- Consumes: everything from Tasks 2–7.
- Produces: `introspectDatabase(name: string): Promise<SchemaGraph>` — the same `{ tables, groups, enums }` shape `describeSchema()` returns.

- [ ] **Step 1: Write the failing test**

Create `packages/db/src/schema/introspect/introspect-database.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { UnknownDatabaseError } from '../list-databases';
import { introspectDatabase } from './introspect-database';

describe('introspectDatabase', () => {
  it('returns a SchemaGraph for a real database', async () => {
    const graph = await introspectDatabase('tickets_test');
    expect(Array.isArray(graph.tables)).toBe(true);
    expect(Array.isArray(graph.groups)).toBe(true);
    expect(Array.isArray(graph.enums)).toBe(true);
    expect(graph.tables.length).toBeGreaterThan(0);
  });

  it('rejects an unknown database', async () => {
    await expect(introspectDatabase('no_such_db')).rejects.toBeInstanceOf(UnknownDatabaseError);
  });

  it('carries pk and fk onto columns', async () => {
    const graph = await introspectDatabase('tickets_test');
    const items = graph.tables.find((t) => t.name === 'items')!;
    expect(items.columns.find((c) => c.name === 'id')!.pk).toBe(true);

    const withFk = graph.tables.find((t) => t.columns.some((c) => c.fk !== null));
    expect(withFk).toBeDefined();
    const fkColumn = withFk!.columns.find((c) => c.fk !== null)!;
    expect(typeof fkColumn.fk!.table).toBe('string');
    expect(typeof fkColumn.fk!.column).toBe('string');
  });

  it('every group table resolves to a real table', async () => {
    const graph = await introspectDatabase('tickets_test');
    const ids = new Set(
      graph.tables.map((t) => (t.schema ? `${t.schema}.${t.name}` : t.name)),
    );
    for (const g of graph.groups) {
      for (const id of g.tables) expect(ids.has(id)).toBe(true);
    }
  });

  it('every table belongs to a group that exists', async () => {
    const graph = await introspectDatabase('tickets_test');
    const keys = new Set(graph.groups.map((g) => g.key));
    for (const t of graph.tables) expect(keys.has(t.group)).toBe(true);
  });

  it('agrees with the drizzle-derived graph on table names', async () => {
    // tickets_test is migrated from the same schema the code declares, so the
    // two paths must see the same tables. A mismatch here is real drift.
    const { describeSchema } = await import('../describe-schema');
    const live = await introspectDatabase('tickets_test');
    const declared = describeSchema();
    const liveIds = new Set(live.tables.map((t) => (t.schema ? `${t.schema}.${t.name}` : t.name)));
    for (const t of declared.tables) {
      const id = t.schema ? `${t.schema}.${t.name}` : t.name;
      expect(liveIds.has(id)).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @tickets/db test -- introspect-database`
Expected: FAIL — cannot find module `./introspect-database`.

- [ ] **Step 3: Implement**

Create `packages/db/src/schema/introspect/introspect-database.ts`:

```ts
import type { ColumnMeta, SchemaGraph, TableMeta } from '../describe-schema';
import { withDatabase } from './connect';
import { groupTables } from './group-tables';
import { readConstraints } from './read-constraints';
import { readEnums } from './read-enums';
import { readIndexes } from './read-indexes';
import { readTables } from './read-tables';

/**
 * The live half of the schema graph: what a database ACTUALLY contains, read
 * from pg_catalog, in the same shape describeSchema() derives from the drizzle
 * table objects. Same shape by design — the renderer must not care which path
 * produced its input, and the two being comparable is what makes drift
 * detectable.
 *
 * One connection for the whole read (all four readers share it), closed by
 * withDatabase before this resolves.
 */
export async function introspectDatabase(name: string): Promise<SchemaGraph> {
  return withDatabase(name, async (sql) => {
    const raw = await readTables(sql);
    const constraints = await readConstraints(sql, raw);
    const indexes = await readIndexes(sql, raw);
    const enums = await readEnums(sql);

    const described: Omit<TableMeta, 'group'>[] = raw.map((t) => {
      const c = constraints.get(t.oid)!;
      const pk = new Set(c.primaryKey);
      const fkByColumn = new Map(c.fks.map((fk) => [fk.column, fk]));

      const columns: ColumnMeta[] = t.columns.map((col) => {
        const fk = fkByColumn.get(col.name);
        return {
          name: col.name,
          type: col.type,
          notNull: col.notNull,
          pk: pk.has(col.name),
          fk: fk
            ? { schema: fk.refSchema, table: fk.refTable, column: fk.refColumn }
            : null,
        };
      });

      return {
        name: t.name,
        schema: t.schema,
        columns,
        primaryKey: c.primaryKey,
        uniques: c.uniques,
        checks: c.checks,
        indexes: indexes.get(t.oid) ?? [],
      };
    });

    const { tables, groups } = groupTables(described);
    return { tables, groups, enums };
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @tickets/db test -- introspect-database`
Expected: PASS (6 tests).

- [ ] **Step 5: Export the public surface**

In `packages/db/src/schema/index.ts`, add:

```ts
export { introspectDatabase } from './introspect/introspect-database';
export { listDatabases, assertKnownDatabase, UnknownDatabaseError } from './list-databases';
```

Then confirm `packages/db/src/index.ts` re-exports the schema barrel (it already does for `describeSchema`); if `introspectDatabase` is not reachable as `import { introspectDatabase } from '@tickets/db'`, add it there the same way `describeSchema` is.

- [ ] **Step 6: Run the whole db suite**

Run: `pnpm --filter @tickets/db test`
Expected: PASS — including `model-conformance.test.ts`, proving `describeSchema()` is untouched.

- [ ] **Step 7: Commit**

```bash
git add packages/db/src/schema/introspect/introspect-database.ts packages/db/src/schema/introspect/introspect-database.test.ts packages/db/src/schema/index.ts packages/db/src/index.ts
git commit -m "feat(db): introspectDatabase — a live SchemaGraph from pg_catalog"
```

---

### Task 9: API routes

**Files:**
- Modify: `apps/api/src/routes/schema.routes.ts`
- Modify: `apps/api/src/routes/schema.routes.test.ts`

**Interfaces:**
- Consumes: `introspectDatabase`, `listDatabases`, `UnknownDatabaseError` (Task 8), `environment` from `@tickets/db`.
- Produces:
  - `GET /api/schema?database=<name>` → `SchemaGraph`; omitted `database` uses the configured one; unknown name → `400 { error }`.
  - `GET /api/schema/databases` → `{ databases: string[]; current: string }`.

- [ ] **Step 1: Write the failing tests**

Replace the body of `apps/api/src/routes/schema.routes.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createDbClient } from '@tickets/db';
import { buildApp } from '../app';

// These routes introspect a LIVE database, so unlike the previous
// code-derived route they need postgres actually running. The api suite
// already runs against tickets_test (src/test/setup-env.ts).
describe('GET /api/schema', () => {
  it('returns a live schema graph for the default database', async () => {
    const { db } = createDbClient({ max: 1 });
    const app = buildApp({ db });
    const res = await app.inject({ method: 'GET', url: '/api/schema' });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { tables: unknown[]; groups: unknown[]; enums: unknown[] };
    expect(Array.isArray(body.tables)).toBe(true);
    expect(body.tables.length).toBeGreaterThan(0);
    const items = (body.tables as { name: string; group: string }[]).find((t) => t.name === 'items');
    expect(items?.group).toBe('rc');
    await app.close();
  });

  it('introspects an explicitly named database', async () => {
    const { db } = createDbClient({ max: 1 });
    const app = buildApp({ db });
    const res = await app.inject({ method: 'GET', url: '/api/schema?database=tickets_test' });
    expect(res.statusCode).toBe(200);
    expect((res.json() as { tables: unknown[] }).tables.length).toBeGreaterThan(0);
    await app.close();
  });

  it('rejects an unknown database with 400', async () => {
    const { db } = createDbClient({ max: 1 });
    const app = buildApp({ db });
    const res = await app.inject({ method: 'GET', url: '/api/schema?database=no_such_db' });
    expect(res.statusCode).toBe(400);
    expect((res.json() as { error: string }).error).toContain('no_such_db');
    await app.close();
  });
});

describe('GET /api/schema/databases', () => {
  it('lists databases and names the current one', async () => {
    const { db } = createDbClient({ max: 1 });
    const app = buildApp({ db });
    const res = await app.inject({ method: 'GET', url: '/api/schema/databases' });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { databases: string[]; current: string };
    expect(body.databases).toContain('tickets_test');
    expect(body.current).toBe('tickets_test');
    await app.close();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @tickets/api test -- schema.routes`
Expected: FAIL — `/api/schema/databases` 404s, and `?database=no_such_db` returns 200 instead of 400.

- [ ] **Step 3: Implement**

Replace `apps/api/src/routes/schema.routes.ts`:

```ts
import type { FastifyInstance } from 'fastify';
import { environment, introspectDatabase, listDatabases, UnknownDatabaseError } from '@tickets/db';

// The schema graph is read from the LIVE database's catalog, not from the
// drizzle table objects — the screen's whole purpose is showing what is
// actually deployed, which the code-derived graph cannot report (it is
// identical for every database, and cannot see a pending migration).
// describeSchema() still exists for the SSOT conformance test in packages/db.
//
// No db context is used: introspection opens its own short-lived connection to
// the named database, which is by definition not the one the request handle is
// bound to.
export function registerSchemaRoutes(app: FastifyInstance) {
  app.get('/api/schema/databases', async () => ({
    databases: await listDatabases(),
    current: environment.postgres.database,
  }));

  app.get('/api/schema', async (request, reply) => {
    const requested = (request.query as { database?: string }).database;
    const name = requested && requested.length > 0 ? requested : environment.postgres.database;
    try {
      return await introspectDatabase(name);
    } catch (err) {
      // An unknown name is a client error, not a fault: it never reached a
      // connection. Anything else is a real failure and belongs to the
      // framework's error handler.
      if (err instanceof UnknownDatabaseError) {
        return reply.code(400).send({ error: `unknown database "${err.database}"` });
      }
      throw err;
    }
  });
}
```

If `environment` is not currently exported from `@tickets/db`, add `export { environment } from './environment';` to `packages/db/src/index.ts`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @tickets/api test -- schema.routes`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/schema.routes.ts apps/api/src/routes/schema.routes.test.ts packages/db/src/index.ts
git commit -m "feat(api): serve a live schema graph and list selectable databases"
```

---

### Task 10: Web data hooks and the `?database=` search param

**Files:**
- Create: `apps/web/src/api/use-schema.ts`
- Modify: `apps/web/src/routes/schema-route.tsx`
- Test: `apps/web/src/routes/schema-route.test.tsx`

**Interfaces:**
- Consumes: `fetchJson` from `../api/client`; `SchemaGraph` from `../components/schema/erd-types`.
- Produces:
  - `type DatabaseList = { databases: string[]; current: string }`
  - `useDatabases(): UseQueryResult<DatabaseList>`
  - `useSchemaGraph(database?: string): UseQueryResult<SchemaGraph>`
  - `schemaRoute` gains `validateSearch` producing `{ database?: string }`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/routes/schema-route.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { schemaRoute } from './schema-route';

describe('schemaRoute search params', () => {
  const validate = schemaRoute.options.validateSearch as (
    s: Record<string, unknown>,
  ) => { database?: string };

  it('keeps a database name', () => {
    expect(validate({ database: 'tickets_dev' })).toEqual({ database: 'tickets_dev' });
  });

  it('drops an empty database name', () => {
    expect(validate({ database: '' })).toEqual({});
  });

  it('drops a non-string database', () => {
    expect(validate({ database: 42 })).toEqual({});
  });

  it('drops unrelated params', () => {
    expect(validate({ other: 'x' })).toEqual({});
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @tickets/web test -- schema-route`
Expected: FAIL — `validateSearch` is undefined on the route options.

- [ ] **Step 3: Create the hooks**

Create `apps/web/src/api/use-schema.ts`:

```ts
import { useQuery } from '@tanstack/react-query';
import { fetchJson } from './client';
import type { SchemaGraph } from '../components/schema/erd-types';

/** GET /api/schema/databases */
export type DatabaseList = { databases: string[]; current: string };

export function useDatabases() {
  return useQuery({
    queryKey: ['schema', 'databases'],
    queryFn: () => fetchJson<DatabaseList>('/api/schema/databases'),
  });
}

/**
 * The live schema graph. `database` undefined means "the API's configured
 * database" — the param is omitted rather than sent empty, so the default is
 * decided in one place (the route) instead of two.
 */
export function useSchemaGraph(database?: string) {
  return useQuery({
    queryKey: ['schema', 'graph', database ?? null],
    queryFn: () =>
      fetchJson<SchemaGraph>(
        database ? `/api/schema?database=${encodeURIComponent(database)}` : '/api/schema',
      ),
  });
}
```

- [ ] **Step 4: Wire the route**

Replace `apps/web/src/routes/schema-route.tsx`:

```tsx
import { createRoute } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';
import { useSchemaGraph } from '../api/use-schema';
import { renderErd } from '../components/schema/erd-engine';
import '../components/schema/erd.css';
import { rootRoute } from './root-route';

export type SchemaSearch = { database?: string };

function SchemaPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { database } = schemaRoute.useSearch();
  const { data, isLoading, error } = useSchemaGraph(database);

  useEffect(() => {
    if (!data || !containerRef.current) return;
    const cleanup = renderErd(containerRef.current, data);
    return cleanup;
  }, [data]);

  return (
    <div className="h-screen overflow-auto bg-gray-1 text-gray-12">
      {isLoading && <p className="p-6 font-sans text-13 text-gray-11">Loading schema…</p>}
      {error && <p className="p-6 font-sans text-13 text-red-11">Failed to load schema.</p>}
      <div ref={containerRef} />
    </div>
  );
}

export const schemaRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/schema',
  // Only `database` survives, and only as a non-empty string: an empty value
  // must fall back to the API's configured database rather than being sent
  // through as `?database=`.
  validateSearch: (search: Record<string, unknown>): SchemaSearch =>
    typeof search.database === 'string' && search.database.length > 0
      ? { database: search.database }
      : {},
  component: SchemaPage,
});
```

The inline `style` props are replaced with Instrument utilities here because `apps/web/src` is scanned by `@tickets/ui`'s token ratchet — leaving raw `var(--color-gray-1)` style objects in a file this task rewrites would leave a fresh violation behind.

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @tickets/web test -- schema-route`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/api/use-schema.ts apps/web/src/routes/schema-route.tsx apps/web/src/routes/schema-route.test.tsx
git commit -m "feat(web): read the live schema graph, database chosen by search param"
```

---

### Task 11: The schema rail mode and database dropdown

**Files:**
- Create: `apps/web/src/components/shell/schema-panel.tsx`
- Create: `apps/web/src/components/shell/schema-panel.test.tsx`
- Modify: `apps/web/src/components/shell/mode-for-path.ts`
- Modify: `apps/web/src/components/shell/mode-for-path.test.ts`
- Modify: `apps/web/src/components/shell/activity-rail.tsx`
- Modify: `apps/web/src/components/shell/mode-panel.tsx`

**Interfaces:**
- Consumes: `useDatabases` (Task 10), `schemaRoute` search param (Task 10), `RailLabel`, `Dropdown`, `Button`, `cn` from `@tickets/ui`.
- Produces: `Mode` gains `'schema'`; `SchemaPanel({ onNavigate })`.

- [ ] **Step 1: Write the failing tests**

Add to `apps/web/src/components/shell/mode-for-path.test.ts`:

```ts
it('maps /schema to the schema mode', () => {
  expect(modeForPath('/schema')).toBe('schema');
});

it('maps a nested schema path to the schema mode', () => {
  expect(modeForPath('/schema/anything')).toBe('schema');
});
```

Create `apps/web/src/components/shell/schema-panel.test.tsx`:

```tsx
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SchemaPanel } from './schema-panel';

const mockNavigate = vi.fn();
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
  useNavigate: () => mockNavigate,
}));

const databases = vi.fn();
vi.mock('../../api/use-schema', () => ({ useDatabases: () => databases() }));

describe('SchemaPanel', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it('names the current database once loaded', () => {
    databases.mockReturnValue({
      data: { databases: ['tickets', 'tickets_dev'], current: 'tickets' },
      isLoading: false,
    });
    render(<SchemaPanel selected={undefined} />);
    expect(screen.getByRole('button', { name: /tickets/ })).toBeInTheDocument();
  });

  it('prefers the selected database over the current one', () => {
    databases.mockReturnValue({
      data: { databases: ['tickets', 'tickets_dev'], current: 'tickets' },
      isLoading: false,
    });
    render(<SchemaPanel selected="tickets_dev" />);
    expect(screen.getByRole('button', { name: /tickets_dev/ })).toBeInTheDocument();
  });

  it('renders nothing selectable while loading', () => {
    databases.mockReturnValue({ data: undefined, isLoading: true });
    render(<SchemaPanel selected={undefined} />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @tickets/web test -- mode-for-path schema-panel`
Expected: FAIL — `modeForPath('/schema')` returns `'tasks'`; `./schema-panel` does not exist.

- [ ] **Step 3: Add the mode**

In `apps/web/src/components/shell/mode-for-path.ts`:

```ts
export type Mode = 'tasks' | 'terminals' | 'agents' | 'signals' | 'schema';

export function modeForPath(pathname: string): Mode | null {
  if (pathname.startsWith('/terminals')) return 'terminals';
  if (pathname.startsWith('/agents')) return 'agents';
  if (pathname.startsWith('/signals')) return 'signals';
  if (pathname.startsWith('/schema')) return 'schema';
  return 'tasks';
}
```

- [ ] **Step 4: Build the panel**

Create `apps/web/src/components/shell/schema-panel.tsx`:

```tsx
import { useNavigate } from '@tanstack/react-router';
import { Button, Dropdown, RailLabel, cn } from '@tickets/ui';
import { useDatabases } from '../../api/use-schema';

function optionClasses(active: boolean) {
  return cn(
    'flex h-8 w-full items-center rounded-lg px-2.25 text-left font-sans text-13/19',
    active ? 'bg-surface-inset font-500 text-gray-12' : 'text-gray-11 hover:bg-surface-inset hover:text-gray-12',
  );
}

/**
 * The "schema" mode panel: which database the diagram introspects.
 *
 * The panel picks a DATA SOURCE; the diagram renders whatever graph results.
 * That split is deliberate — it is what lets the renderer stay a pure function
 * of its input, and it is why this control lives in the shell rather than in
 * the diagram's own toolbar.
 *
 * Selection lives in the route's `?database=` search param, so a chosen
 * database is shareable and survives a reload. `selected` is passed in rather
 * than read here so this component stays renderable outside a router match.
 */
export function SchemaPanel({
  selected,
  onNavigate,
}: {
  selected: string | undefined;
  onNavigate?: () => void;
}) {
  const navigate = useNavigate();
  const { data, isLoading } = useDatabases();
  const active = selected ?? data?.current;

  const choose = (name: string) => {
    onNavigate?.();
    // The default database is expressed by ABSENCE of the param, never by
    // writing it out — otherwise the "default" URL and the explicit one differ
    // while meaning the same thing.
    navigate({
      to: '/schema',
      search: name === data?.current ? {} : { database: name },
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between px-1 pb-2">
        <RailLabel>SCHEMA</RailLabel>
      </div>
      {isLoading || !data ? null : (
        <Dropdown
          align="start"
          padding="sm"
          trigger={
            <Button variant="ghost" className="w-full justify-between font-mono text-12">
              {active ?? ''}
            </Button>
          }
        >
          {(close) => (
            <div className="flex w-44 flex-col gap-0.5">
              {data.databases.map((name) => (
                <button
                  key={name}
                  type="button"
                  className={optionClasses(name === active)}
                  onClick={() => {
                    choose(name);
                    close();
                  }}
                >
                  <span className="truncate font-mono text-12">{name}</span>
                </button>
              ))}
            </div>
          )}
        </Dropdown>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Wire it into the rail and the panel switch**

In `apps/web/src/components/shell/activity-rail.tsx`, extend the `ITEMS` type and array:

```tsx
const ITEMS: {
  mode: Mode;
  to: '/' | '/terminals' | '/agents' | '/signals' | '/schema';
  glyph: string;
  label: string;
}[] = [
  { mode: 'tasks', to: '/', glyph: '▦', label: 'Tasks' },
  { mode: 'terminals', to: '/terminals', glyph: '▷_', label: 'Terminals' },
  { mode: 'agents', to: '/agents', glyph: '✳', label: 'Agents' },
  { mode: 'signals', to: '/signals', glyph: '∿', label: 'Signals' },
  { mode: 'schema', to: '/schema', glyph: '⌗', label: 'Schema' },
];
```

In `apps/web/src/components/shell/mode-panel.tsx`, import `SchemaPanel`, accept a `schemaDatabase?: string` prop, and add the branch before the `tasks` one:

```tsx
) : mode === 'schema' ? (
  <SchemaPanel selected={schemaDatabase} onNavigate={onNavigate} />
) : mode === 'tasks' ? (
```

In `apps/web/src/components/shell/app-shell.tsx`, read the current `?database=` value and pass it to `ModePanel` as `schemaDatabase`. Use `useRouterState` — the same hook the file already uses on line 18 for `pathname` — rather than `schemaRoute.useSearch()`, which throws when the active route is not `/schema`:

```tsx
// Alongside the existing `pathname` selector.
const search = useRouterState({ select: (s) => s.location.search as { database?: string } });
// ...
<ModePanel ... schemaDatabase={search.database} />
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm --filter @tickets/web test -- mode-for-path schema-panel`
Expected: PASS (5 tests).

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/shell/
git commit -m "feat(web): schema rail mode with a database dropdown"
```

---

### Task 12: Full verification

**Files:** none created; this task proves the whole phase.

- [ ] **Step 1: Run every suite**

```bash
pnpm --filter @tickets/db test
pnpm --filter @tickets/api test
pnpm --filter @tickets/web test
```
Expected: all PASS. `model-conformance.test.ts` passing proves `describeSchema()` still behaves exactly as before.

- [ ] **Step 2: Typecheck and build**

```bash
pnpm typecheck
pnpm build
```
Expected: both clean.

- [ ] **Step 3: Token ratchet**

Run: `pnpm verify:tokens`
Expected: PASS. `schema-route.tsx` lost its raw `style` props in Task 10; if the ratchet reports a fresh hit in a file this phase touched, fix the class rather than baselining it.

- [ ] **Step 4: Drive it in a browser**

Start the stack (see the `running-the-stack` skill for ports and startup order), then:

1. Open `/schema`. Tables, columns, PK/FK badges, group boxes and edges render. **Ignore colour** — see "Known pre-existing breakage".
2. The rail shows a Schema item; clicking it lands on `/schema` and lights the icon.
3. The panel names the current database.
4. Pick another database. The diagram re-renders with that database's tables, and the URL gains `?database=<name>`.
5. Reload with `?database=` present. The same database stays selected.
6. Pick the default database again. The `?database=` param disappears from the URL.
7. Hand-edit the URL to `?database=no_such_db`. The screen shows "Failed to load schema." rather than hanging or crashing.

- [ ] **Step 5: Confirm the point of the whole phase**

Compare `/schema?database=tickets` against `/schema?database=tickets_dev`. **They must be able to differ.** If a migration is applied to one and not the other, the diagrams differ — that difference is the capability this phase exists to deliver, and it was impossible before.

- [ ] **Step 6: Commit any fixes**

```bash
git add -A
git commit -m "fix(web): address verification findings"
```

---

## Self-Review

**Spec coverage.** Every Phase 1 requirement maps to a task: `pg_catalog` reading over `information_schema` (Tasks 4–6, with the source table in the spec honoured — `format_type`, `pg_constraint`, `pg_index`+`pg_am`+`pg_get_expr`, `pg_enum` by `enumsortorder`); hybrid grouping via `resolveGroupKey`'s logic with namespace fallback (Tasks 1, 7); `describeSchema()` untouched and still driving conformance (Tasks 1, 8 Step 6); both routes with the enumerated-set validation, configured credentials, read-only access and per-request connections (Tasks 2, 3, 9); hue names not hex (Task 7); rail mode, panel-not-toolbar placement, and `?database=` with absence meaning default (Tasks 10, 11).

**Deliberately deferred to Phase 2**, all named in the spec as such: the eer module move, the token sweep, the round-trip tooling relocation, deleting `apps/eer` and the legacy renderer, and the `--ins-opt-*` colour breakage.

**Placeholders.** None. Every code step carries the actual code; every test step carries the actual assertions; every run step names the command and the expected result.

**Type consistency.** `RawTable`/`RawColumn` (Task 4) are consumed under those names by Tasks 5, 6 and 8. `RawConstraints`/`RawFk` (Task 5) are consumed by Task 8. `findGroupKey` (Task 1) is used by Task 7 with the identical three-argument signature. `UnknownDatabaseError` (Task 2) is thrown by Task 3, asserted in Task 8, and caught in Task 9. `DatabaseList` (Task 10) is the shape Task 9's route returns and Task 11's panel reads (`data.databases`, `data.current`). `SchemaGraph`, `TableMeta`, `ColumnMeta`, `UniqueMeta`, `CheckMeta`, `IndexMeta`, `GroupMeta` and `EnumMeta` are imported from `describe-schema.ts` throughout rather than redeclared.

**One correction found and fixed during review:** Task 4's Files block originally carried a typo'd test path (`packages teps/db/...`); the correct path is stated inline.

**Verified before handoff, so the implementer does not have to discover it:**

- Task 9 changes `/api/schema` from a route needing no live database to one that requires postgres. The api suite already targets a live `tickets_test` (`apps/api/src/test/setup-env.ts`, `fileParallelism: false`), and other route tests already read and write data, so this is safe. Should postgres nonetheless be unavailable, that is a real blocker to raise — never a reason to weaken the assertions.
- `Button`, `Dropdown` and `RailLabel` are all exported from `@tickets/ui` (`components/index.ts`).
- `app-shell.tsx` already reads router state via `useRouterState`; Task 11 extends that rather than introducing a second hook.
