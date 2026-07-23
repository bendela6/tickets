# Signals — where and how to capture errors

A practical guide to `captureError` for anyone instrumenting an app with the Signals SDKs
(`@bendela6/signals-node`, `-browser`, `-react`). Companion to [signals-sdk.md](./signals-sdk.md)
(setup, DSNs, env knobs).

## The mental model

Every error is one of three kinds, and the kind decides what you do:

| Kind | What it means | What you write |
|---|---|---|
| **Unhandled** | Nothing caught it; the process/page was breaking | Nothing — the SDK's process/window/boundary hooks capture it automatically |
| **Handled but real** | You caught it, but something genuinely failed | `captureError(err)` yourself, at the boundary that has context |
| **Handled and expected** | Validation, user typo, 404 | `warning`, or skip it — don't create noise |

The one that bites everyone: a "handled but real" failure can either be **thrown** (an exception)
or **reported as data** (an event/result/status/exit-code). Both need capture, but they arrive at
different code. Instrument both shapes.

## The decision, in one pass

```
Did it throw and nobody caught it?      → automatic (SDK safety net). Write nothing.
Did you catch it and something failed?  → captureError(error) here.
Did a failure arrive as data/event?     → captureError(new Error(...)) at that branch.
Is it just invalid user input (4xx)?    → warning, or skip. Don't create noise.
Do YOU know a value is wrong?           → captureError / captureEvent, deliberately.
```

## The scenarios

### 1. Framework catch-all (one per app)

The single outermost handler where unhandled errors surface. Usually the SDK sets this up
(`process.on('uncaughtException')`, `window.onerror`, the React boundary). If you own the
framework error handler, capture there too:

```ts
app.setErrorHandler((error, request, reply) => {
  signals?.captureError(error, {
    mechanism: 'middleware',
    contexts: { http: { method: request.method, url: request.url, status: 500 } },
  });
  reply.status(500).send({ error: 'internal error' });
});
```

### 2. Failure arrives as DATA, not a throw (the most-missed category)

Any place a failure stops being an exception and becomes a value — an event-stream `{type:'error'}`,
a nonzero exit code, a `status='failed'` write, an `{ ok:false }` result. These NEVER reach the
catch-all, because the code "handled" it by recording it.

```ts
// event stream / async iterator
for await (const event of run.events) {
  if (event.type === 'error') {
    captureError(new Error(event.message), {
      contexts: { agent: { sessionId } },
    });
  }
}

// nonzero process exit code
const { exitCode } = await proc.exit;
if (exitCode !== 0) {
  captureError(new Error(`process exited ${exitCode}`), { contexts: { job } });
}

// result object with an error field
const result = await doThing();
if (!result.ok) {
  captureError(new Error(result.error), { contexts: { op: { name: 'doThing' } } });
}
```

### 3. Swallowed catch — the `catch {}` / `catch → log` sites

Anywhere you catch and continue: background workers, teardown, fire-and-forget promises,
message parsers. If it was worth catching, it's worth a capture next to (or instead of) the log.

```ts
try {
  await drainOutbox();
} catch (err) {
  console.error('outbox drain failed', err);
  captureError(err, { level: 'error', contexts: { outbox: { phase: 'drain' } } });
}

// fire-and-forget that used to be silent
cleanup().catch((err) => captureError(err, { contexts: { phase: 'teardown' } }));
```

### 4. The client-side network seam

One place in the frontend — the fetch wrapper — captures what the UI *experiences*: server 5xx and
network failures. NOT 4xx (the server owns those; capturing both floods you with duplicates).

```ts
try {
  const res = await fetch(url);
  if (res.status >= 500) {
    captureError(new Error(`server ${res.status}`), {
      contexts: { http: { url, status: res.status } },
    });
  }
} catch (err) {
  captureError(err, { contexts: { http: { url } } }); // network failure
  throw err;
}
```

### 5. Handled-but-warning — recovered, but worth recording

A retry that succeeded, a fallback that kicked in. Real, not alarming → `warning`.

```ts
try {
  return await callStripe();
} catch (err) {
  captureError(err, { level: 'warning', contexts: { retry: { attempt: 1 } } });
  return await callStripe(); // second try
}
```

### 6. Business-logic checkpoint — nothing threw, but YOU know it's wrong

An invariant violation, a reconciliation mismatch, a suspicious value.

```ts
if (cart.total !== recomputed) {
  captureError(new Error('cart total mismatch'), {
    level: 'warning',
    contexts: { cart: { shown: cart.total, actual: recomputed } },
  });
}
```

### 7. Automatic — you just mount / init

No `captureError` call at all; the SDK does it.

```tsx
// React: any render crash → mechanism 'error-boundary'
<SignalsErrorBoundary fallback={<Broken />}>
  <App />
</SignalsErrorBoundary>

// Node: initSignals({ ..., registerProcessHandlers: true }) installs
//   process.on('uncaughtException' | 'unhandledRejection')
// Browser: initSignals(...) installs window.onerror + unhandledrejection
```

### 8. Enrich before it fails

Context/user/tags set on the client ride along with every later capture — manual or automatic.

```ts
getClient()?.setUser({ id: userId });
getClient()?.setTag('feature', 'checkout-v2');
getClient()?.setContext('cart', { items: 3 });
// any capture after this carries user + tag + cart context
```

## Option cheat-sheet

```ts
captureError(err, {
  level: 'error' | 'warning' | 'info',        // severity → the shape-coded dot + filter
  mechanism: 'middleware' | 'manual' | ...,   // how it was caught → the UI badge
  fingerprint: 'stripe-charge-failed',        // override grouping when the message has variable ids
  contexts: { anything: { ...structured } },  // shown on the issue detail + searchable
});
```

## Logs — a flat stream, not an issue

Logs are for a captured line worth keeping, not for a fault. They never group into an issue;
they show up in the **Activity** view as a flat, filterable stream (by app, level, time, search).

Two ways a log gets captured:

- **`captureConsole: true`** (SDK init option) — auto-captures `console.warn` / `console.error`
  as `log` signals, gated by a floor (default `'warning'`; lower it to `'info'` with
  `logLevel` / the env knob below to also capture `console.info`). It still calls through to the
  real console — nothing about local output changes — and it's never-throw and
  re-entrancy-guarded, so a console call made *while* reporting a console call can't loop. This
  is the right default for most call sites: you're already writing `console.warn('slow query',
  { ms })`, and turning the flag on makes that line show up in Signals for free.
- **`captureLog(message, level?)`** — call this explicitly when you want a log captured but
  *don't* want (or don't have) a matching `console.*` call, or when you want a level the console
  floor wouldn't pass (e.g. an `'info'` log while the floor is `'warning'`). Prefer plain
  `console.warn`/`console.error` + `captureConsole` for anything that's naturally a console line;
  reach for `captureLog` when the log only needs to exist in Signals.

Don't reach for `captureError` just to get something into the stream — if it didn't fail, it's a
log, not an issue. See [signals-sdk.md](./signals-sdk.md) for `SIGNALS_LOG_LEVEL` /
`VITE_SIGNALS_LOG_LEVEL` (the console-capture floor).

## Events — lifecycle and audit facts, not traffic

`captureEvent(name, data?)` records that something *happened* — a fact worth a line in an
activity stream, not a fault. Use it for:

- **Lifecycle**: boot, ready, graceful shutdown, session started/ended.
- **Run/job outcomes**: a run or job started/completed/failed (as a fact — the failure itself,
  if it's a real error, still gets its own `captureError` at the branch that saw it; the event is
  the audit trail entry, the error is the fault report).
- **Usage audit for infra you don't otherwise see**: e.g. every MCP tool call, so there's a
  record of what ran and whether it succeeded.

Don't use it for:

- **High-frequency, per-request/per-navigation/per-keystroke traffic** — that stays a
  **breadcrumb** (`addBreadcrumb`), which rides along on the next capture instead of becoming its
  own stored row. An event per HTTP request or per route change would flood the Activity view and
  tell you nothing a breadcrumb doesn't already.
- **Domain audit** — ticket/item mutations already have a source of truth
  (`item-activity`). Signals events are for *this repo's infra* (api/mcp/web/eer processes),
  not for what a user did to a ticket.

Naming convention actually used in this repo: `<app-or-subject>.<subject>.<verb>` — short,
dotted, lowercase, stable (it's the thing you'll filter/search on in Activity, not a sentence).
Real examples from what shipped:

```ts
captureEvent('api.boot', { port, environment });
captureEvent('agent.run.completed', { sessionId });
captureEvent('terminal.session.started', { sessionId });
captureEvent('mcp.tool', { name, ok, durationMs }); // one per tool call — success or failure
```

Same "capture at the layer that has context, once" rule applies: the agent driver knows the
session id and the run outcome, so it emits `agent.run.*`, not the route handler three layers up.

## Two rules that keep it clean

1. **Capture at the layer that has context, once.** The driver knows the session id; the request
   handler knows the route. Don't capture the same error at three layers — you get triple issues.
   (A deliberate exception: web-side 5xx *and* api-side 500 for one failure are two genuine
   vantage points — client experience vs server cause — and are allowed to coexist.)

2. **Fingerprint on purpose where messages vary.** If a message interpolates an id/name/count,
   override the fingerprint (by route, by operation) so one *class* of failure is one issue, not
   ten thousand. Everything else groups naturally on error type + normalized message + stack.

## How this repo applies it (reference)

The tickets monorepo instruments all four apps. Notable placements, by scenario:

- **1 (catch-all):** `apps/api/src/app.ts` (Fastify error handler — 4xx warning, 5xx error, plus a
  `setNotFoundHandler`); `apps/web/src/main.tsx` (`SignalsErrorBoundary`); process handlers in
  `apps/api/src/server.ts` + `apps/mcp/src/server.ts`.
- **2 (failure-as-data):** `apps/api/src/agent/driver.ts` (`event.type === 'error'`),
  `apps/api/src/terminal/driver.ts` (mid-session + exit paths).
- **3 (swallowed):** `apps/api/src/outbox/worker.ts`, the terminal/agent socket message catches.
- **4 (fetch seam):** `apps/web/src/api/client.ts` (≥500 + network).

See [signals-sdk.md](./signals-sdk.md) for the env knobs (`SIGNALS_DISABLED`, `SIGNALS_DSN`,
`VITE_SIGNALS_*`) and the self-registration flow.
