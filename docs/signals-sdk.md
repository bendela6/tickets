# Signals SDK — consumer guide

Signals is this repo's local-first, self-hosted error/event collector
(`apps/signals`, port **4640**). This page is for **consumers** — any app,
inside or outside this monorepo, that wants to send errors/events to it.
For the collector's own architecture and data model, see
`docs/superpowers/specs/2026-07-18-signals-error-collector-design.md`.

Every consumer needs a **DSN** first: create an app from the Signals →
Apps screen (or `POST http://<collector-host>:4640/apps`), which returns
`sgl://<ingestKey>@<host>:<port>/<appId>`. Signals never leave the
machine the collector runs on unless you point the DSN at a remote host.

## Install

The four SDK packages are published as **private** packages to the GitHub
Packages npm registry under the `@bendela6` scope:

| Package | For |
| --- | --- |
| `@bendela6/signals-core` | Platform-neutral primitives (pulled in transitively — you don't install this directly) |
| `@bendela6/signals-browser` | Any browser app; also builds the `/sdk.js` IIFE the collector serves |
| `@bendela6/signals-react` | React apps — re-exports `signals-browser` + adds `<SignalsErrorBoundary>` / `useSignals()` |
| `@bendela6/signals-node` | Node servers — process hooks, Express/Fastify helpers, `signals sourcemaps upload` CLI |

Consuming projects need a `.npmrc` (repo root or your project root) telling
npm where `@bendela6/*` lives, plus a `read:packages` PAT in the environment:

```
@bendela6:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GH_PACKAGES_TOKEN}
```

```sh
export GH_PACKAGES_TOKEN=ghp_xxx   # PAT with read:packages, scoped to this org/repo
npm install @bendela6/signals-react   # or signals-node, or signals-browser directly
```

**Plain HTML pages skip all of this** — see the script-tag quickstart below;
`/sdk.js` needs no registry auth, so it's the zero-setup path.

## Quickstarts

### React

```sh
npm install @bendela6/signals-react
```

```ts
import { initSignals } from '@bendela6/signals-react';

initSignals({
  dsn: 'sgl://pub_4f9c21ab@127.0.0.1:4640/3',
  release: import.meta.env.VITE_APP_VERSION,
  environment: 'development',
});
```

Wrap the parts of your tree you want isolated crash reporting for, and
optionally read the client inside components:

```tsx
import { SignalsErrorBoundary, useSignals } from '@bendela6/signals-react';

function App() {
  return (
    <SignalsErrorBoundary fallback={<p>Something broke.</p>}>
      <Checkout />
    </SignalsErrorBoundary>
  );
}

function Checkout() {
  const signals = useSignals();
  const onSubmit = () => signals?.captureEvent('checkout-submitted');
  // ...
}
```

`initSignals` also installs `window.onerror` / `unhandledrejection`
listeners and auto-breadcrumbs (console, clicks, navigation, fetch), so
the error boundary is a backstop for render-time errors — window-level
handlers still catch everything else.

### Node

```sh
npm install @bendela6/signals-node
```

```ts
import { initSignals, expressErrorHandler, fastifyErrorHook } from '@bendela6/signals-node';

const signals = initSignals({
  dsn: 'sgl://pub_4f9c21ab@127.0.0.1:4640/3',
  release: process.env.RELEASE,
  environment: process.env.NODE_ENV,
});

// Express:
app.use(expressErrorHandler(signals));

// Fastify: fastifyErrorHook only captures — it doesn't reply, so wire the
// reply yourself (fastify requires setErrorHandler to always send a response,
// otherwise the request hangs until it times out):
const captureFastify = fastifyErrorHook(signals);
app.setErrorHandler((error, request, reply) => {
  captureFastify(error, request);
  reply.status(500).send({ error: 'internal error' });
});
```

By default `initSignals` registers `process.on('uncaughtException'|'unhandledRejection', …)`
handlers that capture, flush, and exit (matching Node's own guidance for
uncaught exceptions). Pass `registerProcessHandlers: false` to opt out —
e.g. in tests, or if you drive capture entirely yourself:

```ts
const signals = initSignals({ dsn, registerProcessHandlers: false });
signals.captureError(err);
await signals.flush();
```

### Plain HTML (no build step)

```html
<script src="http://127.0.0.1:4640/sdk.js" data-dsn="sgl://pub_4f9c21ab@127.0.0.1:4640/3"></script>
```

Auto-inits on load using the `data-dsn` attribute; `window.Signals` is
also exposed (`Signals.initSignals(...)`, `Signals.getClient()`) if you
need to re-init or reach the client from other inline scripts. See
`packages/signals/examples/plain.html` for a runnable copy.

## Common client API

Available on the object every `initSignals()` returns (same shape across
all three SDKs):

```ts
client.captureError(error, { level?, mechanism?, contexts?, fingerprint? });
client.captureEvent(name, data?, options?);
client.addBreadcrumb({ type, message, data? });
client.setUser({ id?, email?, name? } | null);
client.setTag(key, value);
client.setContext(key, contextObject | null);
await client.flush();          // force-send whatever's queued
client.sessionId;               // one per page load (browser) / process (node)
client.enabled;                 // false if the DSN failed to parse
```

The transport batches (flush every ~5s or 10 signals, whichever first),
retries with backoff, and never throws back into your app — a dead
collector never affects the host app; worst case, signals drop silently.

## Source maps

If you ship minified/bundled JS with a `release`, upload its source maps
so stack frames symbolicate in the Signals UI:

```sh
npx signals sourcemaps upload ./dist --release 1.2.0 --dsn "sgl://pub_4f9c21ab@127.0.0.1:4640/3"
```

Recursively finds every `*.map` under `<dir>`, uploads them (chunked,
50 files/request) tagged with `--release`. Run it as a build/deploy step,
after the release value you pass to `initSignals({ release })` matches.

## Publishing (repo owner only)

The four packages live in `packages/signals/*` and build with `tsup`
(ESM + CJS + `.d.ts`, plus a minified IIFE for `signals-browser`'s
`sdk.js`). To cut a release:

```sh
# 1. Build every package's dist/
pnpm --filter './packages/signals/*' build

# 2. Log in to the GitHub Packages registry (PAT needs write:packages)
npm login --registry=https://npm.pkg.github.com

# 3. Publish all four (workspace deps resolve to matching published versions)
pnpm --filter './packages/signals/*' publish --no-git-checks
```

Bump each package's `version` in its `package.json` before publishing —
pnpm won't republish an unchanged version. `publishConfig.registry` and
`repository` are already set in every `package.json` (GitHub Packages
requires the latter to resolve the scope to this repo).

To sanity-check what would ship without touching the registry (filtered `pnpm pack`
fails on this pnpm version — run it per-directory instead):

```sh
for d in packages/signals/core packages/signals/browser packages/signals/react packages/signals/node; do
  (cd "$d" && pnpm pack)
done
```

## Self-monitoring (this repo)

Every app in this monorepo (except `apps/signals` itself — the collector
doesn't watch itself) reports its own errors to Signals, using the same
DSN-less self-registration flow consumers get from `ensureAppDsn`:

| App | Slug | SDK | Init site |
| --- | --- | --- | --- |
| `apps/api` | `tickets-api` | `@bendela6/signals-node` | `apps/api/src/signals.ts` (`initApiSignals`, called at boot) |
| `apps/mcp` | `tickets-mcp` | `@bendela6/signals-node` | `apps/mcp/src/signals.ts` (`initMcpSignals`, called at boot) |
| `apps/web` | `tickets-web` | `@bendela6/signals-react` | `apps/web/src/signals-init.ts` (`initWebSignals`, fire-and-forget from `main.tsx`) |
| `apps/eer` | `tickets-eer` | `@bendela6/signals-browser` | `apps/eer/src/signals-init.ts` (`initEerSignals`, fire-and-forget from `main.tsx`) |

Names slugify deterministically (`Tickets API` → `tickets-api`, etc.), and
`ensureAppDsn` is called with `upsert: true`, so re-registering on every
boot/page-load is idempotent — it always resolves to the same app row.

### Env knobs

| Var | Apps | Effect |
| --- | --- | --- |
| `SIGNALS_DISABLED=1` | api, mcp | Skip Signals entirely — no registration attempt, no init. |
| `VITE_SIGNALS_DISABLED=1` | web, eer | Same, for the browser build (read via `import.meta.env`). |
| `SIGNALS_DSN` | api, mcp | Skip self-registration and use this DSN directly. |
| `VITE_SIGNALS_DSN` | web, eer | Same, for the browser build. |
| `SIGNALS_COLLECTOR_URL` | api, mcp | Collector base URL for the node `ensureAppDsn` call. Defaults to `http://127.0.0.1:4640`. |
| *(none — same-origin)* | web, eer | The browser `ensureAppDsn` always registers against the same-origin `/signals-api` proxy (`basePath`, default), not a configurable URL — see `ensure.ts` above. |
| `SIGNALS_PROXY_TARGET` | web, eer (dev only) | Overrides the vite dev-server proxy target for `/signals-api` (`apps/web/vite.config.ts`, `apps/eer/vite.config.ts`). Defaults to `http://127.0.0.1:4640`; not read at runtime by the built bundle. |

None of these are required in the deployed container: `SIGNALS_COLLECTOR_URL`
resolves to the loopback collector supervisord runs alongside the api
(`docker/supervisord.conf`), and the web/eer bundles hit `/signals-api`,
which nginx reverse-proxies to the same collector (`docker/nginx.conf`).

### Boundary and uncaught-error behavior

- **api**: `registerProcessHandlers: true`, `exitOnUncaught: environment.nodeEnv === 'production'`
  — in production, an uncaught exception is captured, flushed, and the
  process exits (matching Node's own guidance); in dev it keeps running.
  Either way the error always prints to stderr first (`buildUncaughtListener`
  unconditionally logs it), so the crash stays visible in both modes. Every HTTP 500 (any error that isn't an `HttpError`, i.e. isn't
  an expected 4xx) is captured by the Fastify `setErrorHandler` in
  `apps/api/src/app.ts` with `mechanism: 'middleware'` before the generic
  `{ error: 'internal error' }` response — `HttpError`s (4xx) are never
  reported, only genuine server faults.
- **mcp**: `registerProcessHandlers: false` — `apps/mcp/src/server.ts` owns
  its own `uncaughtException`/`unhandledRejection` listeners (the stdio
  transport must never be torn down by an uncaught error) and forwards to
  Signals through them instead of letting the SDK install its own
  exit-capable handlers.
- **web**: wrapped in `<SignalsErrorBoundary>` around the app root
  (`apps/web/src/main.tsx`) with a minimal `AppCrashedFallback` (reload
  button) — this is a backstop for render-time errors; `initSignals` also
  installs `window.onerror`/`unhandledrejection` listeners, so navigation,
  event-handler, and async errors outside React's render are still caught
  even without the boundary.
- **eer**: no React SDK dependency, so no error boundary — relies solely on
  the browser SDK's `window.onerror`/`unhandledrejection` listeners.
- **Every init path degrades silently on failure**: a down/unreachable
  collector, a registration timeout (2s, no retry), or a disabled flag all
  resolve to "no signals" with at most one `console.warn`/`console.error` —
  none of the four apps ever fail to boot or fail to render because Signals
  is unavailable.
