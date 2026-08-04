# Icon elements — design

**Date:** 2026-07-30 · **Status:** approved, ready to plan

The icon studio can tune exactly one drawing. `generate/svg.ts` loops over exactly three
angles, `MarkConfig` carries `angles` as a fixed triple, and every control is bound to a
field of that specific mark. The goal is a studio that can develop *any* icon and export it
to every platform — this spec is the first step toward that, and only the first.

Companion specs: `2026-07-30-app-mark-design.md` defines the mark itself;
`2026-07-30-icon-studio-design.md` defines the tool. This one changes what the tool can
describe.

## The decomposition

The full vision is four subsystems, not one. They are listed here so later work has a map,
but **only A is in scope for this spec.**

| | Subsystem | What it delivers |
|---|---|---|
| **A** | **Element model** | The drawing becomes data: composable, controllable elements |
| B | Export matrix | `.ico`, `.icns`, Android adaptive layers, iOS, Windows tiles |
| C | Icon library | More than one icon document, each with its own destination |
| D | Editor UX | Canvas, selection, direct manipulation |

**A and B are independent.** The export layer consumes a rendered SVG string and never
touches `MarkConfig`, so B can be built before or after A without rework. A is first
because it changes the shape of the data, and doing that now — with one drawing and seven
outputs — is far cheaper than after a library and thirty export targets exist. Deferring
the pivot makes it harder, not easier.

**C and B both change the security model.** Traversal is currently impossible because
`OUTPUTS` is a frozen table of literal paths. A studio writing arbitrary icons for
arbitrary apps cannot have a frozen table, so that guarantee must be replaced by a rooted,
validated destination. That work belongs to B/C. **A does not touch it.**

## The rule

**The document describes the drawing; the renderer draws it.** No geometry is baked into
code. Today's mark stops being *the* mark and becomes the first `IconDoc` — three `stick`
elements and three inks, with nothing lost.

## The document

```ts
interface IconDoc {
  inks: Record<string, Ink>;
  /** Painted in order, back to front. */
  elements: Element[];
  variants: Record<string, Variant>;
  motion: MotionConfig;
}
```

The 48-unit grid and its centre at `24,24` are unchanged, and remain constants rather than
document fields: every measurement in the studio (safe-zone, contrast, ratio) is expressed
against them, and nothing yet needs a second grid.

## Primitives

Three to start. Each is a closed set of named numbers, so every parameter is a slider and
every element can be measured and animated — the property that a raw SVG path would not
have.

| Type | Parameters | Notes |
|---|---|---|
| `stick` | `angle`, `reach`, `weight` | A full diameter through the centre. Today's mark is three of these. |
| `ring` | `radius`, `weight` | Concentric circle, stroked. |
| `dot` | `at`, `radius` | Filled circle at an arbitrary point. |

`arc` and `polygon` are deliberately deferred. They are pure additions to the union — no
existing element or feature changes when they land — so shipping without them costs
nothing later.

**Why not raw paths.** A `path` element would express any shape, but it would have no
meaningful sliders, no derived geometry and no animation model, splitting every feature in
the studio into two cases forever. The union is designed so a `path` type can be added
later if a real need appears; it is not needed to make the model general enough to be
useful.

## Inks

Colour is indexed by *name*, not by position. Today's `light[0]` means "the top stick",
which stops meaning anything the moment there are five elements.

```ts
inks: {
  top: { light: '#7167ff', dark: '#6652ff' },
  mid: { light: '#00bb9a', dark: '#12b898' },
  low: { light: '#ff298a', dark: '#ff378c' },
}
```

An element references an ink by name. Retuning a colour used by six elements is one edit,
the contrast readouts stay meaningful per ink, and — the real payoff — a variant becomes a
*re-pointing of the palette* rather than a rewrite of every element.

## Variants

```ts
interface Variant {
  inks: InkResolution;
  scale: number;
  field?: Field;
}
```

The built-ins reproduce today's four renderings exactly:

| Variant | `inks` | `scale` | `field` |
|---|---|---|---|
| `favicon` | `theme` | 1 | — |
| `mono` | `black` | 1 | — |
| `chip` | `dark` | 14/18 | ink `field`, radius 11 |

**Scale multiplies reach and weight together.** That makes the weight-to-reach ratio
invariant by construction: a variant cannot drift out of proportion, because there is only
one number. Today `chipReach` and `chipWeight` are independent, which is exactly how the
committed config reached a ratio of 0.44 against the bare mark's rule of 1/3, and why a
"Match the favicon ratio" button had to exist. That button becomes unnecessary.

A variant cannot restyle an individual element. Per-variant element overrides were
considered and rejected: they would give every element N sets of values to keep straight
and would return the ratio to being a convention rather than a guarantee. Per-size
optimisation — dropping detail at 16px — is a real want, but it belongs to a later step and
should not buy its way in by weakening the model now.

## Rendering

One function replaces the four hardcoded generators:

```ts
function renderSvg(doc: IconDoc, variant: string): string;
```

`svgFavicon`, `svgBare`, `svgMono` and `svgChip` all collapse into it. The variant alone
decides everything: `inks: 'theme'` is what emits the favicon's `prefers-color-scheme`
block, and every other resolution produces a single set. There is deliberately no second
switch for theme-awareness — one input, one answer.

**Nothing downstream moves.** `raster.ts`, `outputs.ts`, `head.ts` and `manifest.ts`
consume a rendered SVG string, so the export pipeline, the allowlist and the security
posture are untouched by this step.

## Motion

Each element carries an optional `spin`. The running formation spreads only the spinning
elements, evenly, at `180 / count` degrees — which is exactly 60° when three sticks spin,
so the current mark behaves identically. A static ring with three sticks turning inside it
becomes expressible.

The planner in `motion.ts` generalises from fixed triples to arrays. This is a real
refactor: `Triple`, `lags()`, `relativeTravel()`, `rampsFor()` and `planMove()` are all
written against exactly three sticks today. The invariants they hold must survive
unchanged:

- every spinning element starts moving at the same instant, and they differ in acceleration
- painted order is speed order — first element fastest, last slowest, on the way up
- landings are exact: into running, and back onto any target pose
- a `running` → still move coasts at full speed for the shortest wait that makes the
  landing exact

Elements with `spin: false` hold their pose through every move.

## Migration

Old configs convert on read, in one pure function:

| From | To |
|---|---|
| `angles`, `bareWeight` | three `stick` elements, `reach` = 18, `spin: true` |
| `light`, `dark` | three inks named `top`, `mid`, `low` |
| `chip` | an ink named `field`, the same colour in both themes |
| `chipReach`, `chipWeight` | `chip` variant with `scale = chipReach / 18` |
| `motion` | carried across unchanged |

Same posture as the motion block: forgiving on read, strict on write. The studio writes the
new shape on the next Generate, and a config predating elements still opens.

`chipWeight` is dropped rather than migrated, because scale now derives it. That is a
deliberate correction, not a loss — see the gate below.

## The acceptance gate

**Migrate the committed config, re-render, and Generate must report `unchanged` for
`favicon.svg`, `icon-mono.svg` and `site.webmanifest`.** Byte-identical output is a far
stronger proof that the pivot changed nothing than looking at it.

One documented exception applies to the *originally locked* config, where `chipReach` is 14
and `chipWeight` is 4.6. Under a uniform scale the chip's stroke becomes `6 × 14/18 =
4.667`. The mark spec already records 4.6 as "a one-decimal rounding of `chipReach * 1/3`
(14/3 = 4.6667), a 0.0048 deviation from the exact ratio", so this restores the ratio the
design always intended. The chip PNGs shift by 0.067 units of stroke width on a 48-unit
grid — 1.4% of the stroke, invisible at every shipped size.

The config committed today (`chipReach` 18, `bareWeight` 8, `chipWeight` 8) yields
`scale = 1.0` and a chip weight of exactly 8, so for it the chip is byte-identical too.

## Verification

- **Migration** — a locked old config converts to an expected `IconDoc`, field by field.
- **Rendering** — one test per primitive: a document containing only a `ring` emits one
  `<circle>` with the configured radius and weight, and nothing else.
- **Ratio invariance** — for any scale, a variant's weight-to-reach ratio equals the base
  document's. This is the property that replaces the "Match the favicon ratio" button, so
  it is asserted rather than assumed.
- **Ink resolution** — `mono` resolves every ink to black; `chip` resolves every ink to its
  dark value; `theme` emits both sets.
- **Motion** — N spinning elements land exactly `180/N` apart, for N of 2, 3 and 5, with
  non-spinning elements held; plus the existing invariants (simultaneous starts, painted
  order is speed order, exact landings) re-asserted against arrays.
- **The gate** — the byte-identical check above, run against the real committed config.

Each of these must be shown able to fail, by mutation, before it is trusted.

## Out of scope

New export targets of any kind. `.ico` and `.icns`. Android adaptive layers, iOS sizes,
Windows tiles. The icon library and multiple documents. Canvas or direct manipulation.
Raw-path elements. `arc` and `polygon`. Any change to the outputs allowlist or the write
endpoint's security model.

## Decisions locked

1. **Element model first**, ahead of the export matrix, because it changes the shape of the
   data and is cheapest now.
2. **Parametric primitives**, not raw paths — every element stays measurable, controllable
   and animatable.
3. **Named inks**, not positional or per-element colours — the palette stays coherent as
   elements multiply.
4. **Variants are palette + frame + one uniform scale** — proportion cannot drift.
5. **Per-element `spin`** — static and moving parts can coexist in one icon.

## Types

```ts
/** A colour with a value per theme. */
interface Ink {
  light: string;
  dark: string;
}

/** Fields common to every element. */
interface ElementBase {
  /** Stable across edits; React keys and per-element controls hang off it. */
  id: string;
  /** Name of an entry in `IconDoc.inks`. */
  ink: string;
  /** Takes part in the running formation. Defaults to false. */
  spin?: boolean;
}

/** A full diameter through the centre, rotated. */
interface Stick extends ElementBase {
  type: 'stick';
  /** Degrees. */
  angle: number;
  /** Half-length, in grid units. */
  reach: number;
  /** Stroke width, in grid units. */
  weight: number;
}

/** A concentric stroked circle. */
interface Ring extends ElementBase {
  type: 'ring';
  radius: number;
  weight: number;
}

/** A filled circle at an arbitrary point on the grid. */
interface Dot extends ElementBase {
  type: 'dot';
  /** `[x, y]` in grid units. */
  at: [number, number];
  radius: number;
}

type Element = Stick | Ring | Dot;

/** How a variant resolves every ink. */
type InkResolution =
  /** Emit both sets, swapped by a prefers-color-scheme block. */
  | 'theme'
  | 'light'
  | 'dark'
  /** Every ink becomes solid black — Safari tints the pinned tab itself. */
  | 'black';

/** The plate a variant draws its elements on. */
interface Field {
  /**
   * Name of an entry in `IconDoc.inks`, like any other colour — so the field is
   * themeable and retunable in one place. Migration adds an ink named `field`
   * holding the chip colour, dark in both themes per the mark spec.
   */
  ink: string;
  /** Corner radius in grid units; 0 is square. */
  radius: number;
}

interface Variant {
  inks: InkResolution;
  /** Multiplies every element's lengths and stroke widths together. */
  scale: number;
  field?: Field;
}

/** Unchanged from the mark spec; carried across migration verbatim. */
interface MotionConfig {
  speed: number;
  restSpread: number;
  ramp: number;
  restPose: 'logo' | 'fan';
}

interface IconDoc {
  inks: Record<string, Ink>;
  elements: Element[];
  variants: Record<string, Variant>;
  motion: MotionConfig;
}
```
