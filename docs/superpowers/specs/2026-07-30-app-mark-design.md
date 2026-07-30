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

The same three sticks, animated. Each ramps 0 → one shared top speed on **smootherstep**
(zero velocity *and* zero acceleration at both ends). **All three start at the same instant;
what differs is how hard each accelerates.** The stack still unpeels top down — the top
stick accelerates hardest and so leads.

Revised from an earlier draft, which staggered the *starts* and gave every stick the same
ramp. Simultaneous starts with differing ramps land the identical formation (below) and read
as one object coming up to speed rather than three sticks taking turns.

| Phase | Behaviour |
|---|---|
| `idle` | The rest pose, still. |
| `spin-up` | All three go at once, the trailing ones accelerating more slowly. Gaps open to exactly 60°. |
| `running` | All three at full speed, holding 60° apart — a rigid rotating asterisk. |
| `spin-down` | All three decelerate at once over their own ramps; the top stick parks first and the others close on it. Folds shut. |

### Why the ramps are derived, not tuned

Past its ramp a stick has given up exactly **half a ramp's worth of distance** to
accelerating — `V·R/2`, and the shape of the easing never enters into it. Two sticks sharing
a top speed therefore end up permanently

```
V · (Rᵢ − R₀) / 2      degrees apart
```

so a *difference in ramps* buys a fixed separation with no staggered starts involved. Stick
`i` needs to fall `60i` behind the leader, less however far behind it already rests, giving

```
Rᵢ = R₀ + 2 · (60i − gapᵢ) / V      seconds
```

`R₀` is the configured ramp — the leading stick's — and the rest grow from it, so the
configured value stays something you can feel. On an evenly-spaced rest pose this collapses
to `Rᵢ = R₀ + 2i·Δd` for the earlier draft's `Δd = (60 − rest) / V`: what was a start delay
is now a ramp difference of twice the size.

A transition runs until the slowest stick finishes accelerating, `max(Rᵢ)`. Verified across
speeds 40/120/260 and rest spreads 0/8/24, on both rest poses: every combination lands on
60.00° / 60.00° and folds back onto the rest pose exactly.

**No snap is needed.** Poses are closed-form functions of time rather than per-frame
integrations, so nothing accumulates and there is no drift to hide at the end of a
transition.

One correction falls out of looping it: spin-down returns the mark's *shape* but leaves its
orientation wherever the spinning got to, which would park the logo at an arbitrary angle.
Because a stick is 180°-symmetric, holding `running` for a whole number of half-turns lands
the mark back on its own orientation — so the running hold, the one duration carrying no
meaning, absorbs that correction and the ramp does not.

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
3. Weight-to-reach ratio 1/3 everywhere. In practice the locked `chipWeight` 4.6 is a
   one-decimal rounding of `chipReach * 1/3` (14/3 = 4.6667), a 0.0048 deviation from the
   exact ratio — chosen for a paintable stroke width, not a break from the rule.
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

## Resolved: the rail's idle pose

The logo is the uneven pose; the loader's idle used to be a near-aligned fan (`~8°` apart).
Those are different shapes, so an idle rail mark would not have looked like the favicon.

**Settled as option (1): the loader rests on the logo pose** and spreads to the asterisk
while running, so an idle loader *is* the favicon and the near-aligned stack becomes a
spin-up flourish rather than a resting state. `motion.restPose` carries the choice —
`logo` is the default, `fan` stays available — because it is a question best answered by
looking at both, which the icon studio's Motion panel now allows. Option (3), making the
logo itself the near-aligned fan, stays rejected: it reads as one thick stroke and throws
away two of the three colours.

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
  motion: MotionConfig;
}

/** Which pose the loader rests on when nothing is running. */
type RestPose = 'logo' | 'fan';

/**
 * The loader. Nothing here is a timing tweak: the per-stick ramps that land the
 * asterisk are derived from these four values.
 */
interface MotionConfig {
  /** Top speed of the running asterisk, degrees per second. */
  speed: number;
  /** Degrees between neighbouring sticks at rest. Only the `fan` pose uses it. */
  restSpread: number;
  /** The leading stick's ramp, in seconds. The others are derived from it. */
  ramp: number;
  restPose: RestPose;
}
```
