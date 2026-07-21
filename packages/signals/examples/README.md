# Signals SDK examples

Two minimal, runnable examples. Both assume you already have an app + DSN
(create one from the Apps screen in the Signals UI, or `POST /apps`).

## `plain.html` — zero-build script tag

Open `plain.html` directly in a browser (or serve it with any static
file server). It loads the SDK straight from the collector — no npm
install, no build step:

```html
<script src="http://127.0.0.1:4640/sdk.js" data-dsn="sgl://<key>@127.0.0.1:4640/<appId>"></script>
```

Edit the `data-dsn` attribute to your app's DSN, load the page, and click
the button — the thrown error shows up as a new issue within a few seconds.

## `node-demo.mjs` — Node SDK

```sh
npm install @bendela6/signals-node
node node-demo.mjs "sgl://<key>@127.0.0.1:4640/<appId>"
```

Sends one `captureEvent`, one `captureError` (from a caught `SyntaxError`),
and flushes before exiting. See `docs/signals-sdk.md` at the repo root for
the full install/quickstart/publish reference, including the `.npmrc`
needed to `npm install` the private `@bendela6/signals-*` packages, and the
React quickstart.
