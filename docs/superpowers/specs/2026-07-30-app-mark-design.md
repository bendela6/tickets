# App mark, favicon and installable icons — design

**Date:** 2026-07-30 · **Status:** awaiting review

The apps have no icon at all. `apps/web/index.html` carries no `<link rel="icon">` and
there is no `apps/web/public/`, so every tab — tickets, the UI gallery, the EER viewer —
shows the browser's default blank-page glyph. This spec defines one mark, its three
working states, the sibling-app family, and the files that ship it, including the icons
needed to save the web app to a phone's home screen.

## The rule

**One drawing at every size.** The mark is three strokes of uniform width around a
centre. It is not simplified for small sizes and not enriched for large ones — the
16px favicon and the 512px install icon are the same geometry at different scales.

This follows from a constraint set late in the design: **the mark must be paintable by
hand.** That single requirement decided almost everything else. It ruled out gradients,
fog, specular lighting, perspective and dimensional shading; it ruled out the
rich-master-plus-reduction split those treatments force; and because hand paint is flat
colour, it put the mark back inside the Instrument palette instead of the off-palette
schemes explored earlier.

## The mark

All geometry on a 48-unit grid, centre `24,24`. Stroke width 6, `stroke-linecap: round`,
`fill: none`. Every coordinate is an integer or a half — nothing lands on a third of a
pixel when scaled to 16.

| Element | Count | Geometry |
|---|---|---|
| Line | 3 | `M24 6 L24 42`, rotated `0°` / `120°` / `240°` about `24,24`. Path length 36. |
| Node | 3 | `circle r="4.5"` at `24,8`, rotated `0°` / `120°` / `240°`. |
| Ring | 1 | `circle r="16"`, `stroke-dasharray: 10.4 6.35`, rotated `-102°`. Yields six equal arcs. |
| Core | 1 | `circle` at `24,24`, `r="5.5"`. |

The three lines cross at the centre and produce a six-pointed asterisk. The three nodes
sit at radius 16 on the three arms pointing up, lower-right and lower-left — on existing
arms, not at new positions. The ring runs at that same radius 16, just inside the six line
tips at radius 18, so it passes through all six arms. This shared skeleton is what makes
the states transformable rather than merely sequential.

### Construction by hand

1. Find the centre by eye.
2. One vertical stroke through it, edge to edge.
3. Two more at sixty degrees either side.

Three strokes, no measuring. The nodes and ring in the other states are located by the
same centre and the same tips.

## The three states

`P1` is the logo. `P2` and `P3` are states it enters while the kit is working — they
appear only in the favicon and the activity rail, never in a lockup, a splash screen or
an app-store listing.

| State | Shape | Means | Rotation |
|---|---|---|---|
| `resting` | 3 full lines. No nodes, no ring, no core — the lines cross instead. | Nothing running. | Still |
| `working` | 3 lines retracted to spokes, node on each tip, core filled. | Agents dispatched. | 2s per turn |
| `settled` | Lines withdrawn into the centre, ring showing six arcs, core slightly smaller. | Work finished, nothing needs you. | 24s per turn |
| `failed` | `resting`, held still, in pink-9. | A session errored. | Still |

`failed` deliberately reuses the resting shape. Stillness reads as wrong beside a mark
that is normally turning, so the shape does not need to change — only the hue and the
absence of motion carry it. This keeps the state count at three drawings, not four.

## Transformation

Nothing is created, destroyed or cross-faded. The same eight elements persist through
every state; each changes only its length or its scale.

| Element | resting | working | settled | Driven by |
|---|---|---|---|---|
| Line ×3 | `dasharray: 36 0`, `dashoffset: 0` | `dasharray: 13 36`, `dashoffset: -5` | `dasharray: 0 36`, `dashoffset: -18` | `stroke-dasharray`, `stroke-dashoffset` |
| Node ×3 | `scale(0)` | `scale(1)` | `scale(0)` | `transform` |
| Ring | `dasharray: 0 16.75`, `opacity: 0` | same | `dasharray: 10.4 6.35`, `opacity: 1` | `stroke-dasharray`, `opacity` |
| Core | `scale(0)` | `scale(1)` | `scale(0.82)` | `transform` |

Three consequences worth stating, because they are the reason to build it this way:

- **Reversible.** `working → resting` runs the `resting → working` keyframes backwards.
  A cancelled run does not have to pass through `settled`.
- **Interruptible.** State lives in two numbers per element, not in a path shape, so a
  transition can be caught mid-flight and redirected. No morph library and no path
  interpolation.
- **Cheap.** No filters, no blur, no lighting. It is affordable to redraw in a canvas
  every frame, which is what the favicon needs.

Transitions run ~450ms with a soft ease — long enough to read as one thing changing,
short enough not to feel like a loading screen.

### Known imperfection

In `working → settled` the ring's six arcs grow from six fixed points rather than
sweeping out of the three nodes. Sweeping would read better as "the agents traced this
ring", but needs six individually-animated arc paths instead of one dashed circle.
Deferred until the current version is on screen and judged.

## Colour

Instrument tokens only, theme-aware, exactly as the existing rail mark behaves.

| Role | Light | Dark |
|---|---|---|
| tickets | `indigo-9` `#4e46c6` | `#918aec` |
| gallery | `teal-9` `#176d5c` | `#6cc9b4` |
| eer | `orange-9` `#a44e14` | `#efa36c` |
| `failed` state | `pink-9` `#a63368` | `#ee94bc` |

The mark is drawn with `currentColor` throughout, so a single file serves every hue and
both themes. The standalone `favicon.svg` files carry an internal
`@media (prefers-color-scheme: dark)` block to swap their own colour, since a favicon has
no inherited `color` to read.

**Sibling rule:** same three strokes, one hue each. A fourth app is one hue and one file.

## Lockups

Mark plus wordmark in IBM Plex Mono 600, matching the shell's existing treatment
(`app-shell.tsx:56`).

| Variant | Use | Spec |
|---|---|---|
| Horizontal | Primary. Docs, README, headers. | Mark height = wordmark cap height. Gap = ½ mark width. |
| Stacked | Splash, about screen. | Mark above, gap = ⅓ mark height. |
| Compact | Mobile top bar. | Mark at 18px beside 15px wordmark. |

## Files to build

| File | Apps | Notes |
|---|---|---|
| `favicon.svg` | web, eer, playground | Bare mark, self-contained colour with a dark-scheme block. Hue is the only difference between the three. |
| `icon-192.png`, `icon-512.png` | web | Squircle field (48-grid, `rx="11"`), strokes knocked out at `r=12` (`M24 12 V36`), stroke 5. Maskable: the mark sits inside the centre 80%, safe for Android's circular crop. |
| `apple-touch-icon.png` | web | 180×180, opaque field, square corners — iOS applies its own mask. Required for Add to Home Screen. |
| `site.webmanifest` | web | `name`, `short_name`, `start_url`, `scope`, `display: standalone`, `theme_color`, `background_color`, the two maskable icons. |
| iOS meta tags | web | `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`, `viewport-fit=cover`. Safari ignores the manifest for home-screen launch, so these are not redundant. |
| `mark.tsx` | `@tickets/ui` | The mark as a component. See Types. |
| `favicon-painter.ts` | `apps/web` | Renders the current state to a canvas and swaps `link.href`. |

The maskable icon is the one place the mark gets a filled square. Bare strokes paint
better and read sharper, but Android crops to a circle and a bare asterisk would lose its
tips.

## Motion in the favicon

**A favicon file cannot animate.** Chrome and Safari render only the first frame of an
animated SVG icon; Firefox alone plays it. The working technique is a `<canvas>` redrawn
from JS with `link.href` swapped per frame.

`favicon-painter.ts` therefore:

- Renders `resting`, `settled` and `failed` as single static data URLs, set once.
- For `working`, cycles a pre-rendered 12-frame loop of the spin on a timer.
- Runs **only** while a session is active. Idle costs nothing — no timer, no canvas.
- Reads session state from the same store the rail already uses; it introduces no new
  source of truth.

## Accessibility

`prefers-reduced-motion: reduce` holds every animation and falls back to the three stills
with no tween. The states differ in **shape**, not only in movement, so the information
survives with motion switched off entirely — which is the test a status indicator has to
pass. The rail mark carries an `aria-label` naming the state in words.

## Decisions locked

1. **P1 is the logo.** P2 and P3 are states of it, not alternates.
2. **Instrument palette**, indigo-9, theme-aware. The off-palette schemes (ultraviolet,
   bioluminescent, ember, iridescent, dusk) are dropped.
3. **One drawing at every size.** No rich master, no separate reduction.
4. **Siblings differ by hue only.**
5. **Transport is deferred.** The icons are identical whether the app is later served over
   plain HTTP, Tailscale, or a local certificate.

## Rejected, and why

| Direction | Why not |
|---|---|
| Ticket stub | Wrong object. The product is a development kit, not a ticket tracker. |
| Polychrome burst / iris / prism | Forces a rich-master-plus-reduction split; not hand-paintable. |
| Glass, aurora, chrome | Depends on gradients and translucency; both die at 16px and cannot be painted. |
| Orb, billet, crystal, rack | Dimensional shading is a large-size treatment only. Explicitly disliked. |
| Orbit family (L, AA, AF) | Perspective ellipses under fog. Explicitly disliked, and impossible to draw by hand. |
| Four-point AI sparkle | The most exhausted mark in the category; would date the product within a year. |

## Open questions

1. **The `✳` collision.** The logo is an asterisk and `✳` is already the Agents glyph in
   the rail (`activity-rail.tsx:11`), three rows below it. Either the product is named
   after what it does, or it is a clash. Recommendation: if it reads as a clash, the
   **rail glyph** changes, not the logo.
2. **Transport for the mobile install.** Plain HTTP gives a working standalone app on iOS
   only; Android needs a secure context for a true install, and neither gets offline
   support without HTTPS. Options: stay on HTTP (iOS only), Tailscale `*.ts.net` with real
   certificates, or a self-signed cert trusted per device.
3. **The name.** "tickets" describes one drawer of a development kit. Not blocking the
   mark, but the wordmark is where it starts to matter.

## Out of scope

Restyling the rail's four mode glyphs; any change to the Instrument palette itself; TLS
or reverse-proxy work; renaming the app or its packages; offline/service-worker support.

## Types

```ts
/** Which form the mark is drawn in. Shape carries the meaning, not just colour. */
type MarkState = 'resting' | 'working' | 'settled' | 'failed';

/** Which app the mark represents; selects the hue. */
type MarkApp = 'tickets' | 'gallery' | 'eer';

interface MarkProps {
  /** Defaults to 'resting'. */
  state?: MarkState;
  /** Defaults to 'tickets'. */
  app?: MarkApp;
  /** Rendered px. The geometry is unchanged at every size. */
  size?: number;
  /** Accessible name. Defaults to a phrase describing `state`. */
  label?: string;
}
```
