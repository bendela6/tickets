# Assignee Field (Claude Models) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an `assignee` select field (options = Claude models) to every project, with a planning instruction in the field's `config.description` that the MCP `get_board` tool surfaces to agents.

**Architecture:** Reuse the existing custom-field machinery. A shared constants module defines the field once; `seed-project.ts` consumes it for new projects and an idempotent backfill script consumes it for existing ones. One small MCP change makes field descriptions agent-visible. No API changes, no schema changes, no UI work.

**Tech Stack:** TypeScript (ESM), Drizzle ORM + postgres-js, tsx scripts, pnpm workspaces. Spec: `docs/superpowers/specs/2026-07-05-assignee-field-design.md`.

## Global Constraints

- **No test framework exists in this repo** — do not add one. Verification = `pnpm typecheck` + the executable verification steps below (throwaway database `tickets_seed_check`, JSON-RPC pipe into the MCP server).
- Dev database: `postgres://postgres:postgres@127.0.0.1:5532/tickets` (from the workspace-root `.env`). Dev API: `http://127.0.0.1:4600`.
- Env overrides like `POSTGRES_DATABASE=x pnpm db:migrate` work because `packages/db/src/environment.ts` uses `process.loadEnvFile`, which never overwrites already-set variables — but each verification block re-asserts this before mutating anything.
- Field definition (copy verbatim, from the spec): key `assignee`, label `Assignee`, type `select`, `system: true`, `required: false`, attached to `task` and `subtask`.
- Option values/labels/colors verbatim: `claude-fable-5`/Fable 5/`#8f7ae8`, `claude-opus-4-8`/Opus 4.8/`#3987e5`, `claude-sonnet-5`/Sonnet 5/`#0ca30c`, `claude-haiku-4-5`/Haiku 4.5/`#898781`.
- `config.description` text verbatim (single string, no line breaks): `Which Claude model this ticket is assigned to. When Claude plans a ticket (brainstorming/designing), it must also decide which model fits the task and set this field — weigh task complexity against cost and speed: claude-fable-5 for the most demanding reasoning and long-horizon agentic work, claude-opus-4-8 for hard coding and agentic tasks, claude-sonnet-5 for well-specified implementation work, claude-haiku-4-5 for quick mechanical changes.`
- Run shell commands with the Bash tool (Git Bash syntax). Working directory: repo root `c:\Users\bbend\Desktop\Projects\tickets` unless a step says otherwise.
- Commit after every task; never commit the throwaway verification database or scratch files (none of the verification steps create files).

---

### Task 1: Shared field definition + seed for new projects

**Files:**
- Create: `packages/db/src/seed/assignee-field.ts`
- Modify: `packages/db/src/seed/seed-project.ts`

**Interfaces:**
- Consumes: nothing new — `fields`, `fieldOptions`, `ticketTypeFields` tables from `packages/db/src/schema`.
- Produces (Task 2 imports these exact names from `./assignee-field`):
  - `ASSIGNEE_FIELD: { key: 'assignee'; label: 'Assignee'; type: 'select'; config: { description: string } }`
  - `ASSIGNEE_OPTIONS: readonly { value: string; label: string; color: string }[]` (4 entries, seed order = option position)

- [ ] **Step 1: Create the shared definition module**

Create `packages/db/src/seed/assignee-field.ts`:

```ts
// Single source of truth for the assignee field — consumed by the project
// seed (new projects) and the backfill script (existing projects).
export const ASSIGNEE_FIELD = {
  key: 'assignee',
  label: 'Assignee',
  type: 'select',
  config: {
    description:
      'Which Claude model this ticket is assigned to. When Claude plans a ticket (brainstorming/designing), it must also decide which model fits the task and set this field — weigh task complexity against cost and speed: claude-fable-5 for the most demanding reasoning and long-horizon agentic work, claude-opus-4-8 for hard coding and agentic tasks, claude-sonnet-5 for well-specified implementation work, claude-haiku-4-5 for quick mechanical changes.',
  },
} as const;

export const ASSIGNEE_OPTIONS = [
  { value: 'claude-fable-5', label: 'Fable 5', color: '#8f7ae8' },
  { value: 'claude-opus-4-8', label: 'Opus 4.8', color: '#3987e5' },
  { value: 'claude-sonnet-5', label: 'Sonnet 5', color: '#0ca30c' },
  { value: 'claude-haiku-4-5', label: 'Haiku 4.5', color: '#898781' },
] as const;
```

- [ ] **Step 2: Wire it into `seed-project.ts`**

Five edits to `packages/db/src/seed/seed-project.ts`:

(a) Add the import below the existing `ensureUser` import:

```ts
import { ASSIGNEE_FIELD, ASSIGNEE_OPTIONS } from './assignee-field';
```

(b) In the `insertedFields` values array, append after the `area` entry:

```ts
        {
          projectId: project.id,
          key: ASSIGNEE_FIELD.key,
          label: ASSIGNEE_FIELD.label,
          type: ASSIGNEE_FIELD.type,
          system: true,
          config: ASSIGNEE_FIELD.config,
        },
```

(c) Replace the two field-key lists:

```ts
    const taskFieldKeys = ['title', 'description', 'status', 'severity', 'epic', 'area', 'assignee'];
    const subtaskFieldKeys = ['title', 'status', 'description', 'assignee'];
```

(d) Directly after the `insertedSeverities` insert block, add:

```ts
    await tx.insert(fieldOptions).values(
      ASSIGNEE_OPTIONS.map((option, position) => {
        return {
          fieldId: requireField('assignee').id,
          value: option.value,
          label: option.label,
          position,
          config: { color: option.color },
        };
      }),
    );
```

(e) In the Default view's `columns` array, insert the Assignee column between Severity and Status:

```ts
          { source: 'field', fieldId: requireField('severity').id },
          { source: 'field', fieldId: requireField('assignee').id },
          { source: 'field', fieldId: requireField('status').id },
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @tickets/db typecheck`
Expected: exits 0, no errors.

- [ ] **Step 4: Verify by seeding a throwaway database**

Create the throwaway DB and prove the env override wins before mutating anything:

```bash
cd packages/db
pnpm exec tsx -e "import postgres from 'postgres'; const sql = postgres('postgres://postgres:postgres@127.0.0.1:5532/postgres', { max: 1 }); await sql.unsafe('DROP DATABASE IF EXISTS tickets_seed_check'); await sql.unsafe('CREATE DATABASE tickets_seed_check'); await sql.end(); console.log('tickets_seed_check ready');"
POSTGRES_DATABASE=tickets_seed_check pnpm exec tsx -e "import { connectionUrl } from './src/environment'; if (!connectionUrl.endsWith('/tickets_seed_check')) throw new Error('env override failed: ' + connectionUrl); console.log('override ok');"
```

Expected: `tickets_seed_check ready` then `override ok`. **If the override check throws, STOP** — do not run migrate/seed, the commands would hit the dev DB.

```bash
POSTGRES_DATABASE=tickets_seed_check pnpm db:migrate
POSTGRES_DATABASE=tickets_seed_check pnpm db:seed CHK "Seed Check" CHK
```

Expected: migrate applies all migrations; seed prints `seeded project CHK (#1): 2 types, 10 statuses, 7 fields` (7 fields — was 6 before this task).

- [ ] **Step 5: Assert the seeded shape**

```bash
cd packages/db
pnpm exec tsx -e "
import postgres from 'postgres';
const sql = postgres('postgres://postgres:postgres@127.0.0.1:5532/tickets_seed_check', { max: 1 });
const [field] = await sql\`select f.id, f.system, f.config from fields f join projects p on p.id = f.project_id where p.key = 'CHK' and f.key = 'assignee'\`;
if (!field) throw new Error('assignee field missing');
if (!field.system) throw new Error('assignee field is not system');
if (!String(field.config.description ?? '').includes('decide which model fits the task')) throw new Error('description missing');
const options = await sql\`select value, label, config, position from field_options where field_id = \${field.id} order by position\`;
if (options.length !== 4) throw new Error('expected 4 options, got ' + options.length);
if (options.map(o => o.value).join(',') !== 'claude-fable-5,claude-opus-4-8,claude-sonnet-5,claude-haiku-4-5') throw new Error('option values wrong: ' + options.map(o => o.value).join(','));
if (options[0].config.color !== '#8f7ae8') throw new Error('fable color wrong');
const attach = await sql\`select tt.key, ttf.required from ticket_type_fields ttf join ticket_types tt on tt.id = ttf.ticket_type_id where ttf.field_id = \${field.id} order by tt.key\`;
if (attach.length !== 2 || attach.some(a => a.required)) throw new Error('attachments wrong: ' + JSON.stringify(attach));
const [view] = await sql\`select v.config from views v join projects p on p.id = v.project_id where p.key = 'CHK'\`;
if (!view.config.columns.some(c => c.source === 'field' && c.fieldId === field.id)) throw new Error('view column missing');
await sql.end();
console.log('seed check passed');
"
```

Expected: `seed check passed`. (Leave `tickets_seed_check` in place — Task 2 reuses it; Task 2 drops it.)

- [ ] **Step 6: Commit**

```bash
git add packages/db/src/seed/assignee-field.ts packages/db/src/seed/seed-project.ts
git commit -m "feat(db): seed assignee field (Claude model select) on new projects"
```

---

### Task 2: Idempotent backfill script for existing projects

**Files:**
- Create: `packages/db/src/seed/backfill-assignee-field.ts`
- Modify: `packages/db/package.json` (scripts), `package.json` (root scripts)

**Interfaces:**
- Consumes: `ASSIGNEE_FIELD`, `ASSIGNEE_OPTIONS` from `./assignee-field` (Task 1); `createDbClient` from `../client`.
- Produces: pnpm script `db:backfill-assignee` (package + root). Console output per project: `` `${key}: assignee field added (${n} types attached)` `` or `` `${key}: assignee field already present — skipped` ``.

- [ ] **Step 1: Write the backfill script**

Create `packages/db/src/seed/backfill-assignee-field.ts`:

```ts
import { and, eq, isNull } from 'drizzle-orm';
import { createDbClient } from '../client';
import { fieldOptions, fields, projects, ticketTypeFields, ticketTypes } from '../schema';
import { ASSIGNEE_FIELD, ASSIGNEE_OPTIONS } from './assignee-field';

// Adds the assignee field to every project that lacks it. Idempotent: rerun
// safely — projects that already have the field are skipped.
const { db, sql } = createDbClient({ max: 1 });

const allProjects = await db.select().from(projects);

for (const project of allProjects) {
  const [existing] = await db
    .select({ id: fields.id })
    .from(fields)
    .where(and(eq(fields.projectId, project.id), eq(fields.key, ASSIGNEE_FIELD.key)));
  if (existing) {
    console.log(`${project.key}: assignee field already present — skipped`);
    continue;
  }

  await db.transaction(async (tx) => {
    const [field] = await tx
      .insert(fields)
      .values({
        projectId: project.id,
        key: ASSIGNEE_FIELD.key,
        label: ASSIGNEE_FIELD.label,
        type: ASSIGNEE_FIELD.type,
        system: true,
        config: ASSIGNEE_FIELD.config,
      })
      .returning();
    if (!field) {
      throw new Error(`field insert returned no row for project ${project.key}`);
    }

    await tx.insert(fieldOptions).values(
      ASSIGNEE_OPTIONS.map((option, position) => {
        return {
          fieldId: field.id,
          value: option.value,
          label: option.label,
          position,
          config: { color: option.color },
        };
      }),
    );

    const liveTypes = await tx
      .select()
      .from(ticketTypes)
      .where(and(eq(ticketTypes.projectId, project.id), isNull(ticketTypes.archivedAt)));

    for (const type of liveTypes) {
      const attachments = await tx
        .select({ position: ticketTypeFields.position })
        .from(ticketTypeFields)
        .where(eq(ticketTypeFields.ticketTypeId, type.id));
      const nextPosition = attachments.reduce((max, row) => Math.max(max, row.position + 1), 0);
      await tx.insert(ticketTypeFields).values({
        ticketTypeId: type.id,
        fieldId: field.id,
        position: nextPosition,
        required: false,
      });
    }

    console.log(`${project.key}: assignee field added (${liveTypes.length} types attached)`);
  });
}

await sql.end();
```

- [ ] **Step 2: Add the pnpm scripts**

In `packages/db/package.json`, add to `scripts` (after `"db:import"`):

```json
    "db:backfill-assignee": "tsx src/seed/backfill-assignee-field.ts",
```

In the root `package.json`, add to `scripts` (after `"db:import"`):

```json
    "db:backfill-assignee": "pnpm --filter @tickets/db db:backfill-assignee",
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @tickets/db typecheck`
Expected: exits 0.

- [ ] **Step 4: Verify add + skip paths on the throwaway DB**

The `tickets_seed_check` DB from Task 1 has project CHK *with* the field (new seed). Strip it to simulate a legacy project, then backfill:

```bash
cd packages/db
pnpm exec tsx -e "
import postgres from 'postgres';
const sql = postgres('postgres://postgres:postgres@127.0.0.1:5532/tickets_seed_check', { max: 1 });
const [field] = await sql\`select f.id from fields f join projects p on p.id = f.project_id where p.key = 'CHK' and f.key = 'assignee'\`;
if (!field) throw new Error('nothing to strip');
await sql\`delete from ticket_type_fields where field_id = \${field.id}\`;
await sql\`delete from field_options where field_id = \${field.id}\`;
await sql\`delete from fields where id = \${field.id}\`;
await sql.end();
console.log('stripped assignee from CHK');
"
POSTGRES_DATABASE=tickets_seed_check pnpm exec tsx -e "import { connectionUrl } from './src/environment'; if (!connectionUrl.endsWith('/tickets_seed_check')) throw new Error('env override failed: ' + connectionUrl); console.log('override ok');"
POSTGRES_DATABASE=tickets_seed_check pnpm db:backfill-assignee
```

Expected: `stripped assignee from CHK`, `override ok`, then `CHK: assignee field added (2 types attached)`.

Run it again to prove idempotency:

```bash
POSTGRES_DATABASE=tickets_seed_check pnpm db:backfill-assignee
```

Expected: `CHK: assignee field already present — skipped`.

Re-run the Task 1 Step 5 assertion block verbatim, with one exception: **the final view-column check will now fail for the backfilled field** (backfill deliberately does not touch views). So run this variant (identical except the view check asserts absence):

```bash
pnpm exec tsx -e "
import postgres from 'postgres';
const sql = postgres('postgres://postgres:postgres@127.0.0.1:5532/tickets_seed_check', { max: 1 });
const [field] = await sql\`select f.id, f.system, f.config from fields f join projects p on p.id = f.project_id where p.key = 'CHK' and f.key = 'assignee'\`;
if (!field) throw new Error('assignee field missing');
if (!field.system) throw new Error('assignee field is not system');
if (!String(field.config.description ?? '').includes('decide which model fits the task')) throw new Error('description missing');
const options = await sql\`select value, config, position from field_options where field_id = \${field.id} order by position\`;
if (options.map(o => o.value).join(',') !== 'claude-fable-5,claude-opus-4-8,claude-sonnet-5,claude-haiku-4-5') throw new Error('option values wrong');
const attach = await sql\`select ttf.required from ticket_type_fields ttf where ttf.field_id = \${field.id}\`;
if (attach.length !== 2 || attach.some(a => a.required)) throw new Error('attachments wrong');
const [view] = await sql\`select v.config from views v join projects p on p.id = v.project_id where p.key = 'CHK'\`;
if (view.config.columns.some(c => c.source === 'field' && c.fieldId === field.id)) throw new Error('backfill must not touch views');
await sql.end();
console.log('backfill check passed');
"
```

Expected: `backfill check passed`.

- [ ] **Step 5: Drop the throwaway DB**

```bash
pnpm exec tsx -e "import postgres from 'postgres'; const sql = postgres('postgres://postgres:postgres@127.0.0.1:5532/postgres', { max: 1 }); await sql.unsafe('DROP DATABASE tickets_seed_check'); await sql.end(); console.log('dropped tickets_seed_check');"
```

Expected: `dropped tickets_seed_check`.

- [ ] **Step 6: Commit**

```bash
git add packages/db/src/seed/backfill-assignee-field.ts packages/db/package.json package.json
git commit -m "feat(db): idempotent backfill script for the assignee field"
```

---

### Task 3: MCP — surface field descriptions in `get_board`

**Files:**
- Modify: `apps/mcp/src/types.ts` (the `Field` type)
- Modify: `apps/mcp/src/tools/get-board.ts` (the fields mapping)

**Interfaces:**
- Consumes: the API board payload, which already returns `config: object` on every field (`docs/api/get-board.md`) — the lean MCP mirror just doesn't declare it yet.
- Produces: `get_board` field entries shaped `{ key: string; type: string; options?: string[]; description?: string }`. `description` comes from `field.config.description`; the key is omitted (not `null`) when absent — `toText` uses `JSON.stringify`, which drops `undefined` properties.

- [ ] **Step 1: Add `config` to the MCP `Field` mirror**

In `apps/mcp/src/types.ts`, replace the `Field` type:

```ts
export type Field = {
  id: number;
  key: string;
  label: string;
  type: string;
  config: Record<string, unknown>;
  archivedAt: string | null;
  options: { id: number; value: string; label: string; archivedAt: string | null }[];
};
```

- [ ] **Step 2: Surface `description` in `get-board.ts`**

In `apps/mcp/src/tools/get-board.ts`, replace the fields mapping (the `.map((field) => ({ ... }))` inside `fields:`):

```ts
          fields: board.fields
            .filter((field) => !field.archivedAt)
            .map((field) => ({
              key: field.key,
              type: field.type,
              options:
                field.options.length > 0
                  ? field.options
                      .filter((option) => !option.archivedAt)
                      .map((option) => option.value)
                  : undefined,
              description:
                typeof field.config.description === 'string'
                  ? field.config.description
                  : undefined,
            })),
```

Also update the tool description string (same file) so agents know the guidance is there — replace the `description:` literal with:

```ts
      description:
        'Project orientation: vocabulary (ticket types, statuses with kinds, fields with agent-facing descriptions, epics, link types) plus one summary row per ticket (no ticket descriptions or comments — use get_ticket for depth). Call this before working in a project.',
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @tickets/mcp typecheck`
Expected: exits 0.

- [ ] **Step 4: Structural smoke test over stdio**

Needs the dev API up. Check first; start it in the background only if the check fails:

```bash
curl -s http://127.0.0.1:4600/api/projects >/dev/null && echo API_UP || echo API_DOWN
```

If `API_DOWN`: run `pnpm --filter @tickets/api dev` in the background, wait for its "listening" log line, re-run the check.

Then pipe a JSON-RPC exchange into a fresh MCP server process:

```bash
cd apps/mcp
printf '%s\n' \
 '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"verify","version":"0.0.0"}}}' \
 '{"jsonrpc":"2.0","method":"notifications/initialized"}' \
 '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"get_board","arguments":{"projectKey":"TASK"}}}' \
 | pnpm exec tsx src/server.ts
```

Expected: the `id:2` response contains a JSON text payload with a `fields` array where every entry has `key` and `type`. At this point **no field has a `description` key yet** (the dev DB isn't backfilled until Task 5) — assert the shape is valid JSON and no entry has `"description":null`. The positive description check happens in Task 5.

- [ ] **Step 5: Commit**

```bash
git add apps/mcp/src/types.ts apps/mcp/src/tools/get-board.ts
git commit -m "feat(mcp): surface field config.description in get_board"
```

---

### Task 4: Documentation

**Files:**
- Modify: `docs/mcp/get-board.md`
- Modify: `docs/api/create-field.md`

**Interfaces:**
- Consumes: the output shape produced by Task 3.
- Produces: docs matching the shipped behavior (docs pages stay self-contained on types — every named type used on a page is defined on that page).

- [ ] **Step 1: Update `docs/mcp/get-board.md`**

(a) In the Output type block, replace the `fields` member with:

```ts
  fields: {                    // unarchived
    key: string;
    type: string;              // text · number · date · boolean · json · select · multi_select · status
    options?: string[];        // present for select / multi_select fields
    description?: string;      // agent-facing guidance from the field's config.description
  }[];
```

(b) In the Behavior section, replace the collapsing clause so it reads:

```md
- Calls [`GET /api/projects/:key/board`](../api/get-board.md) once and
  reshapes it — filtering archived vocabulary, collapsing fields to
  key/type/options/description, and summarizing tickets.
```

- [ ] **Step 2: Update `docs/api/create-field.md`**

In the Request body block, replace the `config` line with:

```ts
  config?: object;  // free-form, e.g. { widget: 'markdown' }; default {}.
                    // config.description is agent-facing guidance surfaced by
                    // the MCP get_board tool (e.g. the assignee field tells
                    // Claude to pick a model while planning)
```

- [ ] **Step 3: Commit**

```bash
git add docs/mcp/get-board.md docs/api/create-field.md
git commit -m "docs: field description surfacing in get_board and create-field"
```

---

### Task 5: Rollout to the dev database + end-to-end verification

**Files:** none (runs the Task 2 script against the real dev DB; no code changes).

**Interfaces:**
- Consumes: `pnpm db:backfill-assignee` (Task 2), the MCP JSON-RPC smoke-test pattern (Task 3 Step 4).

- [ ] **Step 1: Backfill the four existing projects**

From the repo root (no env override — this run is *meant* for the dev `tickets` DB):

```bash
pnpm db:backfill-assignee
```

Expected — one `added` line per project, order may vary:

```
TASK: assignee field added (2 types attached)
APP: assignee field added (2 types attached)
GW: assignee field added (2 types attached)
TIX: assignee field added (2 types attached)
```

(If a project reports a different type count, that project simply has more/fewer live ticket types — fine.)

- [ ] **Step 2: Prove idempotency on real data**

```bash
pnpm db:backfill-assignee
```

Expected: four `already present — skipped` lines.

- [ ] **Step 3: Verify the API payload**

(Ensure the dev API is running, as in Task 3 Step 4.)

```bash
cd apps/mcp
pnpm exec tsx -e "
const board = await (await fetch('http://127.0.0.1:4600/api/projects/TASK/board')).json();
const field = board.fields.find((f) => f.key === 'assignee');
if (!field) throw new Error('assignee missing from board payload');
if (!String(field.config.description ?? '').includes('decide which model fits the task')) throw new Error('description missing');
if (field.options.map((o) => o.value).join(',') !== 'claude-fable-5,claude-opus-4-8,claude-sonnet-5,claude-haiku-4-5') throw new Error('options wrong');
console.log('api board check passed');
"
```

Expected: `api board check passed`.

- [ ] **Step 4: Verify what an agent sees (MCP `get_board`)**

```bash
cd apps/mcp
printf '%s\n' \
 '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"verify","version":"0.0.0"}}}' \
 '{"jsonrpc":"2.0","method":"notifications/initialized"}' \
 '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"get_board","arguments":{"projectKey":"TASK"}}}' \
 | pnpm exec tsx src/server.ts
```

Expected: the `id:2` payload's `fields` array contains an entry with `"key":"assignee"`, `"options":["claude-fable-5","claude-opus-4-8","claude-sonnet-5","claude-haiku-4-5"]`, and a `"description"` containing `decide which model fits the task`.

- [ ] **Step 5: Write-path check — valid and invalid assignee values**

Create one real ticket in TIX (the project tracking this app — genuinely useful data, not pollution) with an assignee, then confirm an invalid model is rejected:

```bash
cd apps/mcp
printf '%s\n' \
 '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"verify","version":"0.0.0"}}}' \
 '{"jsonrpc":"2.0","method":"notifications/initialized"}' \
 '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"create_ticket","arguments":{"projectKey":"TIX","typeKey":"task","values":{"title":"Assignee field: verified end-to-end","assignee":"claude-sonnet-5"}}}}' \
 '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"create_ticket","arguments":{"projectKey":"TIX","typeKey":"task","values":{"title":"should fail","assignee":"gpt-5"}}}}' \
 | pnpm exec tsx src/server.ts
```

Expected: the `id:2` response reports `created: true` with a ticket number; the `id:3` response is an `isError` result whose message names the unknown option value (`gpt-5`). Note the created ticket number, then exercise the update path (the spec's real flow — planning updates the assignee) and confirm the value round-trips:

```bash
printf '%s\n' \
 '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"verify","version":"0.0.0"}}}' \
 '{"jsonrpc":"2.0","method":"notifications/initialized"}' \
 '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"update_ticket","arguments":{"projectKey":"TIX","ticketNumber":<NUMBER FROM ABOVE>,"values":{"assignee":"claude-opus-4-8"}}}}' \
 '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"get_ticket","arguments":{"projectKey":"TIX","ticketNumber":<NUMBER FROM ABOVE>}}}' \
 '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"list_ticket_events","arguments":{"projectKey":"TIX","ticketNumber":<NUMBER FROM ABOVE>}}}' \
 | pnpm exec tsx src/server.ts
```

Expected: `id:2` reports the update succeeded; `id:3` shows `"assignee":"claude-opus-4-8"`; `id:4` lists a `created` event and an update event whose payload mentions `assignee` — the audit trail covers assignment changes.

- [ ] **Step 6: Full typecheck and wrap up**

```bash
pnpm typecheck
```

Expected: all packages pass. Nothing new to commit in this task (data-only rollout); confirm `git status` shows a clean tree.
