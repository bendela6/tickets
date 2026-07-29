# Icon studio — design

**Date:** 2026-07-30 · **Status:** awaiting review

A dev-only screen that tunes the app mark and, on one button, writes every icon and
favicon the web app needs. Today those files do not exist; without a tool they would be
hand-exported artefacts that drift from whatever the mark is supposed to be. The studio
makes a committed config the source of truth and the icons a build product of it.

Companion spec: `2026-07-30-app-mark-design.md` defines the mark itself. This one is only
about the tool.

## The rule

**The config is the source of truth; the icons are generated.** Nobody edits
`favicon.svg` by hand. `apps/web/icons.config.json` is committed, the studio reads and
writes it, and **Generate** regenerates every asset from it. Re-running Generate on an
unchanged config produces byte-identical output.

## Why a separate package

`packages/web/icon-studio`, mirroring `packages/web/playground` exactly: `dev/` as the
Vite root, `src/` for components, its own dev server, nothing in `apps/web`'s bundle.

Three reasons this beats a route in the app:

1. A screen that writes into the repo has no business being reachable from the published
   container. As a separate dev-only package that is structural, not a runtime flag.
2. It needs no `apps/api` changes at all. A Vite plugin's `configureServer` hook only
   exists while a dev server is running, so the write endpoint cannot ship.
3. It sits with the other design tooling — the gallery and workbench — rather than in the
   product.

| | Value |
|---|---|
| Package | `@tickets/icon-studio` |
| Path | `packages/web/icon-studio` |
| Port | **4660** (4600 api · 4610 prod · 4620 web · 4630 eer · 4640 signals · 4650 playground) |
| Shape | `dev/index.html` + `dev/main.tsx`, `root: 'dev'`, `strictPort: true` |
| Deps | `@tickets/ui`, react 19, vite 8, `@tailwindcss/vite` — same set as the playground |

## Rasterising in the browser

PNGs are produced client-side: serialise the SVG, load it into an `Image` via a
`data:` URL, `drawImage` onto a `<canvas>` at the target size, `toDataURL('image/png')`.

This is deliberate. The alternative — `sharp` or `node-canvas` on the server — adds a
native dependency with a binary download step, which breaks the fully-self-hosted,
offline-capable posture the deploy already has. The canvas path has no dependency at all
and is already proven in the design exploration.

The client therefore sends bytes, not instructions. That shapes the endpoint's security.

## The Vite plugin

`src/plugin/icon-writer.ts`, exported and registered in the studio's own `vite.config.ts`.

| Route | Method | Behaviour |
|---|---|---|
| `/__icons/config` | GET | Returns `apps/web/icons.config.json`, or the built-in default if absent. |
| `/__icons/generate` | POST | Body `{ config, assets }`. Writes the assets, the config, and the head block. Returns a per-file report. |

`assets` is `Record<string, string>` — a filename mapped to either SVG source or a
base64 PNG payload.

### Security posture

The client never sends a path. Every name is looked up in a frozen table; anything absent
is rejected with 400 and nothing is written.

```ts
const OUTPUTS = {
  'favicon.svg':          'apps/web/public/favicon.svg',
  'icon-mono.svg':        'apps/web/public/icon-mono.svg',
  'icon-192.png':         'apps/web/public/icon-192.png',
  'icon-512.png':         'apps/web/public/icon-512.png',
  'apple-touch-icon.png': 'apps/web/public/apple-touch-icon.png',
  'site.webmanifest':     'apps/web/public/site.webmanifest',
} as const;
```

Then, in order, every request must pass:

1. **Dev only.** The plugin's `apply` is `'serve'`, so the route does not exist in a build.
2. **Loopback only.** Non-loopback remote addresses are refused — the dev server may be
   bound wider on a LAN.
3. **Name allowlist.** Keys not in `OUTPUTS` are rejected. No path traversal is possible
   because no path crosses the wire.
4. **Containment check.** Each resolved absolute path is `realpath`-checked to be inside
   the repo root before writing — the same discipline as `WORKDIR_ROOTS` on the directory
   picker.
5. **Type and size.** SVG payloads must parse as XML and start with `<svg`; PNG payloads
   must carry the PNG magic bytes. Anything over 1 MB is refused.
6. **Atomic write.** Write to `<name>.tmp` in the destination directory, then rename, so a
   failure never leaves a truncated icon in place.

## What Generate writes

| Path | Source |
|---|---|
| `apps/web/public/favicon.svg` | Bare mark, both triads inlined with a `prefers-color-scheme` block |
| `apps/web/public/icon-mono.svg` | Solid black single-colour mark |
| `apps/web/public/icon-192.png` | Chip, rasterised at 192 |
| `apps/web/public/icon-512.png` | Chip, rasterised at 512 |
| `apps/web/public/apple-touch-icon.png` | Square chip, rasterised at 180 |
| `apps/web/public/site.webmanifest` | Name, `display: standalone`, `theme_color`, maskable icons |
| `apps/web/icons.config.json` | The config that produced all of the above |
| `apps/web/index.html` | The head block, between markers — see below |

`apps/web/public/` does not exist yet and is created. Vite copies `public/` to `dist/`,
which is what nginx serves, so no build or deploy change is needed.

### The head block is marked and idempotent

`index.html` is a hand-maintained file, so Generate does not rewrite it — it replaces
exactly the region between two markers, or inserts that region before `</head>` the first
time:

```html
<!-- icons:start — generated by @tickets/icon-studio, do not edit -->
...
<!-- icons:end -->
```

Anything outside the markers is untouched. Re-running is a no-op when the config has not
changed.

## The screen

One page, controls on the right, output on the left. Built from `@tickets/ui` primitives
rather than the raw HTML of the exploration.

| Group | Controls |
|---|---|
| Palette | Base colour per stick for light and dark, plus the chip field. Live contrast per swatch against the ground that set is used on. |
| Adjust | Hue shift; vividness and brightness, separately for light and dark. Non-destructive over the base. |
| Angles | One slider per stick, 0–180°, plus a tightest-gap readout that warns when sticks hide each other. |
| Weight | Bare stroke, chip reach, chip stroke, with a ratio readout against the bare mark's 1/3 and a maskable safe-circle proof. |
| Output | Every file previewed at true size on a transparency check. **Generate** writes them all; per-file result reported. |

Presets seed the palette, including the chosen set and the violet-lifted variant from the
mark spec.

## Verification

- **Unit** — the pure generators. Given a config, each `svg*()` returns one `<svg>` with
  exactly three `<path>` elements, honours custom angles, and holds the 1/3 weight ratio
  where it claims to.
- **Unit** — the derived stagger. The asterisk lands at 60.00° across speeds, rest spreads
  and frame rates. Already verified numerically during design; port those cases as tests.
- **Unit** — the allowlist. Unknown names, traversal attempts, oversized bodies and
  non-loopback callers are all refused, and nothing is written.
- **Manual** — run Generate, confirm the six files appear, `pnpm --filter @tickets/web build`
  copies them to `dist/`, and the tab icon changes in both themes.

## Out of scope

Sibling icons for eer and the gallery — the mark spec defers the per-app rule, and the
`OUTPUTS` table extends to cover them when it exists. Animated favicon painting (the
canvas-driven status display) — that belongs in `apps/web`, not the studio. Any CI step
that regenerates or verifies icons. Rasterising server-side.

## Open questions

1. **Commit the PNGs?** They are generated, which argues for ignoring them — but nginx
   serves `dist/`, and a clean clone that never runs the studio would ship no icons.
   Recommendation: **commit them**, and treat the config as the reviewable artefact.
2. **`pnpm dev` integration.** The root dev script runs mprocs. The studio is used rarely,
   so the recommendation is to leave it out and run it on demand with
   `pnpm --filter @tickets/icon-studio dev`.

## Types

```ts
/** Defined in the mark spec; the studio reads and writes it verbatim. */
interface MarkConfig {
  light: [string, string, string];
  dark: [string, string, string];
  chip: string;
  angles: [number, number, number];
  bareWeight: number;
  chipReach: number;
  chipWeight: number;
}

/** Filename to payload. SVG as source text, PNG as base64 without a data: prefix. */
type Assets = Record<string, string>;

interface GenerateRequest {
  config: MarkConfig;
  assets: Assets;
}

interface GenerateResult {
  /** Repo-relative path written. */
  path: string;
  bytes: number;
  /** `written` when the bytes changed, `unchanged` when identical. */
  status: 'written' | 'unchanged' | 'rejected';
  /** Present only when `status` is `rejected`. */
  reason?: string;
}

interface GenerateResponse {
  results: GenerateResult[];
}
```
