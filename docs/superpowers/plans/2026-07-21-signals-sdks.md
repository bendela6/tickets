# Signals SDKs (packages/signals/*) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the four publishable SDK packages (`@bendela6/signals-core|browser|react|node`), the collector-served `/sdk.js` IIFE for plain HTML, the `signals` sourcemap CLI, and the publish setup for the GitHub Packages private registry.

**Architecture:** Layered packages under `packages/signals/*`: `core` is platform-neutral (DSN parsing, stack parsing, batching transport, client with never-throw guarantee); `browser` wraps core with window instrumentation and ships an auto-init IIFE; `react` wraps browser with an error boundary + hook; `node` wraps core with process hooks, server helpers, and the CLI. The collector (`apps/signals`) gains one route that serves the browser IIFE. SDKs never import from `apps/signals` or any tickets module — they speak only the wire format.

**Tech Stack:** TypeScript, tsup (build: ESM + CJS + dts, IIFE for browser), vitest (jsdom for browser/react), react 19 peer, node `util.parseArgs` for the CLI (no CLI deps).

This is **Plan 2 of 3** (spec: `docs/superpowers/specs/2026-07-18-signals-error-collector-design.md`). Plan 1 (collector, DONE) provides the live API on :4640. Plan 3 = web UI.

## Global Constraints

- Package names/dirs: `packages/signals/core` → `@bendela6/signals-core`, `…/browser` → `@bendela6/signals-browser`, `…/react` → `@bendela6/signals-react`, `…/node` → `@bendela6/signals-node`. All version `0.1.0`, `"private": false`.
- pnpm-workspace.yaml gains `- packages/signals/*`.
- DSN: `sgl://<key>@<host:port>/<appId>` → http; `sgls://…` → https. Ingest endpoint `<scheme>://<host>/ingest/<key>`, sourcemaps `…/ingest/<key>/sourcemaps`.
- Wire format exactly per the spec's Types section (kind error|log|event; level error|warning|info; the 6 mechanisms; StackFrame {functionName,file,line,column,inApp}; envelope `{ signals: [...] }` max 64).
- Level derivation table from the spec: uncaught-exception/unhandled-rejection → error; error-boundary/middleware/manual captureError → error; console maps method (error→error, warn→warning, log→info); captureEvent → info. Caller may override via `{ level }`.
- **Never-throw guarantee:** no public SDK API and no transport path may ever throw or reject into host code. Every entry point wrapped.
- Transport defaults: flush every 5000 ms or at 10 queued; ≤64 signals per request; client queue cap 200 (drop oldest); on 429 back off 30 s; on network error keep queue and retry next flush.
- Breadcrumb ring buffer default 50, embedded into error signals only.
- Each package: `publishConfig: { registry: "https://npm.pkg.github.com", access: "restricted" }`, `repository: { type: "git", url: "git+https://github.com/bendela6/tickets.git" }`, `files: ["dist"]`, exports with types+import+require from tsup output. `pnpm --filter <pkg> build` must produce dist/; `pnpm --filter <pkg> pack` (pack, not publish — publish needs the user's PAT) is the publishability gate.
- Zero imports from `apps/*` or `@tickets/*` inside `packages/signals/*` (and apps/signals may import ONLY `@bendela6/signals-browser` for the sdk.js file path — nothing else new).
- Verification per task: `pnpm --filter <pkg> test` + `pnpm --filter <pkg> typecheck`; repo-wide `pnpm typecheck` at the final task.
- Commits: `feat(signals-sdk): …`, one per task, pathspec-scoped (`-- packages/signals …`).

## Shared package boilerplate (referenced by Tasks 1, 5, 7, 8 — copy, adjusting name/deps)

`packages/signals/<dir>/package.json` template:

```json
{
  "name": "@bendela6/signals-core",
  "version": "0.1.0",
  "type": "module",
  "description": "Platform-neutral core for the Signals local-first error collector",
  "repository": { "type": "git", "url": "git+https://github.com/bendela6/tickets.git" },
  "license": "MIT",
  "files": ["dist"],
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    }
  },
  "publishConfig": { "registry": "https://npm.pkg.github.com", "access": "restricted" },
  "scripts": {
    "build": "tsup",
    "typecheck": "tsc -p tsconfig.json",
    "test": "vitest run"
  },
  "devDependencies": {
    "tsup": "^8.5.0",
    "typescript": "^6.0.3",
    "vitest": "^4.1.10"
  }
}
```

`tsconfig.json` (per package): `{ "extends": "../../../tsconfig.base.json", "compilerOptions": { "types": [] }, "include": ["src"] }` — add `"lib": ["ES2022", "DOM"]` for browser/react, `"types": ["node"]` (+ `@types/node` devDep) for node/core-tests as needed.

`tsup.config.ts` (per package): `import { defineConfig } from 'tsup'; export default defineConfig({ entry: ['src/index.ts'], format: ['esm', 'cjs'], dts: true, sourcemap: true, clean: true });`

`vitest.config.ts`: node default; browser/react add `test: { environment: 'jsdom' }` (+ `jsdom` devDep `^29.1.1`).

---

### Task 1: Workspace wiring + core package scaffold + DSN parsing

**Files:**
- Modify: `pnpm-workspace.yaml` (add `- packages/signals/*`)
- Create: `packages/signals/core/package.json`, `tsconfig.json`, `tsup.config.ts`, `vitest.config.ts` (from the boilerplate above, name `@bendela6/signals-core`, plus devDep `@types/node`)
- Create: `packages/signals/core/src/index.ts` (re-exports), `src/dsn.ts`
- Test: `packages/signals/core/src/dsn.test.ts`

**Interfaces:**
- Produces: `parseDsn(dsn: string): ParsedDsn` where `ParsedDsn = { key: string; appId: number; ingestUrl: string; sourcemapsUrl: string }`; throws `Error('invalid signals DSN: …')` on garbage (callers wrap — parseDsn itself is the ONE place allowed to throw, at init time).

- [ ] **Step 1: Scaffold files, add workspace glob, `pnpm install`** (verify `pnpm --filter @bendela6/signals-core exec node -e "console.log('ok')"` resolves the package).

- [ ] **Step 2: Failing tests** — `src/dsn.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseDsn } from './dsn';

describe('parseDsn', () => {
  it('parses sgl:// into http endpoints', () => {
    expect(parseDsn('sgl://pub_4f9c21ab@127.0.0.1:4640/3')).toEqual({
      key: 'pub_4f9c21ab',
      appId: 3,
      ingestUrl: 'http://127.0.0.1:4640/ingest/pub_4f9c21ab',
      sourcemapsUrl: 'http://127.0.0.1:4640/ingest/pub_4f9c21ab/sourcemaps',
    });
  });
  it('parses sgls:// into https endpoints', () => {
    expect(parseDsn('sgls://k@signals.example.com/12').ingestUrl).toBe('https://signals.example.com/ingest/k');
  });
  it.each(['', 'sgl://nokey/1', 'sgl://k@host', 'http://k@host/1', 'sgl://k@host/notanumber'])(
    'rejects %s',
    (bad) => expect(() => parseDsn(bad)).toThrow(/invalid signals DSN/),
  );
});
```

- [ ] **Step 3: Run to verify failure** (`pnpm --filter @bendela6/signals-core test`).

- [ ] **Step 4: Implement** — `src/dsn.ts`:

```ts
export interface ParsedDsn {
  key: string;
  appId: number;
  ingestUrl: string;
  sourcemapsUrl: string;
}

// sgl://<key>@<host[:port]>/<appId> → http; sgls:// → https.
export function parseDsn(dsn: string): ParsedDsn {
  const match = /^(sgl|sgls):\/\/([^@/]+)@([^/@]+)\/(\d+)$/.exec(dsn);
  if (!match) throw new Error(`invalid signals DSN: ${dsn}`);
  const [, scheme, key, host, appId] = match;
  const base = `${scheme === 'sgls' ? 'https' : 'http'}://${host}`;
  return {
    key: key!,
    appId: Number(appId),
    ingestUrl: `${base}/ingest/${key}`,
    sourcemapsUrl: `${base}/ingest/${key}/sourcemaps`,
  };
}
```

`src/index.ts` starts as `export { parseDsn, type ParsedDsn } from './dsn';` and grows each task.

- [ ] **Step 5: Tests pass; typecheck; `pnpm --filter @bendela6/signals-core build` emits dist/index.js+cjs+d.ts; commit**

```bash
git add pnpm-workspace.yaml pnpm-lock.yaml packages/signals
git commit -m "feat(signals-sdk): core package scaffold + DSN parsing" -- pnpm-workspace.yaml pnpm-lock.yaml packages/signals
```

---

### Task 2: Core wire types + stack-trace parser

**Files:**
- Create: `packages/signals/core/src/types.ts`, `src/stack-parse.ts`
- Modify: `src/index.ts` (re-export)
- Test: `packages/signals/core/src/stack-parse.test.ts`

**Interfaces:**
- Produces: the wire types (`Signal`, `SignalKind`, `SignalLevel`, `Mechanism`, `StackFrame`, `Breadcrumb`, `PlatformInfo`, `SdkInfo`) — copy the spec's Types section verbatim into `types.ts` (Signal's `timestamp` is ISO string; add `SdkInfo = { name: string; version: string }`). And `parseStack(stack: string | undefined, isInApp?: (file: string) => boolean): StackFrame[]` — parses V8 (`at fn (file:1:2)` / `at file:1:2` / `at async fn (…)`) and Firefox/Safari (`fn@file:1:2`) formats; unparseable lines skipped; default `isInApp = (file) => !/node_modules|^node:/.test(file)`.

- [ ] **Step 1: Failing tests** — `src/stack-parse.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseStack } from './stack-parse';

describe('parseStack', () => {
  it('parses V8 frames with and without function names', () => {
    const stack = [
      'TypeError: boom',
      '    at CartList (/app/src/checkout/CartList.tsx:48:13)',
      '    at /app/src/main.tsx:10:1',
      '    at async load (node:internal/modules/esm/loader:100:5)',
    ].join('\n');
    const frames = parseStack(stack);
    expect(frames).toEqual([
      { functionName: 'CartList', file: '/app/src/checkout/CartList.tsx', line: 48, column: 13, inApp: true },
      { functionName: '<anonymous>', file: '/app/src/main.tsx', line: 10, column: 1, inApp: true },
      { functionName: 'load', file: 'node:internal/modules/esm/loader', line: 100, column: 5, inApp: false },
    ]);
  });
  it('parses Firefox/Safari frames and vendor detection', () => {
    const frames = parseStack('boom@https://cdn.site/vendor/node_modules/lib.js:5:9\nrun@https://app.site/assets/index.js:1:100');
    expect(frames).toEqual([
      { functionName: 'boom', file: 'https://cdn.site/vendor/node_modules/lib.js', line: 5, column: 9, inApp: false },
      { functionName: 'run', file: 'https://app.site/assets/index.js', line: 1, column: 100, inApp: true },
    ]);
  });
  it('returns [] for undefined or unparseable stacks', () => {
    expect(parseStack(undefined)).toEqual([]);
    expect(parseStack('just a message\nwith lines')).toEqual([]);
  });
  it('honors a custom isInApp', () => {
    const frames = parseStack('    at f (/x/a.js:1:1)', () => false);
    expect(frames[0]!.inApp).toBe(false);
  });
});
```

- [ ] **Step 2: Verify failure → implement** — `src/stack-parse.ts`:

```ts
import type { StackFrame } from './types';

const V8_FRAME = /^\s*at\s+(?:async\s+)?(?:(.+?)\s+\()?(.+?):(\d+):(\d+)\)?\s*$/;
const GECKO_FRAME = /^\s*(?:(.*?)@)?(.+?):(\d+):(\d+)\s*$/;

const defaultIsInApp = (file: string): boolean => !/node_modules|^node:/.test(file);

export function parseStack(
  stack: string | undefined,
  isInApp: (file: string) => boolean = defaultIsInApp,
): StackFrame[] {
  if (!stack) return [];
  const frames: StackFrame[] = [];
  for (const line of stack.split('\n')) {
    const match = V8_FRAME.exec(line) ?? (line.includes('@') ? GECKO_FRAME.exec(line) : null);
    if (!match) continue;
    const [, fn, file, ln, col] = match;
    if (!file || file.includes(' ')) continue; // "just a message" guard
    frames.push({
      functionName: fn?.trim() || '<anonymous>',
      file,
      line: Number(ln),
      column: Number(col),
      inApp: isInApp(file),
    });
  }
  return frames;
}
```

`src/types.ts`: the spec Types section verbatim (SignalKind/SignalLevel/Mechanism/StackFrame/Breadcrumb/PlatformInfo) plus:

```ts
export interface SdkInfo { name: string; version: string }
export interface Signal {
  kind: SignalKind;
  sessionId: string;
  name: string;
  message?: string;
  mechanism: Mechanism;
  level: SignalLevel;
  timestamp: string;
  release?: string;
  environment?: string;
  fingerprint?: string;
  stack?: StackFrame[];
  breadcrumbs?: Breadcrumb[];
  user?: { id?: string; email?: string; name?: string };
  tags?: Record<string, string>;
  contexts?: Record<string, Record<string, unknown>>;
  platform: PlatformInfo;
  sdk: SdkInfo;
}
```

- [ ] **Step 3: Tests pass; typecheck; commit** (`feat(signals-sdk): wire types + cross-engine stack parser`, pathspec `packages/signals`).

---

### Task 3: Core batching transport

**Files:**
- Create: `packages/signals/core/src/transport.ts`
- Modify: `src/index.ts`
- Test: `packages/signals/core/src/transport.test.ts`

**Interfaces:**
- Produces:

```ts
interface TransportOptions {
  url: string;
  fetchFn?: (url: string, init: { method: string; headers: Record<string, string>; body: string; keepalive?: boolean }) => Promise<{ status: number }>;
  flushIntervalMs?: number;      // 5000
  flushAt?: number;              // 10
  maxPerRequest?: number;        // 64
  maxQueue?: number;             // 200
  backoffMs?: number;            // 30_000 after a 429
  now?: () => number;
  scheduleFlush?: (cb: () => void, ms: number) => unknown;  // default setTimeout
  cancelFlush?: (handle: unknown) => void;                  // default clearTimeout
}
interface Transport {
  enqueue(signal: Signal): void;   // never throws
  flush(): Promise<void>;          // never rejects
  takeAll(): Signal[];             // drain queue (for sendBeacon on unload)
  queuedCount(): number;
  dispose(): void;                 // cancel pending timer
}
createTransport(options: TransportOptions): Transport
```

Behavior: `enqueue` pushes (dropping oldest past `maxQueue`) and (a) triggers immediate `flush()` at `flushAt`, else (b) arms a one-shot timer for `flushIntervalMs` if none armed. `flush` sends up to `maxPerRequest` as `{ signals }` JSON POST; on 2xx removes them and repeats if queue non-empty; on 429 re-queues and sets backoff (enqueue/flush no-op sends until `now() > backoffUntil`); on any throw/non-2xx re-queues and stops (retry on next trigger). All errors swallowed.

- [ ] **Step 1: Failing tests** — `src/transport.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createTransport } from './transport';
import type { Signal } from './types';

const sig = (n: number): Signal => ({
  kind: 'event', sessionId: 's', name: `e${n}`, mechanism: 'manual', level: 'info',
  timestamp: new Date(0).toISOString(), platform: { runtime: 'node' }, sdk: { name: 't', version: '0' },
});

function harness(overrides: Partial<Parameters<typeof createTransport>[0]> = {}) {
  const calls: { url: string; body: unknown }[] = [];
  let status = 202;
  const timers: { cb: () => void; ms: number }[] = [];
  const transport = createTransport({
    url: 'http://x/ingest/k',
    fetchFn: async (url, init) => { calls.push({ url, body: JSON.parse(init.body) }); return { status }; },
    scheduleFlush: (cb, ms) => { timers.push({ cb, ms }); return timers.length; },
    cancelFlush: () => {},
    now: () => 0,
    ...overrides,
  });
  return { transport, calls, timers, setStatus: (s: number) => { status = s; } };
}

describe('createTransport', () => {
  it('arms a single 5s timer and flushes the batch when it fires', async () => {
    const { transport, calls, timers } = harness();
    transport.enqueue(sig(1));
    transport.enqueue(sig(2));
    expect(timers).toHaveLength(1);
    expect(timers[0]!.ms).toBe(5000);
    timers[0]!.cb();
    await Promise.resolve(); await Promise.resolve();
    expect(calls).toHaveLength(1);
    expect((calls[0]!.body as { signals: unknown[] }).signals).toHaveLength(2);
  });

  it('flushes immediately at flushAt and chunks by maxPerRequest', async () => {
    const { transport, calls } = harness({ flushAt: 3, maxPerRequest: 2 });
    for (let i = 0; i < 3; i++) transport.enqueue(sig(i));
    await transport.flush();
    expect(calls.length).toBeGreaterThanOrEqual(2); // 2 + 1
    expect(transport.queuedCount()).toBe(0);
  });

  it('caps the queue by dropping oldest', () => {
    const { transport } = harness({ maxQueue: 2, flushAt: 100 });
    transport.enqueue(sig(1)); transport.enqueue(sig(2)); transport.enqueue(sig(3));
    expect(transport.queuedCount()).toBe(2);
    expect(transport.takeAll().map((s) => s.name)).toEqual(['e2', 'e3']);
  });

  it('backs off after 429 and re-queues the batch', async () => {
    let t = 0;
    const { transport, calls, setStatus } = harness({ now: () => t, flushAt: 1 });
    setStatus(429);
    transport.enqueue(sig(1));
    await transport.flush();
    expect(transport.queuedCount()).toBe(1);
    const before = calls.length;
    await transport.flush();               // still inside backoff → no send
    expect(calls.length).toBe(before);
    t = 31_000; setStatus(202);
    await transport.flush();
    expect(transport.queuedCount()).toBe(0);
  });

  it('never rejects even when fetch throws', async () => {
    const { transport } = harness({ fetchFn: async () => { throw new Error('net down'); }, flushAt: 1 });
    transport.enqueue(sig(1));
    await expect(transport.flush()).resolves.toBeUndefined();
    expect(transport.queuedCount()).toBe(1); // kept for retry
  });
});
```

- [ ] **Step 2: Verify failure → implement** — `src/transport.ts`:

```ts
import type { Signal } from './types';

export interface TransportOptions {
  url: string;
  fetchFn?: (url: string, init: { method: string; headers: Record<string, string>; body: string; keepalive?: boolean }) => Promise<{ status: number }>;
  flushIntervalMs?: number;
  flushAt?: number;
  maxPerRequest?: number;
  maxQueue?: number;
  backoffMs?: number;
  now?: () => number;
  scheduleFlush?: (cb: () => void, ms: number) => unknown;
  cancelFlush?: (handle: unknown) => void;
}

export interface Transport {
  enqueue(signal: Signal): void;
  flush(): Promise<void>;
  takeAll(): Signal[];
  queuedCount(): number;
  dispose(): void;
}

export function createTransport(options: TransportOptions): Transport {
  const {
    url,
    fetchFn = (u, init) => fetch(u, init),
    flushIntervalMs = 5000,
    flushAt = 10,
    maxPerRequest = 64,
    maxQueue = 200,
    backoffMs = 30_000,
    now = Date.now,
    scheduleFlush = (cb, ms) => setTimeout(cb, ms),
    cancelFlush = (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
  } = options;

  let queue: Signal[] = [];
  let timer: unknown = null;
  let backoffUntil = 0;
  let sending = false;

  async function flush(): Promise<void> {
    if (sending || queue.length === 0 || now() < backoffUntil) return;
    sending = true;
    try {
      while (queue.length > 0) {
        const batch = queue.slice(0, maxPerRequest);
        queue = queue.slice(batch.length);
        let status: number;
        try {
          ({ status } = await fetchFn(url, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ signals: batch }),
          }));
        } catch {
          queue = [...batch, ...queue];   // network error: keep for retry
          return;
        }
        if (status === 429) {
          queue = [...batch, ...queue];
          backoffUntil = now() + backoffMs;
          return;
        }
        if (status < 200 || status >= 300) {
          queue = [...batch, ...queue];
          return;
        }
      }
    } finally {
      sending = false;
    }
  }

  return {
    enqueue(signal) {
      try {
        queue.push(signal);
        if (queue.length > maxQueue) queue = queue.slice(queue.length - maxQueue);
        if (queue.length >= flushAt) {
          void flush();
        } else if (timer === null) {
          timer = scheduleFlush(() => { timer = null; void flush(); }, flushIntervalMs);
        }
      } catch { /* never throw into host */ }
    },
    flush: () => flush().catch(() => undefined),
    takeAll() {
      const drained = queue;
      queue = [];
      return drained;
    },
    queuedCount: () => queue.length,
    dispose() {
      if (timer !== null) { try { cancelFlush(timer); } catch { /* noop */ } timer = null; }
    },
  };
}
```

- [ ] **Step 3: Tests pass; typecheck; commit** (`feat(signals-sdk): batching transport with backoff and never-throw`, pathspec `packages/signals`).

---

### Task 4: Core client (capture APIs, breadcrumbs, context, never-throw)

**Files:**
- Create: `packages/signals/core/src/client.ts`
- Modify: `src/index.ts`
- Test: `packages/signals/core/src/client.test.ts`

**Interfaces:**
- Produces:

```ts
interface ClientOptions {
  dsn: string;
  release?: string;
  environment?: string;
  maxBreadcrumbs?: number;   // 50
  beforeSend?: (signal: Signal) => Signal | null;
  platform: PlatformInfo;                 // supplied by the wrapper package
  sdk: SdkInfo;                           // e.g. { name: '@bendela6/signals-node', version: '0.1.0' }
  transport?: Transport;                  // injectable for tests; default createTransport({ url: parsed.ingestUrl })
  sessionId?: string;                     // default generateSessionId()
  now?: () => Date;
  isInApp?: (file: string) => boolean;
}
interface CaptureOptions { level?: SignalLevel; mechanism?: Mechanism; fingerprint?: string; contexts?: Record<string, Record<string, unknown>> }
interface SignalsClient {
  captureError(error: unknown, options?: CaptureOptions): void;
  captureEvent(name: string, data?: Record<string, unknown>, options?: CaptureOptions): void;
  captureLog(message: string, level?: SignalLevel): void;          // kind 'log', mechanism 'console'
  addBreadcrumb(breadcrumb: Breadcrumb): void;
  setUser(user: { id?: string; email?: string; name?: string } | null): void;
  setTag(key: string, value: string): void;
  setContext(key: string, context: Record<string, unknown> | null): void;
  flush(): Promise<void>;
  takeAll(): Signal[];                     // pass-through for unload beacons
  sessionId: string;
  enabled: boolean;                        // false when the DSN failed to parse
}
createClient(options: ClientOptions): SignalsClient
generateSessionId(): string                // 'sess_' + 10 base36 chars
```

Rules: `captureError` defaults mechanism `'manual'`/level `'error'`; non-Error values are wrapped (`name: 'Error'`, `message: String(value)`); stack parsed via `parseStack`; breadcrumb snapshot attached (copy). `captureEvent` → kind `'event'`, level `'info'`, data lands in `contexts.event`. String fields truncated: message ≤ 5000, breadcrumb message ≤ 500. A `beforeSend` returning null drops the signal. If `parseDsn` throws, the client is created **disabled**: every method is a silent no-op, `enabled === false` — construction never throws. Every public method body wrapped in try/catch.

- [ ] **Step 1: Failing tests** — `src/client.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createClient, generateSessionId } from './client';
import type { Signal } from './types';
import type { Transport } from './transport';

function fakeTransport() {
  const sent: Signal[] = [];
  const transport: Transport = {
    enqueue: (s) => { sent.push(s); },
    flush: async () => {},
    takeAll: () => sent.splice(0),
    queuedCount: () => sent.length,
    dispose: () => {},
  };
  return { transport, sent };
}

const base = {
  dsn: 'sgl://k@127.0.0.1:4640/1',
  platform: { runtime: 'node' as const },
  sdk: { name: 'test-sdk', version: '0.0.0' },
  now: () => new Date('2026-07-21T12:00:00Z'),
};

describe('createClient', () => {
  it('captures an Error with parsed stack, defaults, session id, and context state', () => {
    const { transport, sent } = fakeTransport();
    const client = createClient({ ...base, transport, release: '1.0.0', environment: 'test' });
    client.setUser({ id: 'u1' });
    client.setTag('checkout', 'v2');
    client.setContext('cart', { items: 3 });
    client.addBreadcrumb({ type: 'console', timestamp: base.now().toISOString(), message: 'hi' });
    const err = new TypeError('boom');
    client.captureError(err);
    expect(sent).toHaveLength(1);
    const s = sent[0]!;
    expect(s).toMatchObject({
      kind: 'error', name: 'TypeError', message: 'boom', mechanism: 'manual', level: 'error',
      release: '1.0.0', environment: 'test', user: { id: 'u1' }, tags: { checkout: 'v2' },
      timestamp: '2026-07-21T12:00:00.000Z', sessionId: client.sessionId,
    });
    expect(s.contexts).toMatchObject({ cart: { items: 3 } });
    expect(s.breadcrumbs).toHaveLength(1);
    expect(s.stack!.length).toBeGreaterThan(0);
  });

  it('wraps non-Error values and honors overrides', () => {
    const { transport, sent } = fakeTransport();
    const client = createClient({ ...base, transport });
    client.captureError('plain string', { level: 'warning', mechanism: 'middleware', fingerprint: 'fp' });
    expect(sent[0]).toMatchObject({ name: 'Error', message: 'plain string', level: 'warning', mechanism: 'middleware', fingerprint: 'fp' });
  });

  it('captureEvent defaults to info/manual with data under contexts.event; captureLog maps console', () => {
    const { transport, sent } = fakeTransport();
    const client = createClient({ ...base, transport });
    client.captureEvent('checkout.started', { items: 3 });
    client.captureLog('cart mismatch', 'warning');
    expect(sent[0]).toMatchObject({ kind: 'event', name: 'checkout.started', level: 'info', mechanism: 'manual' });
    expect(sent[0]!.contexts).toMatchObject({ event: { items: 3 } });
    expect(sent[1]).toMatchObject({ kind: 'log', name: 'console', message: 'cart mismatch', level: 'warning', mechanism: 'console' });
  });

  it('ring-buffers breadcrumbs to maxBreadcrumbs', () => {
    const { transport, sent } = fakeTransport();
    const client = createClient({ ...base, transport, maxBreadcrumbs: 2 });
    for (const n of ['a', 'b', 'c']) client.addBreadcrumb({ type: 'custom', timestamp: 't', message: n });
    client.captureError(new Error('x'));
    expect(sent[0]!.breadcrumbs!.map((b) => b.message)).toEqual(['b', 'c']);
  });

  it('beforeSend can drop and mutate', () => {
    const { transport, sent } = fakeTransport();
    const client = createClient({
      ...base, transport,
      beforeSend: (s) => (s.kind === 'log' ? null : { ...s, tags: { ...s.tags, scrubbed: 'yes' } }),
    });
    client.captureLog('secret');
    client.captureError(new Error('keep'));
    expect(sent).toHaveLength(1);
    expect(sent[0]!.tags).toMatchObject({ scrubbed: 'yes' });
  });

  it('a bad DSN disables the client instead of throwing, and nothing ever throws', () => {
    const client = createClient({ ...base, dsn: 'garbage' });
    expect(client.enabled).toBe(false);
    expect(() => {
      client.captureError(new Error('x'));
      client.captureEvent('e');
      client.setUser(null);
    }).not.toThrow();
  });

  it('even a throwing beforeSend cannot escape', () => {
    const { transport, sent } = fakeTransport();
    const client = createClient({ ...base, transport, beforeSend: () => { throw new Error('hook bug'); } });
    expect(() => client.captureError(new Error('x'))).not.toThrow();
    expect(sent).toHaveLength(0);
  });
});

it('generateSessionId shape', () => {
  expect(generateSessionId()).toMatch(/^sess_[a-z0-9]{10}$/);
});
```

- [ ] **Step 2: Verify failure → implement** — `src/client.ts` (complete):

```ts
import { parseDsn } from './dsn';
import { parseStack } from './stack-parse';
import { createTransport, type Transport } from './transport';
import type { Breadcrumb, CaptureOptions, Mechanism, PlatformInfo, SdkInfo, Signal, SignalLevel } from './types';

export interface ClientOptions {
  dsn: string;
  release?: string;
  environment?: string;
  maxBreadcrumbs?: number;
  beforeSend?: (signal: Signal) => Signal | null;
  platform: PlatformInfo;
  sdk: SdkInfo;
  transport?: Transport;
  sessionId?: string;
  now?: () => Date;
  isInApp?: (file: string) => boolean;
}

export interface SignalsClient {
  captureError(error: unknown, options?: CaptureOptions): void;
  captureEvent(name: string, data?: Record<string, unknown>, options?: CaptureOptions): void;
  captureLog(message: string, level?: SignalLevel): void;
  addBreadcrumb(breadcrumb: Breadcrumb): void;
  setUser(user: { id?: string; email?: string; name?: string } | null): void;
  setTag(key: string, value: string): void;
  setContext(key: string, context: Record<string, unknown> | null): void;
  flush(): Promise<void>;
  takeAll(): Signal[];
  sessionId: string;
  enabled: boolean;
}

export function generateSessionId(): string {
  let id = '';
  while (id.length < 10) id += Math.random().toString(36).slice(2);
  return `sess_${id.slice(0, 10)}`;
}

const truncate = (value: string, max: number): string => (value.length > max ? value.slice(0, max) : value);

export function createClient(options: ClientOptions): SignalsClient {
  const {
    maxBreadcrumbs = 50,
    beforeSend,
    platform,
    sdk,
    sessionId = generateSessionId(),
    now = () => new Date(),
    isInApp,
  } = options;

  let transport: Transport | null = options.transport ?? null;
  let enabled = true;
  if (!transport) {
    try {
      transport = createTransport({ url: parseDsn(options.dsn).ingestUrl });
    } catch {
      enabled = false;
    }
  }

  const breadcrumbs: Breadcrumb[] = [];
  let user: Signal['user'];
  const tags: Record<string, string> = {};
  const contexts: Record<string, Record<string, unknown>> = {};

  function send(signal: Signal): void {
    if (!enabled || !transport) return;
    let out: Signal | null = signal;
    if (beforeSend) out = beforeSend(signal);   // caller (guarded) catches hook bugs
    if (out) transport.enqueue(out);
  }

  const guarded = <A extends unknown[]>(fn: (...args: A) => void) => (...args: A): void => {
    try { fn(...args); } catch { /* the SDK must never break the host app */ }
  };

  function baseSignal(kind: Signal['kind'], name: string, mechanism: Mechanism, level: SignalLevel, opts?: CaptureOptions): Signal {
    return {
      kind,
      sessionId,
      name,
      mechanism: opts?.mechanism ?? mechanism,
      level: opts?.level ?? level,
      timestamp: now().toISOString(),
      release: options.release,
      environment: options.environment,
      fingerprint: opts?.fingerprint,
      user,
      tags: Object.keys(tags).length ? { ...tags } : undefined,
      contexts: { ...contexts, ...opts?.contexts },
      platform,
      sdk,
    };
  }

  return {
    sessionId,
    get enabled() { return enabled; },

    captureError: guarded((error: unknown, opts?: CaptureOptions) => {
      const isError = error instanceof Error;
      const signal = baseSignal('error', isError ? error.name || 'Error' : 'Error', 'manual', 'error', opts);
      signal.message = truncate(isError ? error.message : String(error), 5000);
      signal.stack = parseStack(isError ? error.stack : undefined, isInApp);
      signal.breadcrumbs = breadcrumbs.map((b) => ({ ...b }));
      send(signal);
    }),

    captureEvent: guarded((name: string, data?: Record<string, unknown>, opts?: CaptureOptions) => {
      const signal = baseSignal('event', truncate(name, 300), 'manual', 'info', opts);
      if (data) signal.contexts = { ...signal.contexts, event: data };
      send(signal);
    }),

    captureLog: guarded((message: string, level: SignalLevel = 'info') => {
      const signal = baseSignal('log', 'console', 'console', level);
      signal.message = truncate(message, 5000);
      send(signal);
    }),

    addBreadcrumb: guarded((breadcrumb: Breadcrumb) => {
      breadcrumbs.push({ ...breadcrumb, message: breadcrumb.message ? truncate(breadcrumb.message, 500) : undefined });
      if (breadcrumbs.length > maxBreadcrumbs) breadcrumbs.splice(0, breadcrumbs.length - maxBreadcrumbs);
    }),

    setUser: guarded((next) => { user = next ?? undefined; }),
    setTag: guarded((key: string, value: string) => { tags[key] = truncate(value, 200); }),
    setContext: guarded((key: string, context) => {
      if (context === null) delete contexts[key];
      else contexts[key] = context;
    }),

    flush: () => (transport ? transport.flush() : Promise.resolve()),
    takeAll: () => (transport ? transport.takeAll() : []),
  };
}
```

Note: `CaptureOptions` lives in `types.ts`: `export interface CaptureOptions { level?: SignalLevel; mechanism?: Mechanism; fingerprint?: string; contexts?: Record<string, Record<string, unknown>> }`. The `send()` call happens inside `guarded`, so a throwing `beforeSend` is swallowed (the test pins this).

- [ ] **Step 3: Tests pass; typecheck; build; commit** (`feat(signals-sdk): core client — capture APIs, breadcrumbs, never-throw`, pathspec `packages/signals`).

---

### Task 5: Browser package — instrumentation + auto-init IIFE

**Files:**
- Create: `packages/signals/browser/package.json` (boilerplate; name `@bendela6/signals-browser`; dep `"@bendela6/signals-core": "workspace:^"`; devDeps + `jsdom`; tsconfig lib adds `"DOM"`; vitest `environment: 'jsdom'`)
- Create: `packages/signals/browser/tsup.config.ts` — two builds:

```ts
import { defineConfig } from 'tsup';
export default defineConfig([
  { entry: ['src/index.ts'], format: ['esm', 'cjs'], dts: true, sourcemap: true, clean: true },
  { entry: { sdk: 'src/auto.ts' }, format: ['iife'], globalName: 'Signals', sourcemap: false, minify: true, outExtension: () => ({ js: '.js' }) },
]);
```

- Create: `packages/signals/browser/src/index.ts`, `src/instrument.ts`, `src/auto.ts`
- Test: `packages/signals/browser/src/index.test.ts`

**Interfaces:**
- Produces: `initSignals(options: BrowserInitOptions): SignalsClient` where `BrowserInitOptions = Omit<ClientOptions, 'platform' | 'sdk' | 'transport'> & { captureConsole?: 'breadcrumbs' | 'both' | 'off'; transport?: Transport }` — creates a core client with `platform: { runtime: 'browser', browser: navigator.userAgent, url: location.href }`, `sdk: { name: '@bendela6/signals-browser', version: '0.1.0' }`, then installs instrumentation. Repeat calls tear down the previous instance's listeners first (idempotent init). Re-exports the core types + `getClient(): SignalsClient | null`.
- Instrumentation (each in `instrument.ts`, returning an uninstall fn):
  - `window.addEventListener('error')` → `captureError(event.error ?? event.message, { mechanism: 'uncaught-exception' })`
  - `window.addEventListener('unhandledrejection')` → `captureError(event.reason, { mechanism: 'unhandled-rejection' })`
  - console patch (`log`, `warn`, `error`): always call original; add breadcrumb `{ type: 'console', message: args joined, data: { method } }`; when `captureConsole === 'both'` also `captureLog(message, mapped level)` (error→error, warn→warning, log→info). `'off'` disables console instrumentation entirely.
  - click: `document.addEventListener('click', …, { capture: true })` → breadcrumb `{ type: 'click', message: selector }` where selector = `tag#id.class1.class2` (first 2 classes).
  - history: patch `pushState`/`replaceState` + `popstate` listener → breadcrumb `{ type: 'navigation', message: newPath }`.
  - fetch patch: wrap `window.fetch`; breadcrumb `{ type: 'http', message: '<METHOD> <url>', data: { status, durationMs } }`; errors rethrown untouched (breadcrumb with `data: { error: true }`).
  - flush-on-hide: `visibilitychange`→hidden and `pagehide` → `navigator.sendBeacon(ingestUrl, JSON.stringify({ signals: client.takeAll() }))` when non-empty.
- `auto.ts`: reads `document.currentScript?.dataset.dsn`; if present calls `initSignals({ dsn })`; always sets `window.Signals = { initSignals, getClient }`.

- [ ] **Step 1: Failing tests** — `src/index.test.ts` (jsdom):

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { initSignals, getClient } from './index';
import type { Signal } from '@bendela6/signals-core';
import type { Transport } from '@bendela6/signals-core';

function fakeTransport() {
  const sent: Signal[] = [];
  const transport: Transport = {
    enqueue: (s) => { sent.push(s); }, flush: async () => {}, takeAll: () => sent.splice(0),
    queuedCount: () => sent.length, dispose: () => {},
  };
  return { transport, sent };
}
const DSN = 'sgl://k@127.0.0.1:4640/1';

afterEach(() => { vi.restoreAllMocks(); });

describe('initSignals (browser)', () => {
  it('captures window error events with uncaught-exception mechanism and browser platform', () => {
    const { transport, sent } = fakeTransport();
    initSignals({ dsn: DSN, transport });
    window.dispatchEvent(new ErrorEvent('error', { error: new TypeError('boom'), message: 'boom' }));
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ kind: 'error', mechanism: 'uncaught-exception', name: 'TypeError' });
    expect(sent[0]!.platform.runtime).toBe('browser');
    expect(sent[0]!.platform.url).toContain('localhost');
  });

  it('captures unhandled rejections', () => {
    const { transport, sent } = fakeTransport();
    initSignals({ dsn: DSN, transport });
    const event = new Event('unhandledrejection') as Event & { reason?: unknown };
    event.reason = new Error('nope');
    window.dispatchEvent(event);
    expect(sent[0]).toMatchObject({ mechanism: 'unhandled-rejection', message: 'nope' });
  });

  it('console.warn leaves a breadcrumb that rides the next error', () => {
    const { transport, sent } = fakeTransport();
    initSignals({ dsn: DSN, transport });
    console.warn('low stock');
    getClient()!.captureError(new Error('x'));
    expect(sent[0]!.breadcrumbs!.some((b) => b.type === 'console' && b.message === 'low stock')).toBe(true);
  });

  it("captureConsole: 'both' also emits log signals", () => {
    const { transport, sent } = fakeTransport();
    initSignals({ dsn: DSN, transport, captureConsole: 'both' });
    console.error('gateway timeout');
    expect(sent.some((s) => s.kind === 'log' && s.level === 'error' && s.message === 'gateway timeout')).toBe(true);
  });

  it('clicks and history changes leave typed breadcrumbs', () => {
    const { transport, sent } = fakeTransport();
    initSignals({ dsn: DSN, transport });
    const button = document.createElement('button');
    button.id = 'apply-coupon';
    document.body.appendChild(button);
    button.click();
    history.pushState({}, '', '/checkout');
    getClient()!.captureError(new Error('x'));
    const types = sent[0]!.breadcrumbs!.map((b) => `${b.type}:${b.message}`);
    expect(types).toContain('click:button#apply-coupon');
    expect(types).toContain('navigation:/checkout');
  });

  it('re-init tears down old listeners (no double capture)', () => {
    const { transport, sent } = fakeTransport();
    initSignals({ dsn: DSN, transport });
    initSignals({ dsn: DSN, transport });
    window.dispatchEvent(new ErrorEvent('error', { error: new Error('once'), message: 'once' }));
    expect(sent.filter((s) => s.kind === 'error')).toHaveLength(1);
  });
});
```

(fetch-patch breadcrumb test: stub `window.fetch = async () => ({ status: 200 })` before init, call `fetch('/api/x')`, then capture an error and assert an `http` breadcrumb `GET /api/x` with `status: 200` — include it as a seventh `it`.)

- [ ] **Step 2: Verify failure → implement** `instrument.ts` + `index.ts` + `auto.ts` per the interface block above. Key skeleton for `index.ts`:

```ts
import { createClient, parseDsn, type SignalsClient, type Transport } from '@bendela6/signals-core';
import { installInstrumentation } from './instrument';

let current: { client: SignalsClient; uninstall: () => void } | null = null;

export type BrowserInitOptions = /* per interface block */;

export function initSignals(options: BrowserInitOptions): SignalsClient {
  try {
    current?.uninstall();
    const client = createClient({
      ...options,
      platform: { runtime: 'browser', browser: navigator.userAgent, url: location.href },
      sdk: { name: '@bendela6/signals-browser', version: '0.1.0' },
    });
    let ingestUrl: string | null = null;
    try { ingestUrl = parseDsn(options.dsn).ingestUrl; } catch { /* disabled client */ }
    const uninstall = installInstrumentation(client, { captureConsole: options.captureConsole ?? 'breadcrumbs', ingestUrl });
    current = { client, uninstall };
    return client;
  } catch {
    // absolute last resort: return an inert client-shaped object
    const noop = () => {};
    return { captureError: noop, captureEvent: noop, captureLog: noop, addBreadcrumb: noop, setUser: noop, setTag: noop, setContext: noop, flush: async () => {}, takeAll: () => [], sessionId: 'sess_disabled0', enabled: false } as SignalsClient;
  }
}

export function getClient(): SignalsClient | null { return current?.client ?? null; }
export * from '@bendela6/signals-core';
```

`installInstrumentation(client, { captureConsole, ingestUrl })` registers each hook, collects teardown closures (restore originals, removeEventListener), returns `() => teardowns.forEach(fn => fn())`. Console patch stores originals on first patch and always restores on uninstall.

- [ ] **Step 3: Tests pass; typecheck; `pnpm --filter @bendela6/signals-browser build` produces `dist/index.js`, `dist/index.cjs`, `dist/index.d.ts`, and `dist/sdk.js` (IIFE); commit** (`feat(signals-sdk): browser SDK — instrumentation, beacon flush, auto-init IIFE`, pathspec `packages/signals`).

---

### Task 6: Collector serves /sdk.js

**Files:**
- Modify: `apps/signals/package.json` (add dep `"@bendela6/signals-browser": "workspace:^"`)
- Create: `apps/signals/src/routes/sdk.routes.ts`
- Modify: `apps/signals/src/app.ts` (register)
- Test: `apps/signals/src/routes/sdk.routes.test.ts`

**Interfaces:**
- Produces: `GET /sdk.js` → 200, `content-type: application/javascript`, `access-control-allow-origin: *`, `cache-control: public, max-age=300`, body = contents of the browser package's built `dist/sdk.js`. Resolved once at first request via `createRequire(import.meta.url).resolve('@bendela6/signals-browser/package.json')` → sibling `dist/sdk.js`, cached in memory. If the file is missing (package not built), 503 `{ error: 'sdk bundle not built — run pnpm --filter @bendela6/signals-browser build' }`.
- The browser package.json needs `"exports"` to keep `./package.json` accessible: add `"./package.json": "./package.json"` to its exports map (done here if Task 5 didn't).

- [ ] **Step 1: Failing test** — `sdk.routes.test.ts`:

```ts
import { expect, it } from 'vitest';
import { buildApp } from '../app';

it('GET /sdk.js serves the browser IIFE with open CORS', async () => {
  const app = buildApp({ db: null as never });
  const res = await app.inject({ method: 'GET', url: '/sdk.js' });
  expect(res.statusCode).toBe(200);
  expect(res.headers['content-type']).toContain('javascript');
  expect(res.headers['access-control-allow-origin']).toBe('*');
  expect(res.body).toContain('Signals');
  await app.close();
});
```

(Test precondition: `pnpm --filter @bendela6/signals-browser build` ran — Task 5 committed dist? **No — dist is gitignored.** The test must build on demand: add a vitest `beforeAll` hook? Simpler and deterministic: this test file starts with `import { execSync } from 'node:child_process'` guarded `beforeAll(() => { if (!existsSync(sdkPath)) execSync('pnpm --filter @bendela6/signals-browser build', { stdio: 'ignore' }); }, 120_000)`. Write it that way.)

- [ ] **Step 2: Implement** `sdk.routes.ts`:

```ts
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import type { FastifyInstance } from 'fastify';

let cached: string | null = null;

function loadBundle(): string | null {
  if (cached !== null) return cached;
  try {
    const require = createRequire(import.meta.url);
    const pkgPath = require.resolve('@bendela6/signals-browser/package.json');
    cached = readFileSync(join(dirname(pkgPath), 'dist', 'sdk.js'), 'utf8');
    return cached;
  } catch {
    return null;
  }
}

export function registerSdkRoutes(app: FastifyInstance) {
  app.get('/sdk.js', async (_request, reply) => {
    const bundle = loadBundle();
    if (bundle === null) {
      reply.status(503).send({ error: 'sdk bundle not built — run pnpm --filter @bendela6/signals-browser build' });
      return;
    }
    reply
      .header('content-type', 'application/javascript; charset=utf-8')
      .header('access-control-allow-origin', '*')
      .header('cache-control', 'public, max-age=300')
      .send(bundle);
  });
}
```

- [ ] **Step 3: Full apps/signals suite + typecheck green; commit** (`feat(signals): serve browser SDK IIFE at /sdk.js`, pathspec `apps/signals packages/signals`).

---

### Task 7: React package

**Files:**
- Create: `packages/signals/react/package.json` — boilerplate; name `@bendela6/signals-react`; dep `"@bendela6/signals-browser": "workspace:^"`; `peerDependencies: { "react": ">=18" }`; devDeps add `react@^19.2.5`, `react-dom@^19.2.5`, `@testing-library/react@^16.3.2`, `jsdom@^29.1.1`, `@types/react` matching; tsconfig `"jsx": "react-jsx", "lib": ["ES2022", "DOM"]`; vitest jsdom. tsup: mark react external (`external: ['react']`).
- Create: `packages/signals/react/src/index.tsx`
- Test: `packages/signals/react/src/index.test.tsx`

**Interfaces:**
- Produces: `<SignalsErrorBoundary fallback={node | (error) => node}>` — class component; `componentDidCatch(error, info)` → `getClient()?.captureError(error, { mechanism: 'error-boundary', contexts: { react: { componentStack: info.componentStack ?? '' } } })`; renders `fallback` (or null) after catching. `useSignals(): SignalsClient | null` (thin `getClient()` wrapper). Re-exports everything from `@bendela6/signals-browser` including `initSignals`.

- [ ] **Step 1: Failing tests** — `src/index.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { initSignals, SignalsErrorBoundary, useSignals } from './index';
import type { Signal, Transport } from '@bendela6/signals-browser';

function fakeTransport() {
  const sent: Signal[] = [];
  const transport: Transport = {
    enqueue: (s) => { sent.push(s); }, flush: async () => {}, takeAll: () => sent.splice(0),
    queuedCount: () => sent.length, dispose: () => {},
  };
  return { transport, sent };
}

function Bomb(): never { throw new Error('render boom'); }

describe('SignalsErrorBoundary', () => {
  it('captures render errors with error-boundary mechanism and shows the fallback', () => {
    const { transport, sent } = fakeTransport();
    initSignals({ dsn: 'sgl://k@127.0.0.1:4640/1', transport });
    render(
      <SignalsErrorBoundary fallback={<div>broken</div>}>
        <Bomb />
      </SignalsErrorBoundary>,
    );
    expect(screen.getByText('broken')).toBeDefined();
    const captured = sent.find((s) => s.kind === 'error' && s.mechanism === 'error-boundary');
    expect(captured).toBeDefined();
    expect(captured!.message).toBe('render boom');
    expect(captured!.contexts?.react?.componentStack).toBeDefined();
  });

  it('function fallback receives the error; useSignals exposes the client', () => {
    const { transport } = fakeTransport();
    initSignals({ dsn: 'sgl://k@127.0.0.1:4640/1', transport });
    function Probe() {
      const client = useSignals();
      return <span>{client ? client.sessionId : 'none'}</span>;
    }
    render(
      <SignalsErrorBoundary fallback={(error) => <em>{(error as Error).message}</em>}>
        <Bomb />
      </SignalsErrorBoundary>,
    );
    expect(screen.getByText('render boom')).toBeDefined();
    render(<Probe />);
    expect(screen.getByText(/^sess_/)).toBeDefined();
  });
});
```

- [ ] **Step 2: Verify failure → implement** — `src/index.tsx`:

```tsx
import { Component, type ReactNode } from 'react';
import { getClient, type SignalsClient } from '@bendela6/signals-browser';

export * from '@bendela6/signals-browser';

interface BoundaryProps {
  children: ReactNode;
  fallback?: ReactNode | ((error: unknown) => ReactNode);
}
interface BoundaryState { error: unknown | null }

export class SignalsErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  override state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): BoundaryState {
    return { error };
  }

  override componentDidCatch(error: unknown, info: { componentStack?: string | null }): void {
    getClient()?.captureError(error, {
      mechanism: 'error-boundary',
      contexts: { react: { componentStack: info.componentStack ?? '' } },
    });
  }

  override render(): ReactNode {
    if (this.state.error !== null) {
      const { fallback } = this.props;
      return typeof fallback === 'function' ? fallback(this.state.error) : (fallback ?? null);
    }
    return this.props.children;
  }
}

export function useSignals(): SignalsClient | null {
  return getClient();
}
```

- [ ] **Step 3: Tests pass; typecheck; build; commit** (`feat(signals-sdk): react error boundary + useSignals`, pathspec `packages/signals`).

---

### Task 8: Node package — process hooks + server helpers

**Files:**
- Create: `packages/signals/node/package.json` — boilerplate; name `@bendela6/signals-node`; dep core `workspace:^`; devDep `@types/node`; `"bin": { "signals": "./dist/cli.js" }`; tsup entries `['src/index.ts', 'src/cli.ts']` with `banner: { js: '#!/usr/bin/env node' }` applied ONLY to cli (use two config objects; cli builds ESM-only).
- Create: `packages/signals/node/src/index.ts`
- Test: `packages/signals/node/src/index.test.ts`

**Interfaces:**
- Produces: `initSignals(options: NodeInitOptions): SignalsClient` with `NodeInitOptions = Omit<ClientOptions, 'platform' | 'sdk'> & { registerProcessHandlers?: boolean; exitOnUncaught?: boolean }` — platform `{ runtime: 'node', nodeVersion: process.version, hostname: os.hostname(), pid: process.pid }`, sdk `{ name: '@bendela6/signals-node', version: '0.1.0' }`. When `registerProcessHandlers !== false`: `process.on('uncaughtException', handler)` → `handleUncaught` captures (mechanism `uncaught-exception`), `void client.flush()`, then `process.exit(1)` if `exitOnUncaught !== false`; `process.on('unhandledRejection')` → capture (mechanism `unhandled-rejection`), no exit. Exported for tests: `handleUncaught(client, error, exit?)`, `handleRejection(client, reason)`.
  - `expressErrorHandler(client)` → `(err, req, res, next)` — captures with mechanism `middleware` + `contexts: { http: { method: req.method, url: req.originalUrl ?? req.url } }`, then `next(err)`.
  - `fastifyErrorHook(client)` → `(error, request) => void` for use inside an app's own `setErrorHandler` — captures with mechanism `middleware` + `contexts: { http: { method: request.method, url: request.url } }`.
  - `getClient(): SignalsClient | null` mirror.

- [ ] **Step 1: Failing tests** — `src/index.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { expressErrorHandler, fastifyErrorHook, handleRejection, handleUncaught, initSignals } from './index';
import type { Signal, Transport } from '@bendela6/signals-core';

function fakeTransport() {
  const sent: Signal[] = [];
  const transport: Transport = {
    enqueue: (s) => { sent.push(s); }, flush: async () => {}, takeAll: () => sent.splice(0),
    queuedCount: () => sent.length, dispose: () => {},
  };
  return { transport, sent };
}
const DSN = 'sgl://k@127.0.0.1:4640/1';

describe('node SDK', () => {
  it('carries node platform info and does not register process handlers when disabled', () => {
    const before = process.listenerCount('uncaughtException');
    const { transport, sent } = fakeTransport();
    const client = initSignals({ dsn: DSN, transport, registerProcessHandlers: false });
    expect(process.listenerCount('uncaughtException')).toBe(before);
    client.captureError(new Error('x'));
    expect(sent[0]!.platform).toMatchObject({ runtime: 'node', nodeVersion: process.version, pid: process.pid });
  });

  it('handleUncaught captures with mechanism and calls exit hook; handleRejection never exits', () => {
    const { transport, sent } = fakeTransport();
    const client = initSignals({ dsn: DSN, transport, registerProcessHandlers: false });
    let exited: number | null = null;
    handleUncaught(client, new TypeError('crash'), (code) => { exited = code; });
    expect(sent[0]).toMatchObject({ mechanism: 'uncaught-exception', name: 'TypeError' });
    expect(exited).toBe(1);
    handleRejection(client, 'string reason');
    expect(sent[1]).toMatchObject({ mechanism: 'unhandled-rejection', message: 'string reason' });
  });

  it('express and fastify helpers capture with http context and middleware mechanism', () => {
    const { transport, sent } = fakeTransport();
    const client = initSignals({ dsn: DSN, transport, registerProcessHandlers: false });
    let nexted: unknown = null;
    expressErrorHandler(client)(new Error('exp'), { method: 'POST', url: '/pay', originalUrl: '/api/pay' }, {}, (e: unknown) => { nexted = e; });
    expect(sent[0]).toMatchObject({ mechanism: 'middleware', message: 'exp' });
    expect(sent[0]!.contexts?.http).toMatchObject({ method: 'POST', url: '/api/pay' });
    expect(nexted).toBeInstanceOf(Error);
    fastifyErrorHook(client)(new Error('fas'), { method: 'GET', url: '/x' });
    expect(sent[1]!.contexts?.http).toMatchObject({ method: 'GET', url: '/x' });
  });
});
```

- [ ] **Step 2: Verify failure → implement** `src/index.ts` per the interface block (registration path: store handlers so repeat init with `registerProcessHandlers` replaces them via `process.off`; `handleUncaught(client, error, exit = (c) => process.exit(c))`).

- [ ] **Step 3: Tests pass; typecheck; build; commit** (`feat(signals-sdk): node SDK — process hooks, express/fastify helpers`, pathspec `packages/signals`).

---

### Task 9: `signals` CLI — sourcemaps upload

**Files:**
- Create: `packages/signals/node/src/sourcemaps.ts`, `src/cli.ts`
- Modify: `src/index.ts` (export `uploadSourcemaps`)
- Test: `packages/signals/node/src/sourcemaps.test.ts`

**Interfaces:**
- Produces: `uploadSourcemaps(options: { dir: string; release: string; dsn: string; fetchFn?: typeof fetch }): Promise<{ uploaded: string[] }>` — recursively finds `*.map` under `dir` (skip `node_modules`), POSTs one JSON body `{ release, files: [{ filename: basename, content }] }` to the DSN's sourcemaps URL, throws on non-201 with the response body in the message (CLI context — throwing is fine here, this is not host-app code). Batches: if > 50 files, send in chunks of 50.
- `cli.ts`: `signals sourcemaps upload <dir> --release <r> --dsn <dsn>` via `util.parseArgs` (`allowPositionals: true`); prints `uploaded N source map(s) for release <r>`; exits 1 with the error message on failure; `--help`/unknown commands print usage.

- [ ] **Step 1: Failing tests** — `src/sourcemaps.test.ts`:

```ts
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { uploadSourcemaps } from './sourcemaps';

function tempDist(): string {
  const dir = mkdtempSync(join(tmpdir(), 'signals-maps-'));
  writeFileSync(join(dir, 'index-abc.js.map'), '{"version":3}');
  mkdirSync(join(dir, 'assets'));
  writeFileSync(join(dir, 'assets', 'vendor.js.map'), '{"version":3}');
  writeFileSync(join(dir, 'index.js'), 'not a map');
  mkdirSync(join(dir, 'node_modules'));
  writeFileSync(join(dir, 'node_modules', 'skip.js.map'), '{}');
  return dir;
}

describe('uploadSourcemaps', () => {
  it('finds maps recursively (skipping node_modules) and posts them to the DSN sourcemap URL', async () => {
    const calls: { url: string; body: { release: string; files: { filename: string }[] } }[] = [];
    const result = await uploadSourcemaps({
      dir: tempDist(), release: '1.2.0', dsn: 'sgl://k@127.0.0.1:4640/1',
      fetchFn: (async (url: string, init: { body: string }) => {
        calls.push({ url, body: JSON.parse(init.body) });
        return { status: 201, text: async () => '' };
      }) as unknown as typeof fetch,
    });
    expect(calls[0]!.url).toBe('http://127.0.0.1:4640/ingest/k/sourcemaps');
    expect(calls[0]!.body.release).toBe('1.2.0');
    expect(calls[0]!.body.files.map((f) => f.filename).sort()).toEqual(['index-abc.js.map', 'vendor.js.map']);
    expect(result.uploaded).toHaveLength(2);
  });

  it('throws with server detail on non-201', async () => {
    await expect(uploadSourcemaps({
      dir: tempDist(), release: 'r', dsn: 'sgl://k@h/1',
      fetchFn: (async () => ({ status: 403, text: async () => '{"error":"unknown ingest key"}' })) as unknown as typeof fetch,
    })).rejects.toThrow(/403.*unknown ingest key/);
  });
});
```

- [ ] **Step 2: Verify failure → implement** `sourcemaps.ts` (readdir recursive walk) and `cli.ts` (parseArgs → uploadSourcemaps → console.log / process.exit(1)).

- [ ] **Step 3: Tests pass; typecheck; build (`dist/cli.js` exists with shebang); commit** (`feat(signals-sdk): signals CLI — sourcemaps upload`, pathspec `packages/signals`).

---

### Task 10: End-to-end integration, examples, publish setup, full gate

**Files:**
- Create: `packages/signals/node/src/e2e.test.ts`
- Create: `packages/signals/examples/plain.html`, `packages/signals/examples/node-demo.mjs`, `packages/signals/examples/README.md`
- Create: `docs/signals-sdk.md`
- Test: full-repo gates

**Interfaces:**
- Produces: proof the SDK talks to the real collector; consumer-facing docs; publishable tarballs.

- [ ] **Step 1: E2E test** — `packages/signals/node/src/e2e.test.ts`: **skipped unless the collector test env is reachable** — spins the real collector in-process:

```ts
import { describe, expect, it } from 'vitest';
import { initSignals } from './index';

// End-to-end: real HTTP from the node SDK into the real collector (in-process,
// signals_test database). Requires postgres on 127.0.0.1:5532; skips otherwise.
describe('node SDK ⇄ collector e2e', () => {
  it('captureError lands as a grouped issue', async () => {
    process.env.SIGNALS_DATABASE = 'signals_test';
    let buildApp, createDbClient;
    try {
      ({ buildApp } = await import('../../../../apps/signals/src/app'));
      ({ createDbClient } = await import('../../../../apps/signals/src/db/client'));
    } catch { return; /* collector sources unavailable — skip */ }
    const { db, sql } = createDbClient({ max: 1 });
    await sql.unsafe('TRUNCATE "signals", "sourcemap_artifacts", "issues", "apps" RESTART IDENTITY CASCADE');
    const app = buildApp({ db });
    await app.listen({ port: 0, host: '127.0.0.1' });
    const port = (app.server.address() as { port: number }).port;
    const created = await fetch(`http://127.0.0.1:${port}/apps`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'E2E' }),
    }).then((r) => r.json());

    const client = initSignals({
      dsn: `sgl://${created.ingestKey}@127.0.0.1:${port}/${created.id}`,
      registerProcessHandlers: false,
      release: '1.0.0',
    });
    client.captureError(new TypeError('e2e boom'));
    await client.flush();

    const issues = await fetch(`http://127.0.0.1:${port}/issues`).then((r) => r.json());
    expect(issues.total).toBe(1);
    expect(issues.rows[0].title).toContain('e2e boom');
    expect(issues.rows[0].key).toMatch(/^SGL-\d+$/);
    await app.close();
    await sql.end();
  }, 30_000);
});
```

Note: this file imports collector sources across package boundaries FOR THE TEST ONLY (dev-time, not shipped); it must not appear in `src/index.ts` exports. If the tsconfig `include: ["src"]` complains about the cross-package import, add `// @ts-expect-error dev-only cross-package import` — the test's runtime behavior is what matters.

- [ ] **Step 2: Examples** — `plain.html` (script tag pointing at `http://127.0.0.1:4640/sdk.js` with `data-dsn` placeholder + a button that throws), `node-demo.mjs` (init + captureEvent + captureError + flush, DSN from argv), short README.

- [ ] **Step 3: docs/signals-sdk.md** — consumer setup: the `.npmrc` block from the spec, install commands, React/Node/plain quickstarts (mirroring the design's snippet panel), sourcemap upload command, publish instructions for the owner (`pnpm --filter './packages/signals/*' build`, `npm login --registry=https://npm.pkg.github.com` with a `write:packages` PAT, `pnpm --filter './packages/signals/*' publish --no-git-checks`).

- [ ] **Step 4: Full gate**

```bash
pnpm --filter './packages/signals/*' build     # all four dists
pnpm --filter './packages/signals/*' test
pnpm --filter @tickets/signals test            # collector still green (incl. /sdk.js route)
pnpm typecheck                                  # whole monorepo
pnpm --filter './packages/signals/*' pack      # four publishable tarballs, no errors
```

- [ ] **Step 5: Commit** (`feat(signals-sdk): e2e test, examples, consumer docs, publish setup`, pathspec `packages/signals docs apps/signals`).

---

## Self-review notes

- **Spec coverage:** core API surface incl. beforeSend/breadcrumbs/session ids (T4), transport rules 5s/10/64/backoff (T3), DSN parse (T1), stack capture (T2), browser auto-instrumentation incl. console/click/nav/fetch + sendBeacon (T5), plain-HTML `/sdk.js` (T6), react boundary + hook (T7), node hooks + express/fastify helpers (T8), `signals sourcemaps upload` CLI (T9), GitHub Packages publish config + .npmrc docs + examples + e2e (T10).
- **Known deviations:** XHR patching dropped (fetch-only; jsdom XHR patch verification is brittle and every modern consumer uses fetch — revisit if a consumer needs it). `captureConsole` default `'breadcrumbs'` (spec's session-timeline logs arrive when consumers opt into `'both'`). CLI syntax `signals sourcemaps upload <dir> --release --dsn` matches the design's snippet.
- **Type consistency:** `Transport`/`Signal`/`SignalsClient` flow core → browser → react/node; fake transports in every test file share the same 5-method shape.
