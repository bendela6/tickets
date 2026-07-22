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
    getClient()?.captureError(new Error(event.message), {
      contexts: { agent: { sessionId } },
    });
  }
}

// nonzero process exit code
const { exitCode } = await proc.exit;
if (exitCode !== 0) {
  getClient()?.captureError(new Error(`process exited ${exitCode}`), { contexts: { job } });
}

// result object with an error field
const result = await doThing();
if (!result.ok) {
  getClient()?.captureError(new Error(result.error), { contexts: { op: { name: 'doThing' } } });
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
  getClient()?.captureError(err, { level: 'error', contexts: { outbox: { phase: 'drain' } } });
}

// fire-and-forget that used to be silent
cleanup().catch((err) => getClient()?.captureError(err, { contexts: { phase: 'teardown' } }));
```

### 4. The client-side network seam

One place in the frontend — the fetch wrapper — captures what the UI *experiences*: server 5xx and
network failures. NOT 4xx (the server owns those; capturing both floods you with duplicates).

```ts
try {
  const res = await fetch(url);
  if (res.status >= 500) {
    getClient()?.captureError(new Error(`server ${res.status}`), {
      contexts: { http: { url, status: res.status } },
    });
  }
} catch (err) {
  getClient()?.captureError(err, { contexts: { http: { url } } }); // network failure
  throw err;
}
```

### 5. Handled-but-warning — recovered, but worth recording

A retry that succeeded, a fallback that kicked in. Real, not alarming → `warning`.

```ts
try {
  return await callStripe();
} catch (err) {
  getClient()?.captureError(err, { level: 'warning', contexts: { retry: { attempt: 1 } } });
  return await callStripe(); // second try
}
```

### 6. Business-logic checkpoint — nothing threw, but YOU know it's wrong

An invariant violation, a reconciliation mismatch, a suspicious value.

```ts
if (cart.total !== recomputed) {
  getClient()?.captureError(new Error('cart total mismatch'), {
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
