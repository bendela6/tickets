# Icon Editor — design spec

**Date:** 2026-07-31
**Status:** approved, ready to plan
**Design of record:** Claude Design project `a75bdf6d-0534-4321-8d56-af7d30fffd7e`,
files `Icon Editor.dc.html` (13 annotated screens + Decisions + close-ups),
`IconEditor.dc.html` (working prototype: layout **and** logic), `IconProps.dc.html`
(right rail). Read them with the DesignSync tool.

## Goal

A canvas icon editor as a new app at `apps/icon`, built to the design as drawn.
The existing `@tickets/icon-studio` is untouched and keeps owning `apps/web`'s six
icon files; the two share no code and no document model.

## Why this is buildable as drawn

`IconEditor.dc.html` is not markup — it is a working React prototype carrying the
whole model: the pose maths (`poseU`, `poseAt`, `ease`), the transport state
machine (`run`, `advance`, `seek`), the shape geometry (`dbox`, `shapeCss`,
`polyClip`), WCAG contrast (`lin`/`lum`/`ratio`), the safe-zone rule
(`extentOf`, `warnList`), and every constant (`SWATCHES`, `ROLES`, `PACES`,
`SPEEDS`, `RAMPS`, `RESTS`, `SUSTAIN`, `AMP`, `TARGETS`, `DUR`, `CYCLE`, `SAFE`).
Those values are the specification. They get transcribed, not reinvented.

## The four decisions taken before planning

### 1. A state's pose is derived from its index, never authored

The prototype gives each state a hidden `phase` number (`idle` 0, `loading` 0.28,
`done` 1) and derives every object's pose from it — but no control anywhere sets
that number. **Resolved: `phase = index / (count - 1)`**, with `phase = 0` when
there is one state. Nothing new appears in the state manager; the design's
"transitions are derived, never authored" holds literally.

The consequence is deliberate and must not be quietly worked around: motion
magnitudes stay fixed constants (`spins` 110° × pace, `moves` +92 units,
`fades` −58%). The feel is tuned through role, pace, and document timing — not
through per-object distances. No task may add an amplitude control.

### 2. Documents persist in the browser

IndexedDB, one record per document. **The store is reached only through a
`DocumentStore` interface** so a server-backed implementation can replace it
later without touching a component. No API, no migration, no server.

### 3. Export delivers a `.zip` download

The browser assembles every file and downloads one archive. There is no write
path, so the containment problem that constrains the old studio does not exist
here. The export dialog's summary line reads `into <name>.zip` rather than the
prototype's `into ./icons`.

### 4. All nine export targets are real

Browser favicon, PWA, iOS, Android, macOS, Windows, animated SVG, Lottie,
animated favicon. `.ico` and `.icns` are containers around PNGs and get written
directly; no new runtime dependency is added for any of them, including the zip.

## Architecture

Pure client-side React 19 + Vite on port **4670**, run on demand
(`pnpm --filter @tickets/icon dev`) like the icon studio — not in `pnpm dev`'s
mprocs. Because nothing is server-side it could be deployed later; wiring that is
out of scope.

Four layers, each testable without the one above it:

| Layer | Owns | Depends on |
|---|---|---|
| `doc/` | types, geometry, pose maths, validation, store + undo, persistence | nothing |
| `render/` | document → SVG string; object → CSS for on-canvas DOM | `doc/` |
| `export/` | rasterising, container formats, zip assembly | `render/` |
| components | canvas, rails, transport, top bar, dialog | all of the above |

`render/svg.ts` is the single source of exported artwork: every target
rasterises the same SVG, so a shape can never look different in a PNG than it
does on screen.

### Document model

```ts
type Pair = { light: string; dark: string };   // every colour, everywhere

type Shape =
  | { kind: 'rect';    x; y; w; h; radius }
  | { kind: 'ellipse'; x; y; w; h }
  | { kind: 'line';    x1; y1; x2; y2 }
  | { kind: 'polygon'; cx; cy; r; sides };

type Obj = Shape & {
  id; name; fill: Pair; stroke: Pair; strokeWidth; opacity; rotation;
  hidden; locked;
  motion: { takesPart: boolean; role: 'spins'|'moves'|'fades'; pace: 0.5|1|2|3 };
};

type State = { id; name; sustain: null|'turning'|'pulsing'|'travelling' };

type IconDoc = {
  name; size: 256|512|1024; background: Pair;
  objects: Obj[];            // front-to-back; objects[0] is frontmost
  states: State[];           // floor of ONE, per the Decisions board
  timing: { speed: 0.5|1|1.5|2; ramp: 'linear'|'soft'|'sharp'; rest: 0|0.08|0.18 };
};
```

Object order is front-to-back and the renderer paints in reverse — the same
convention the icon studio settled on, and what the prototype's
`posed.slice().reverse()` does.

### Undo

Keyboard only, `⌘Z` / `⇧⌘Z`, per the Decisions board: no button, no history
panel, no stack. Implemented as bounded snapshot history in the store (the
document is small; a command log would buy nothing). The only feedback is the
existing status slot bottom-right, which echoes `undid · move mark` for about two
seconds and then returns to the selection line.

### Design tokens

The design's palette is already the Instrument palette in `@tickets/ui`. Mapping,
verified against `tokens/next/colors.*.tokens.json`:

| Design var | Token |
|---|---|
| `--bg` | `gray-1` |
| `--rs` | `surface-raised` |
| `--in` | `surface-inset` |
| `--bd` / `--bs` | `gray-6` / `gray-7` |
| `--f1` / `--f2` / `--f3` | `gray-12` / `gray-11` / `gray-9` |
| `--ac` / `--ach` / `--acs` / `--oac` | `indigo-9` / `indigo-10` / `indigo-3` / `indigo-contrast` |
| `--dg` | `red-9` |

Where a design hex differs from the token by a step or two (`--f3` light,
`--acs`, `--in` dark) **the token wins** — tokens are the source of truth and
hand-copying a value into code is the thing the tokenizing skill exists to
prevent.

Three things are genuinely absent and get added to `@tickets/ui`:

- `surface-field` — the recessed canvas field, `#e7e5de` / `#131210`.
- `shadow-artboard` — the artboard's lift, distinct from raised/overlay/modal.
- `literal-handle` `#4e46c6` and `literal-safe-zone` `#c0382e` — **fixed in both
  themes on purpose**, because they sit on the artboard, not on the chrome.
  They join the existing `literal` group beside `folder` and `highlight`.

`apps/icon/src` is added to the hardcoded-value scanner's `ROOTS` so the new app
is held to the same discipline as `apps/web`.

### Components

Reused from `@tickets/ui`: `Button`, `Dialog*`, `Popover*`, `Switch`, `Checkbox`,
`Pill`, `Row`, `Stack`, `Icon`, `Tooltip`, `NumberInput`, `cn`, `variants`.

Two additions, both genuinely generic:

- **`Tabs` gains a `segment` variant.** The design's chip group — hairline
  container, transparent ground, accent-tinted active chip — appears six times
  (transport states, speed, ramp, rest spread, ground, export state picker).
  `pill` is the wrong shape (filled container, raised active chip). Extending
  Tabs beats a fourth near-duplicate component.
- **`Slider`.** Nothing in the library covers a draggable scalar; `Progress` is
  display-only. Opacity needs one.

Everything else — the split colour-pair swatch, the artboard, the selection
handles, the transport — is icon-specific and stays in `apps/icon`.

## Scope boundaries

**In:** all 13 designed screens, all four shape types, direct manipulation
(select, drag, resize, rotate, z-order via list, hide, lock), the colour pair
model, states/motion/timing/reduced motion, documents, all nine export targets,
light and dark UI, keyboard shortcuts (`R E L P`, `⌘Z`, `⇧⌘Z`, `⌘S`, `⌫`).

**Out:** anything the Decisions board says was deliberately not drawn; multi-select;
groups; paths/bezier; text objects; import; deployment to `:4610`; any change to
`@tickets/icon-studio`, `apps/web/icons.config.json`, or `brand-mark.tsx`.

## Known deviations from the design, and why

1. **§7's caption says "× deletes down to a floor of two"** while the Decisions
   board says the floor is one and the prototype enforces one. The Decisions
   board governs: **floor of one**.
2. **Export summary destination** reads `into <name>.zip`, not `into ./icons` —
   forced by decision 3.
3. **Token values** replace three near-miss design hexes, as above.

## Verification

Per the project's `verifying-a-component` skill: behaviour asserted through role
and accessible name, never class names or DOM shape. Pose maths, geometry,
contrast, validation, the container formats and the zip writer are pure functions
with direct unit tests. Every export target is asserted by decoding what was
written — an `.ico` is parsed back, the zip's central directory is walked — not
by asserting byte counts.

## Decisions taken after the first release, 2026-08-01

The four decisions above governed the build. These govern everything after it,
and several of them overturn what shipped.

### 5. A shape kind is an SVG element, or it does not exist

The document may hold `rect`, `circle`, `ellipse`, `line`, `polyline`, `polygon`,
`path`, and later `text`, `image` and `g` — the SVG element set, nothing beside
it. This retired the original `polygon`, which was a regular n-gon
(`{cx, cy, r, sides}`) and therefore not an element at all.

Parametric shapes survive as **one-shot presets**: the toolbar's hexagon
generates six points, the arc generates a path, and neither remembers it was
generated. The cost is accepted deliberately — dragging a hexagon's corner moves
that corner rather than keeping it regular. The alternative, an object carrying
the parameters it came from, would have re-introduced two flavours of `polygon`
under one kind, which is the hidden second kind this rule exists to prevent.

### 6. Colour becomes gradient-capable, and stays paired

Flat `Pair` is not enough for real icon work. Paint gains linear and radial
gradients, with **each stop being a light/dark pair** — the pairing rule from
decision 1 is not weakened, it is applied per stop. This touches the colour
field, the contrast readout, both animated exports and every raster path.

### 7. Import always opens a new document, and reports what it dropped

An SVG import never merges into the open document: the incoming `viewBox` and the
current artboard almost always disagree, and something would have to be silently
scaled or clipped. Filters, masks, patterns, `<use>` and CSS classes are dropped
and **named in a report**. An importer that silently loses half a file is worse
than one that refuses it.

### 8. Boolean ops buy their geometry

Union, subtract, intersect and exclude take a real dependency — Skia pathops or
paper.js — ending the zero-runtime-dependency property that the ZIP writer,
`.ico`, `.icns`, SMIL and Lottie all upheld. Béziers intersecting béziers is
where hand-rolled geometry produces subtly wrong output rather than errors, and
this is the one place that trade is worth making. It is gated behind `path`.

### 9. Text ships as text, and says so

A `<text>` element renders with system fonts and exports as `<text>`. A font the
viewer does not have renders as something else, so the export dialog warns.
Converting to outlines needs a font parser — a second large dependency — and that
decision waits until it is known to matter.

### 10. The wheel zooms

Zoom is continuous and multiplicative rather than a ladder on a modifier, and it
anchors on the point under the cursor. A trackpad's two-finger scroll arrives as
a wheel event too and must pan instead, so the two are told apart by a
documented heuristic with the modifier as an override. Middle-drag also pans;
scrollbars are hidden.

Anchoring is a scroll correction, so it only has somewhere to go once the
artboard outgrows the canvas region. Below that it degrades to centre-zoom.
Closing that window means replacing the scroller with a transformed viewport,
which is a different design and has not been taken.

### 11. Animation is deferred, but its properties are settled

Moving animation authoring into a side rail and restating it in CSS's terms —
`@keyframes` versus `transition` — is postponed. When it happens, the animatable
properties are **transform, opacity and colour**; geometry and path morphing are
out, because morphing only works between paths with matching node counts and
that matching step is its own project.
