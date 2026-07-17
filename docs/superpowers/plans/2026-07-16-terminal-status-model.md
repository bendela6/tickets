# Terminal Status Model + Archive — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give terminal sessions an honest status model (`live`/`disconnected` + startup reconcile — no more "running forever" ghosts), an output-based Running/Ready pulse on the terminal screen, and archive/unarchive.

**Architecture:** Extends AI Sessions v2. DB gains two enum values + an `archived_at` column. The supervisor persists `live` for terminals and the app reconciles orphans on boot. Archive mirrors the existing workspace/agent pattern. The "is something running" signal is a client-side output pulse on the open terminal only (foreground-name detection via OSC 133 shell integration is verified-doable but deferred to the profiles subsystem).

**Tech Stack:** apps/api (Fastify 5, valibot, drizzle, node-pty behind a Runner seam), apps/web (React 19, TanStack Router/Query, Tailwind v4 Instrument preflight ON, vitest + Testing Library), packages/db (drizzle + postgres-js).

## Global Constraints

- Spec of record: `docs/superpowers/specs/2026-07-16-terminal-status-model-design.md`.
- One commit per task; conventional commits scoped by app.
- New enum values are ADDED to the existing `session_status` type (not a new enum). Agents keep `running`/`idle`/`awaiting_input`/`interrupted` — do not touch agent status transitions.
- Terminals persist `live` (not `running`) on start; `disconnected` for orphans; `failed` renders "Couldn't start"; `exited` keeps the exit code.
- Reconcile SQL (verbatim): flip `ended_at IS NULL AND status IN ('starting','running','live','idle','awaiting_input','interrupted')` → `disconnected`, stamp `ended_at`.
- Archive: `archived_at` nullable timestamp; list excludes archived unless `?archived=true`; archiving a live session ends it first.
- The output pulse is client-side (terminal screen only); NO new socket frame, NO server poll, NO `foreground_process` column.
- Existing suites stay green (135 api · 133 web · 18 db); run `pnpm typecheck` + `pnpm build`. API tests need Docker Postgres `tickets-postgres-1` @ 127.0.0.1:5532 (gitignored `.env`).
- Dev stack for manual smoke: api :4700 / web :4720 (http://localhost:4720) / DB `tickets_e2dev`.

---

## File Structure

**DB (packages/db)**
- `src/schema/enums.ts` — add `live`, `disconnected` to `sessionStatusEnum`.
- `src/schema/ai-sessions.ts` — add `archivedAt` column.
- `drizzle/00NN_*.sql` (+ snapshot/journal) — generated migration (verify the ADD VALUEs).

**API (apps/api)**
- `src/ai/types.ts` — `SessionStatus` union gains `live`/`disconnected`.
- `src/ai/db-session-store.ts` — `setArchived`, `reconcileOrphaned`.
- `src/ai/supervisor.ts` — terminal `start()` persists/broadcasts `live`.
- `src/app.ts` — call `reconcileOrphaned()` once at wire-up.
- `src/routes/ai.routes.ts` — list `archived` filter; `archive`/`unarchive` handlers + registration.
- Tests: `db-session-store.test.ts` (or a focused test), `supervisor.test.ts`, `ai.routes.test.ts`.

**Web (apps/web)**
- `src/api/types.ts` — `SessionStatus` +`live`/`disconnected`; `AiSession.archivedAt`.
- `src/ui/session-status-pill.tsx` — extend union, add `live`/`disconnected` visuals, `kind?`/`label?` props.
- `src/components/ai/terminal-display.ts` (new) — pure `terminalDisplay(conn,status,busy)`.
- `src/components/ai/use-terminal-activity.ts` (new) — output pulse hook.
- `src/components/ai/ai-session-screen.tsx` — feed activity + render derived pill.
- `src/components/ai/session-list.tsx` — `kind` on pill + archive hover action.
- `src/components/shell/terminals-panel.tsx` / `agents-panel.tsx` — "Show archived" toggle.
- `src/api/use-ai-sessions.ts` — `{ archived }` param.
- `src/api/use-archive-session.ts` (new) — archive/unarchive mutations.
- Tests: `session-status-pill.test.tsx`, `terminal-display.test.ts`, `use-terminal-activity.test.ts`.

---

## Task 1: DB — enum values + archive column

**Files:**
- Modify: `packages/db/src/schema/enums.ts:35-44`
- Modify: `packages/db/src/schema/ai-sessions.ts`
- Create: `packages/db/drizzle/00NN_*.sql` (generated)
- Test: `packages/db/src/*.test.ts` (existing migrate harness covers apply)

**Interfaces:**
- Produces: `session_status` enum includes `live`, `disconnected`; `ai_sessions.archived_at timestamptz` nullable.

- [ ] **Step 1: Extend the enum**

In `packages/db/src/schema/enums.ts`, add the two values (order after `idle` keeps them grouped with live states, but Postgres appends regardless):

```ts
export const sessionStatusEnum = pgEnum('session_status', [
  'starting',
  'live',
  'running',
  'idle',
  'awaiting_input',
  'interrupted',
  'disconnected',
  'exited',
  'failed',
]);
```

- [ ] **Step 2: Add the archive column**

In `packages/db/src/schema/ai-sessions.ts`, beside `endedAt`, add:

```ts
    archivedAt: timestamp('archived_at', { withTimezone: true, mode: 'string' }),
```

- [ ] **Step 3: Generate the migration**

Run: `pnpm --filter @tickets/db db:generate`
Open the new `packages/db/drizzle/00NN_*.sql`. It MUST contain both `ALTER TYPE "public"."session_status" ADD VALUE ...` lines (for `live` and `disconnected`) and `ALTER TABLE "ai_sessions" ADD COLUMN "archived_at" timestamp with time zone`. drizzle-kit sometimes misses enum-value additions — if either ADD VALUE is absent, hand-add them at the TOP of the file:

```sql
ALTER TYPE "public"."session_status" ADD VALUE IF NOT EXISTS 'live';
ALTER TYPE "public"."session_status" ADD VALUE IF NOT EXISTS 'disconnected';
```

(ADD VALUE cannot run in the same transaction that uses the value; this migration only adds them, so it is safe.)

- [ ] **Step 4: Apply on a scratch DB**

Run: `pnpm --filter @tickets/db test`
Expected: PASS (18 tests) — the harness creates a scratch DB and runs every migration; a malformed migration fails here.

- [ ] **Step 5: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/db/src/schema/enums.ts packages/db/src/schema/ai-sessions.ts packages/db/drizzle
git commit -m "feat(db): session_status live/disconnected + ai_sessions.archived_at"
```

---

## Task 2: API — live status, reconcile, archive store methods

**Files:**
- Modify: `apps/api/src/ai/types.ts` (`SessionStatus` union)
- Modify: `apps/api/src/ai/db-session-store.ts`
- Modify: `apps/api/src/ai/supervisor.ts:288-293` (terminal `start`)
- Modify: `apps/api/src/app.ts` (call reconcile at wire-up)
- Test: `apps/api/src/ai/db-session-store.test.ts` (or the store's existing test file), `apps/api/src/ai/supervisor.test.ts`

**Interfaces:**
- Consumes: `SessionStore` (`db-session-store.ts`), the supervisor factory.
- Produces: `store.reconcileOrphaned(): Promise<number>` (returns rows affected); terminal sessions persist `'live'`. (Archive writes go through `db` directly in Task 3 — the route factory has `db`, not the store — so no `store.setArchived` is needed.)

- [ ] **Step 1: Extend the API SessionStatus union**

In `apps/api/src/ai/types.ts`, add `'live'` and `'disconnected'` to the `SessionStatus` union (wherever it is declared — search `type SessionStatus`).

- [ ] **Step 2: Write the failing store tests**

In the store's test file (the one that constructs a real `createDbSessionStore(db)` against the scratch DB — search for `reconcile`/`setStatus` test neighbours; use `db-session-store.test.ts` if present, else the api test that exercises the store), add:

```ts
it('reconcileOrphaned flips live-ish orphans to disconnected and stamps ended_at', async () => {
  const s = await insertSession({ kind: 'terminal', status: 'live' }); // ended_at null
  const done = await insertSession({ kind: 'terminal', status: 'exited', endedAt: NOW });
  const n = await store.reconcileOrphaned();
  expect(n).toBeGreaterThanOrEqual(1);
  const [a] = await db.select().from(aiSessions).where(eq(aiSessions.id, s.id));
  expect(a.status).toBe('disconnected');
  expect(a.endedAt).not.toBeNull();
  const [b] = await db.select().from(aiSessions).where(eq(aiSessions.id, done.id));
  expect(b.status).toBe('exited'); // untouched
});
```

(Use the file's existing session-insert helper / column names; `insertSession`/`NOW` above are placeholders for whatever that file already uses. If it has no helper, insert with `db.insert(aiSessions).values({...}).returning()`. Archive is covered end-to-end by the route tests in Task 3, so no `setArchived` store method is needed.)

- [ ] **Step 3: Run to verify they fail**

Run: `pnpm --filter @tickets/api test -- db-session-store`
Expected: FAIL — `reconcileOrphaned`/`setArchived` are not functions.

- [ ] **Step 4: Implement the store methods**

In `apps/api/src/ai/db-session-store.ts`, add to the returned object (near `setStatus`/`finishSession`), importing `inArray`/`and`/`isNull` from `drizzle-orm` as needed:

```ts
    async reconcileOrphaned(): Promise<number> {
      const rows = await db
        .update(aiSessions)
        .set({ status: 'disconnected', endedAt: sql`now()`, updatedAt: sql`now()` })
        .where(
          and(
            isNull(aiSessions.endedAt),
            inArray(aiSessions.status, [
              'starting',
              'running',
              'live',
              'idle',
              'awaiting_input',
              'interrupted',
            ]),
          ),
        )
        .returning({ id: aiSessions.id });
      return rows.length;
    },
```

Add `reconcileOrphaned` to the `SessionStore` interface (same file or `types.ts` where the interface lives).

- [ ] **Step 5: Terminal starts as `live`**

In `apps/api/src/ai/supervisor.ts`, in the `start(spec)` method, replace the terminal bring-up:

```ts
      void store.setStatus(spec.id, 'live');
      broadcast(rs, { type: 'status', status: 'live' });
```

(was `store.markRunning` + `status: 'running'`). Leave `startAgent` untouched. `newSession` may keep its internal default; the persisted + broadcast status is what matters. If `markRunning` is now unused, leave it (agents/tests may use it) — do not remove in this task.

- [ ] **Step 6: Add a supervisor test for the live status**

In `apps/api/src/ai/supervisor.test.ts`, assert a started terminal broadcasts `{ type: 'status', status: 'live' }` (mirror the existing "broadcasts running" test if present, updating the expectation) and that `store.setStatus` was called with `'live'`.

- [ ] **Step 7: Reconcile on boot (production wiring only)**

`app.ts` today creates the store inline inside the default-supervisor branch:
`context.supervisor ?? createSupervisor({ ..., store: createDbSessionStore(context.db) })`. Lift
the store to a named const in that branch and reconcile there, so reconcile runs only when the
REAL supervisor is built (production) and NOT when a test injects `context.supervisor`:

```ts
  const supervisor =
    context.supervisor ??
    (() => {
      const store = createDbSessionStore(context.db);
      void store.reconcileOrphaned().then((n) => {
        if (n > 0) app.log.info({ reconciled: n }, 'marked orphaned sessions disconnected');
      });
      return createSupervisor({ /* ...existing args... */, store });
    })();
```

Keep the existing constructor args identical — only introduce the named `store` and the
reconcile call. This guarantees the route/supervisor test suites (which inject a fake
supervisor) never have their seeded rows reconciled.

- [ ] **Step 8: Run the api tests**

Run: `pnpm --filter @tickets/api test -- db-session-store supervisor`
Expected: PASS. Then `pnpm typecheck`.

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/ai/types.ts apps/api/src/ai/db-session-store.ts apps/api/src/ai/supervisor.ts apps/api/src/app.ts apps/api/src/ai/db-session-store.test.ts apps/api/src/ai/supervisor.test.ts
git commit -m "feat(api): terminals persist live; reconcile orphans to disconnected on boot; archive store methods"
```

---

## Task 3: API — archive routes + list filter

**Files:**
- Modify: `apps/api/src/routes/ai.routes.ts` (listSessions filter; archive/unarchive handlers + registration)
- Test: `apps/api/src/routes/ai.routes.test.ts`

**Interfaces:**
- Consumes: `store.setArchived`, `supervisor.has`/`supervisor.stop`.
- Produces: `GET /api/ai/sessions?archived=true|false`; `POST /api/ai/sessions/:id/archive`; `POST /api/ai/sessions/:id/unarchive`.

- [ ] **Step 1: Write the failing route tests**

In `apps/api/src/routes/ai.routes.test.ts`, add (adapting to the file's `app.inject` helpers + session-seeding):

```ts
it('excludes archived sessions from the list unless ?archived=true', async () => {
  const live = await createTerminalSession();
  const arch = await createTerminalSession();
  await app.inject({ method: 'POST', url: `/api/ai/sessions/${arch.id}/archive` });

  const def = await app.inject({ method: 'GET', url: '/api/ai/sessions' });
  const ids = def.json().map((s: { id: number }) => s.id);
  expect(ids).toContain(live.id);
  expect(ids).not.toContain(arch.id);

  const all = await app.inject({ method: 'GET', url: '/api/ai/sessions?archived=true' });
  expect(all.json().map((s: { id: number }) => s.id)).toContain(arch.id);
});

it('unarchive brings a session back into the list', async () => {
  const s = await createTerminalSession();
  await app.inject({ method: 'POST', url: `/api/ai/sessions/${s.id}/archive` });
  await app.inject({ method: 'POST', url: `/api/ai/sessions/${s.id}/unarchive` });
  const def = await app.inject({ method: 'GET', url: '/api/ai/sessions' });
  expect(def.json().map((r: { id: number }) => r.id)).toContain(s.id);
});
```

(If the test suite has no `createTerminalSession` helper, insert a row directly via the db handle the test already uses, with `status: 'exited'` so no supervisor is needed.)

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm --filter @tickets/api test -- ai.routes`
Expected: FAIL — archive route 404s and the list still returns archived rows.

- [ ] **Step 3: Filter archived from the list**

In `listSessions` (`ai.routes.ts:179-190`), default-exclude archived unless `?archived=true`:

```ts
  const listSessions = async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as { status?: string; kind?: string; archived?: string };
    const conditions = [];
    if (query.status) conditions.push(eq(aiSessions.status, query.status as never));
    if (query.kind) conditions.push(eq(aiSessions.kind, query.kind as never));
    if (query.archived !== 'true') conditions.push(isNull(aiSessions.archivedAt));
    const rows = await db
      .select()
      .from(aiSessions)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(aiSessions.createdAt));
    reply.send(rows);
  };
```

(`isNull` is already imported in this file — it's used by `listWorkspaces`.)

- [ ] **Step 4: Add archive/unarchive handlers**

Add near `stopSession`:

```ts
  const archiveSession = async (request: FastifyRequest, reply: FastifyReply) => {
    const id = parseId((request.params as { id: string }).id);
    const [session] = await db.select().from(aiSessions).where(eq(aiSessions.id, id));
    if (!session) throw new HttpError(404, 'session not found');
    if (supervisor.has(id)) {
      supervisor.stop(id); // its exit handler finalizes status + ended_at
    } else if (!session.endedAt) {
      await db
        .update(aiSessions)
        .set({ status: 'disconnected', endedAt: sql`now()`, updatedAt: sql`now()` })
        .where(eq(aiSessions.id, id));
    }
    await db
      .update(aiSessions)
      .set({ archivedAt: sql`now()`, updatedAt: sql`now()` })
      .where(eq(aiSessions.id, id));
    const [row] = await db.select().from(aiSessions).where(eq(aiSessions.id, id));
    reply.send(row);
  };

  const unarchiveSession = async (request: FastifyRequest, reply: FastifyReply) => {
    const id = parseId((request.params as { id: string }).id);
    const [session] = await db.select().from(aiSessions).where(eq(aiSessions.id, id));
    if (!session) throw new HttpError(404, 'session not found');
    await db
      .update(aiSessions)
      .set({ archivedAt: null, updatedAt: sql`now()` })
      .where(eq(aiSessions.id, id));
    const [row] = await db.select().from(aiSessions).where(eq(aiSessions.id, id));
    reply.send(row);
  };
```

(The route factory already has `db` and does raw `db.update` in `stopSession` — the archive handlers use `db` directly too; no `store` threading needed. `sql`, `eq`, `isNull`, `and`, `desc`, `aiSessions`, `HttpError`, `parseId` are all already imported in this file.)

- [ ] **Step 5: Register the routes**

Beside the other `app.post('/api/ai/sessions/...')` registrations:

```ts
  app.post('/api/ai/sessions/:id/archive', archiveSession);
  app.post('/api/ai/sessions/:id/unarchive', unarchiveSession);
```

- [ ] **Step 6: Run the tests**

Run: `pnpm --filter @tickets/api test -- ai.routes`
Expected: PASS. Then `pnpm typecheck`.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/routes/ai.routes.ts apps/api/src/routes/ai.routes.test.ts
git commit -m "feat(api): archive/unarchive sessions + exclude archived from the list"
```

---

## Task 4: Web — types + kind-aware SessionStatusPill

**Files:**
- Modify: `apps/web/src/api/types.ts` (`SessionStatus`, `AiSession.archivedAt`)
- Modify: `apps/web/src/ui/session-status-pill.tsx`
- Test: `apps/web/src/ui/session-status-pill.test.tsx`

**Interfaces:**
- Produces: `SessionStatusPill` accepts `kind?: SessionKind` and `label?: string`; renders `live` + `disconnected`; terminal wording overrides.

- [ ] **Step 1: Extend web types**

In `apps/web/src/api/types.ts`: add `'live' | 'disconnected'` to `SessionStatus`; add `archivedAt: string | null` to `AiSession`.

- [ ] **Step 2: Write the failing pill tests**

Append to `apps/web/src/ui/session-status-pill.test.tsx`:

```tsx
it('labels the new terminal states', () => {
  render(<SessionStatusPill status="live" kind="terminal" />);
  expect(screen.getByText('Live')).toBeInTheDocument();
});
it('reads failed as "Couldn\'t start" for a terminal', () => {
  render(<SessionStatusPill status="failed" kind="terminal" />);
  expect(screen.getByText("Couldn't start")).toBeInTheDocument();
});
it('keeps the agent/default wording for failed', () => {
  render(<SessionStatusPill status="failed" />);
  expect(screen.getByText('failed')).toBeInTheDocument();
});
it('honours an explicit label override', () => {
  render(<SessionStatusPill status="running" label="Running" />);
  expect(screen.getByText('Running')).toBeInTheDocument();
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `pnpm --filter @tickets/web test -- session-status-pill`
Expected: FAIL — `kind`/`label` props don't exist, `live` isn't in the union.

- [ ] **Step 4: Extend the pill**

In `apps/web/src/ui/session-status-pill.tsx`:

1. Add to the local `SessionStatus` union: `| 'live'` and `| 'disconnected'`.
2. Add PILL entries:

```ts
  live: { className: 'bg-kind-active-subtle text-kind-active', label: 'Live' },
  disconnected: { className: 'bg-kind-dropped-subtle text-kind-dropped', label: 'Disconnected' },
```

3. Add StatusDot cases:

```tsx
    // Alive & attached — a steady filled dot.
    case 'live':
      return <span aria-hidden className="size-2 shrink-0 rounded-full bg-current" />;
    // Lost the process — a hollow ring.
    case 'disconnected':
      return (
        <span aria-hidden className="size-2.5 shrink-0 rounded-full border-[1.5px] border-current opacity-70" />
      );
```

4. Add `kind`/`label` props and a terminal label override:

```tsx
import type { SessionKind } from '../api/types';

const TERMINAL_LABELS: Partial<Record<SessionStatus, string>> = {
  starting: 'Connecting',
  live: 'Live',
  failed: "Couldn't start",
};

export function SessionStatusPill({
  status,
  exitCode,
  kind,
  label,
  className,
}: {
  status: SessionStatus;
  exitCode?: number | null;
  kind?: SessionKind;
  label?: string;
  className?: string;
}) {
  const pill = PILL[status];
  const text = label ?? (kind === 'terminal' ? TERMINAL_LABELS[status] : undefined) ?? pill.label;
  // ...render `text` instead of `pill.label`...
}
```

Replace the `{pill.label}` render with `{text}`.

- [ ] **Step 5: Run to verify pass**

Run: `pnpm --filter @tickets/web test -- session-status-pill`
Expected: PASS. Then `pnpm typecheck`.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/api/types.ts apps/web/src/ui/session-status-pill.tsx apps/web/src/ui/session-status-pill.test.tsx
git commit -m "feat(web): SessionStatusPill gains live/disconnected + kind-aware terminal wording"
```

---

## Task 5: Web — output pulse + archive UI

**Files:**
- Create: `apps/web/src/components/ai/terminal-display.ts` + `.test.ts`
- Create: `apps/web/src/components/ai/use-terminal-activity.ts` + `.test.ts`
- Create: `apps/web/src/api/use-archive-session.ts`
- Modify: `apps/web/src/api/use-ai-sessions.ts` (archived param)
- Modify: `apps/web/src/components/ai/ai-session-screen.tsx` (feed activity + derived pill)
- Modify: `apps/web/src/components/ai/session-list.tsx` (kind on pill + archive action)
- Modify: `apps/web/src/components/shell/terminals-panel.tsx`, `agents-panel.tsx` (Show-archived toggle)

**Interfaces:**
- Consumes: `SessionStatusPill` (Task 4), `useAiSessions`.
- Produces: `terminalDisplay(conn, status, busy): { status: SessionStatus; label: string; pulse: boolean }`; `useTerminalActivity(): { busy: boolean; ping: () => void }`; `useArchiveSession()` / `useUnarchiveSession()`.

- [ ] **Step 1: Write the failing `terminalDisplay` test**

Create `apps/web/src/components/ai/terminal-display.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { terminalDisplay } from './terminal-display';

describe('terminalDisplay', () => {
  it('shows Ready at idle and Running when busy', () => {
    expect(terminalDisplay('open', 'live', false)).toMatchObject({ label: 'Ready', pulse: false });
    expect(terminalDisplay('open', 'live', true)).toMatchObject({ label: 'Running', pulse: true, status: 'running' });
  });
  it('reflects the socket connection first for a live session', () => {
    expect(terminalDisplay('connecting', 'live', false)).toMatchObject({ label: 'Connecting' });
    expect(terminalDisplay('reconnecting', 'live', true)).toMatchObject({ label: 'Reconnecting' });
  });
  it('shows terminal end states regardless of connection', () => {
    expect(terminalDisplay('connecting', 'exited', false)).toMatchObject({ label: 'Exited', status: 'exited' });
    expect(terminalDisplay('open', 'disconnected', false)).toMatchObject({ label: 'Disconnected', status: 'disconnected' });
    expect(terminalDisplay('open', 'failed', false)).toMatchObject({ label: "Couldn't start", status: 'failed' });
  });
});
```

- [ ] **Step 2: Run to verify it fails, then implement**

Run: `pnpm --filter @tickets/web test -- terminal-display` → FAIL (module not found).

Create `apps/web/src/components/ai/terminal-display.ts`:

```ts
import type { SessionStatus } from '../../api/types';
import type { ConnState } from './use-session-socket';

// Compose the terminal pill from the persisted status, the live socket
// connection, and the output-activity pulse. Dead states win over connection;
// otherwise connection state, then live→busy?Running:Ready.
export function terminalDisplay(
  conn: ConnState,
  status: SessionStatus,
  busy: boolean,
): { status: SessionStatus; label: string; pulse: boolean } {
  if (status === 'exited') return { status: 'exited', label: 'Exited', pulse: false };
  if (status === 'disconnected') return { status: 'disconnected', label: 'Disconnected', pulse: false };
  if (status === 'failed') return { status: 'failed', label: "Couldn't start", pulse: false };
  if (conn === 'connecting') return { status: 'starting', label: 'Connecting', pulse: false };
  if (conn === 'reconnecting') return { status: 'starting', label: 'Reconnecting', pulse: false };
  if (status === 'live') {
    return busy
      ? { status: 'running', label: 'Running', pulse: true }
      : { status: 'live', label: 'Ready', pulse: false };
  }
  if (status === 'starting') return { status: 'starting', label: 'Connecting', pulse: false };
  return { status, label: String(status), pulse: false };
}
```

Confirm the `ConnState` type is exported from `use-session-socket.ts`; if it isn't, export it (`export type ConnState = 'connecting' | 'open' | 'reconnecting' | 'ended'`).

Run again → PASS.

- [ ] **Step 3: Write + implement `useTerminalActivity`**

Create `apps/web/src/components/ai/use-terminal-activity.test.ts`:

```ts
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTerminalActivity } from './use-terminal-activity';

describe('useTerminalActivity', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('is busy right after a ping and clears after the idle window', () => {
    const { result } = renderHook(() => useTerminalActivity(800));
    expect(result.current.busy).toBe(false);
    act(() => result.current.ping());
    expect(result.current.busy).toBe(true);
    act(() => vi.advanceTimersByTime(801));
    expect(result.current.busy).toBe(false);
  });
});
```

Run → FAIL. Then create `apps/web/src/components/ai/use-terminal-activity.ts`:

```ts
import { useCallback, useEffect, useRef, useState } from 'react';

// Output-based "busy" pulse: ping() on each output chunk; busy stays true for
// `idleMs` after the last chunk, then clears. Cleared on unmount.
export function useTerminalActivity(idleMs = 800): { busy: boolean; ping: () => void } {
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ping = useCallback(() => {
    setBusy(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setBusy(false), idleMs);
  }, [idleMs]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  return { busy, ping };
}
```

Run → PASS.

- [ ] **Step 4: Archive mutations + list param**

Create `apps/web/src/api/use-archive-session.ts`:

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchJson } from './client';
import type { AiSession } from './types';

function useSessionAction(action: 'archive' | 'unarchive') {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      fetchJson<AiSession>(`/api/ai/sessions/${id}/${action}`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai', 'sessions'] }),
  });
}

export const useArchiveSession = () => useSessionAction('archive');
export const useUnarchiveSession = () => useSessionAction('unarchive');
```

In `apps/web/src/api/use-ai-sessions.ts`, accept an options arg and thread `?archived=true`:

```ts
export function useAiSessions(opts?: { archived?: boolean }) {
  const archived = opts?.archived ?? false;
  return useQuery({
    queryKey: ['ai', 'sessions', { archived }],
    queryFn: () => fetchJson<AiSession[]>(`/api/ai/sessions${archived ? '?archived=true' : ''}`),
    refetchInterval: 4000,
  });
}
```

(Callers with no args keep working; the query key gains the archived discriminator.)

- [ ] **Step 5: Wire the pill into the terminal screen**

In `apps/web/src/components/ai/ai-session-screen.tsx`: instantiate `const activity = useTerminalActivity();`, call `activity.ping()` inside the socket `onData` handler (where output is written to xterm), and render the header status pill from `terminalDisplay(socket.conn, socket.status ?? data?.status ?? 'starting', activity.busy)` — pass its `label` to `<SessionStatusPill status={display.status} label={display.label} kind="terminal" exitCode={...} />`. Read the file first to place these precisely.

- [ ] **Step 6: Archive affordance in the list + Show-archived toggle**

- In `apps/web/src/components/ai/session-list.tsx`: pass `kind={session.kind}` to the row's `SessionStatusPill`; add a small hover-revealed **Archive** button (or an ⋯) per row that calls `useArchiveSession().mutate(session.id)` — `stopPropagation`/`preventDefault` so it doesn't navigate. For archived rows (in the archived view) show **Unarchive** instead. Accept an optional `archived?: boolean` prop to pick which action.
- In `apps/web/src/components/shell/terminals-panel.tsx` and `agents-panel.tsx`: add a "Show archived" toggle (a small button; default off), keep it in local state, pass `{ archived }` to `useAiSessions`, and pass `archived` down to `SessionList`.

- [ ] **Step 7: Typecheck + full web suite + build**

Run: `pnpm typecheck && pnpm --filter @tickets/web test && pnpm build`
Expected: PASS (133 baseline + new terminal-display / use-terminal-activity / pill tests).

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/components/ai/terminal-display.ts apps/web/src/components/ai/terminal-display.test.ts apps/web/src/components/ai/use-terminal-activity.ts apps/web/src/components/ai/use-terminal-activity.test.ts apps/web/src/api/use-archive-session.ts apps/web/src/api/use-ai-sessions.ts apps/web/src/components/ai/ai-session-screen.tsx apps/web/src/components/ai/session-list.tsx apps/web/src/components/shell/terminals-panel.tsx apps/web/src/components/shell/agents-panel.tsx
git commit -m "feat(web): terminal Running/Ready output pulse + session archive UI"
```

---

## Task 6: Final verification

**Files:** none (verification).

- [ ] **Step 1: Full checks**

Run: `pnpm typecheck && pnpm --filter @tickets/api test && pnpm --filter @tickets/web test && pnpm --filter @tickets/db test && pnpm build`
Expected: all green.

- [ ] **Step 2: Manual smoke (dev stack)**

At http://localhost:4720: open a terminal → **Ready**; run `sleep 3` → pill pulses **Running**, then **Ready**; from another shell restart the API (or `docker` dev api) under the live terminal → the row flips to **Disconnected** (not stuck "running"); Archive a dead session → it leaves the list; toggle **Show archived** → it reappears; **Unarchive** → back in the main list. Note anything that misbehaves.

- [ ] **Step 3: Commit any fixups**

```bash
git add -A && git commit -m "chore: terminal-status verification fixups" || echo "nothing to commit"
```

---

## Self-Review Notes

- **Spec coverage:** perpetual-running → Task 2 (`live`) + Task 5 (`terminalDisplay`); stale ghosts → Task 2 reconcile + Task 1 enum; archive → Task 1 (column) + Task 3 (routes) + Task 5 (UI); output pulse → Task 5. Foreground name (OSC 133) is a documented non-goal (deferred to profiles).
- **Type consistency:** `SessionStatus` gains `live`/`disconnected` in all three declarations (packages/db enum, apps/api `types.ts`, apps/web `api/types.ts`, and the pill's local copy). `terminalDisplay` returns `{status,label,pulse}` consumed by the terminal screen; `SessionStatusPill` `label`/`kind` props consumed by the screen and the list.
- **Migration risk:** drizzle-kit may omit `ALTER TYPE ADD VALUE` — Task 1 Step 3 checks and hand-adds; Step 4 proves it on the scratch DB before anything depends on it.
- **Store threading (resolved):** the route factory receives `db` + `supervisor` (not the store), so archive routes write via `db` directly like `stopSession` does; boot reconcile runs inside the real-supervisor branch of `app.ts` (never in injected-supervisor tests). No store threading required.
