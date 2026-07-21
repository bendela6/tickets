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

// Fastify:
app.setErrorHandler(fastifyErrorHook(signals));
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

To sanity-check what would ship without touching the registry:

```sh
pnpm --filter './packages/signals/*' pack
```
