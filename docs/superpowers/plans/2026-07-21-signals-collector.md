# Signals Collector (apps/signals) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the standalone Signals collector server — ingest API, fingerprint grouping into issues, symbolication, and the management API the future web UI will consume.

**Architecture:** A new `apps/signals` Fastify app modeled on `apps/api` conventions (buildApp + injectables, HttpError, valibot validation, vitest + `app.inject`), with its own drizzle schema/migrations against a dedicated `signals` database in the existing postgres container. Zero imports from ticket modules or `@tickets/db`.

**Tech Stack:** Fastify 5, drizzle-orm + postgres-js, valibot, vitest, `@jridgewell/trace-mapping` (symbolication).

This is **Plan 1 of 3** for the Signals initiative (spec: `docs/superpowers/specs/2026-07-18-signals-error-collector-design.md`). Plan 2 = SDK packages, Plan 3 = web UI + deploy wiring. `GET /sdk.js` and docker/nginx changes are deliberately NOT here — they land with plans 2 and 3.

## Global Constraints

- Port **4640** (4630 is taken by the eer dev server). Host default `127.0.0.1`.
- Databases: `signals` (dev/prod), `signals_test` (tests) — in the existing postgres container at `127.0.0.1:5532`.
- DSN format: `sgl://<ingestKey>@<host>:<port>/<appId>`; ingest keys look like `pub_<12 hex>`.
- Levels: exactly `'error' | 'warning' | 'info'`. Kinds: exactly `'error' | 'log' | 'event'`. Mechanisms: `'uncaught-exception' | 'unhandled-rejection' | 'error-boundary' | 'middleware' | 'console' | 'manual'`.
- Issue keys are rendered `SGL-<id>` from the bigserial id — no separate key column.
- Ingest limits: max 64 signals per envelope, per-key rate limit 300 signals/min → 429, oversize payloads truncated server-side.
- Zero imports from `@tickets/db` or any `apps/api` module. The app must typecheck with `pnpm --filter @tickets/signals typecheck` and pass `pnpm --filter @tickets/signals test`.
- All timestamps `timestamp with time zone`.
- Commits: conventional, scoped `feat(signals): …`, one commit per task, **always pathspec-scoped** (`git commit -m "…" -- apps/signals`) because unrelated work may be staged in this checkout.

---

### Task 1: Scaffold apps/signals with health route and test infra

**Files:**
- Create: `apps/signals/package.json`
- Create: `apps/signals/tsconfig.json`
- Create: `apps/signals/vitest.config.ts`
- Create: `apps/signals/src/environment.ts`
- Create: `apps/signals/src/errors.ts`
- Create: `apps/signals/src/app.ts`
- Create: `apps/signals/src/server.ts`
- Create: `apps/signals/scripts/create-databases.ts`
- Create: `apps/signals/src/test/setup-env.ts`
- Test: `apps/signals/src/app.test.ts`

**Interfaces:**
- Produces: `buildApp(ctx: { db: Db })` returning a Fastify instance; `environment` object; `HttpError(statusCode, message)`; databases `signals` + `signals_test` existing on the shared postgres.

- [ ] **Step 1: Create package.json, tsconfig, vitest config**

`apps/signals/package.json`:

```json
{
  "name": "@tickets/signals",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "start": "tsx src/server.ts",
    "typecheck": "tsc -p tsconfig.json",
    "test": "vitest run",
    "db:create": "tsx scripts/create-databases.ts",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "tsx src/db/migrate.ts"
  },
  "dependencies": {
    "@jridgewell/trace-mapping": "^0.3.31",
    "drizzle-orm": "^0.45.2",
    "fastify": "^5.8.5",
    "postgres": "^3.4.9",
    "valibot": "^1.4.1"
  },
  "devDependencies": {
    "@types/node": "^25.6.0",
    "drizzle-kit": "^0.31.0",
    "tsx": "^4.21.0",
    "typescript": "^6.0.3",
    "vitest": "^4.1.10"
  }
}
```

(Version floors copied from `apps/api/package.json` / `packages/db/package.json`; run `pnpm install` from the repo root after creating the file. `drizzle-kit` version: match whatever `packages/db/package.json` pins.)

`apps/signals/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "types": ["node"]
  },
  "include": ["src", "scripts", "drizzle.config.ts"]
}
```

`apps/signals/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['./src/test/setup-env.ts'],
    fileParallelism: false,
  },
});
```

`apps/signals/src/test/setup-env.ts`:

```ts
// Runs before any test file loads, so environment.ts (which reads
// process.env at module load) always targets signals_test regardless of
// how the test command was invoked.
process.env.SIGNALS_DATABASE = 'signals_test';
```

- [ ] **Step 2: Write environment.ts and errors.ts**

`apps/signals/src/environment.ts` (walk-up .env pattern copied from `packages/db/src/environment.ts` — the workspace `.env` supplies POSTGRES_HOST/PORT for dev):

```ts
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

// The only place in the app that reads process.env.
function findEnvFile(): string | null {
  let current = resolve(process.cwd());
  for (let depth = 0; depth < 5; depth++) {
    const candidate = join(current, '.env');
    if (existsSync(candidate)) return candidate;
    const parent = dirname(current);
    if (parent === current) return null;
    current = parent;
  }
  return null;
}

const envFile = findEnvFile();
if (envFile) {
  process.loadEnvFile(envFile);
}

export const environment = {
  port: Number(process.env.SIGNALS_PORT ?? 4640),
  // 127.0.0.1 for local dev; containers set SIGNALS_HOST=0.0.0.0
  host: process.env.SIGNALS_HOST ?? '127.0.0.1',
  // host:port advertised inside DSNs returned by the management API
  publicAddress: process.env.SIGNALS_PUBLIC_ADDRESS ?? '127.0.0.1:4640',
  postgres: {
    host: process.env.POSTGRES_HOST ?? 'localhost',
    port: Number(process.env.POSTGRES_PORT ?? 5432),
    user: process.env.POSTGRES_USER ?? 'postgres',
    password: process.env.POSTGRES_PASSWORD ?? 'postgres',
    // deliberately NOT POSTGRES_DATABASE — signals owns its own database
    // and must not follow the tickets/tickets_dev switch
    database: process.env.SIGNALS_DATABASE ?? 'signals',
  },
};

const { host, port, user, password, database } = environment.postgres;
export const connectionUrl = `postgres://${user}:${password}@${host}:${port}/${database}`;
```

`apps/signals/src/errors.ts`:

```ts
export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
  }
}
```

- [ ] **Step 3: Write the create-databases script and run it**

`apps/signals/scripts/create-databases.ts`:

```ts
import postgres from 'postgres';
import { environment } from '../src/environment';

// Connects to the maintenance db and creates signals + signals_test if missing.
const { host, port, user, password } = environment.postgres;
const sql = postgres(`postgres://${user}:${password}@${host}:${port}/postgres`, { max: 1 });

for (const name of ['signals', 'signals_test']) {
  const [exists] = await sql`SELECT 1 FROM pg_database WHERE datname = ${name}`;
  if (!exists) {
    await sql.unsafe(`CREATE DATABASE "${name}"`);
    console.log(`created database ${name}`);
  } else {
    console.log(`database ${name} already exists`);
  }
}
await sql.end();
```

Run: `pnpm install` (repo root), then `pnpm --filter @tickets/signals db:create`
Expected output: `created database signals` and `created database signals_test` (or "already exists" on re-run).

- [ ] **Step 4: Write the failing app test**

`apps/signals/src/app.test.ts`:

```ts
import { expect, it } from 'vitest';
import { buildApp } from './app';

it('GET /health returns ok without a db', async () => {
  const app = buildApp({ db: null as never });
  const res = await app.inject({ method: 'GET', url: '/health' });
  expect(res.statusCode).toBe(200);
  expect(res.json()).toEqual({ ok: true });
  await app.close();
});
```

- [ ] **Step 5: Run test to verify it fails**

Run: `pnpm --filter @tickets/signals test`
Expected: FAIL — cannot resolve `./app`.

- [ ] **Step 6: Write app.ts and server.ts**

`apps/signals/src/app.ts`:

```ts
import fastify from 'fastify';
import type { Db } from './db/client';
import { HttpError } from './errors';

export function buildApp(context: { db: Db }) {
  const app = fastify({ logger: false });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof HttpError) {
      reply.status(error.statusCode).send({ error: error.message });
      return;
    }
    console.error(error);
    reply.status(500).send({ error: 'internal error' });
  });

  app.get('/health', async () => ({ ok: true }));

  return app;
}
```

For this task only, create a stub `apps/signals/src/db/client.ts` (replaced by the real one in Task 2):

```ts
export type Db = unknown;
```

`apps/signals/src/server.ts`:

```ts
import { buildApp } from './app';
import { createDbClient } from './db/client';
import { environment } from './environment';

const { db } = createDbClient();
const app = buildApp({ db });

const shutdown = async () => {
  await app.close();
  process.exit(0);
};
process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());

await app.listen({ port: environment.port, host: environment.host });
console.log(`signals collector listening on http://${environment.host}:${environment.port}`);
```

(`server.ts` will not typecheck against the stub client — that is resolved in Task 2 when `createDbClient` becomes real. To keep this task green, have the stub also export `export function createDbClient(): { db: Db } { throw new Error('db client lands in task 2'); }`.)

- [ ] **Step 7: Run test to verify it passes**

Run: `pnpm --filter @tickets/signals test` → PASS.
Run: `pnpm --filter @tickets/signals typecheck` → clean.

- [ ] **Step 8: Commit**

```bash
git add apps/signals pnpm-lock.yaml
git commit -m "feat(signals): scaffold collector app (fastify, env, health, test infra)" -- apps/signals pnpm-lock.yaml
```

---

### Task 2: Drizzle schema, migration, real db client, test reset helper

**Files:**
- Create: `apps/signals/drizzle.config.ts`
- Create: `apps/signals/src/db/schema.ts`
- Modify: `apps/signals/src/db/client.ts` (replace stub)
- Create: `apps/signals/src/db/migrate.ts`
- Create: `apps/signals/src/types.ts`
- Create: `apps/signals/src/test/db.ts`
- Test: `apps/signals/src/db/schema.test.ts`

**Interfaces:**
- Produces: tables `apps`, `signals`, `issues`, `sourcemapArtifacts` (drizzle objects, same names exported from `./db/schema`); `createDbClient()` → `{ db, sql }`; `Db` type; `resetDb()` + `testDb` from `./test/db`; payload types `SignalPayload`, `StackFrame`, `Breadcrumb` from `./types`.

- [ ] **Step 1: Write types.ts (wire + payload types, from the spec's Types section)**

`apps/signals/src/types.ts`:

```ts
export type SignalKind = 'error' | 'log' | 'event';
export type SignalLevel = 'error' | 'warning' | 'info';
export type Mechanism =
  | 'uncaught-exception'
  | 'unhandled-rejection'
  | 'error-boundary'
  | 'middleware'
  | 'console'
  | 'manual';
export type IssueStatus = 'open' | 'resolved' | 'ignored';

export interface StackFrame {
  functionName: string;
  file: string;
  line: number;
  column: number;
  inApp: boolean;
}

export interface SymbolicatedFrame extends StackFrame {
  // ±2 lines of original source around `line`, when the map carries sourcesContent
  contextLines?: { line: number; text: string }[];
}

export interface Breadcrumb {
  type: 'console' | 'click' | 'navigation' | 'http' | 'custom';
  timestamp: string;
  message?: string;
  data?: Record<string, unknown>;
}

export interface PlatformInfo {
  runtime: 'browser' | 'node';
  os?: string;
  browser?: string;
  url?: string;
  nodeVersion?: string;
  hostname?: string;
  pid?: number;
}

// What lands in signals.payload (jsonb)
export interface SignalPayload {
  stack?: StackFrame[];
  stackSymbolicated?: SymbolicatedFrame[];
  breadcrumbs?: Breadcrumb[];
  user?: { id?: string; email?: string; name?: string };
  tags?: Record<string, string>;
  contexts?: Record<string, Record<string, unknown>>;
  platform: PlatformInfo;
  sdk: { name: string; version: string };
  truncated?: boolean;
}
```

- [ ] **Step 2: Write the schema**

`apps/signals/src/db/schema.ts`:

```ts
import {
  bigint, bigserial, index, integer, jsonb, pgTable, serial, text, timestamp, uniqueIndex,
} from 'drizzle-orm/pg-core';
import type { SignalPayload } from '../types';

export const apps = pgTable('apps', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  ingestKey: text('ingest_key').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const issues = pgTable(
  'issues',
  {
    // rendered "SGL-<id>" in API responses and the UI
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    appId: integer('app_id').notNull().references(() => apps.id),
    fingerprint: text('fingerprint').notNull(),
    title: text('title').notNull(),
    culprit: text('culprit'),
    status: text('status', { enum: ['open', 'resolved', 'ignored'] }).notNull().default('open'),
    firstSeen: timestamp('first_seen', { withTimezone: true }).notNull().defaultNow(),
    lastSeen: timestamp('last_seen', { withTimezone: true }).notNull().defaultNow(),
    eventCount: bigint('event_count', { mode: 'number' }).notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('issues_app_fingerprint').on(t.appId, t.fingerprint)],
);

export const signals = pgTable(
  'signals',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    appId: integer('app_id').notNull().references(() => apps.id),
    kind: text('kind', { enum: ['error', 'log', 'event'] }).notNull(),
    sessionId: text('session_id').notNull(),
    name: text('name').notNull(),
    message: text('message'),
    mechanism: text('mechanism').notNull(),
    level: text('level', { enum: ['error', 'warning', 'info'] }).notNull(),
    clientTimestamp: timestamp('client_timestamp', { withTimezone: true }).notNull(),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
    release: text('release'),
    environment: text('environment'),
    issueId: bigint('issue_id', { mode: 'number' }).references(() => issues.id),
    payload: jsonb('payload').notNull().$type<SignalPayload>(),
  },
  (t) => [
    index('signals_session').on(t.sessionId),
    index('signals_issue').on(t.issueId),
    index('signals_app_received').on(t.appId, t.receivedAt),
  ],
);

export const sourcemapArtifacts = pgTable(
  'sourcemap_artifacts',
  {
    id: serial('id').primaryKey(),
    appId: integer('app_id').notNull().references(() => apps.id),
    release: text('release').notNull(),
    filename: text('filename').notNull(),
    // raw JSON text of the .map file
    content: text('content').notNull(),
    uploadedAt: timestamp('uploaded_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('sourcemaps_app_release').on(t.appId, t.release)],
);
```

- [ ] **Step 3: Write client, drizzle config, migrate script**

`apps/signals/src/db/client.ts` (replaces the Task 1 stub):

```ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { connectionUrl } from '../environment';
import * as schema from './schema';

export function createDbClient({ max = 10 }: { max?: number } = {}) {
  const sql = postgres(connectionUrl, { max });
  const db = drizzle(sql, { schema });
  return { db, sql };
}

export type DbClient = ReturnType<typeof createDbClient>;
export type Db = DbClient['db'];
```

`apps/signals/drizzle.config.ts`:

```ts
import { defineConfig } from 'drizzle-kit';
import { connectionUrl } from './src/environment';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: connectionUrl },
});
```

`apps/signals/src/db/migrate.ts`:

```ts
import { resolve } from 'node:path';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { createDbClient } from './client';

const { db, sql } = createDbClient({ max: 1 });
await migrate(db, { migrationsFolder: resolve(import.meta.dirname, '../../drizzle') });
await sql.end();
console.log('signals migrations applied');
```

- [ ] **Step 4: Generate the migration and apply it to both databases**

```bash
pnpm --filter @tickets/signals db:generate
pnpm --filter @tickets/signals db:migrate
SIGNALS_DATABASE=signals_test pnpm --filter @tickets/signals db:migrate
```

(On PowerShell: `$env:SIGNALS_DATABASE='signals_test'; pnpm --filter @tickets/signals db:migrate; Remove-Item Env:SIGNALS_DATABASE`.)
Expected: a new folder `apps/signals/drizzle/0000_*.sql` and "signals migrations applied" twice.

- [ ] **Step 5: Write test/db.ts and the failing roundtrip test**

`apps/signals/src/test/db.ts`:

```ts
import { createDbClient } from '../db/client';
import type { Db } from '../db/client';

if (process.env.SIGNALS_DATABASE !== 'signals_test') {
  throw new Error(
    `signals tests must run against signals_test, not "${process.env.SIGNALS_DATABASE}". ` +
      'Set SIGNALS_DATABASE=signals_test.',
  );
}

const client = createDbClient({ max: 1 });
export const testDb: Db = client.db;

// Child-first so TRUNCATE ... CASCADE resets cleanly.
const TABLES = ['signals', 'sourcemap_artifacts', 'issues', 'apps'];

export async function resetDb(): Promise<void> {
  await client.sql.unsafe(
    `TRUNCATE ${TABLES.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`,
  );
}
```

`apps/signals/src/db/schema.test.ts`:

```ts
import { afterAll, beforeEach, expect, it } from 'vitest';
import { resetDb, testDb } from '../test/db';
import { apps, issues, signals } from './schema';

beforeEach(resetDb);
afterAll(resetDb);

it('inserts an app, an issue, and a signal referencing both', async () => {
  const [appRow] = await testDb
    .insert(apps)
    .values({ name: 'Storefront', slug: 'storefront-web', ingestKey: 'pub_0123456789ab' })
    .returning();
  const [issueRow] = await testDb
    .insert(issues)
    .values({ appId: appRow!.id, fingerprint: 'fp1', title: 'TypeError — boom' })
    .returning();
  const [signalRow] = await testDb
    .insert(signals)
    .values({
      appId: appRow!.id,
      kind: 'error',
      sessionId: 'sess_1',
      name: 'TypeError',
      message: 'boom',
      mechanism: 'manual',
      level: 'error',
      clientTimestamp: new Date(),
      issueId: issueRow!.id,
      payload: { platform: { runtime: 'node' }, sdk: { name: 'test', version: '0.0.0' } },
    })
    .returning();
  expect(signalRow!.issueId).toBe(issueRow!.id);
  expect(issueRow!.status).toBe('open');
  expect(issueRow!.eventCount).toBe(1);
});
```

- [ ] **Step 6: Run tests**

Run: `pnpm --filter @tickets/signals test`
Expected: both test files PASS (health test still green). If the roundtrip test fails with a missing-table error, the `signals_test` migration in Step 4 didn't run — repeat it.

- [ ] **Step 7: Commit**

```bash
git add apps/signals
git commit -m "feat(signals): db schema (apps/signals/issues/sourcemaps), client, migrations, test reset" -- apps/signals
```

---

### Task 3: Fingerprinting module

**Files:**
- Create: `apps/signals/src/fingerprint.ts`
- Test: `apps/signals/src/fingerprint.test.ts`

**Interfaces:**
- Consumes: `StackFrame` from `./types`.
- Produces: `normalizeMessage(message: string): string`, `fingerprintError(input: { name: string; message?: string; stack?: StackFrame[]; explicit?: string }): string`, `culpritFrom(stack?: StackFrame[]): string | null`, `issueTitle(name: string, message?: string): string`.

- [ ] **Step 1: Write failing table-driven tests**

`apps/signals/src/fingerprint.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { culpritFrom, fingerprintError, issueTitle, normalizeMessage } from './fingerprint';
import type { StackFrame } from './types';

describe('normalizeMessage', () => {
  it.each([
    ['timeout of 5000ms exceeded', 'timeout of <n>ms exceeded'],
    ['user 550e8400-e29b-41d4-a716-446655440000 not found', 'user <uuid> not found'],
    ['bad address 0x7fff5fbff8c0', 'bad address <hex>'],
    ['chunk deadbeefcafe failed', 'chunk <hash> failed'],
    ['no digits here', 'no digits here'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeMessage(input)).toBe(expected);
  });
});

const frame = (functionName: string, file: string, inApp = true): StackFrame => ({
  functionName, file, line: 10, column: 5, inApp,
});

describe('fingerprintError', () => {
  it('is stable across differing line numbers and message numerals', () => {
    const a = fingerprintError({ name: 'TypeError', message: 'x is 5', stack: [{ ...frame('f', 'src/a.ts'), line: 10 }] });
    const b = fingerprintError({ name: 'TypeError', message: 'x is 9', stack: [{ ...frame('f', 'src/a.ts'), line: 99 }] });
    expect(a).toBe(b);
  });

  it('differs when the error type differs', () => {
    expect(fingerprintError({ name: 'TypeError', message: 'boom' }))
      .not.toBe(fingerprintError({ name: 'RangeError', message: 'boom' }));
  });

  it('uses only the top 5 in-app frames', () => {
    const inApp = Array.from({ length: 5 }, (_, i) => frame(`f${i}`, `src/${i}.ts`));
    const a = fingerprintError({ name: 'E', stack: [...inApp, frame('deep', 'src/deep.ts')] });
    const b = fingerprintError({ name: 'E', stack: [...inApp, frame('other', 'src/other.ts')] });
    expect(a).toBe(b);
  });

  it('ignores vendor frames', () => {
    const a = fingerprintError({ name: 'E', stack: [frame('f', 'src/a.ts'), frame('v', 'node_modules/x.js', false)] });
    const b = fingerprintError({ name: 'E', stack: [frame('f', 'src/a.ts'), frame('w', 'node_modules/y.js', false)] });
    expect(a).toBe(b);
  });

  it('honors an explicit fingerprint override', () => {
    expect(fingerprintError({ name: 'E', explicit: 'my-group' })).toBe('my-group');
  });
});

describe('culpritFrom', () => {
  it('prefers the top in-app frame', () => {
    expect(culpritFrom([frame('v', 'node_modules/x.js', false), frame('f', 'src/checkout/CartList.tsx')]))
      .toBe('src/checkout/CartList.tsx:10');
  });
  it('falls back to the top frame, and null without a stack', () => {
    expect(culpritFrom([frame('v', '/assets/index.js', false)])).toBe('/assets/index.js:10');
    expect(culpritFrom(undefined)).toBeNull();
  });
});

describe('issueTitle', () => {
  it('joins name and message, capping length', () => {
    expect(issueTitle('TypeError', 'boom')).toBe('TypeError — boom');
    expect(issueTitle('TypeError', undefined)).toBe('TypeError');
    expect(issueTitle('E', 'x'.repeat(500)).length).toBeLessThanOrEqual(203);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @tickets/signals test -- fingerprint`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`apps/signals/src/fingerprint.ts`:

```ts
import { createHash } from 'node:crypto';
import type { StackFrame } from './types';

// Order matters: uuid → 0x-hex → long hex tokens → remaining digit runs.
export function normalizeMessage(message: string): string {
  return message
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<uuid>')
    .replace(/\b0x[0-9a-f]+\b/gi, '<hex>')
    .replace(/\b[0-9a-f]*[0-9][0-9a-f]{6,}\b|\b[0-9a-f]{7,}\b/gi, '<hash>')
    .replace(/\d+/g, '<n>');
}

export function fingerprintError(input: {
  name: string;
  message?: string;
  stack?: StackFrame[];
  explicit?: string;
}): string {
  if (input.explicit) return input.explicit;
  const frames = (input.stack ?? [])
    .filter((f) => f.inApp)
    .slice(0, 5)
    .map((f) => `${f.functionName}@${f.file}`);
  const basis = [input.name, normalizeMessage(input.message ?? ''), ...frames].join('\n');
  return createHash('sha256').update(basis).digest('hex').slice(0, 32);
}

export function culpritFrom(stack?: StackFrame[]): string | null {
  const top = stack?.find((f) => f.inApp) ?? stack?.[0];
  return top ? `${top.file}:${top.line}` : null;
}

export function issueTitle(name: string, message?: string): string {
  const title = message ? `${name} — ${message}` : name;
  return title.length > 200 ? `${title.slice(0, 200)}…` : title;
}
```

Note on the `<hash>` regex: plain-word hex like `deadbeefcafe` (no digit) is caught by the second alternative (`{7,}` all-hex). The first alternative requires at least one digit so ordinary long words are untouched.

- [ ] **Step 4: Run tests** → all fingerprint tests PASS. If the `deadbeefcafe` case fails, adjust the regex until the whole table passes — the table is the contract.

- [ ] **Step 5: Commit**

```bash
git add apps/signals/src/fingerprint.ts apps/signals/src/fingerprint.test.ts
git commit -m "feat(signals): message normalization + error fingerprinting + culprit/title helpers" -- apps/signals
```

---

### Task 4: Rate limiter

**Files:**
- Create: `apps/signals/src/rate-limit.ts`
- Test: `apps/signals/src/rate-limit.test.ts`

**Interfaces:**
- Produces: `createRateLimiter(opts?: { limit?: number; windowMs?: number; now?: () => number }): RateLimiter` where `RateLimiter = { allow(key: string, weight?: number): boolean }`. Default limit 300 per 60_000 ms. `weight` is the envelope's signal count.

- [ ] **Step 1: Write failing tests**

`apps/signals/src/rate-limit.test.ts`:

```ts
import { expect, it } from 'vitest';
import { createRateLimiter } from './rate-limit';

it('allows up to the limit within a window, then refuses', () => {
  let t = 0;
  const rl = createRateLimiter({ limit: 3, windowMs: 1000, now: () => t });
  expect(rl.allow('k')).toBe(true);
  expect(rl.allow('k')).toBe(true);
  expect(rl.allow('k')).toBe(true);
  expect(rl.allow('k')).toBe(false);
  t = 1000; // new window
  expect(rl.allow('k')).toBe(true);
});

it('weights batches and isolates keys', () => {
  let t = 0;
  const rl = createRateLimiter({ limit: 10, windowMs: 1000, now: () => t });
  expect(rl.allow('a', 10)).toBe(true);
  expect(rl.allow('a', 1)).toBe(false);
  expect(rl.allow('b', 1)).toBe(true);
});
```

- [ ] **Step 2: Run to verify failure** → module not found.

- [ ] **Step 3: Implement**

`apps/signals/src/rate-limit.ts`:

```ts
export interface RateLimiter {
  allow(key: string, weight?: number): boolean;
}

// Fixed-window counter per ingest key. In-memory is fine: single-process
// collector, and 429 is advisory back-pressure, not a security boundary.
export function createRateLimiter({
  limit = 300,
  windowMs = 60_000,
  now = Date.now,
}: { limit?: number; windowMs?: number; now?: () => number } = {}): RateLimiter {
  const windows = new Map<string, { start: number; count: number }>();
  return {
    allow(key, weight = 1) {
      const t = now();
      const w = windows.get(key);
      if (!w || t - w.start >= windowMs) {
        windows.set(key, { start: t, count: weight });
        return weight <= limit;
      }
      w.count += weight;
      return w.count <= limit;
    },
  };
}
```

- [ ] **Step 4: Run tests** → PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/signals/src/rate-limit.ts apps/signals/src/rate-limit.test.ts
git commit -m "feat(signals): per-key fixed-window rate limiter" -- apps/signals
```

---

### Task 5: Apps management routes + DSN

**Files:**
- Create: `apps/signals/src/dsn.ts`
- Create: `apps/signals/src/routes/apps.routes.ts`
- Modify: `apps/signals/src/app.ts` (register route, accept real Db)
- Test: `apps/signals/src/routes/apps.routes.test.ts`

**Interfaces:**
- Consumes: `apps`, `signals` tables; `environment.publicAddress`.
- Produces: `composeDsn(ingestKey: string, appId: number): string`; routes `POST /apps` (`{ name }` → 201 `{ id, name, slug, ingestKey, dsn, createdAt }`), `GET /apps` (array of `{ id, name, slug, createdAt, signals24h, errors24h }`), `GET /apps/:id` (single, with `dsn`), `GET /meta` (`{ dbSizeBytes }`). `registerAppsRoutes(app, { db })`.

- [ ] **Step 1: Write failing tests**

`apps/signals/src/routes/apps.routes.test.ts`:

```ts
import { afterAll, beforeEach, expect, it } from 'vitest';
import { buildApp } from '../app';
import { resetDb, testDb } from '../test/db';

beforeEach(resetDb);
afterAll(resetDb);

it('POST /apps creates an app with slug, pub_ key, and sgl:// DSN', async () => {
  const app = buildApp({ db: testDb });
  const res = await app.inject({ method: 'POST', url: '/apps', payload: { name: 'Storefront Web' } });
  expect(res.statusCode).toBe(201);
  const body = res.json();
  expect(body.slug).toBe('storefront-web');
  expect(body.ingestKey).toMatch(/^pub_[0-9a-f]{12}$/);
  expect(body.dsn).toBe(`sgl://${body.ingestKey}@127.0.0.1:4640/${body.id}`);
  await app.close();
});

it('POST /apps rejects a missing name and duplicate slug', async () => {
  const app = buildApp({ db: testDb });
  expect((await app.inject({ method: 'POST', url: '/apps', payload: {} })).statusCode).toBe(400);
  await app.inject({ method: 'POST', url: '/apps', payload: { name: 'Same' } });
  expect((await app.inject({ method: 'POST', url: '/apps', payload: { name: 'Same' } })).statusCode).toBe(409);
  await app.close();
});

it('GET /apps lists apps; GET /apps/:id returns one with dsn; unknown id 404s', async () => {
  const app = buildApp({ db: testDb });
  const created = (await app.inject({ method: 'POST', url: '/apps', payload: { name: 'A' } })).json();
  const list = (await app.inject({ method: 'GET', url: '/apps' })).json();
  expect(list).toHaveLength(1);
  expect(list[0].signals24h).toBe(0);
  const one = (await app.inject({ method: 'GET', url: `/apps/${created.id}` })).json();
  expect(one.dsn).toContain('sgl://');
  expect((await app.inject({ method: 'GET', url: '/apps/9999' })).statusCode).toBe(404);
  await app.close();
});

it('GET /meta reports database size', async () => {
  const app = buildApp({ db: testDb });
  const meta = (await app.inject({ method: 'GET', url: '/meta' })).json();
  expect(meta.dbSizeBytes).toBeGreaterThan(0);
  await app.close();
});
```

- [ ] **Step 2: Run to verify failure** → 404s / module not found.

- [ ] **Step 3: Implement**

`apps/signals/src/dsn.ts`:

```ts
import { environment } from './environment';

export function composeDsn(ingestKey: string, appId: number): string {
  return `sgl://${ingestKey}@${environment.publicAddress}/${appId}`;
}
```

`apps/signals/src/routes/apps.routes.ts`:

```ts
import { randomBytes } from 'node:crypto';
import { and, count, eq, gte, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import * as v from 'valibot';
import type { Db } from '../db/client';
import { apps, signals } from '../db/schema';
import { composeDsn } from '../dsn';
import { HttpError } from '../errors';

const CreateAppSchema = v.object({ name: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(100)) });

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export function registerAppsRoutes(app: FastifyInstance, context: { db: Db }) {
  app.post('/apps', async (request, reply) => {
    const parsed = v.safeParse(CreateAppSchema, request.body ?? {});
    if (!parsed.success) throw new HttpError(400, 'name is required');
    const slug = slugify(parsed.output.name);
    if (!slug) throw new HttpError(400, 'name must contain letters or digits');
    const existing = await context.db.select({ id: apps.id }).from(apps).where(eq(apps.slug, slug));
    if (existing.length > 0) throw new HttpError(409, `an app with slug "${slug}" already exists`);
    const ingestKey = `pub_${randomBytes(6).toString('hex')}`;
    const [row] = await context.db.insert(apps).values({ name: parsed.output.name, slug, ingestKey }).returning();
    reply.status(201).send({ ...row, dsn: composeDsn(row!.ingestKey, row!.id) });
  });

  app.get('/apps', async () => {
    const rows = await context.db.select().from(apps).orderBy(apps.id);
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const counts = await context.db
      .select({
        appId: signals.appId,
        total: count(),
        errors: count(sql`CASE WHEN ${signals.kind} = 'error' THEN 1 END`),
      })
      .from(signals)
      .where(gte(signals.receivedAt, since))
      .groupBy(signals.appId);
    const byApp = new Map(counts.map((c) => [c.appId, c]));
    return rows.map((r) => ({
      id: r.id, name: r.name, slug: r.slug, createdAt: r.createdAt,
      signals24h: byApp.get(r.id)?.total ?? 0,
      errors24h: byApp.get(r.id)?.errors ?? 0,
    }));
  });

  app.get('/apps/:id', async (request) => {
    const id = Number((request.params as { id: string }).id);
    const [row] = await context.db.select().from(apps).where(eq(apps.id, id));
    if (!row) throw new HttpError(404, 'app not found');
    return { ...row, dsn: composeDsn(row.ingestKey, row.id) };
  });

  app.get('/meta', async () => {
    const [row] = await context.db.execute<{ size: string }>(
      sql`SELECT pg_database_size(current_database()) AS size`,
    );
    return { dbSizeBytes: Number(row!.size) };
  });
}
```

In `apps/signals/src/app.ts`, add after the error handler:

```ts
import { registerAppsRoutes } from './routes/apps.routes';
// inside buildApp, before `return app`:
registerAppsRoutes(app, context);
```

(`count(sql…)` with a CASE argument: drizzle's `count()` accepts an SQL expression; if the overload fights the type-checker, use ``sql<number>`count(CASE WHEN ${signals.kind} = 'error' THEN 1 END)`.mapWith(Number)``.)

- [ ] **Step 4: Run tests** → apps routes tests PASS; health test still green. Note: the health test from Task 1 passes `db: null as never` — it only touches `/health`, which never queries, so it stays green.

- [ ] **Step 5: Commit**

```bash
git add apps/signals/src
git commit -m "feat(signals): apps management routes, DSN composition, db-size meta" -- apps/signals
```

---

### Task 6: Ingest route — validation, grouping, reopen, rate limit, CORS

**Files:**
- Create: `apps/signals/src/routes/ingest.schema.ts`
- Create: `apps/signals/src/routes/ingest.routes.ts`
- Modify: `apps/signals/src/app.ts` (register, CORS hook, rate limiter injection)
- Test: `apps/signals/src/routes/ingest.routes.test.ts`

**Interfaces:**
- Consumes: `fingerprintError`, `culpritFrom`, `issueTitle`, `createRateLimiter`, tables.
- Produces: `POST /ingest/:key` accepting `{ signals: IngestSignal[] }` (≤64) → 202 `{ accepted: number }`; 403 unknown key; 400 invalid envelope; 429 over rate limit. `buildApp` gains optional `rateLimiter` in its context. Signals with `kind: 'error'` are linked to an upserted issue. Symbolication is a no-op here (Task 8 fills it in) — `symbolicate` is called but returns null without artifacts.

- [ ] **Step 1: Write the valibot wire schema**

`apps/signals/src/routes/ingest.schema.ts`:

```ts
import * as v from 'valibot';

const StackFrameSchema = v.object({
  functionName: v.string(),
  file: v.string(),
  line: v.number(),
  column: v.number(),
  inApp: v.boolean(),
});

const BreadcrumbSchema = v.object({
  type: v.picklist(['console', 'click', 'navigation', 'http', 'custom']),
  timestamp: v.string(),
  message: v.optional(v.string()),
  data: v.optional(v.record(v.string(), v.unknown())),
});

export const IngestSignalSchema = v.object({
  kind: v.picklist(['error', 'log', 'event']),
  sessionId: v.pipe(v.string(), v.minLength(1), v.maxLength(128)),
  name: v.pipe(v.string(), v.minLength(1), v.maxLength(300)),
  message: v.optional(v.pipe(v.string(), v.maxLength(5000))),
  mechanism: v.picklist([
    'uncaught-exception', 'unhandled-rejection', 'error-boundary', 'middleware', 'console', 'manual',
  ]),
  level: v.picklist(['error', 'warning', 'info']),
  timestamp: v.pipe(v.string(), v.isoTimestamp()),
  release: v.optional(v.pipe(v.string(), v.maxLength(100))),
  environment: v.optional(v.pipe(v.string(), v.maxLength(50))),
  fingerprint: v.optional(v.pipe(v.string(), v.maxLength(200))),
  stack: v.optional(v.array(StackFrameSchema)),
  breadcrumbs: v.optional(v.array(BreadcrumbSchema)),
  user: v.optional(v.object({
    id: v.optional(v.string()), email: v.optional(v.string()), name: v.optional(v.string()),
  })),
  tags: v.optional(v.record(v.string(), v.string())),
  contexts: v.optional(v.record(v.string(), v.record(v.string(), v.unknown()))),
  platform: v.object({
    runtime: v.picklist(['browser', 'node']),
    os: v.optional(v.string()),
    browser: v.optional(v.string()),
    url: v.optional(v.string()),
    nodeVersion: v.optional(v.string()),
    hostname: v.optional(v.string()),
    pid: v.optional(v.number()),
  }),
  sdk: v.object({ name: v.string(), version: v.string() }),
});

export const IngestEnvelopeSchema = v.object({
  signals: v.pipe(v.array(IngestSignalSchema), v.minLength(1), v.maxLength(64)),
});

export type IngestSignal = v.InferOutput<typeof IngestSignalSchema>;
```

- [ ] **Step 2: Write failing tests**

`apps/signals/src/routes/ingest.routes.test.ts`:

```ts
import { afterAll, beforeEach, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { buildApp } from '../app';
import { issues, signals } from '../db/schema';
import { createRateLimiter } from '../rate-limit';
import { resetDb, testDb } from '../test/db';

beforeEach(resetDb);
afterAll(resetDb);

async function makeApp() {
  const app = buildApp({ db: testDb });
  const created = (await app.inject({ method: 'POST', url: '/apps', payload: { name: 'A' } })).json();
  return { app, key: created.ingestKey as string, appId: created.id as number };
}

const errorSignal = (overrides: Record<string, unknown> = {}) => ({
  kind: 'error', sessionId: 'sess_1', name: 'TypeError',
  message: "Cannot read properties of undefined (reading 'map')",
  mechanism: 'uncaught-exception', level: 'error',
  timestamp: new Date().toISOString(),
  stack: [{ functionName: 'CartList', file: 'src/checkout/CartList.tsx', line: 48, column: 13, inApp: true }],
  platform: { runtime: 'browser' }, sdk: { name: 'test', version: '0.0.0' },
  ...overrides,
});

it('rejects unknown keys with 403 and invalid envelopes with 400', async () => {
  const { app, key } = await makeApp();
  expect((await app.inject({ method: 'POST', url: '/ingest/pub_nope', payload: { signals: [errorSignal()] } })).statusCode).toBe(403);
  expect((await app.inject({ method: 'POST', url: `/ingest/${key}`, payload: { nope: true } })).statusCode).toBe(400);
  await app.close();
});

it('accepts a batch, creates an issue for the error, and groups repeats', async () => {
  const { app, key, appId } = await makeApp();
  const first = await app.inject({ method: 'POST', url: `/ingest/${key}`, payload: { signals: [errorSignal()] } });
  expect(first.statusCode).toBe(202);
  expect(first.json()).toEqual({ accepted: 1 });
  await app.inject({ method: 'POST', url: `/ingest/${key}`, payload: { signals: [errorSignal({ sessionId: 'sess_2' })] } });

  const issueRows = await testDb.select().from(issues);
  expect(issueRows).toHaveLength(1);
  expect(issueRows[0]!.eventCount).toBe(2);
  expect(issueRows[0]!.culprit).toBe('src/checkout/CartList.tsx:48');
  expect(issueRows[0]!.appId).toBe(appId);

  const signalRows = await testDb.select().from(signals).where(eq(signals.issueId, issueRows[0]!.id));
  expect(signalRows).toHaveLength(2);
  await app.close();
});

it('log/event kinds never create issues', async () => {
  const { app, key } = await makeApp();
  await app.inject({
    method: 'POST', url: `/ingest/${key}`,
    payload: { signals: [
      { kind: 'log', sessionId: 's', name: 'console', message: 'hello', mechanism: 'console', level: 'info',
        timestamp: new Date().toISOString(), platform: { runtime: 'node' }, sdk: { name: 't', version: '0' } },
      { kind: 'event', sessionId: 's', name: 'checkout.started', mechanism: 'manual', level: 'info',
        timestamp: new Date().toISOString(), platform: { runtime: 'node' }, sdk: { name: 't', version: '0' } },
    ] },
  });
  expect(await testDb.select().from(issues)).toHaveLength(0);
  expect(await testDb.select().from(signals)).toHaveLength(2);
  await app.close();
});

it('reopens a resolved issue on regression but leaves ignored alone', async () => {
  const { app, key } = await makeApp();
  await app.inject({ method: 'POST', url: `/ingest/${key}`, payload: { signals: [errorSignal()] } });
  let [issue] = await testDb.select().from(issues);
  await testDb.update(issues).set({ status: 'resolved' }).where(eq(issues.id, issue!.id));
  await app.inject({ method: 'POST', url: `/ingest/${key}`, payload: { signals: [errorSignal()] } });
  [issue] = await testDb.select().from(issues);
  expect(issue!.status).toBe('open');
  expect(issue!.eventCount).toBe(2);

  await testDb.update(issues).set({ status: 'ignored' }).where(eq(issues.id, issue!.id));
  await app.inject({ method: 'POST', url: `/ingest/${key}`, payload: { signals: [errorSignal()] } });
  [issue] = await testDb.select().from(issues);
  expect(issue!.status).toBe('ignored');
  expect(issue!.eventCount).toBe(3);
  await app.close();
});

it('enforces the per-key rate limit with 429', async () => {
  let t = 0;
  const app = buildApp({ db: testDb, rateLimiter: createRateLimiter({ limit: 2, windowMs: 60_000, now: () => t }) });
  const created = (await app.inject({ method: 'POST', url: '/apps', payload: { name: 'B' } })).json();
  const one = { signals: [errorSignal()] };
  expect((await app.inject({ method: 'POST', url: `/ingest/${created.ingestKey}`, payload: one })).statusCode).toBe(202);
  expect((await app.inject({ method: 'POST', url: `/ingest/${created.ingestKey}`, payload: one })).statusCode).toBe(202);
  expect((await app.inject({ method: 'POST', url: `/ingest/${created.ingestKey}`, payload: one })).statusCode).toBe(429);
  await app.close();
});

it('answers ingest CORS preflight with open headers', async () => {
  const { app, key } = await makeApp();
  const res = await app.inject({ method: 'OPTIONS', url: `/ingest/${key}` });
  expect(res.statusCode).toBe(204);
  expect(res.headers['access-control-allow-origin']).toBe('*');
  await app.close();
});
```

- [ ] **Step 3: Run to verify failure** → 404 (route absent).

- [ ] **Step 4: Implement**

`apps/signals/src/routes/ingest.routes.ts`:

```ts
import { eq, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import * as v from 'valibot';
import type { Db } from '../db/client';
import { apps, issues, signals } from '../db/schema';
import { HttpError } from '../errors';
import { culpritFrom, fingerprintError, issueTitle } from '../fingerprint';
import type { RateLimiter } from '../rate-limit';
import type { SignalPayload } from '../types';
import { IngestEnvelopeSchema, type IngestSignal } from './ingest.schema';

const MAX_PAYLOAD_BYTES = 200_000;

function toPayload(s: IngestSignal): SignalPayload {
  const payload: SignalPayload = {
    stack: s.stack, breadcrumbs: s.breadcrumbs, user: s.user, tags: s.tags,
    contexts: s.contexts, platform: s.platform, sdk: s.sdk,
  };
  // Oversize guard: breadcrumbs are the usual offender — drop them first,
  // then contexts. Flag truncation so the UI can say so.
  if (JSON.stringify(payload).length > MAX_PAYLOAD_BYTES) {
    payload.breadcrumbs = payload.breadcrumbs?.slice(0, 5);
    if (JSON.stringify(payload).length > MAX_PAYLOAD_BYTES) delete payload.contexts;
    payload.truncated = true;
  }
  return payload;
}

export function registerIngestRoutes(
  app: FastifyInstance,
  context: { db: Db; rateLimiter: RateLimiter },
) {
  app.options('/ingest/:key', async (_request, reply) => reply.status(204).send());

  app.post('/ingest/:key', async (request, reply) => {
    const key = (request.params as { key: string }).key;
    const [appRow] = await context.db.select().from(apps).where(eq(apps.ingestKey, key));
    if (!appRow) throw new HttpError(403, 'unknown ingest key');

    const parsed = v.safeParse(IngestEnvelopeSchema, request.body ?? {});
    if (!parsed.success) throw new HttpError(400, 'invalid ingest envelope');
    const batch = parsed.output.signals;

    if (!context.rateLimiter.allow(key, batch.length)) {
      throw new HttpError(429, 'rate limit exceeded — back off');
    }

    for (const s of batch) {
      let issueId: number | null = null;
      if (s.kind === 'error') {
        const fingerprint = fingerprintError({
          name: s.name, message: s.message, stack: s.stack, explicit: s.fingerprint,
        });
        const [issue] = await context.db
          .insert(issues)
          .values({
            appId: appRow.id, fingerprint,
            title: issueTitle(s.name, s.message),
            culprit: culpritFrom(s.stack),
          })
          .onConflictDoUpdate({
            target: [issues.appId, issues.fingerprint],
            set: {
              eventCount: sql`${issues.eventCount} + 1`,
              lastSeen: sql`now()`,
              status: sql`CASE WHEN ${issues.status} = 'resolved' THEN 'open' ELSE ${issues.status} END`,
            },
          })
          .returning({ id: issues.id });
        issueId = issue!.id;
      }
      await context.db.insert(signals).values({
        appId: appRow.id, kind: s.kind, sessionId: s.sessionId, name: s.name,
        message: s.message ?? null, mechanism: s.mechanism, level: s.level,
        clientTimestamp: new Date(s.timestamp),
        release: s.release ?? null, environment: s.environment ?? null,
        issueId, payload: toPayload(s),
      });
    }

    reply.status(202).send({ accepted: batch.length });
  });
}
```

In `apps/signals/src/app.ts`:

```ts
import { createRateLimiter, type RateLimiter } from './rate-limit';
import { registerIngestRoutes } from './routes/ingest.routes';

export function buildApp(context: { db: Db; rateLimiter?: RateLimiter }) {
  const app = fastify({ logger: false });
  const rateLimiter = context.rateLimiter ?? createRateLimiter();

  // Ingest is cross-origin by design: browser SDKs on other sites post here.
  app.addHook('onSend', async (request, reply, payload) => {
    if (request.url.startsWith('/ingest/')) {
      reply.header('access-control-allow-origin', '*');
      reply.header('access-control-allow-headers', 'content-type');
      reply.header('access-control-allow-methods', 'POST, OPTIONS');
    }
    return payload;
  });

  // ...existing error handler + routes...
  registerIngestRoutes(app, { db: context.db, rateLimiter });
  return app;
}
```

- [ ] **Step 5: Run tests** → all ingest tests PASS (`pnpm --filter @tickets/signals test`).

- [ ] **Step 6: Commit**

```bash
git add apps/signals/src
git commit -m "feat(signals): ingest endpoint — validation, issue grouping, reopen, rate limit, CORS" -- apps/signals
```

---

### Task 7: Issues management API

**Files:**
- Create: `apps/signals/src/routes/issues.routes.ts`
- Modify: `apps/signals/src/app.ts` (register)
- Test: `apps/signals/src/routes/issues.routes.test.ts`

**Interfaces:**
- Consumes: tables; ingest route (tests seed through it).
- Produces:
  - `GET /issues?app=<id>&status=<open|resolved|ignored>&level=<l>&days=<n=14>&q=<text>&page=<1>&perPage=<25>` → `{ rows, total }`; each row `{ id, key: "SGL-<id>", title, culprit, appId, appSlug, status, level, mechanism, eventCount, firstSeen, lastSeen, spark: number[14] }` (level/mechanism from the newest signal of the issue).
  - `GET /issues/:id` → row plus `{ sessionCount, userCount, releaseRange: { first, last } }`.
  - `PATCH /issues/:id` body `{ status }` → updated row.
  - `GET /issues/:id/signals?page&perPage` → `{ rows: { id, receivedAt, release, sessionId }[], total }`.

- [ ] **Step 1: Write failing tests**

`apps/signals/src/routes/issues.routes.test.ts`:

```ts
import { afterAll, beforeEach, expect, it } from 'vitest';
import { buildApp } from '../app';
import { resetDb, testDb } from '../test/db';

beforeEach(resetDb);
afterAll(resetDb);

async function seed() {
  const app = buildApp({ db: testDb });
  const a = (await app.inject({ method: 'POST', url: '/apps', payload: { name: 'A' } })).json();
  const send = (payload: object) =>
    app.inject({ method: 'POST', url: `/ingest/${a.ingestKey}`, payload });
  const err = (session: string, message: string, release?: string, user?: object) => ({
    kind: 'error', sessionId: session, name: 'TypeError', message,
    mechanism: 'uncaught-exception', level: 'error', timestamp: new Date().toISOString(),
    release, user,
    stack: [{ functionName: 'f', file: 'src/a.ts', line: 1, column: 1, inApp: true }],
    platform: { runtime: 'browser' }, sdk: { name: 't', version: '0' },
  });
  await send({ signals: [err('s1', 'boom', '1.0.0', { id: 'u1' })] });
  await send({ signals: [err('s2', 'boom', '1.1.0', { id: 'u2' })] });
  await send({ signals: [err('s1', 'different failure entirely')] });
  return { app, appId: a.id as number };
}

it('lists issues with keys, counts, and a 14-slot sparkline', async () => {
  const { app } = await seed();
  const body = (await app.inject({ method: 'GET', url: '/issues' })).json();
  expect(body.total).toBe(2);
  const grouped = body.rows.find((r: { eventCount: number }) => r.eventCount === 2);
  expect(grouped.key).toMatch(/^SGL-\d+$/);
  expect(grouped.spark).toHaveLength(14);
  expect(grouped.spark[13]).toBe(2); // both events today
  expect(grouped.level).toBe('error');
  await app.close();
});

it('filters by status and text', async () => {
  const { app } = await seed();
  const q = (url: string) => app.inject({ method: 'GET', url }).then((r) => r.json());
  expect((await q('/issues?status=resolved')).total).toBe(0);
  expect((await q('/issues?q=different')).total).toBe(1);
  await app.close();
});

it('issue detail carries session/user counts and release range', async () => {
  const { app } = await seed();
  const list = (await app.inject({ method: 'GET', url: '/issues?q=boom' })).json();
  const detail = (await app.inject({ method: 'GET', url: `/issues/${list.rows[0].id}` })).json();
  expect(detail.sessionCount).toBe(2);
  expect(detail.userCount).toBe(2);
  expect(detail.releaseRange).toEqual({ first: '1.0.0', last: '1.1.0' });
  await app.close();
});

it('PATCH updates status and rejects bad values; occurrences paginate', async () => {
  const { app } = await seed();
  const list = (await app.inject({ method: 'GET', url: '/issues?q=boom' })).json();
  const id = list.rows[0].id;
  const patched = (await app.inject({ method: 'PATCH', url: `/issues/${id}`, payload: { status: 'resolved' } })).json();
  expect(patched.status).toBe('resolved');
  expect((await app.inject({ method: 'PATCH', url: `/issues/${id}`, payload: { status: 'nope' } })).statusCode).toBe(400);
  const occ = (await app.inject({ method: 'GET', url: `/issues/${id}/signals?perPage=1&page=2` })).json();
  expect(occ.total).toBe(2);
  expect(occ.rows).toHaveLength(1);
  expect(occ.rows[0].sessionId).toBeDefined();
  await app.close();
});
```

- [ ] **Step 2: Run to verify failure** → 404s.

- [ ] **Step 3: Implement**

`apps/signals/src/routes/issues.routes.ts`:

```ts
import { and, count, countDistinct, desc, eq, gte, ilike, max, min, or, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import * as v from 'valibot';
import type { Db } from '../db/client';
import { apps, issues, signals } from '../db/schema';
import { HttpError } from '../errors';

const PatchSchema = v.object({ status: v.picklist(['open', 'resolved', 'ignored']) });

const dayMs = 24 * 60 * 60 * 1000;

// UTC day-bucketed counts for the sparkline, oldest → newest, always `days` slots.
async function sparklines(db: Db, issueIds: number[], days: number): Promise<Map<number, number[]>> {
  const result = new Map<number, number[]>(issueIds.map((id) => [id, Array(days).fill(0)]));
  if (issueIds.length === 0) return result;
  const since = new Date(Date.now() - (days - 1) * dayMs);
  const rows = await db
    .select({
      issueId: signals.issueId,
      day: sql<string>`to_char(date_trunc('day', ${signals.receivedAt} AT TIME ZONE 'UTC'), 'YYYY-MM-DD')`,
      n: count(),
    })
    .from(signals)
    .where(and(sql`${signals.issueId} IN ${issueIds}`, gte(signals.receivedAt, since)))
    .groupBy(signals.issueId, sql`2`);
  const today = new Date();
  for (const row of rows) {
    const slot = days - 1 - Math.floor(
      (Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) - Date.parse(`${row.day}T00:00:00Z`)) / dayMs,
    );
    if (slot >= 0 && slot < days && row.issueId !== null) result.get(row.issueId)![slot] = row.n;
  }
  return result;
}

export function registerIssuesRoutes(app: FastifyInstance, context: { db: Db }) {
  app.get('/issues', async (request) => {
    const q = request.query as Record<string, string | undefined>;
    const days = Math.min(Number(q.days ?? 14) || 14, 90);
    const page = Math.max(Number(q.page ?? 1) || 1, 1);
    const perPage = Math.min(Number(q.perPage ?? 25) || 25, 100);

    const where = and(
      q.app ? eq(issues.appId, Number(q.app)) : undefined,
      q.status ? eq(issues.status, q.status as 'open' | 'resolved' | 'ignored') : undefined,
      gte(issues.lastSeen, new Date(Date.now() - days * dayMs)),
      q.q ? or(ilike(issues.title, `%${q.q}%`), ilike(issues.culprit, `%${q.q}%`)) : undefined,
    );

    const [{ total }] = await context.db.select({ total: count() }).from(issues).where(where);
    const rows = await context.db
      .select({
        id: issues.id, title: issues.title, culprit: issues.culprit, appId: issues.appId,
        appSlug: apps.slug, status: issues.status, eventCount: issues.eventCount,
        firstSeen: issues.firstSeen, lastSeen: issues.lastSeen,
      })
      .from(issues)
      .innerJoin(apps, eq(apps.id, issues.appId))
      .where(where)
      .orderBy(desc(issues.lastSeen))
      .limit(perPage)
      .offset((page - 1) * perPage);

    const ids = rows.map((r) => r.id);
    const sparks = await sparklines(context.db, ids, 14);
    // level/mechanism of the newest signal per issue
    const latest = ids.length
      ? await context.db
          .select({
            issueId: signals.issueId, level: signals.level, mechanism: signals.mechanism,
            rn: sql<number>`row_number() OVER (PARTITION BY ${signals.issueId} ORDER BY ${signals.receivedAt} DESC)`,
          })
          .from(signals)
          .where(sql`${signals.issueId} IN ${ids}`)
      : [];
    const latestByIssue = new Map(latest.filter((l) => Number(l.rn) === 1).map((l) => [l.issueId, l]));

    // level filter applies to the newest signal's level
    const enriched = rows
      .map((r) => ({
        ...r,
        key: `SGL-${r.id}`,
        level: latestByIssue.get(r.id)?.level ?? 'error',
        mechanism: latestByIssue.get(r.id)?.mechanism ?? 'manual',
        spark: sparks.get(r.id) ?? Array(14).fill(0),
      }))
      .filter((r) => (q.level ? r.level === q.level : true));

    return { rows: enriched, total };
  });

  app.get('/issues/:id', async (request) => {
    const id = Number((request.params as { id: string }).id);
    const [row] = await context.db.select().from(issues).where(eq(issues.id, id));
    if (!row) throw new HttpError(404, 'issue not found');
    const [agg] = await context.db
      .select({
        sessionCount: countDistinct(signals.sessionId),
        userCount: countDistinct(sql`${signals.payload} -> 'user' ->> 'id'`),
        firstRelease: min(signals.release),
        lastRelease: max(signals.release),
      })
      .from(signals)
      .where(eq(signals.issueId, id));
    const spark = (await sparklines(context.db, [id], 14)).get(id)!;
    return {
      ...row,
      key: `SGL-${row.id}`,
      spark,
      sessionCount: agg!.sessionCount,
      userCount: agg!.userCount,
      releaseRange: { first: agg!.firstRelease, last: agg!.lastRelease },
    };
  });

  app.patch('/issues/:id', async (request) => {
    const id = Number((request.params as { id: string }).id);
    const parsed = v.safeParse(PatchSchema, request.body ?? {});
    if (!parsed.success) throw new HttpError(400, 'status must be open, resolved, or ignored');
    const [row] = await context.db
      .update(issues).set({ status: parsed.output.status }).where(eq(issues.id, id)).returning();
    if (!row) throw new HttpError(404, 'issue not found');
    return { ...row, key: `SGL-${row.id}` };
  });

  app.get('/issues/:id/signals', async (request) => {
    const id = Number((request.params as { id: string }).id);
    const q = request.query as Record<string, string | undefined>;
    const page = Math.max(Number(q.page ?? 1) || 1, 1);
    const perPage = Math.min(Number(q.perPage ?? 25) || 25, 100);
    const [{ total }] = await context.db
      .select({ total: count() }).from(signals).where(eq(signals.issueId, id));
    const rows = await context.db
      .select({
        id: signals.id, receivedAt: signals.receivedAt,
        release: signals.release, sessionId: signals.sessionId,
      })
      .from(signals)
      .where(eq(signals.issueId, id))
      .orderBy(desc(signals.receivedAt))
      .limit(perPage)
      .offset((page - 1) * perPage);
    return { rows, total };
  });
}
```

Register in `app.ts`: `registerIssuesRoutes(app, context);`

Notes for the implementer:
- `sql`${signals.issueId} IN ${ids}`` — drizzle renders arrays with `inArray`; prefer `inArray(signals.issueId, ids)` from `drizzle-orm` (imported alongside the rest) — use it in both places.
- `min`/`max` on release are lexicographic; the test's `1.0.0` → `1.1.0` ordering works. Real semver edge cases (e.g. `1.10.0` vs `1.9.0`) are accepted as a v1 limitation — first/last by *seen time* can replace it in a later pass.
- The `q.level` filter is applied after pagination — with per-issue levels only known post-query this is acceptable for v1 (page sizes ≤100); note it in the route with a comment.

- [ ] **Step 4: Run tests** → PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/signals/src
git commit -m "feat(signals): issues API — list/filters/sparklines, detail aggregates, status patch, occurrences" -- apps/signals
```

---

### Task 8: Session timeline API

**Files:**
- Create: `apps/signals/src/routes/sessions.routes.ts`
- Modify: `apps/signals/src/app.ts` (register)
- Test: `apps/signals/src/routes/sessions.routes.test.ts`

**Interfaces:**
- Produces: `GET /sessions/:sessionId/signals?app=<appId>` → `{ session: { sessionId, appId, startedAt, endedAt, durationMs, crashed, counts: { error, log, event }, release, platform }, rows: Signal[] }` ordered by `clientTimestamp` asc. Each row: `{ id, kind, name, message, mechanism, level, clientTimestamp, issueId, issueKey }`. 404 when the session has no signals.

- [ ] **Step 1: Write failing tests**

`apps/signals/src/routes/sessions.routes.test.ts`:

```ts
import { afterAll, beforeEach, expect, it } from 'vitest';
import { buildApp } from '../app';
import { resetDb, testDb } from '../test/db';

beforeEach(resetDb);
afterAll(resetDb);

it('returns the chronological timeline with derived header data', async () => {
  const app = buildApp({ db: testDb });
  const a = (await app.inject({ method: 'POST', url: '/apps', payload: { name: 'A' } })).json();
  const base = Date.parse('2026-07-21T14:02:11Z');
  const at = (s: number) => new Date(base + s * 1000).toISOString();
  const common = { sessionId: 'sess_9f3k21', platform: { runtime: 'browser' }, sdk: { name: 't', version: '0' } };
  await app.inject({
    method: 'POST', url: `/ingest/${a.ingestKey}`,
    payload: { signals: [
      { ...common, kind: 'event', name: 'page load', mechanism: 'manual', level: 'info', timestamp: at(0), release: '1.44.1' },
      { ...common, kind: 'log', name: 'console', message: 'cart hydrate', mechanism: 'console', level: 'info', timestamp: at(10) },
      { ...common, kind: 'error', name: 'TypeError', message: 'boom', mechanism: 'uncaught-exception', level: 'error', timestamp: at(20),
        stack: [{ functionName: 'f', file: 'src/a.ts', line: 1, column: 1, inApp: true }] },
    ] },
  });

  const res = await app.inject({ method: 'GET', url: '/sessions/sess_9f3k21/signals' });
  expect(res.statusCode).toBe(200);
  const body = res.json();
  expect(body.rows.map((r: { kind: string }) => r.kind)).toEqual(['event', 'log', 'error']);
  expect(body.session.crashed).toBe(true);
  expect(body.session.durationMs).toBe(20_000);
  expect(body.session.counts).toEqual({ error: 1, log: 1, event: 1 });
  expect(body.session.release).toBe('1.44.1');
  expect(body.rows[2].issueKey).toMatch(/^SGL-\d+$/);

  expect((await app.inject({ method: 'GET', url: '/sessions/nope/signals' })).statusCode).toBe(404);
  await app.close();
});
```

- [ ] **Step 2: Run to verify failure** → 404 route absent (the test expects 200 for the seeded session).

- [ ] **Step 3: Implement**

`apps/signals/src/routes/sessions.routes.ts`:

```ts
import { and, asc, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { Db } from '../db/client';
import { signals } from '../db/schema';
import { HttpError } from '../errors';

export function registerSessionsRoutes(app: FastifyInstance, context: { db: Db }) {
  app.get('/sessions/:sessionId/signals', async (request) => {
    const sessionId = (request.params as { sessionId: string }).sessionId;
    const q = request.query as { app?: string };
    const rows = await context.db
      .select()
      .from(signals)
      .where(and(
        eq(signals.sessionId, sessionId),
        q.app ? eq(signals.appId, Number(q.app)) : undefined,
      ))
      .orderBy(asc(signals.clientTimestamp), asc(signals.id));
    if (rows.length === 0) throw new HttpError(404, 'session not found');

    const startedAt = rows[0]!.clientTimestamp;
    const endedAt = rows[rows.length - 1]!.clientTimestamp;
    const counts = { error: 0, log: 0, event: 0 };
    for (const r of rows) counts[r.kind] += 1;

    return {
      session: {
        sessionId,
        appId: rows[0]!.appId,
        startedAt,
        endedAt,
        durationMs: endedAt.getTime() - startedAt.getTime(),
        crashed: counts.error > 0,
        counts,
        release: rows.find((r) => r.release)?.release ?? null,
        platform: rows[0]!.payload.platform,
      },
      rows: rows.map((r) => ({
        id: r.id, kind: r.kind, name: r.name, message: r.message,
        mechanism: r.mechanism, level: r.level, clientTimestamp: r.clientTimestamp,
        issueId: r.issueId, issueKey: r.issueId === null ? null : `SGL-${r.issueId}`,
        payload: r.payload,
      })),
    };
  });
}
```

Register in `app.ts`: `registerSessionsRoutes(app, context);`

- [ ] **Step 4: Run tests** → PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/signals/src
git commit -m "feat(signals): session timeline API with derived header (crashed, counts, duration)" -- apps/signals
```

---

### Task 9: Source map upload + symbolication at ingest

**Files:**
- Create: `apps/signals/src/symbolicate.ts`
- Create: `apps/signals/src/routes/sourcemaps.routes.ts`
- Modify: `apps/signals/src/routes/ingest.routes.ts` (symbolicate error signals)
- Modify: `apps/signals/src/app.ts` (register)
- Test: `apps/signals/src/symbolicate.test.ts`
- Test: `apps/signals/src/routes/sourcemaps.routes.test.ts`

**Interfaces:**
- Produces:
  - `POST /ingest/:key/sourcemaps` — JSON body `{ release: string, files: { filename: string, content: string }[] }` (content = raw .map JSON text; route registered with `bodyLimit: 50 * 1024 * 1024`) → 201 `{ stored: number }`. **Spec deviation:** JSON body instead of multipart — the plan-2 CLI controls the format, and this avoids a multipart dependency; the spec is updated in Task 10.
  - `symbolicateFrames(frames: StackFrame[], artifacts: { filename: string, content: string }[]): SymbolicatedFrame[] | null` — returns null when no frame matches any map.
  - Ingest now stores `payload.stackSymbolicated` and refreshes the issue `culprit` from symbolicated frames when available.

- [ ] **Step 1: Write the failing symbolicate unit test with a real generated map**

`apps/signals/src/symbolicate.test.ts`:

```ts
import { expect, it } from 'vitest';
import { symbolicateFrames } from './symbolicate';
import type { StackFrame } from './types';

// A tiny real source map: `function boom(){throw new Error("x")}` from src/boom.ts,
// generated with esbuild --minify --sourcemap. sourcesContent included.
const MAP = JSON.stringify({
  version: 3,
  sources: ['../src/boom.ts'],
  sourcesContent: ['function boom() {\n  throw new Error("x");\n}\nboom();\n'],
  mappings: 'AAAA,SAASA,IAAO,CACd,MAAM,IAAI,MAAM,GAAG,CACrB,CACAA,EAAK',
  names: ['boom'],
});

const minifiedFrame: StackFrame = {
  functionName: 'r', file: '/assets/index-8f3a91.js', line: 1, column: 21, inApp: false,
};

it('resolves a minified frame to the original source with context lines', () => {
  const out = symbolicateFrames([minifiedFrame], [{ filename: 'index-8f3a91.js.map', content: MAP }]);
  expect(out).not.toBeNull();
  expect(out![0]!.file).toContain('src/boom.ts');
  expect(out![0]!.line).toBe(2);
  expect(out![0]!.inApp).toBe(true);
  expect(out![0]!.contextLines!.map((l) => l.line)).toContain(2);
});

it('returns null when no artifact matches the frame file', () => {
  expect(symbolicateFrames([minifiedFrame], [{ filename: 'other.js.map', content: MAP }])).toBeNull();
});
```

(If the hand-inlined `mappings` string doesn't resolve line 1/col 21 → original line 2 exactly, regenerate the fixture: `cd $(mktemp -d) && printf 'function boom() {\n  throw new Error("x");\n}\nboom();\n' > boom.ts && npx esbuild boom.ts --minify --sourcemap --outfile=out.js` and paste the produced `out.js.map` into MAP, then pick the frame line/column by throwing in node and reading the minified stack. The assertion targets are what matter: original file, original line, context lines present.)

- [ ] **Step 2: Run to verify failure** → module not found.

- [ ] **Step 3: Implement symbolicate.ts**

```ts
import { TraceMap, originalPositionFor, sourceContentFor } from '@jridgewell/trace-mapping';
import type { StackFrame, SymbolicatedFrame } from './types';

function basename(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

// Artifact "index-8f3a91.js.map" symbolicates frames whose file basename is
// "index-8f3a91.js". Returns null when nothing matched (caller keeps raw only).
export function symbolicateFrames(
  frames: StackFrame[],
  artifacts: { filename: string; content: string }[],
): SymbolicatedFrame[] | null {
  const maps = new Map<string, TraceMap>();
  for (const a of artifacts) {
    try {
      maps.set(a.filename.replace(/\.map$/, ''), new TraceMap(a.content));
    } catch {
      // an unparseable map never blocks ingest
    }
  }
  let any = false;
  const out = frames.map<SymbolicatedFrame>((frame) => {
    const tracer = maps.get(basename(frame.file));
    if (!tracer) return { ...frame };
    const pos = originalPositionFor(tracer, { line: frame.line, column: frame.column });
    if (pos.source === null || pos.line === null) return { ...frame };
    any = true;
    const source = pos.source.replace(/^(\.\.\/)+/, '');
    const content = sourceContentFor(tracer, pos.source);
    const contextLines = content
      ? content.split('\n')
          .map((text, i) => ({ line: i + 1, text }))
          .filter((l) => Math.abs(l.line - pos.line!) <= 2)
      : undefined;
    return {
      functionName: pos.name ?? frame.functionName,
      file: source,
      line: pos.line,
      column: pos.column ?? 0,
      inApp: !source.includes('node_modules'),
      contextLines,
    };
  });
  return any ? out : null;
}
```

- [ ] **Step 4: Run symbolicate tests** → PASS (regenerate fixture per Step 1 note if needed).

- [ ] **Step 5: Write failing route/integration tests**

`apps/signals/src/routes/sourcemaps.routes.test.ts`:

```ts
import { afterAll, beforeEach, expect, it } from 'vitest';
import { buildApp } from '../app';
import { issues, signals } from '../db/schema';
import { resetDb, testDb } from '../test/db';

beforeEach(resetDb);
afterAll(resetDb);

const MAP = /* same fixture string as symbolicate.test.ts — repeat it verbatim here */ '';

it('stores maps and symbolicates subsequent error ingests, refreshing culprit', async () => {
  const app = buildApp({ db: testDb });
  const a = (await app.inject({ method: 'POST', url: '/apps', payload: { name: 'A' } })).json();

  const up = await app.inject({
    method: 'POST', url: `/ingest/${a.ingestKey}/sourcemaps`,
    payload: { release: '1.0.0', files: [{ filename: 'index-8f3a91.js.map', content: MAP }] },
  });
  expect(up.statusCode).toBe(201);
  expect(up.json()).toEqual({ stored: 1 });

  await app.inject({
    method: 'POST', url: `/ingest/${a.ingestKey}`,
    payload: { signals: [{
      kind: 'error', sessionId: 's', name: 'Error', message: 'x',
      mechanism: 'uncaught-exception', level: 'error', timestamp: new Date().toISOString(),
      release: '1.0.0',
      stack: [{ functionName: 'r', file: '/assets/index-8f3a91.js', line: 1, column: 21, inApp: false }],
      platform: { runtime: 'browser' }, sdk: { name: 't', version: '0' },
    }] },
  });

  const [signalRow] = await testDb.select().from(signals);
  expect(signalRow!.payload.stackSymbolicated).toBeDefined();
  expect(signalRow!.payload.stackSymbolicated![0]!.file).toContain('src/boom.ts');
  const [issueRow] = await testDb.select().from(issues);
  expect(issueRow!.culprit).toContain('src/boom.ts');
  await app.close();
});

it('403s on a bad key and 400s without release', async () => {
  const app = buildApp({ db: testDb });
  const a = (await app.inject({ method: 'POST', url: '/apps', payload: { name: 'A' } })).json();
  expect((await app.inject({ method: 'POST', url: '/ingest/pub_bad/sourcemaps', payload: { release: '1', files: [] } })).statusCode).toBe(403);
  expect((await app.inject({ method: 'POST', url: `/ingest/${a.ingestKey}/sourcemaps`, payload: { files: [] } })).statusCode).toBe(400);
  await app.close();
});
```

- [ ] **Step 6: Implement the route and wire symbolication into ingest**

`apps/signals/src/routes/sourcemaps.routes.ts`:

```ts
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import * as v from 'valibot';
import type { Db } from '../db/client';
import { apps, sourcemapArtifacts } from '../db/schema';
import { HttpError } from '../errors';

const UploadSchema = v.object({
  release: v.pipe(v.string(), v.minLength(1), v.maxLength(100)),
  files: v.pipe(
    v.array(v.object({
      filename: v.pipe(v.string(), v.minLength(1), v.maxLength(300)),
      content: v.pipe(v.string(), v.minLength(2)),
    })),
    v.minLength(1),
    v.maxLength(50),
  ),
});

export function registerSourcemapRoutes(app: FastifyInstance, context: { db: Db }) {
  app.post('/ingest/:key/sourcemaps', { bodyLimit: 50 * 1024 * 1024 }, async (request, reply) => {
    const key = (request.params as { key: string }).key;
    const [appRow] = await context.db.select().from(apps).where(eq(apps.ingestKey, key));
    if (!appRow) throw new HttpError(403, 'unknown ingest key');
    const parsed = v.safeParse(UploadSchema, request.body ?? {});
    if (!parsed.success) throw new HttpError(400, 'release and files[] are required');
    const { release, files } = parsed.output;
    await context.db.insert(sourcemapArtifacts).values(
      files.map((f) => ({ appId: appRow.id, release, filename: f.filename, content: f.content })),
    );
    reply.status(201).send({ stored: files.length });
  });
}
```

In `ingest.routes.ts`, inside the `s.kind === 'error'` branch, before fingerprinting:

```ts
import { and } from 'drizzle-orm';
import { sourcemapArtifacts } from '../db/schema';
import { symbolicateFrames } from '../symbolicate';

// inside the loop:
let symbolicated = null;
if (s.stack && s.release) {
  const artifacts = await context.db
    .select({ filename: sourcemapArtifacts.filename, content: sourcemapArtifacts.content })
    .from(sourcemapArtifacts)
    .where(and(eq(sourcemapArtifacts.appId, appRow.id), eq(sourcemapArtifacts.release, s.release)));
  if (artifacts.length > 0) symbolicated = symbolicateFrames(s.stack, artifacts);
}
const effectiveStack = symbolicated ?? s.stack;
const fingerprint = fingerprintError({
  name: s.name, message: s.message, stack: effectiveStack, explicit: s.fingerprint,
});
// issue upsert: culprit: culpritFrom(effectiveStack)
// ...and in the onConflictDoUpdate set, add: culprit: sql`COALESCE(EXCLUDED.culprit, ${issues.culprit})`
```

and extend `toPayload` to accept and store the symbolicated stack:

```ts
function toPayload(s: IngestSignal, stackSymbolicated: SymbolicatedFrame[] | null): SignalPayload {
  const payload: SignalPayload = { /* as before */ };
  if (stackSymbolicated) payload.stackSymbolicated = stackSymbolicated;
  // ...size guard as before...
  return payload;
}
```

Register in `app.ts`: `registerSourcemapRoutes(app, context);`

**Fingerprint-stability note (this is intentional):** fingerprinting runs on symbolicated frames when maps exist and raw frames otherwise, so the same error before/after uploading maps may open two issues. Accepted v1 trade-off — the alternative (always raw) makes minified `inApp` detection useless. The next occurrence after upload groups consistently.

- [ ] **Step 7: Run all tests** → PASS (the pre-existing ingest tests must still pass — symbolication is a no-op without artifacts).

- [ ] **Step 8: Commit**

```bash
git add apps/signals/src
git commit -m "feat(signals): sourcemap upload + ingest-time symbolication with culprit refresh" -- apps/signals
```

---

### Task 10: Dev wiring, docs touch-ups, full-suite gate

**Files:**
- Modify: `mprocs.yaml` (add signals pane)
- Modify: `docs/superpowers/specs/2026-07-18-signals-error-collector-design.md` (sourcemap upload = JSON, not multipart)
- Modify: `.claude/skills/running-the-stack/SKILL.md` (add signals port to the ports table — match the file's existing format)

**Interfaces:**
- Produces: `pnpm dev` runs the collector on :4640 against the `signals` database.

- [ ] **Step 1: Add the mprocs pane**

In `mprocs.yaml`, after the `eer:` block:

```yaml
  signals:
    shell: pnpm --filter @tickets/signals dev
```

(No env needed: `SIGNALS_PORT` defaults to 4640 and `SIGNALS_DATABASE` defaults to `signals`, independent of the tickets_dev switch.)

- [ ] **Step 2: Update the spec's sourcemap line**

In the spec, replace the Management API line
`- POST /ingest/:key/sourcemaps — multipart upload: release + map files`
with
`- POST /ingest/:key/sourcemaps — JSON upload: { release, files: [{ filename, content }] } (content = raw .map text; 50 MB body limit)`

- [ ] **Step 3: Update running-the-stack ports**

Add a line for signals (`4640 — signals collector (dev: pnpm dev pane "signals")`) wherever the skill lists api 4600 / web 4620 / eer 4630, matching its formatting.

- [ ] **Step 4: Verify end to end**

```bash
pnpm --filter @tickets/signals typecheck
pnpm --filter @tickets/signals test
pnpm typecheck
```

Expected: all green; `pnpm typecheck` proves the new app doesn't break the monorepo turbo graph.

Then a live smoke: run `pnpm --filter @tickets/signals dev`, and in another shell:

```bash
curl -s http://127.0.0.1:4640/health
curl -s -X POST http://127.0.0.1:4640/apps -H 'content-type: application/json' -d '{"name":"smoke"}'
# use the returned ingestKey:
curl -s -X POST http://127.0.0.1:4640/ingest/<key> -H 'content-type: application/json' -d '{"signals":[{"kind":"error","sessionId":"s1","name":"TypeError","message":"boom","mechanism":"manual","level":"error","timestamp":"2026-07-21T12:00:00Z","platform":{"runtime":"node"},"sdk":{"name":"curl","version":"0"}}]}'
curl -s http://127.0.0.1:4640/issues
```

Expected: health ok → app created → `{"accepted":1}` → issues list with one `SGL-1` row.

- [ ] **Step 5: Commit**

```bash
git add mprocs.yaml docs/superpowers/specs/2026-07-18-signals-error-collector-design.md .claude/skills/running-the-stack
git commit -m "feat(signals): dev wiring (mprocs pane), spec + running-the-stack updates" -- mprocs.yaml docs .claude/skills/running-the-stack
```

---

## Self-review notes

- **Spec coverage:** ingest envelope/limits (T6), fingerprinting rules (T3), issue lifecycle incl. reopen/ignored (T6), symbolication + culprit refresh (T9), rate limit (T6/T4), apps + DSN (T5), issues list/detail/patch/occurrences + sparklines + distinct counts + release range (T7), session timeline + crashed/duration/counts (T8), db-size meta (T5), CORS-open ingest (T6), dev wiring (T10). Deferred by design: `GET /sdk.js` (plan 2), docker/nginx `/signals-api` proxy (plan 3), retention (post-v1).
- **Known deviations from spec, accepted:** issue `key` derived from id (no column); sourcemap upload is JSON not multipart (spec updated in T10); `min/max` release is lexicographic.
- **Type consistency:** `buildApp({ db, rateLimiter? })`; `registerXRoutes(app, { db })`; frames types live in `src/types.ts` and are reused by fingerprint/symbolicate/ingest.

## Post-merge follow-ups (from final whole-branch review, 2026-07-21)

Deferred, none merge-blocking — pick up in plans 2/3 or a cleanup pass:
- Cap `stack` array length in the ingest schema (~128 frames) so the ~200 KB truncation claim is honest (plan 2, alongside SDK batching).
- POST /apps slug race: catch pg 23505 → 409 (DB unique constraint already prevents duplicates).
- Issues list: level filter post-pagination / `total` ignores level (documented v1 limitation; revisit when the UI exposes it).
- Sparkline oldest slot undercounts (since-cutoff is an instant, not a day boundary).
- Culprit can be clobbered by a later unsymbolicated occurrence when the fingerprint is message-only.
- Fingerprint instability when maps lack `names` (falls back to minified function names).
- Escape `%`/`_` in the issues `?q=` ilike pattern.
- Add `OPTIONS /ingest/:key/sourcemaps` preflight if browser uploads ever happen (CLI-only in plan 2).
- Close the postgres pool in server.ts shutdown.
- **Plan 3 must include:** vite dev proxy `/signals-api/*` → 127.0.0.1:4640 (spec Architecture/Dev line; not implemented here by design) + nginx/docker wiring + `GET /sdk.js` (plan 2).
- Symbolicate tests: add fixture variants covering the leading-`../` strip and `names`-fallback branches.
