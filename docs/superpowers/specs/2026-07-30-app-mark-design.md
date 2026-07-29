# App mark, favicon and installable icons — design

**Date:** 2026-07-30 · **Status:** colours and geometry locked; one open question (see end)

The apps have no icon at all. `apps/web/index.html` carries no `<link rel="icon">` and
there is no `apps/web/public/`, so every tab shows the browser's default blank-page glyph.
This spec defines the mark, its colours, the loader it animates into, and the files that
ship it — including the icons needed to save the web app to a phone's home screen.

Superseded revision: an earlier draft of this file described a three-drawing state system
(`resting` / `working` / `settled`) built from lines, nodes, a ring and a core. That is
gone. The mark is **three sticks and nothing else**, and the states are poses of those
three sticks.

## The rule

**One drawing at every size, and it must be paintable by hand.** Three strokes of uniform
width around a centre. No gradients, no shading, no simplified-for-small variant — the
16px favicon and the 512px install icon are the same geometry at different scales.

That constraint decided nearly everything: it ruled out the rich-master-plus-reduction
split that gradients force, and it kept the count of moving parts at three.

## Geometry

A 48-unit grid, centre `24,24`. Each stick is a full diameter: `M24 6 L24 42`,
`stroke-linecap: round`, `fill: none`, rotated about the centre.

| | Value | Note |
|---|---|---|
| Stick count | 3 | Each is 180°-symmetric — it looks identical at θ and θ+180 |
| Bare stroke | 6 | Reach 18, so the weight-to-reach ratio is **1/3** |
| Logo angles | `62°` / `27°` / `160°` | Deliberately uneven; gaps 35 / 47 / 82 |
| Paint order | low, mid, top | Back-to-front, so `top` is the stick you see on top |

**The uneven pose is the point.** A perfect 0/60/120 asterisk reads constructed; 62/27/160
reads drawn. It is also the pose the loader resolves *out of*, which gives the animation
somewhere to go.

**Stroke must scale with reach.** Any inset variant has to hold the 1/3 ratio or it reads
as a bolder mark. The chip inset to reach 14 therefore uses stroke 4.6, not 6.

## Colour

Three sticks, three colours, one set per theme. `top` is the leading stick.

| Stick | Light | Dark |
|---|---|---|
| top | `#7167ff` | `#6652ff` |
| mid | `#00bb9a` | `#12b898` |
| low | `#ff298a` | `#ff378c` |
| chip field | `#1b1830` | `#1b1830` |

Measured contrast, against a white tab and a selected dark tab (`#35363a`):

| Stick | On white | On dark tab | On chip field |
|---|---|---|---|
| top | 4.13 | **2.42** | 3.46 |
| mid | **2.45** | 4.79 | 6.83 |
| low | 3.54 | 3.55 | 5.06 |

Two things follow from that table:

- **Each theme loses a different stick.** The emerald is weakest on white, the violet on a
  dark tab. The mark is never missing the same colour twice, so it stays recognisable
  across themes — this is luck, but it is useful luck.
- **Every install icon is fine.** On the chip field the worst value is 3.46. The weakness
  is confined to the bare favicon.

A brand mark has no WCAG minimum — WCAG 1.4.11 exempts logotypes — so these are a
judgement about findability, not a compliance failure. **Optional one-value fix:** dark
`top` `#6652ff` → `#8071ff` raises 2.42 → 3.29 with no visible hue change. Not applied;
recorded as an option.

This set leaves the Instrument palette. That is a deliberate exception for the icon only —
no token changes, no UI consequences.

## The loader

The same three sticks, animated. Each stick integrates **its own speed**, ramping 0 → one
shared top speed on **smootherstep** (zero velocity *and* zero acceleration at both ends).
Starts are staggered, and the stack unpeels **top down**: the stick on top leaves first.

| Phase | Behaviour |
|---|---|
| `idle` | Sticks a few degrees apart, still. Reads as one stroke with a slight fan. |
| `spin-up` | Top stick starts, then mid, then low. Gaps open to exactly 60°. |
| `running` | All three at full speed, holding 60° apart — a rigid rotating asterisk. |
| `spin-down` | Same ramp reversed; top slows first, the others close on it. Folds shut. |

### Why the stagger is derived, not tuned

A stick sweeps `V · F(t − i·Δd)` where `F` is the integral of the easing. Past the ramp,
`F(x) = x − k` with the **same** `k` for every stick, so the separation settles at exactly
`V · Δd` regardless of the easing shape. Setting `V · Δd = 60° − rest` lands the asterisk
exactly:

```
Δd = (60 − rest) / V     // seconds
```

At `V = 120°/s` with `rest = 8°`, `Δd = 0.433s`. Change the speed and it recomputes, so
the formation is exact by construction rather than by timing. Verified numerically across
speeds 40/120/260, rest spreads 0/8/24, at 30fps and 60fps: every combination lands on
60.00° / 60.00° and returns precisely to the rest fan.

Transitions run `2Δd + 0.9s`. The implementation snaps to the exact pose at the end of each
transition to absorb per-frame integration drift.

### Motion in the favicon

**A favicon file cannot animate** — Chrome and Safari render frame one of an animated SVG
icon; Firefox alone plays it. The working technique is a `<canvas>` redrawn from JS with
`link.href` swapped per frame. It should run only while a session is active; idle costs
nothing.

## Files

| File | Notes |
|---|---|
| `favicon.svg` | Bare mark. Both triads inlined, swapped by a `prefers-color-scheme` block — a favicon has no inherited colour, so `currentColor` is no use. |
| `icon-192.png`, `icon-512.png` | Chip: `rx 11` field in `#1b1830`, mark at reach 14 / stroke 4.6. Maskable — outer extent 16.3 of 24, **68%** of the tile, inside the 80% safe circle. |
| `apple-touch-icon.png` | 180×180, same chip, square corners — iOS applies its own mask. |
| `icon-mono.svg` | Solid black, single colour. Safari pinned tab tints it itself. |
| `site.webmanifest` | `display: standalone`, `start_url`, `scope`, `theme_color` and `background_color` both `#1b1830`, the two maskable icons. |
| head tags | `icon`, `mask-icon`, `apple-touch-icon`, `manifest`, `theme-color`, plus the iOS meta tags Safari needs because it ignores the manifest for home-screen launch. |

The chip field is dark in **both** themes. A coloured field cannot knock out three colours,
and a dark chip lets the mark sit at full strength on any home-screen wallpaper.

## Accessibility

`prefers-reduced-motion: reduce` holds the loader on its idle pose. The phases differ in
**shape**, not only in movement, so state survives with motion off — the test a status
indicator has to pass. The rail mark carries an `aria-label` naming the phase in words.

## Decisions locked

1. Three sticks, uneven pose `62/27/160`, one drawing at every size.
2. The colour sets above, off-palette, icon-only.
3. Weight-to-reach ratio 1/3 everywhere.
4. Loader = staggered speed ramps with a derived stagger; asterisk is a pose it forms.
5. Chip field dark in both themes.

## Rejected, and why

| Direction | Why not |
|---|---|
| Ticket stub | Wrong object — the product is a development kit. |
| Polychrome burst / iris / prism | Force a rich-master-plus-reduction split; not paintable. |
| Glass, aurora, chrome, fog | Gradients and translucency die at 16px and cannot be painted. |
| Orb, billet, crystal, rack | Dimensional shading is large-size only. Explicitly disliked. |
| Orbit family | Perspective ellipses under fog. Explicitly disliked, impossible by hand. |
| Four-point AI sparkle | The most exhausted mark in the category. |
| Nodes / ring / core states | Superseded — three sticks do the same job with a third of the parts. |
| Same-rung triads | Rung 11 is a flat-lightness ramp; three hues at one rung read as one colour at 16px on white. |

## Open question

**The rail's idle pose.** The logo is the uneven `62/27/160`. The loader's idle pose is the
near-aligned fan (`~8°` apart). Those are different shapes, so an idle rail mark would not
look like the favicon. Three ways out, in preference order:

1. The loader rests on the **logo pose** and spreads to the asterisk while running. The
   near-aligned stack becomes a spin-up flourish rather than a resting state.
2. Keep both: the favicon is the logo pose, the rail idles near-aligned. Accepts the
   mismatch on the grounds that they are never seen side by side.
3. Make the logo the near-aligned fan. Rejected — it reads as one thick stroke and throws
   away two of the three colours.

Recommendation is (1), but it changes what "idle" means in the loader, so it needs a call.

## Out of scope

Sibling-app icons for eer and the gallery — a three-colour mark leaves them no hue of their
own, and the rule for distinguishing them is deferred. Restyling the rail's four mode
glyphs. Any change to the Instrument palette. TLS or transport work for the mobile install.

## Types

```ts
/** Which pose the mark is drawn in. Shape carries the meaning, not just colour. */
type MarkPhase = 'idle' | 'spin-up' | 'running' | 'spin-down' | 'failed';

/** A stick's identity, ordered as painted: `top` is frontmost and leads. */
type Stick = 'top' | 'mid' | 'low';

/** Everything the mark needs to draw itself. Serialised as icons.config.json. */
interface MarkConfig {
  /** Hex per stick, in `top, mid, low` order. */
  light: [string, string, string];
  dark: [string, string, string];
  /** Field behind the mark on the chip variants. */
  chip: string;
  /** Degrees per stick, in `top, mid, low` order. */
  angles: [number, number, number];
  /** Stroke width of the bare mark on the 48-unit grid. */
  bareWeight: number;
  /** Arm reach and stroke for the inset chip variants. */
  chipReach: number;
  chipWeight: number;
}
```
