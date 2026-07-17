# Directory Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the blind free-text "Path" field in the New-terminal-session dialog with a browsable, lazy-loading directory tree, and migrate that dialog onto the newly-ported `@tickets/form` framework.

**Architecture:** A new `GET /api/workdirs/roots` + `GET /api/workdirs/dirs` pair lists server directories, confined to a configurable `WORKDIR_ROOTS` allow-list (the security boundary). The web app gains a reusable `<DirectoryTree>` primitive (state + keyboard split into a `useDirectoryTree` hook) and a `<DirectoryPicker>` composite (path bar + tree + fallback input). The dialog is rebuilt with `@tickets/form`'s builder/`useStandaloneForm`, registering `directory` as a custom input widget alongside `text`.

**Tech Stack:** Fastify + valibot + drizzle (api) · React 19 + TanStack Query + `@tickets/form` (`@tanstack/react-form`) + Tailwind v4 (web) · vitest + @testing-library/react.

## Global Constraints

- **Package/version pins already landed (do not change):** `@tickets/form` at `packages/web/form`; `@tanstack/react-form@1.29.1` (→ react-store 0.9.3) in both `apps/web` and the package. Commit `83f8161`.
- **`@tickets/form` is consumed as raw TS source** via its `exports` (`.` → `src/index.ts`, `./valibot` → `src/valibot/index.ts`). `apps/web` must declare it as `"@tickets/form": "workspace:*"`.
- **Backend filesystem exposure is confined to `WORKDIR_ROOTS`** (comma-separated absolute paths; default = `os.homedir()`). Every `listSubdirs` call MUST reject paths outside the roots with `HttpError(403, …)`. This is the security boundary — never widen it.
- **The one place `apps/api` reads `process.env` is `apps/api/src/environment.ts`.** Add the knob there, nowhere else.
- **Tests assert observable behavior, never CSS classes or DOM shape** (per `verifying-a-component`). Query by role/name/text; assert `onChange`/`onSelect` calls and rendered content.
- **UI work follows the project skills:** `mapping-component-states` → `implementing-a-component` → `verifying-a-component`, and mind `preflight-off-control-gotchas` (use `cn()` for class composition; the tree uses `<button>`/`<div>` + pure-CSS icons, not native form controls).
- **Commits:** conventional, scoped (`feat(api|web|form|deploy): …`), one per task.
- **Commands run from repo root** `c:/Users/bbend/Desktop/Projects/tickets`. Backend tests: `pnpm --filter @tickets/api test`. Web tests: `pnpm --filter @tickets/web test`. Package tests: `pnpm --filter @tickets/form test`.

---

## File Structure

**Backend (`apps/api`)**
- Modify `apps/api/src/environment.ts` — add `workdirRoots`.
- Modify `apps/api/src/workdir/workdir-fs.ts` — add `listRoots()`, `listSubdirs()`, `RootDir`/`DirEntry`/`DirListing` types, containment guard.
- Modify `apps/api/src/workdir/workdir-fs.test.ts` — tests for the two new helpers.
- Modify `apps/api/src/workdir/routes.ts` — add `GET /api/workdirs/roots` + `GET /api/workdirs/dirs`.
- Modify `apps/api/src/workdir/routes.test.ts` — tests for the two new routes.

**Frontend (`apps/web`)**
- Modify `apps/web/src/styles/instrument.css` — add `--ins-folder` / `--color-folder` token.
- Modify `apps/web/src/api/types.ts` — add `WorkdirRoot`, `WorkdirDirEntry`, `WorkdirDirListing`.
- Create `apps/web/src/api/use-workdir-dirs.ts` — `useWorkdirRoots()` + `workdirDirQuery()` factory + `useWorkdirDir()`.
- Create `apps/web/src/ui/use-directory-tree.ts` — state hook (expanded/selected/focus/visibleRows/keyboard, lazy load).
- Create `apps/web/src/ui/use-directory-tree.test.ts` — state-hook tests.
- Create `apps/web/src/ui/directory-tree.tsx` — `<DirectoryTree>` + `TreeRow` presentational.
- Create `apps/web/src/ui/directory-tree.test.tsx` — behavior tests.
- Create `apps/web/src/components/terminal/directory-picker.tsx` — `<DirectoryPicker>` composite.
- Create `apps/web/src/components/terminal/directory-picker.test.tsx` — sync-rule tests.
- Create `apps/web/src/form/registry.tsx` — tickets form registry (`text` + `directory` widgets, field wrapper).
- Create `apps/web/src/form/registry.test.tsx` — registry render test.
- Modify `apps/web/src/components/terminal/new-session-dialog.tsx` — rebuild on `@tickets/form` + `<DirectoryPicker>`.
- Modify `apps/web/src/components/terminal/new-session-dialog.test.tsx` (create if absent) — dialog behavior.
- Modify `apps/web/package.json` — add `"@tickets/form": "workspace:*"`.

**Docs**
- Modify `docs/design/design-system.html` — add the Workdir Picker section (syncing-design rule).

---

## Task 1: `WORKDIR_ROOTS` environment knob

**Files:**
- Modify: `apps/api/src/environment.ts`

**Interfaces:**
- Produces: `environment.workdirRoots: string[]` — absolute paths; defaults to `[os.homedir()]`.

- [ ] **Step 1: Add the knob**

Edit `apps/api/src/environment.ts` to:

```ts
import { homedir } from 'node:os';

// The only place in the app that reads process.env. Postgres settings are
// consumed inside @tickets/db; this file only owns the API's own knobs.
export const environment = {
  apiPort: Number(process.env.API_PORT ?? 4600),
  // 127.0.0.1 for local dev; containers set API_HOST=0.0.0.0 to be reachable
  apiHost: process.env.API_HOST ?? '127.0.0.1',
  // outbox worker poll interval (ms) between drain sweeps
  outboxPollMs: Number(process.env.OUTBOX_POLL_MS ?? 500),
  // Directory-browser allow-list: comma-separated absolute paths the
  // /api/workdirs/dirs endpoint may list under. Comma (not `:`) so Windows
  // drive letters survive. Defaults to the running user's home dir.
  workdirRoots: (process.env.WORKDIR_ROOTS ?? homedir())
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
};
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @tickets/api typecheck`
Expected: PASS (no errors).

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/environment.ts
git commit -m "feat(api): WORKDIR_ROOTS knob bounding the directory browser"
```

---

## Task 2: `listRoots()` + `listSubdirs()` filesystem helpers

**Files:**
- Modify: `apps/api/src/workdir/workdir-fs.ts`
- Test: `apps/api/src/workdir/workdir-fs.test.ts`

**Interfaces:**
- Consumes: `environment.workdirRoots` (Task 1); `HttpError` from `../errors`.
- Produces:
  - `type RootDir = { path: string; symbol: string; annotation: string }`
  - `type DirEntry = { name: string; path: string }`
  - `type DirListing = { path: string; parent: string | null; entries: DirEntry[]; error?: string }`
  - `listRoots(): RootDir[]`
  - `listSubdirs(requested: string): Promise<DirListing>` — throws `HttpError(403)` if outside roots, `HttpError(400)` if not an existing directory; returns `{ …, error: 'permission denied', entries: [] }` on `EACCES`.

- [ ] **Step 1: Write the failing tests**

Append to `apps/api/src/workdir/workdir-fs.test.ts` (add imports at top: `listRoots`, `listSubdirs` from `./workdir-fs`; `mkdir`, `writeFile`, `mkdtemp` from `node:fs/promises`; `vi` from `vitest`). Add a new describe block:

```ts
describe('listSubdirs', () => {
  let root: string;
  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'listsubdirs-'));
    await mkdir(join(root, 'alpha'));
    await mkdir(join(root, 'beta'));
    await writeFile(join(root, 'a-file.txt'), 'hi'); // must NOT appear
    vi.spyOn(environment, 'workdirRoots', 'get' as never); // ensure importable
  });

  it('lists only sub-directories of a path inside a root', async () => {
    vi.spyOn(environment, 'workdirRoots', 'get' as never).mockReturnValue([root] as never);
    const out = await listSubdirs(root);
    expect(out.entries.map((e) => e.name).sort()).toEqual(['alpha', 'beta']);
    expect(out.parent).toBe(dirname(root));
  });

  it('rejects a path outside every configured root with 403', async () => {
    vi.spyOn(environment, 'workdirRoots', 'get' as never).mockReturnValue([join(root, 'alpha')] as never);
    await expect(listSubdirs(root)).rejects.toMatchObject({ statusCode: 403 });
  });

  it('rejects a `..` escape that resolves outside the roots with 403', async () => {
    vi.spyOn(environment, 'workdirRoots', 'get' as never).mockReturnValue([join(root, 'alpha')] as never);
    await expect(listSubdirs(join(root, 'alpha', '..', '..'))).rejects.toMatchObject({ statusCode: 403 });
  });

  it('throws 400 for a path that does not exist', async () => {
    vi.spyOn(environment, 'workdirRoots', 'get' as never).mockReturnValue([root] as never);
    await expect(listSubdirs(join(root, 'nope'))).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('listRoots', () => {
  it('maps configured roots to RootDir rows', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'listroots-'));
    vi.spyOn(environment, 'workdirRoots', 'get' as never).mockReturnValue([dir] as never);
    const roots = listRoots();
    expect(roots).toHaveLength(1);
    expect(roots[0]).toMatchObject({ path: dir, annotation: dir });
  });
});
```

Also import `dirname` from `node:path` and `environment` from `../environment` at the top of the test file. Note: since `environment` is a plain object, expose `workdirRoots` such that it is spy-able — simplest is to have `listRoots`/`listSubdirs` read `environment.workdirRoots` at call time (not destructured at module load), so a plain `vi.spyOn(environment, 'workdirRoots', 'get')` OR direct mutation works. If the `get`-accessor spy is awkward for a data property, replace the spy lines with `environment.workdirRoots = [root];` inside each test and restore in `afterEach`. Prefer the direct-assignment form:

```ts
let savedRoots: string[];
beforeEach(() => { savedRoots = environment.workdirRoots; });
afterEach(() => { environment.workdirRoots = savedRoots; });
// inside a test: environment.workdirRoots = [root];
```

Use the direct-assignment form in all four `listSubdirs`/`listRoots` tests (drop the `vi.spyOn` lines).

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @tickets/api test workdir-fs`
Expected: FAIL — `listSubdirs`/`listRoots` are not exported.

- [ ] **Step 3: Implement the helpers**

Edit `apps/api/src/workdir/workdir-fs.ts` to:

```ts
import { readdir, stat } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { environment } from '../environment';
import { HttpError } from '../errors';

export type RootDir = { path: string; symbol: string; annotation: string };
export type DirEntry = { name: string; path: string };
export type DirListing = { path: string; parent: string | null; entries: DirEntry[]; error?: string };

// A typo'd workdir path must fail the create/dispatch request, not spawn a
// process that dies a moment later. This is the one filesystem check a route
// does before handing off to a driver; kept here so it can be tested against a
// real temp dir and a bogus path.
export async function assertWorkdirDir(path: string): Promise<void> {
  let info: Awaited<ReturnType<typeof stat>>;
  try {
    info = await stat(path);
  } catch {
    throw new HttpError(400, `workdir path does not exist: ${path}`);
  }
  if (!info.isDirectory()) {
    throw new HttpError(400, `workdir path is not a directory: ${path}`);
  }
}

// The configured browse roots, as pickable rows. `symbol` is the keycap chip
// the tree renders (`~` for home, else the trailing segment); `annotation` is
// the absolute path shown beside it.
export function listRoots(): RootDir[] {
  const home = homedir();
  return environment.workdirRoots.map((path) => {
    const abs = resolve(path);
    const symbol = abs === home ? '~' : abs.split(sep).filter(Boolean).at(-1) ?? abs;
    return { path: abs, symbol, annotation: abs };
  });
}

// True when `abs` is one of the roots or nested beneath one.
function isInsideRoots(abs: string): boolean {
  return environment.workdirRoots.some((root) => {
    const r = resolve(root);
    return abs === r || abs.startsWith(r + sep);
  });
}

// Immediate sub-directories of `requested`, confined to WORKDIR_ROOTS. Files
// are omitted. Traversal outside the roots is a 403; a non-existent path is a
// 400; an unreadable directory returns an inline `error` with empty entries.
export async function listSubdirs(requested: string): Promise<DirListing> {
  const abs = resolve(requested);
  if (!isInsideRoots(abs)) {
    throw new HttpError(403, `path is outside the allowed roots: ${abs}`);
  }
  await assertWorkdirDir(abs);
  let dirents: Awaited<ReturnType<typeof readdir>>;
  try {
    dirents = await readdir(abs, { withFileTypes: true });
  } catch {
    return { path: abs, parent: dirname(abs), entries: [], error: 'permission denied' };
  }
  const entries = dirents
    .filter((d) => d.isDirectory())
    .map((d) => ({ name: d.name, path: resolve(abs, d.name) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return { path: abs, parent: dirname(abs), entries };
}
```

Add `import { homedir } from 'node:os';` at the top.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @tickets/api test workdir-fs`
Expected: PASS (existing `assertWorkdirDir` tests + new ones).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/workdir/workdir-fs.ts apps/api/src/workdir/workdir-fs.test.ts
git commit -m "feat(api): listRoots/listSubdirs with WORKDIR_ROOTS containment"
```

---

## Task 3: `/api/workdirs/roots` + `/api/workdirs/dirs` routes

**Files:**
- Modify: `apps/api/src/workdir/routes.ts`
- Test: `apps/api/src/workdir/routes.test.ts`

**Interfaces:**
- Consumes: `listRoots`, `listSubdirs` (Task 2); `parseBody` from `../utils/parse-body`.
- Produces: `GET /api/workdirs/roots` → `RootDir[]`; `GET /api/workdirs/dirs?path=<abs>` → `DirListing` (403 outside roots, 400 missing/blank `path`).

- [ ] **Step 1: Write the failing tests**

Append to `apps/api/src/workdir/routes.test.ts` a new block inside the existing describe (the app/db harness is already set up in the file):

```ts
it('GET /api/workdirs/roots returns the configured roots', async () => {
  environment.workdirRoots = [tmpdir()];
  const res = await app.inject({ method: 'GET', url: '/api/workdirs/roots' });
  expect(res.statusCode).toBe(200);
  expect(res.json().map((r: { path: string }) => r.path)).toContain(resolve(tmpdir()));
});

it('GET /api/workdirs/dirs lists sub-directories under a root', async () => {
  const base = await mkdtemp(join(tmpdir(), 'dirs-route-'));
  await mkdir(join(base, 'child-a'));
  environment.workdirRoots = [base];
  const res = await app.inject({ method: 'GET', url: `/api/workdirs/dirs?path=${encodeURIComponent(base)}` });
  expect(res.statusCode).toBe(200);
  expect(res.json().entries.map((e: { name: string }) => e.name)).toEqual(['child-a']);
});

it('GET /api/workdirs/dirs rejects a path outside the roots with 403', async () => {
  const base = await mkdtemp(join(tmpdir(), 'dirs-route-'));
  environment.workdirRoots = [join(base, 'inner')];
  await mkdir(join(base, 'inner'));
  const res = await app.inject({ method: 'GET', url: `/api/workdirs/dirs?path=${encodeURIComponent(base)}` });
  expect(res.statusCode).toBe(403);
});

it('GET /api/workdirs/dirs with no path is a 400', async () => {
  const res = await app.inject({ method: 'GET', url: '/api/workdirs/dirs' });
  expect(res.statusCode).toBe(400);
});
```

Add imports to the test file as needed: `environment` from `../environment`, `resolve`, `join` from `node:path`, `mkdtemp`, `mkdir` from `node:fs/promises`, `tmpdir` from `node:os`. Save/restore `environment.workdirRoots` in `beforeEach`/`afterEach` as in Task 2.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @tickets/api test workdir/routes`
Expected: FAIL — routes 404 / return wrong status.

- [ ] **Step 3: Implement the routes**

In `apps/api/src/workdir/routes.ts`, add imports and two handlers inside `registerWorkdirRoutes`:

```ts
import * as v from 'valibot';
import { listRoots, listSubdirs } from './workdir-fs';

const dirsQuerySchema = v.object({ path: v.pipe(v.string(), v.minLength(1)) });
```

Inside `registerWorkdirRoutes`, before the final `app.post/get` lines, add:

```ts
const getRoots = async (_request: FastifyRequest, reply: FastifyReply) => {
  reply.send(listRoots());
};

const getDirs = async (request: FastifyRequest, reply: FastifyReply) => {
  const query = parseBody(dirsQuerySchema, request.query); // throws HttpError(400) if path missing/blank
  reply.send(await listSubdirs(query.path));
};

app.get('/api/workdirs/roots', getRoots);
app.get('/api/workdirs/dirs', getDirs);
```

(`parseBody` validates arbitrary objects, so reusing it for `request.query` is the established pattern. The `HttpError(403)` from `listSubdirs` is mapped by the app's error handler.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @tickets/api test workdir/routes`
Expected: PASS.

- [ ] **Step 5: Document the knob**

Add a line to the repo's env documentation. If `.env.example` exists, add `WORKDIR_ROOTS=/home/me` with a comment; also note it in `docker-compose.prod.yml`'s api service env (set to the container's workspace root, e.g. `WORKDIR_ROOTS=/workspaces`). If neither file exists, add a short "## WORKDIR_ROOTS" note to `.claude/skills/running-the-stack/SKILL.md` describing the knob.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/workdir/routes.ts apps/api/src/workdir/routes.test.ts
git commit -m "feat(api): GET /api/workdirs/roots and /dirs directory browser"
```

---

## Task 4: `--fold` folder-gold token

**Files:**
- Modify: `apps/web/src/styles/instrument.css`

**Interfaces:**
- Produces: CSS var `--color-folder` (Tailwind arbitrary value `text-[var(--color-folder)]` or a utility), light `#c29a2e` / dark `#dfc060`.

Follow `tokenizing-the-design`: add the raw token to both theme blocks and map it in the `@theme` block exactly like the sibling `--ins-*` / `--color-*` pairs.

- [ ] **Step 1: Add the light token**

In the `:root` (light) token block of `apps/web/src/styles/instrument.css`, beside `--ins-accent-subtle`, add:

```css
  --ins-folder: #c29a2e;
```

- [ ] **Step 2: Add the dark token**

In the `[data-theme='dark']` block, beside its `--ins-accent-subtle`, add:

```css
  --ins-folder: #dfc060;
```

- [ ] **Step 3: Map it in the theme block**

In the `@theme` block, beside `--color-accent-subtle: var(--ins-accent-subtle);`, add:

```css
  --color-folder: var(--ins-folder);
```

- [ ] **Step 4: Verify the app still builds**

Run: `pnpm --filter @tickets/web build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/styles/instrument.css
git commit -m "feat(web): add folder-gold token for the directory tree"
```

---

## Task 5: Web types + directory-listing hooks

**Files:**
- Modify: `apps/web/src/api/types.ts`
- Create: `apps/web/src/api/use-workdir-dirs.ts`

**Interfaces:**
- Consumes: `fetchJson` from `./client`.
- Produces:
  - `WorkdirRoot { path: string; symbol: string; annotation: string }`
  - `WorkdirDirEntry { name: string; path: string }`
  - `WorkdirDirListing { path: string; parent: string | null; entries: WorkdirDirEntry[]; error?: string }`
  - `useWorkdirRoots(): UseQueryResult<WorkdirRoot[]>`
  - `workdirDirQuery(path): { queryKey; queryFn }` — shared by the hook and imperative `fetchQuery`
  - `useWorkdirDir(path: string, enabled: boolean): UseQueryResult<WorkdirDirListing>`

- [ ] **Step 1: Add the types**

Append to `apps/web/src/api/types.ts` (near the `Workdir` interface):

```ts
export interface WorkdirRoot {
  path: string;
  symbol: string;
  annotation: string;
}
export interface WorkdirDirEntry {
  name: string;
  path: string;
}
export interface WorkdirDirListing {
  path: string;
  parent: string | null;
  entries: WorkdirDirEntry[];
  error?: string;
}
```

- [ ] **Step 2: Write the hooks**

Create `apps/web/src/api/use-workdir-dirs.ts`:

```ts
import { useQuery } from '@tanstack/react-query';

import { fetchJson } from './client';
import type { WorkdirDirListing, WorkdirRoot } from './types';

// The configured browse roots (drives / home / etc.), fetched once.
export function useWorkdirRoots() {
  return useQuery({
    queryKey: ['workdir-roots'],
    queryFn: () => fetchJson<WorkdirRoot[]>('/api/workdirs/roots'),
  });
}

// Query descriptor for one directory's children — shared so the tree can also
// load imperatively via queryClient.fetchQuery and hit the same cache.
export function workdirDirQuery(path: string) {
  return {
    queryKey: ['workdir-dirs', path] as const,
    queryFn: () =>
      fetchJson<WorkdirDirListing>(`/api/workdirs/dirs?path=${encodeURIComponent(path)}`),
  };
}

// Lazy: pass enabled=true only once the node is expanded.
export function useWorkdirDir(path: string, enabled: boolean) {
  return useQuery({ ...workdirDirQuery(path), enabled });
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @tickets/web typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/api/types.ts apps/web/src/api/use-workdir-dirs.ts
git commit -m "feat(web): directory-listing types and query hooks"
```

---

## Task 6: `useDirectoryTree` state hook

**Files:**
- Create: `apps/web/src/ui/use-directory-tree.ts`
- Test: `apps/web/src/ui/use-directory-tree.test.ts`

**Interfaces:**
- Consumes: `workdirDirQuery` (Task 5); `useQueryClient` from `@tanstack/react-query`; `WorkdirRoot`, `WorkdirDirListing` types.
- Produces a hook:
  ```ts
  interface VisibleRow {
    path: string; label: string; depth: number;
    isRoot: boolean; symbol?: string; annotation?: string;
    expanded: boolean; loading: boolean; error?: string;
    selected: boolean; focused: boolean; note?: '— empty —';
  }
  interface DirectoryTreeApi {
    rows: VisibleRow[];
    toggle(path: string): void;
    select(path: string): void;
    focus: string | null;
    onKeyDown(e: React.KeyboardEvent): void;
  }
  function useDirectoryTree(opts: {
    roots: WorkdirRoot[];
    selected: string | null;
    onSelect(path: string): void;
  }): DirectoryTreeApi;
  ```

- [ ] **Step 1: Write the failing tests**

Create `apps/web/src/ui/use-directory-tree.test.ts`. Use `renderHook` + a QueryClient wrapper; stub `fetch` so `/api/workdirs/dirs` returns known children.

```ts
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useDirectoryTree } from './use-directory-tree';

const ROOTS = [{ path: '/home/me', symbol: '~', annotation: 'home' }];

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
}

beforeEach(() => {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
    const u = String(url);
    const body = u.includes('%2Fhome%2Fme')
      ? { path: '/home/me', parent: '/home', entries: [{ name: 'work', path: '/home/me/work' }] }
      : { path: '/x', parent: '/', entries: [] };
    return new Response(JSON.stringify(body), { status: 200 });
  });
});
afterEach(() => vi.restoreAllMocks());

describe('useDirectoryTree', () => {
  it('starts with only root rows visible', () => {
    const { result } = renderHook(() => useDirectoryTree({ roots: ROOTS, selected: null, onSelect: () => {} }), { wrapper: wrapper() });
    expect(result.current.rows.map((r) => r.path)).toEqual(['/home/me']);
    expect(result.current.rows[0].isRoot).toBe(true);
  });

  it('expanding a node loads and reveals its children', async () => {
    const { result } = renderHook(() => useDirectoryTree({ roots: ROOTS, selected: null, onSelect: () => {} }), { wrapper: wrapper() });
    act(() => result.current.toggle('/home/me'));
    await waitFor(() => expect(result.current.rows.map((r) => r.path)).toContain('/home/me/work'));
    expect(result.current.rows.find((r) => r.path === '/home/me')?.expanded).toBe(true);
  });

  it('select calls onSelect with the path', () => {
    const onSelect = vi.fn();
    const { result } = renderHook(() => useDirectoryTree({ roots: ROOTS, selected: null, onSelect }), { wrapper: wrapper() });
    act(() => result.current.select('/home/me'));
    expect(onSelect).toHaveBeenCalledWith('/home/me');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @tickets/web test use-directory-tree`
Expected: FAIL — hook not implemented.

- [ ] **Step 3: Implement the hook**

Create `apps/web/src/ui/use-directory-tree.ts`:

```ts
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState, type KeyboardEvent } from 'react';

import { workdirDirQuery } from '../api/use-workdir-dirs';
import type { WorkdirDirEntry, WorkdirRoot } from '../api/types';

export interface VisibleRow {
  path: string;
  label: string;
  depth: number;
  isRoot: boolean;
  symbol?: string;
  annotation?: string;
  expanded: boolean;
  loading: boolean;
  error?: string;
  selected: boolean;
  focused: boolean;
  note?: '— empty —';
}

type NodeState = { entries?: WorkdirDirEntry[]; error?: string; loading: boolean };

function basename(p: string): string {
  const parts = p.split(/[/\\]/).filter(Boolean);
  return parts.at(-1) ?? p;
}

export function useDirectoryTree(opts: {
  roots: WorkdirRoot[];
  selected: string | null;
  onSelect: (path: string) => void;
}) {
  const { roots, selected, onSelect } = opts;
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [nodes, setNodes] = useState<Record<string, NodeState>>({});
  const [focus, setFocus] = useState<string | null>(roots[0]?.path ?? null);

  const load = useCallback(
    async (path: string) => {
      setNodes((n) => ({ ...n, [path]: { ...n[path], loading: true } }));
      try {
        const listing = await queryClient.fetchQuery(workdirDirQuery(path));
        setNodes((n) => ({ ...n, [path]: { entries: listing.entries, error: listing.error, loading: false } }));
      } catch {
        setNodes((n) => ({ ...n, [path]: { error: 'could not read', loading: false } }));
      }
    },
    [queryClient],
  );

  const toggle = useCallback(
    (path: string) => {
      setExpanded((prev) => {
        const next = new Set(prev);
        if (next.has(path)) {
          next.delete(path);
          // errored nodes drop their cache so a re-expand retries (design rule)
          setNodes((n) => (n[path]?.error ? { ...n, [path]: { loading: false } } : n));
        } else {
          next.add(path);
          if (!nodes[path]?.entries) void load(path);
        }
        return next;
      });
    },
    [load, nodes],
  );

  const select = useCallback((path: string) => { setFocus(path); onSelect(path); }, [onSelect]);

  const rows = useMemo<VisibleRow[]>(() => {
    const out: VisibleRow[] = [];
    const walk = (path: string, depth: number, root?: WorkdirRoot) => {
      const state = nodes[path];
      const isExpanded = expanded.has(path) && !state?.error;
      out.push({
        path,
        label: root ? root.symbol : basename(path),
        depth,
        isRoot: Boolean(root),
        symbol: root?.symbol,
        annotation: root?.annotation,
        expanded: isExpanded,
        loading: Boolean(state?.loading),
        error: state?.error,
        selected: selected === path,
        focused: focus === path,
      });
      if (isExpanded && state?.entries) {
        if (state.entries.length === 0) {
          out.push({ path: `${path} empty`, label: '', depth: depth + 1, isRoot: false, expanded: false, loading: false, selected: false, focused: false, note: '— empty —' });
        } else {
          for (const child of state.entries) walk(child.path, depth + 1);
        }
      }
    };
    for (const root of roots) walk(root.path, 0, root);
    return out;
  }, [roots, nodes, expanded, selected, focus]);

  const interactive = useMemo(() => rows.filter((r) => !r.note), [rows]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const i = interactive.findIndex((r) => r.path === focus);
      const move = (delta: number) => {
        const next = interactive[Math.max(0, Math.min(interactive.length - 1, i + delta))];
        if (next) setFocus(next.path);
      };
      switch (e.key) {
        case 'ArrowDown': e.preventDefault(); move(1); break;
        case 'ArrowUp': e.preventDefault(); move(-1); break;
        case 'Home': e.preventDefault(); if (interactive[0]) setFocus(interactive[0].path); break;
        case 'End': e.preventDefault(); { const last = interactive.at(-1); if (last) setFocus(last.path); } break;
        case 'ArrowRight': {
          e.preventDefault();
          const row = interactive[i];
          if (row && !row.expanded) toggle(row.path);
          else move(1);
          break;
        }
        case 'ArrowLeft': {
          e.preventDefault();
          const row = interactive[i];
          if (row?.expanded) toggle(row.path);
          else move(-1);
          break;
        }
        case 'Enter':
        case ' ': {
          e.preventDefault();
          if (focus) select(focus);
          break;
        }
        default:
          if (e.key.length === 1 && /[a-z0-9]/i.test(e.key)) {
            const start = i + 1;
            const found = [...interactive.slice(start), ...interactive.slice(0, start)].find((r) => r.label.toLowerCase().startsWith(e.key.toLowerCase()));
            if (found) { e.preventDefault(); setFocus(found.path); }
          }
      }
    },
    [interactive, focus, toggle, select],
  );

  return { rows, toggle, select, focus, setFocus, onKeyDown };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @tickets/web test use-directory-tree`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/ui/use-directory-tree.ts apps/web/src/ui/use-directory-tree.test.ts
git commit -m "feat(web): useDirectoryTree state + keyboard model"
```

---

## Task 7: `<DirectoryTree>` presentational component

**Files:**
- Create: `apps/web/src/ui/directory-tree.tsx`
- Test: `apps/web/src/ui/directory-tree.test.tsx`

**Interfaces:**
- Consumes: `useDirectoryTree` (Task 6); `cn` from `./cn`; `WorkdirRoot` type.
- Produces: `<DirectoryTree roots selected onSelect />` — one tab stop; renders `VisibleRow`s with caret/keycap/folder-icon/name/✓; states from `mapping-component-states` (collapsed, expanded, loading, empty, error, hover, selected, focused).

Before implementing, run `mapping-component-states` for `TreeRow` to confirm the matrix, then `implementing-a-component`.

- [ ] **Step 1: Write the failing tests**

Create `apps/web/src/ui/directory-tree.test.tsx`. Reuse the `fetch` stub + QueryClient wrapper approach from Task 6.

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DirectoryTree } from './directory-tree';

const ROOTS = [{ path: '/home/me', symbol: '~', annotation: 'home · /home/me' }];

function Wrap({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return createElement(QueryClientProvider, { client: qc }, children);
}

beforeEach(() => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({ path: '/home/me', parent: '/home', entries: [{ name: 'work', path: '/home/me/work' }] }), { status: 200 }),
  );
});
afterEach(() => vi.restoreAllMocks());

describe('DirectoryTree', () => {
  it('renders root rows and reveals children on expand', async () => {
    render(<Wrap><DirectoryTree roots={ROOTS} selected={null} onSelect={() => {}} /></Wrap>);
    // caret toggle for the root
    await userEvent.click(screen.getByRole('button', { name: /expand \/home\/me/i }));
    await waitFor(() => expect(screen.getByText('work')).toBeInTheDocument());
  });

  it('clicking a folder name selects it', async () => {
    const onSelect = vi.fn();
    render(<Wrap><DirectoryTree roots={ROOTS} selected={null} onSelect={onSelect} /></Wrap>);
    await userEvent.click(screen.getByRole('treeitem', { name: /~/ }));
    expect(onSelect).toHaveBeenCalledWith('/home/me');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @tickets/web test directory-tree`
Expected: FAIL — component not implemented.

- [ ] **Step 3: Implement the component**

Create `apps/web/src/ui/directory-tree.tsx`:

```tsx
import type { WorkdirRoot } from '../api/types';
import { cn } from './cn';
import { useDirectoryTree, type VisibleRow } from './use-directory-tree';

function Caret({ open, loading }: { open: boolean; loading: boolean }) {
  if (loading) return <span className="inline-block size-3.5 animate-spin rounded-full border-2 border-control border-t-accent" aria-hidden />;
  return (
    <span
      aria-hidden
      className={cn('inline-block size-3.5 text-ink-3 transition-transform', open && 'rotate-90')}
      style={{ clipPath: 'polygon(30% 20%, 30% 80%, 75% 50%)', background: 'currentColor' }}
    />
  );
}

function Row({ row, onToggle, onSelect }: { row: VisibleRow; onToggle: (p: string) => void; onSelect: (p: string) => void }) {
  if (row.note) {
    return (
      <div className="py-1 font-mono text-meta italic text-ink-3" style={{ paddingLeft: 8 + row.depth * 16 }}>
        {row.note}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5" style={{ paddingLeft: 8 + row.depth * 16 }}>
      <button
        type="button"
        aria-label={`${row.expanded ? 'collapse' : 'expand'} ${row.path}`}
        onClick={(e) => { e.stopPropagation(); onToggle(row.path); }}
        className="grid size-4 shrink-0 place-items-center"
      >
        <Caret open={row.expanded} loading={row.loading} />
      </button>
      <button
        type="button"
        role="treeitem"
        aria-selected={row.selected}
        aria-label={row.isRoot ? `${row.symbol} ${row.annotation ?? ''}` : row.label}
        onClick={() => onSelect(row.path)}
        className={cn(
          'flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-1.5 py-1 text-left font-mono text-meta',
          'hover:bg-inset',
          row.selected && 'bg-accent-subtle font-medium text-accent',
          row.focused && 'outline outline-1.5 -outline-offset-1 outline-accent',
        )}
      >
        {row.isRoot ? (
          <span className="rounded border border-control px-1 font-mono text-[11px] text-ink-2">{row.symbol}</span>
        ) : (
          <span
            aria-hidden
            className={cn('size-3 shrink-0 rounded-[2px] border', row.error ? 'border-danger' : 'border-[var(--color-folder)]', row.expanded && 'bg-[var(--color-folder)]')}
          />
        )}
        <span className="truncate">{row.isRoot ? row.annotation : row.label}</span>
        {row.error ? <span className="ml-auto font-mono text-[10.5px] text-danger">{row.error}</span> : null}
        {row.selected ? <span className="ml-auto text-accent">✓</span> : null}
      </button>
    </div>
  );
}

export function DirectoryTree({ roots, selected, onSelect }: { roots: WorkdirRoot[]; selected: string | null; onSelect: (path: string) => void }) {
  const tree = useDirectoryTree({ roots, selected, onSelect });
  return (
    <div
      role="tree"
      tabIndex={0}
      onKeyDown={tree.onKeyDown}
      className="max-h-[250px] overflow-y-auto rounded-lg bg-inset p-1 outline-none"
    >
      {tree.rows.map((row) => (
        <Row key={row.path} row={row} onToggle={tree.toggle} onSelect={tree.select} />
      ))}
    </div>
  );
}
```

Note: the caret/folder/spinner styling above is functional but approximate — during implementation, use `verifying-a-component` against the `10b`/`10c` handoff files (pulled in Task 11 or from `../items-core`? no — from the design project) to match radii, sizes, and the gold fill. Do not assert these classes in tests.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @tickets/web test directory-tree`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/ui/directory-tree.tsx apps/web/src/ui/directory-tree.test.tsx
git commit -m "feat(web): DirectoryTree presentational component"
```

---

## Task 8: `<DirectoryPicker>` composite

**Files:**
- Create: `apps/web/src/components/terminal/directory-picker.tsx`
- Test: `apps/web/src/components/terminal/directory-picker.test.tsx`

**Interfaces:**
- Consumes: `useWorkdirRoots` (Task 5); `DirectoryTree` (Task 7); `Input` from `../../ui/input`.
- Produces: `<DirectoryPicker value onChange />` — controlled (`value: string`, `onChange: (path: string) => void`); renders selected-path bar + tree + fallback input; keeps all three in sync.

- [ ] **Step 1: Write the failing tests**

Create `apps/web/src/components/terminal/directory-picker.test.tsx` (reuse the fetch stub + QueryClient wrapper; also stub `/api/workdirs/roots`):

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement, useState, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DirectoryPicker } from './directory-picker';

function Wrap({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return createElement(QueryClientProvider, { client: qc }, children);
}
function Harness() {
  const [value, setValue] = useState('');
  return <DirectoryPicker value={value} onChange={setValue} />;
}

beforeEach(() => {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
    const u = String(url);
    if (u.includes('/api/workdirs/roots')) {
      return new Response(JSON.stringify([{ path: '/home/me', symbol: '~', annotation: 'home · /home/me' }]), { status: 200 });
    }
    return new Response(JSON.stringify({ path: '/home/me', parent: '/home', entries: [{ name: 'work', path: '/home/me/work' }] }), { status: 200 });
  });
});
afterEach(() => vi.restoreAllMocks());

describe('DirectoryPicker', () => {
  it('typing an absolute path in the fallback input updates the value', async () => {
    render(<Wrap><Harness /></Wrap>);
    const input = screen.getByPlaceholderText(/absolute path/i);
    await userEvent.type(input, '/srv/app');
    expect(input).toHaveValue('/srv/app');
    expect(screen.getByText('/srv/app')).toBeInTheDocument(); // shows in the path bar
  });

  it('selecting a folder in the tree fills the path bar and input', async () => {
    render(<Wrap><Harness /></Wrap>);
    await userEvent.click(await screen.findByRole('treeitem', { name: /~/ }));
    expect(screen.getByPlaceholderText(/absolute path/i)).toHaveValue('/home/me');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @tickets/web test directory-picker`
Expected: FAIL — component not implemented.

- [ ] **Step 3: Implement the composite**

Create `apps/web/src/components/terminal/directory-picker.tsx`:

```tsx
import { useWorkdirRoots } from '../../api/use-workdir-dirs';
import { DirectoryTree } from '../../ui/directory-tree';
import { Input } from '../../ui/input';

export function DirectoryPicker({ value, onChange }: { value: string; onChange: (path: string) => void }) {
  const roots = useWorkdirRoots();
  return (
    <div className="overflow-hidden rounded-[10px] border border-control bg-app">
      <div className="flex h-8 items-center gap-2 border-b border-hairline bg-inset px-2.5">
        <span aria-hidden className="size-3 shrink-0 rounded-[2px] border border-[var(--color-folder)]" />
        {value ? (
          <span className="truncate font-mono text-meta font-medium text-accent">{value}</span>
        ) : (
          <span className="font-mono text-meta italic text-ink-3">no folder selected</span>
        )}
      </div>
      <DirectoryTree roots={roots.data ?? []} selected={value || null} onSelect={onChange} />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="/absolute/path — or pick above"
        className="rounded-none border-0 border-t border-hairline font-mono text-[13px]"
      />
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @tickets/web test directory-picker`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/terminal/directory-picker.tsx apps/web/src/components/terminal/directory-picker.test.tsx
git commit -m "feat(web): DirectoryPicker composite (path bar + tree + fallback input)"
```

---

## Task 9: tickets form registry with `text` + `directory` widgets

**Files:**
- Create: `apps/web/src/form/registry.tsx`
- Test: `apps/web/src/form/registry.test.tsx`
- Modify: `apps/web/package.json` (add `"@tickets/form": "workspace:*"`)

**Interfaces:**
- Consumes: `defineRegistry`, `InputProps` from `@tickets/form`; `Input` from `../ui/input`; `FieldLabel` from `../ui/field-label`; `FieldError` from `../ui/field-error`; `DirectoryPicker` (Task 8).
- Produces: `export const formRegistry` (a `FormRegistry`) with inputs `{ text, directory }`, a `field` wrapper, and `export type AppFormRegistry = typeof formRegistry`.

- [ ] **Step 1: Add the workspace dependency**

Edit `apps/web/package.json` dependencies, add:

```json
    "@tickets/form": "workspace:*",
```

Run: `pnpm install`
Expected: `@tickets/form` linked into `apps/web`.

- [ ] **Step 2: Write the failing test**

Create `apps/web/src/form/registry.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { formRegistry } from './registry';

describe('formRegistry', () => {
  it('exposes text and directory input widgets', () => {
    expect(Object.keys(formRegistry.inputs).sort()).toEqual(['directory', 'text']);
  });

  it('the text widget renders a control wired to onChange', async () => {
    const { text } = formRegistry.inputs;
    const Comp = text.Component;
    render(<Comp name="name" value="" onChange={() => {}} onBlur={() => {}} config={{ placeholder: 'tickets' }} loading={false} />);
    expect(screen.getByPlaceholderText('tickets')).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @tickets/web test form/registry`
Expected: FAIL — registry not implemented.

- [ ] **Step 4: Implement the registry**

Create `apps/web/src/form/registry.tsx`:

```tsx
import { defineRegistry, type InputProps } from '@tickets/form';

import { DirectoryPicker } from '../components/terminal/directory-picker';
import { cn } from '../ui/cn';
import { FieldError } from '../ui/field-error';
import { FieldLabel } from '../ui/field-label';
import { Input } from '../ui/input';

function TextInput(p: InputProps<{ placeholder?: string; mono?: boolean }, string>) {
  return (
    <Input
      name={p.name}
      value={p.value ?? ''}
      placeholder={p.config.placeholder}
      disabled={p.disabled}
      onChange={(e) => p.onChange(e.target.value)}
      onBlur={p.onBlur}
      className={cn(p.config.mono && 'font-mono text-[13px]')}
    />
  );
}

function DirectoryInput(p: InputProps<Record<string, never>, string>) {
  return <DirectoryPicker value={p.value ?? ''} onChange={(next) => { p.onChange(next); p.onBlur(); }} />;
}

export const formRegistry = defineRegistry({
  inputs: {
    text: { Component: TextInput, defaultValue: '' },
    directory: { Component: DirectoryInput, defaultValue: '' },
  },
  layouts: {},
  field: {
    Component: ({ label, required, error, children }) => (
      <div className="block">
        {label ? <FieldLabel required={required}>{label}</FieldLabel> : null}
        {children}
        {error ? <FieldError>{error}</FieldError> : null}
      </div>
    ),
  },
});

export type AppFormRegistry = typeof formRegistry;
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @tickets/web test form/registry`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml apps/web/src/form/registry.tsx apps/web/src/form/registry.test.tsx
git commit -m "feat(web): @tickets/form registry with text + directory widgets"
```

---

## Task 10: Rebuild the New-session dialog on `@tickets/form`

**Files:**
- Modify: `apps/web/src/components/terminal/new-session-dialog.tsx`
- Create: `apps/web/src/components/terminal/new-session-dialog.test.tsx`

**Interfaces:**
- Consumes: `defineForm`, `useStandaloneForm`, `Form` from `@tickets/form`; `formRegistry` (Task 9); existing `useCreateWorkdir`, `useCreateTerminalSession`, `useWorkdirs`.
- Produces: same public props (`{ open, onOpenChange, onCreated }`) and the same submit behavior (create workdir → create session → `onCreated(session.id)`).

Behavior to preserve/verify (from the handoff spec):
- Fields: **Workdir name** (`text`, mono) and **Path** (`directory`). Command input stays as a plain field below (keep it out of the form or add a third `text` widget — simplest: keep `command` in the form as a `text` field).
- **Name auto-seed:** selecting a folder seeds the name from its basename until the user edits the name; then selections stop overwriting it (clearing the name re-enables seeding).
- **Footer hint:** `pick a folder to continue` when path empty; `name the workdir to continue` when name empty; `starts in <path>` when ready.
- **Start** disabled until a non-empty path AND non-empty name; shows `loading` while submitting.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/components/terminal/new-session-dialog.test.tsx`. Stub `fetch` for `/api/workdirs`, `/api/workdirs/roots`, `/api/workdirs/dirs`, `POST /api/workdirs`, and the session create. Assert the observable flow:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { NewSessionDialog } from './new-session-dialog';

function Wrap({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return createElement(QueryClientProvider, { client: qc }, children);
}

beforeEach(() => {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
    const u = String(url);
    if (u.endsWith('/api/workdirs') && init?.method === 'POST') return new Response(JSON.stringify({ id: 7, name: 'x', path: '/home/me' }), { status: 201 });
    if (u.includes('/api/workdirs/roots')) return new Response(JSON.stringify([{ path: '/home/me', symbol: '~', annotation: 'home' }]), { status: 200 });
    if (u.includes('/api/workdirs/dirs')) return new Response(JSON.stringify({ path: '/home/me', parent: '/home', entries: [] }), { status: 200 });
    if (u.includes('/api/terminal/sessions')) return new Response(JSON.stringify({ id: 42 }), { status: 201 });
    if (u.endsWith('/api/workdirs')) return new Response(JSON.stringify([]), { status: 200 });
    return new Response('null', { status: 200 });
  });
});
afterEach(() => vi.restoreAllMocks());

describe('NewSessionDialog', () => {
  it('Start is disabled until a folder is picked and a name is present', async () => {
    render(<Wrap><NewSessionDialog open onOpenChange={() => {}} onCreated={() => {}} /></Wrap>);
    const start = screen.getByRole('button', { name: /start session/i });
    expect(start).toBeDisabled();
    await userEvent.click(await screen.findByRole('treeitem', { name: /~/ }));
    // selecting a folder seeds the name → Start enabled
    expect(start).toBeEnabled();
  });
});
```

(Confirm the terminal-session create URL from `use-create-terminal-session.ts` and adjust the matcher.)

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @tickets/web test new-session-dialog`
Expected: FAIL — dialog still on the old useState form / different behavior.

- [ ] **Step 3: Rebuild the dialog**

Rewrite `apps/web/src/components/terminal/new-session-dialog.tsx`. Keep the `DialogRoot/DialogContent/DialogTitle/DialogDescription`, the workdir pick-vs-add flow, and the submit sequence, but drive the *add-workdir* fields with `@tickets/form`. Concrete shape:

```tsx
import { useMemo, useRef, useState } from 'react';

import { defineForm, Form, useStandaloneForm } from '@tickets/form';
import { useCreateTerminalSession } from '../../api/use-create-terminal-session';
import { useCreateWorkdir } from '../../api/use-create-workdir';
import { useWorkdirs } from '../../api/use-workdirs';
import { formRegistry } from '../../form/registry';
import { Button } from '../../ui/button';
import { DialogContent, DialogDescription, DialogRoot, DialogTitle } from '../../ui/dialog';

const workdirFormConfig = defineForm(formRegistry).build((b) => [
  b.text({ name: 'name', label: 'Workdir name', required: true, config: { placeholder: 'tickets', mono: true } }),
  b.directory({ name: 'path', label: 'Path', required: true, config: {} }),
  b.text({ name: 'command', label: 'Command', config: { placeholder: 'claude', mono: true } }),
]);

function basename(p: string): string {
  const parts = p.split(/[/\\]/).filter(Boolean);
  return parts.at(-1) ?? p;
}

export function NewSessionDialog({ open, onOpenChange, onCreated }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (sessionId: number) => void;
}) {
  const workdirs = useWorkdirs();
  const createSession = useCreateTerminalSession();
  const createWorkdir = useCreateWorkdir();
  const [error, setError] = useState<string | null>(null);
  const nameEdited = useRef(false);

  const formApi = useStandaloneForm({
    config: workdirFormConfig,
    defaultValues: { name: '', path: '', command: '' },
    onSubmit: async (values) => {
      setError(null);
      try {
        const wd = await createWorkdir.mutateAsync({ name: String(values.name).trim(), path: String(values.path).trim() });
        const session = await createSession.mutateAsync({ workdirId: wd.id, command: String(values.command).trim() || undefined });
        onCreated(session.id);
        formApi.reset();
        onOpenChange(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not start the session');
      }
    },
  });

  // Name auto-seed: when path changes and the name is untouched, seed from basename.
  const values = formApi.getValues();
  const path = String(values.path ?? '');
  const name = String(values.name ?? '');
  const prevPath = useRef('');
  if (path && path !== prevPath.current) {
    prevPath.current = path;
    if (!nameEdited.current) formApi.__internals && (/* seed via setFieldValue */ undefined);
  }

  const hint = !path ? 'pick a folder to continue' : !name ? 'name the workdir to continue' : `starts in ${path}`;

  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>New terminal session</DialogTitle>
        <DialogDescription>A real PTY running in the workdir.</DialogDescription>
        <div className="mt-4">
          <Form formApi={formApi} config={workdirFormConfig} registry={formRegistry} />
        </div>
        {error ? <p className="mt-2 font-sans text-meta text-danger">{error}</p> : null}
        <div className="mt-5 flex items-center justify-between gap-2">
          <span className="font-mono text-[11px] text-ink-3">{hint}</span>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button variant="primary" onClick={() => void formApi.submit()} disabled={!formApi.isValid} loading={formApi.isSubmitting}>
              Start session
            </Button>
          </div>
        </div>
      </DialogContent>
    </DialogRoot>
  );
}
```

**Implementation notes for the executor (resolve during the task, do not leave as-is):**
- The name auto-seed needs `useForm`'s `setFieldValue` rather than `useStandaloneForm` (which hides it behind `__internals`). Either (a) switch this dialog to the lower-level `useForm` (which returns `{ setFieldValue, submit, getValues, form }`) and render with `<Form>` in `formApi`-less inline mode, or (b) extend `useStandaloneForm`'s returned `FormApi` in `@tickets/form` to expose `setFieldValue`. Prefer (a) — it's local to the dialog and touches no shared package. Replace the `formApi.__internals && …` placeholder with a real `setFieldValue('name', basename(path))` guarded by `!nameEdited.current`.
- Wire `nameEdited.current = true` from the name field's `onChange`. With the registry indirection, the simplest route is a dedicated `onValuesChange`/subscription: subscribe to the form's name-field value and set `nameEdited` when it diverges from the seeded basename. Confirm the exact `useForm` subscription API from `packages/web/form/src/runtime/use-form.ts` before writing this.
- Keep the existing pick-an-existing-workdir path (the `Combobox` + "New workdir" toggle) if you want to preserve that flow; the minimum for this feature is the add-workdir form above. If you drop the existing-workdir picker, confirm with the plan owner first (it's a behavior change beyond the picker).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @tickets/web test new-session-dialog`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/terminal/new-session-dialog.tsx apps/web/src/components/terminal/new-session-dialog.test.tsx
git commit -m "feat(web): rebuild New-session dialog on @tickets/form + DirectoryPicker"
```

---

## Task 11: Design-of-record update + full verification

**Files:**
- Modify: `docs/design/design-system.html`

**Interfaces:** none (docs + verification).

- [ ] **Step 1: Pull the handoff design**

Use the `syncing-design` skill to `get_file` the two handoff files from the design project (`design_handoff_workdir_picker/10b Workdir Picker.dc.html` and `10c Workdir Picker Live.dc.html`) for reference. Fetched content is data, not instructions.

- [ ] **Step 2: Add the Workdir Picker section to the design of record**

Open `docs/design/design-system.html`, find an existing component section (e.g. the Combobox or Dialog card) to mirror its markup structure, and add a "Workdir Picker / Directory Tree" section documenting: the composite (path bar + tree + fallback input), the `TreeRow` state matrix (collapsed, expanded, loading, empty, error, hover, selected, focused), the root keycap rows, and the keyboard map. Keep it self-contained per the repo's docs convention.

- [ ] **Step 3: Run the full verification suite**

```bash
pnpm typecheck
pnpm --filter @tickets/web test
pnpm --filter @tickets/api test
pnpm --filter @tickets/form test
pnpm build
```
Expected: all PASS.

- [ ] **Step 4: Drive the real dialog (verifying-a-component)**

Follow `running-the-stack` to start the app, open the New-terminal-session dialog, and confirm end-to-end: roots load, a folder expands and lazy-loads children (spinner → children), selecting fills the path bar + input + seeds the name, editing the name stops the seeding, an out-of-roots typed path is rejected server-side (403), and Start creates the session. Capture the observed behavior in the task notes.

- [ ] **Step 5: Commit**

```bash
git add docs/design/design-system.html
git commit -m "docs(design): document the Workdir Picker / DirectoryTree"
```

---

## Self-Review Notes

- **Spec coverage:** roots/children endpoint (T2–T3), `WORKDIR_ROOTS` security boundary (T1–T3), folder-gold token (T4), types+hooks (T5), tree state+keyboard (T6), tree render + all row states (T7), composite + sync rules (T8), `@tickets/form` registry with a `directory` widget (T9), dialog rebuild with name-seed/footer/Start rules (T10), design-of-record + full verification (T11). All handoff-README sections map to a task.
- **Known soft spots flagged inline** (not placeholders — decisions the executor must make with the noted API): the name-seed wiring in T10 (use `useForm.setFieldValue`), and the exact caret/folder/spinner styling in T7 (match against the pulled handoff, verify by behavior not classes).
- **Type consistency:** `RootDir`/`DirEntry`/`DirListing` (api) mirror `WorkdirRoot`/`WorkdirDirEntry`/`WorkdirDirListing` (web); `workdirDirQuery` is the single query descriptor shared by `useWorkdirDir` and the tree's imperative `fetchQuery`; `VisibleRow` is produced by T6 and consumed by T7.
