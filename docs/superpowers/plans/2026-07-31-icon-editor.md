# Icon Editor implementation plan

**Goal:** Build the designed canvas icon editor as a new app at `apps/icon`, to the
design as drawn, reusing `@tickets/ui` and extending it where it falls short.

**Spec:** `docs/superpowers/specs/2026-07-31-icon-editor-design.md`
**Design of record:** Claude Design `a75bdf6d-0534-4321-8d56-af7d30fffd7e` —
`Icon Editor.dc.html`, `IconEditor.dc.html`, `IconProps.dc.html`.

**Tech:** React 19 · Vite 8 (port 4670) · Tailwind v4 · vitest + testing-library ·
TypeScript strict with `noUncheckedIndexedAccess` · zero new runtime dependencies.

## Global constraints

- **No hardcoded visual values.** Every colour, radius, shadow and type size
  resolves to a `@tickets/ui` token. `apps/icon/src` joins the scanner's `ROOTS`.
- **No non-null assertions**, no `as` casts to silence the compiler.
- **Object order is front-to-back**; the renderer paints in reverse.
- **Every colour is a `Pair`** (`{ light, dark }`) from the first commit. A bare
  string anywhere in the document model is a defect.
- **State floor is one**, per the Decisions board (§7's caption is stale).
- **Phase is derived**: `phase = states.length > 1 ? index / (states.length - 1) : 0`.
  No amplitude or phase control may be added.
- **`render/svg.ts` is the only source of exported artwork.** No target may draw
  shapes itself.
- Conventional commits, scoped `feat(icon):` / `feat(ui):`, one per task.
- Checks that must stay green: `pnpm typecheck`, `pnpm --filter @tickets/icon test`,
  `pnpm --filter @tickets/ui test`, `pnpm --filter @tickets/ui tokens:verify`.

## Constants transcribed from the prototype — the values of record

```
DOC (artboard units) 512      ARTBOARD (px on screen) 448      SAFE 0.80
DUR 400ms (a transition)      CYCLE 900ms (a sustained loop)

SWATCHES  #4E46C6 #25231D #FFFFFF #F7F6F2 #C0382E #C29A2E #2E7D4F #2E6FCC
ROLES     spins · moves · fades
PACES     0.5 1 2 3            SPEEDS 0.5 1 1.5 2
RAMPS     linear · soft · sharp   RESTS 0 (none) · 0.08 (even) · 0.18 (wide)
SUSTAIN   null · turning · pulsing · travelling

AMP           spins  moves  fades
  turning      1.00   0.30   0.30
  pulsing      0.14   0.20   1.00
  travelling   0.18   1.00   0.30

ease(t): linear → t · soft → t²(3−2t) · sharp → t<.5 ? 4t³ : 1−(−2t+2)³/2

poseAt(o, u):  spins → rot = round(110·u·pace) % 360
               moves → dy += 92·u
               fades → op  = round(100 − 58·u)
  sustained, phase p = (loop − index·rest)·pace, w = 2πp, a = AMP[sustain][role]:
               spins → rot += 360·p·a
               moves → dy  += 24·a·sin(w)
               fades → op  −= 34·a·(0.5 − 0.5·cos(w)), clamped [14,100]

new shape defaults (512 artboard, fill+stroke #4E46C6/#A9A2F2, op 100, rot 0):
  rect     x136 y136 w240 h240 radius32       ellipse  x136 y136 w240 h240
  line     (136,256)→(376,256) strokeWidth 20 polygon  cx256 cy256 r120 sides6

TARGETS  id    name              sizes         writes          files  anim
         fav   Browser favicon   16·32·48      favicon.ico +3    4
         pwa   PWA               192·512       manifest +2       2
         ios   iOS               20→1024       appiconset       13
         and   Android           48→512        mipmap ×5         5
         mac   macOS             16→1024       icon.icns        10
         win   Windows           16→256        app.ico           5
         asvg  Animated SVG      vector        icon.svg          1   yes
         lottie Lottie           vector·json   icon.json         1   yes
         afav  Animated favicon  32·canvas     favicon.js +1     2   yes
```

---

# Phase 1 — `@tickets/ui` additions

### Task 1.1 · Tokens: `surface-field`, `shadow-artboard`, two literals

**Files:** `packages/web/ui/src/tokens/next/semantic.tokens.json`,
`shadows.light.tokens.json`, `shadows.dark.tokens.json`; regenerate `tokens.css`.

Add `surface.field` = `#e7e5de` / `#131210`; `literal.handle` = `#4e46c6` both
themes; `literal.safe-zone` = `#c0382e` both themes; `shadow-artboard` =
`0 1px 2px rgba(28,26,20,.07), 0 10px 28px rgba(28,26,20,.09)` light and
`0 0 0 1px rgba(0,0,0,.5), 0 12px 34px rgba(0,0,0,.55)` dark.

Run `pnpm --filter @tickets/ui tokens:build`, commit the regenerated
`tokens.css`, then `tokens:verify` must exit clean. **Done when** `bg-field`,
`shadow-artboard`, `text-handle`, `border-safe-zone` resolve.

### Task 1.2 · `Tabs` gains a `segment` variant

**Files:** `packages/web/ui/src/components/tabs/tabs.tsx` + its test and demo.

Container: `inline-flex items-center rounded-lg border-1 border-gray-6` with the
`pill` gap/padding rows. Active chip: `bg-indigo-3 font-500 text-indigo-9`.
Inactive: `text-gray-11 hover:text-gray-12`. Must honour the existing `scale`,
`size` and `role` axes — no new hardcoded tone.

Test through role + accessible name for both `role="group"` and `role="tablist"`,
asserting `aria-pressed` / `aria-selected` on the active item and its absence on
the others. Add the variant to the component's `states` export so the gallery
renders it.

### Task 1.3 · `Slider`

**Files:** `packages/web/ui/src/components/slider/{slider.tsx,slider.test.tsx}` +
barrel export.

A controlled `role="slider"` with `aria-valuemin/max/now`, keyboard arrows
(±step), Home/End, and pointer drag. Props `value, onChange, min = 0, max = 100,
step = 1, label, disabled`. 3px track, `bg-surface-inset` rail, `bg-indigo-9`
fill. Tests drive keyboard and pointer, assert `onChange` payloads and
`aria-valuenow` — never class names.

---

# Phase 2 — `apps/icon` scaffold

### Task 2.1 · Package, Vite, Tailwind, tokens, test harness

**Files:** `apps/icon/{package.json,index.html,vite.config.ts,tsconfig.json,vitest.config.ts}`,
`apps/icon/src/{main.tsx,styles.css,app.tsx}`.

Name `@tickets/icon`, private, `type: module`. Dev deps mirror
`packages/web/icon-studio/package.json` exactly (same React 19, Vite 8, vitest 4,
`@fontsource/ibm-plex-*`, `@tailwindcss/vite`). `server: { port: 4670, strictPort: true }`.
`styles.css` imports `@tickets/ui/tokens.css` and `@source '../src/'`.

`app.tsx` renders the 48px top bar / 232px left rail / canvas field / 264px right
rail skeleton with nothing in it yet. **Done when** `pnpm --filter @tickets/icon dev`
serves at `localhost:4670` (not `127.0.0.1` — Vite binds IPv6 only on Windows) and
`pnpm typecheck` passes.

### Task 2.2 · Hold the new app to the token discipline

**Files:** `packages/web/ui/src/tokens/vocabulary.ts`.

Add `join(REPO_ROOT, 'apps', 'icon', 'src')` to `ROOTS`. Refresh the scan
baseline. **Done when** `tokens:verify` is clean with the new root included.

---

# Phase 3 — the document model (`apps/icon/src/doc/`)

Pure TypeScript, no React. Every task is test-first.

### Task 3.1 · `types.ts` + `defaults.ts`

The model from the spec, plus `DOC`, `ARTBOARD`, `SAFE`, `DUR`, `CYCLE`,
`SWATCHES`, `ROLES`, `PACES`, `SPEEDS`, `RAMPS`, `RESTS`, `REST_LABELS`,
`SUSTAIN`, `AMP`, `newObject(kind, seq)`, `emptyDocument(name)`.
`emptyDocument` has one state named `default`, size 512, background
`#FFFFFF`/`#14130F`, no objects.

### Task 3.2 · `geometry.ts`

`bounds(obj): {x,y,w,h}` — polygon from `cx±r`, line from its endpoints inflated
by `strokeWidth/2`, others direct. `polygonPoints(cx,cy,r,sides)` starting at
−90° (top vertex). `extentOf(obj, size)` = furthest corner from centre ÷ half-size.
`hitTest(objs, x, y)` walks front-to-back, skipping hidden and locked.
Tests: a 6-gon's first point is directly above centre; a 45° line's bounds are
square; `extentOf` of the 448-wide backdrop on a 512 board is 0.875.

### Task 3.3 · `pose.ts`

`phaseOf(doc, stateId)`, `ease(ramp, t)`, `poseFor(doc, {from,to,t,loop})` →
`Map<objectId, PosedObject>`. Exactly the maths in the constants block above.
`takesPart: false` returns the object untouched. Tests assert each role in
isolation at u=0, u=0.5, u=1; that `pace` scales only rotation; that the
sustained loop is periodic (`loop=0` and `loop=1` agree); and that opacity
clamps at 14.

### Task 3.4 · `validate.ts`

`safeZoneWarnings(doc)` → `{ id, name, percent }[]` for every visible object with
`extentOf > SAFE`, in document order. Tests: the designed `backdrop` reports 88%;
a hidden oversized object reports nothing.

### Task 3.5 · `contrast.ts`

`relativeLuminance(hex)`, `contrastRatio(a,b)`, `grade(ratio)` →
`AAA | AA | AA LG | LOW` at 7 / 4.5 / 3. Tests against known pairs
(black-on-white is 21:1).

### Task 3.6 · `store.ts` — reducer + bounded undo

`iconReducer(state, action)` over
`{ doc, selectedId, history: {past, future} }`. Actions: `addObject`,
`selectObject`, `moveObject`, `resizeObject`, `rotateObject`, `setObjectProp`,
`toggleHidden`, `toggleLocked`, `deleteObject`, `reorder`, `setBackground`,
`setSize`, `addState`, `renameState`, `deleteState`, `cycleSustain`,
`reorderStates`, `setTiming`, `undo`, `redo`.

Undo rules, each its own test: history caps at 50; `undo` past the start is a
no-op; a new action clears `future`; selection changes are **not** undoable;
consecutive drags of the same object within 400ms coalesce into one entry;
every undoable action produces a label (`move mark`) for the status echo.

### Task 3.7 · `persist.ts` — `DocumentStore`

```ts
interface DocumentStore {
  list(): Promise<DocumentSummary[]>;          // newest first
  load(id: string): Promise<IconDoc | null>;
  save(id: string, doc: IconDoc): Promise<void>;
  create(name: string): Promise<DocumentSummary>;
}
```
`indexedDbStore()` implements it against one object store keyed by id, holding
`{id, name, size, updatedAt, doc}`. A `memoryStore()` backs the tests. Nothing
outside this file may touch IndexedDB.

---

# Phase 4 — rendering and the canvas

### Task 4.1 · `render/svg.ts`

`renderSvg(doc, { ground, stateId })` → SVG string on a `size × size` viewBox:
background rect, then objects **in reverse order**, each resolved through the
posed map for that state. Rect → `<rect rx>`, ellipse → `<ellipse>`, line →
`<line stroke-linecap="round">`, polygon → `<polygon points>`. Rotation is
`transform="rotate(a cx cy)"` about the object's own centre. Hidden objects are
omitted entirely. Deterministic output (stable attribute order) so tests can
compare strings.

### Task 4.2 · `render/shape-style.ts`

`shapeStyle(posedObj, scale, ground)` → the `CSSProperties` the on-canvas DOM
node uses, mirroring the prototype's `shapeCss`: absolute box, `clip-path` for
polygons, rotate-about-origin for lines, `border-radius` 50% for ellipses.
A test asserts a shape's computed box matches `bounds()` × scale, so the DOM
layer and the SVG layer cannot drift.

### Task 4.3 · `canvas/artboard.tsx`

The white artboard at `ARTBOARD × zoom`, `bg-field` surround, `shadow-artboard`,
optional 32-unit grid, and the shape layer. Click on a shape selects; click on
the field deselects. Zoom 50–200% in 25% steps.

### Task 4.4 · `canvas/selection.tsx`

Eight handles (4 corners 8×8, 4 edges 8×7 / 7×8), rotation knob on a 14px stem,
and the dimension pill below — all `literal-handle`, both themes. Withdrawn
entirely while dragging or playing.

### Task 4.5 · `canvas/pointer.ts` + drag/resize/rotate

Pointer-event state machine: `idle → pressing → dragging|resizing|rotating`.
Shift constrains (axis on move, ratio on resize, 15° on rotate). Alt duplicates
on drag. Movement is committed to the store on pointer-up as one undo entry.
Locked objects don't respond. Pure geometry helpers are unit-tested; the
component test drives real pointer events and asserts the resulting document.

### Task 4.6 · Drag chrome and the safe zone

Ghost outline at the origin, two dashed centre guides with their labels, the
mono position/delta readout, and the 40% dim of both rails, the top bar and the
grid while dragging or playing. `canvas/safe-zone.tsx` draws the dashed 80%
circle plus its `literal-safe-zone` label whenever the selected object is over,
the export dialog is open with warnings, or the warning chip was clicked.

### Task 4.7 · `canvas/canvas-footer.tsx`

Bottom-left: grid toggle, reduced-motion toggle, ground `light`/`dark` segment.
Bottom-right: the warning chip (`N platform warnings`, danger-outlined, focuses
the first offender) **or** the status line — never both. The status line shows
the undo echo for 2s, then the selection line.

---

# Phase 5 — the rails

### Task 5.1 · `rails/object-list.tsx`

`OBJECTS` header with count; rows carrying a kind glyph, name, `MOVING` badge,
eye and lock buttons; hidden rows at 50% with a struck name; empty state
`— no objects —`. Drag to reorder (front-to-back). Below the hairline, the four
`ADD SHAPE` buttons; `R E L P` do the same from anywhere the canvas has focus.

### Task 5.2 · `rails/color-pair-field.tsx`

The split swatch — 32px, diagonal, light half top-left and dark half
bottom-right — the editable hex at 13px mono, the contrast readout (large
against the previewed ground, small for the other half turning danger if it
fails), and the eight preset swatches. **The ground chip decides which half is
edited.** Used by both the object fill and the document background.

### Task 5.3 · `rails/props-panel.tsx`

Header (glyph · name · kind). With a selection: `POSITION & SIZE` (X/Y/W/H +
rotation), `APPEARANCE` (fill pair block, stroke + width, opacity with the new
`Slider`), then `RECTANGLE`'s corner radius or `POLYGON`'s sides, then `MOTION`.
With nothing selected: `ARTBOARD` (W/H + 256/512/1024 presets), `BACKGROUND`
pair, and the object-count note. **The rail never empties.**

All numeric fields are real `NumberInput`s that commit to the store.

### Task 5.4 · `rails/motion-group.tsx`

`Takes part` switch; when on, the three-role segment, its hint, and the `PACE`
segment with its running-order hint — `leads — stripe, plate follow` /
`follows seal` / `resolves last, after stripe` / `the only object in the
animation`, computed by sorting participants by pace descending. When off, the
group states that it holds its first-state pose rather than vanishing.

---

# Phase 6 — the transport

### Task 6.1 · `transport/transport.tsx`

34px strip matching the artboard width. Play/pause, the `all` cycle chip, the
state chips (current filled, previous outlined, sustained marked `↻`), the `⋯`
manager button, the track, the speed button, and the two-line time readout.

Two rails, one strip: **finite** — solid, rounded caps, fill from a hard left
origin, `0.24s of 0.40s`; **sustained** — dashed square-capped rail, a 24% band
that trails the head and wraps at the seam, `0.62 cycle` / `0.90s loop ↻`.
Clicking the track holds a frame (`held 0.62`).

Animation is driven by `requestAnimationFrame` off a timestamp, not the
prototype's `setInterval(16)`, so it stays correct under frame-rate changes.

### Task 6.2 · `transport/state-manager.tsx`

230px popover from `⋯`: grip, inline rename with the standard focus ring, the
settled/sustained cycle button (`settled → turning → pulsing → travelling`),
delete disabled at one state, and the dashed `+ add state` row.

### Task 6.3 · `transport/timing-popover.tsx`

236px popover from the speed button: `SPEED`, `RAMP`, `REST` segments and the
mono line reporting what they currently mean in seconds.

### Task 6.4 · `transport/held-poses.tsx` + reduced motion

With reduced motion on: play disabled, track replaced by
`motion off · holding the <state> pose`, and the held-pose strip below the
artboard — one 98px thumbnail per state, current outlined 2px, a sustained state
labelled `<name> ↻ entry pose` and rendered at **phase 0, never a mid-loop frame**.

---

# Phase 7 — documents

### Task 7.1 · `topbar/top-bar.tsx` + `documents-popover.tsx`

Accent dot, the document name as the popover trigger, the `512 × 512` label, the
dirty group (neutral dot · `unsaved` · `save ⌘S`) or `saved 2m ago` in the same
slot, zoom stepper, and Export. The 246px popover lists saved documents newest
first with the current one dotted, plus the dashed `+ new icon` row.

### Task 7.2 · Wire persistence

Load the most recent document on boot, or create `untitled.icon` if there is
none. `⌘S` saves only while dirty. Switching documents with unsaved work prompts
before discarding. Relative timestamps come from `@tickets/ui`'s existing
`RelativeDate` behaviour where it fits.

---

# Phase 8 — export

Every target rasterises `render/svg.ts`. No runtime dependency is added.

### Task 8.1 · `export/raster.ts`

`rasterise(svg, size)` → `Uint8Array` PNG, by drawing an SVG blob into a canvas
of that size and reading `toBlob('image/png')`. Tests run in jsdom against a
stubbed canvas; a single browser smoke check in Phase 9 proves the real path.

### Task 8.2 · `export/zip.ts`

A store-method (uncompressed) ZIP writer — correct, dependency-free, and lossless
for already-compressed PNGs. Local headers, central directory, EOCD, CRC-32.
**The test walks the central directory back out and reads a file's bytes**, so a
malformed archive fails loudly.

### Task 8.3 · `export/ico.ts` and `export/icns.ts`

`.ico`: 6-byte header, 16-byte directory entry per image, PNG payloads.
`.icns`: `icns` magic, total length, then `ic07`/`ic08`/`ic09`/`ic10`… chunks.
Both tests parse the result back and assert the embedded PNG signatures and
declared sizes.

### Task 8.4 · `export/animated-svg.ts`, `lottie.ts`, `animated-favicon.ts`

Animated SVG: the static SVG plus `<animateTransform>` / `<animate>` per
participating object, timed from the sustained state's cycle. Lottie: a
`{v, fr, ip, op, w, h, layers[]}` document with one shape layer per object and
rotation/position/opacity keyframes. Animated favicon: `favicon.js` that draws
the loop into a 32px canvas and swaps the link's href, plus the snippet that
loads it. Each is asserted structurally (parse the JSON, query the SVG), never
by string equality.

### Task 8.5 · `export/targets.ts` + `run.ts`

The `TARGETS` table exactly as transcribed, the per-target file lists
(iOS `Contents.json`, Android mipmap folders, the PWA `site.webmanifest`), and
`runExport(doc, selection, stateId)` → `{ path, bytes }[]` → zip.

### Task 8.6 · `export/dialog.tsx`

`STATIC TARGETS` with the state picker in its header, `ANIMATED TARGETS` below,
with animated rows **present but unavailable and stating why** when no state is
sustained. The danger block above the summary names the rule, the object and the
measured percentage; **Export stays enabled — it is a warning, not a lock.**
Summary line, `nothing is written until you press Export`, and a confirm button
naming the file count that disables at zero targets.

---

# Phase 9 — whole-app verification

`pnpm typecheck` · `pnpm --filter @tickets/icon test` ·
`pnpm --filter @tickets/ui test` · `pnpm --filter @tickets/ui tokens:verify` ·
`pnpm build`. Then a real browser pass at `localhost:4670`: draw all four
shapes, drag/resize/rotate, undo/redo, switch ground, add a state, mark it
sustained, play it, toggle reduced motion, save, reload, and export a zip —
opening the archive to confirm the PNGs decode and the `.ico` is well-formed.
Update `.claude/skills/running-the-stack/SKILL.md` with the new app and port.
