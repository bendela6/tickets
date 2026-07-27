# Foundation tokens

The complete design-token set for `@tickets/ui`. This is the specification —
every token, its value, and how to consume it.

**Source of truth is JSON, not CSS.** `packages/web/ui/src/tokens/*.tokens.json`
→ `scripts/build-tokens.mjs` → `src/tokens.css` **and** `src/tones.generated.ts`.
The generated blocks in `tokens.css` are marked `do not edit`; change the JSON
and rebuild. `pnpm tokens:verify` diffs both outputs.

## Tiers

| Tier | Lives in | Form | Rule |
|---|---|---|---|
| **Primitive** | `primitives.tokens.json` → `--ins-*` | CSS custom property | Generated ramp values, one set per theme. **Never referenced by a component.** |
| **Semantic** | `semantic.*.tokens.json` → `--color-*` | CSS custom property | `<scale>-<step>`. What a component consumes. |
| **Tone** | `tones.tokens.json` → `tones.generated.ts` | TypeScript class strings | Pre-generated literals for when colour is a *prop*. |

Dark mode works by re-declaring `--ins-*` under `[data-theme='dark']`; every
semantic token follows automatically and no component knows a theme exists.

`--ins-*` is named after **Ins**trument and holds raw values:

```css
--ins-gray-1: #f7f6f2;                          /* primitive */
[data-theme='dark'] { --ins-gray-1: #1b1a17; }  /* only this layer flips */
--color-gray-1: var(--ins-gray-1);              /* semantic → generates bg-gray-1 */
```

## How to consume a token

Placement decides the syntax, and getting it wrong silently produces no styling.

| Block | Contains | Consumed as |
|---|---|---|
| `@theme inline` | colour, text, weight, radius, tracking, shadow, font, ease, animate, breakpoint | Plain utility — `bg-gray-1`, `text-4`, `rounded-3` |
| `:root` | duration, border width, focus ring, z-index | Explicit var — `ring-(length:--ring-focus)`, `z-(--z-overlay)` |

Every `@theme` family opens with `--<family>-*: initial`, so Tailwind's default
palette, type scale, weights and radii do not exist. What is listed here is the
whole set.

The rule is mechanical: **if Tailwind v4 has a namespace for it, it belongs in
`@theme` and generates a utility; if not, it belongs in `:root`.**

> **Tailwind preflight is OFF in this repo.** Unlayered CSS and native control
> defaults can beat these tokens — see the trap tables in the project skills
> before debugging a style that "isn't applying".

---

## Colour

**One system, no exceptions: `<scale>-<step>`.** Twelve steps per scale, in both
themes. There are no role-named colour tokens — no `-subtle`, no `-hover`, no
`-base`.

```
bg-green-3   border-green-7   text-green-11   bg-accent-9
```

### Steps

Every scale assigns the same job to the same step, so a step number means the
same thing on every colour.

| Step | Job |
|---:|---|
| 1 | App background |
| 2 | Subtle background — cards, panels |
| 3 | Component background |
| 4 | Component background, hovered |
| 5 | Component background, active / selected |
| 6 | Subtle border, separator |
| 7 | Component border, focus ring |
| 8 | Component border, hovered |
| 9 | Solid fill |
| 10 | Solid fill, hovered |
| 11 | Low-contrast text |
| 12 | High-contrast text |

### Scales

| Scale | Kind | Notes |
|---|---|---|
| `gray` | hue | **Doubles as the UI neutral** — surfaces, borders and ink all come from here |
| `red` `orange` `yellow` `green` `teal` `cyan` `blue` `indigo` `purple` `pink` | hue | The palette a user can assign to a configurable option |
| `accent` | semantic | Own scale — the product's primary interactive colour |
| `danger` | semantic | Own scale — destructive intent |
| `success` | semantic | Alias of `green` |
| `warning` | semantic | Alias of `orange` |

13 real scales × 12 steps.

Semantic scales follow the identical `<scale>-<step>` pattern, so this remains
one system while keeping colours re-pointable: rebranding is a change to the
`accent` scale definition, not to call sites. `accent` and `danger` are their
own scales rather than aliases because their values are deliberately distinct
from `indigo` and `red`.

`success` and `warning` ship as aliases, so `success-9` and `green-9` are
identical today. Promoting either to its own scale is a one-line change and
requires no call-site edits — worth doing the moment status colour needs to
diverge from the palette (colour-blind tuning, for instance), because a user's
saved green option must not move with it.

### Surfaces and ink

These are not separate tokens. They are positions on the `gray` scale:

| Was | Now | Light | Dark |
|---|---|---|---|
| `app` | `gray-1` | `#f7f6f2` | `#1b1a17` |
| `raised` | `gray-2` | `#ffffff` | `#252320` |
| `inset` | `gray-3` | `#eceae3` | `#141310` |
| `hairline` | `gray-6` | `#e0ddd5` | `#343128` |
| `control` | `gray-7` | `#c9c5ba` | `#4c483d` |
| `ink-3` | `gray-10` | `#918d80` | `#79756a` |
| `ink-2` | `gray-11` | `#5d5a50` | `#a6a296` |
| `ink` | `gray-12` | `#25231d` | `#edebe3` |

The old names were already an informal ramp, which is why they map cleanly.
`opt-gray` merges in too — its base `#5c594f` is within a hair of `ink-2`, and
its subtle `#eae9e4` of `inset`.

> **Open:** in light mode `raised` is pure white and therefore *lighter* than
> `app`, so it sits above step 1 rather than at step 2. Either the scale's
> step 1 is white and `app` moves to step 2, or panels keep a dedicated token.
> Decide before generating the ramp.

### Ramp anchors

Ramps are generated in OKLCH. Step 9 of each scale is anchored to today's base
colour so the palette is preserved; the remaining steps are derived by
lightness, giving perceptually even spacing and free extensibility.

| Scale | Step 9 light | Step 9 dark |
|---|---|---|
| `accent` | `#4e46c6` | `#918aec` |
| `danger` | `#c0382e` | `#e26a5f` |
| `red` | `#a03028` | `#f0968d` |
| `orange` | `#a44e14` | `#efa36c` |
| `yellow` | `#8a6a10` | `#dfc060` |
| `green` | `#2e7042` | `#7fcb97` |
| `teal` | `#176d5c` | `#6cc9b4` |
| `cyan` | `#14687e` | `#74c4dc` |
| `blue` | `#2a5dae` | `#8bb4ef` |
| `indigo` | `#4a44b0` | `#a5a0f0` |
| `purple` | `#7b3fa0` | `#c591e8` |
| `pink` | `#a63368` | `#ee94bc` |
| `gray` | `#5c594f` | `#a5a195` |

Exact values at other steps will shift slightly from today's hand-authored
colours as they snap onto ramp positions.

### `contrast` — the one non-numbered token

Text on a step-9 fill sits at no fixed step: it is near-white over a dark fill
and near-black over a light one, and it flips between themes. So each scale
carries one extra token:

```css
--color-accent-contrast   /* #ffffff light · #16143c dark */
--color-yellow-contrast   /* #ffffff light · #33290a dark */
```

Used only as the foreground on steps 9–10. This is the single exception to
`<scale>-<step>`, and it is forced by contrast maths rather than preference.

### Runtime-variable colour

Tailwind scans source for **literal** class names at build time, so a name built
at runtime — `` `bg-${scale}-9` `` — generates no CSS and silently does nothing.
Any component whose colour arrives as a *prop* (Pill, Meter, ScreenState) must
therefore use pre-generated literals:

```ts
toneClasses('success', 'solid')  // 'bg-success-9 text-success-contrast'
```

`build-tokens.mjs` writes every combination into `tones.generated.ts` in
advance. This is a build constraint, not a second naming system — the strings it
emits are ordinary `<scale>-<step>` classes. Never assemble one by hand.

---

## Typography

Numbered like colour: `text-1` … `text-9`, smallest to largest. Each step is
**paired with its own line-height**; never set a size and a line-height
independently.

| Token | Size | Line-height | Extra |
|---|---|---|---|
| `--text-1` | 9px | 1.3 | |
| `--text-2` | 10px | 1.35 | |
| `--text-3` | 11px | 1.2 | `letter-spacing: .06em` |
| `--text-4` | 12px | 1.4 | |
| `--text-5` | 13px | 1.45 | |
| `--text-6` | 14px | 1.5 | |
| `--text-7` | 16px | 1.4 | |
| `--text-8` | 20px | 1.3 | |
| `--text-9` | 24px | 1.25 | |

`@theme` opens with `--text-*: initial`, so Tailwind's `text-xs`…`text-xl` do
not exist. Nothing is lost — they had zero uses.

### Weight

The number **is** the CSS value.

| Token | Value |
|---|---|
| `--font-weight-400` | `400` |
| `--font-weight-500` | `500` |
| `--font-weight-600` | `600` |

`--font-weight-*: initial` removes `font-thin`, `font-bold` and the rest.

### Family and tracking

| Token | Value |
|---|---|
| `--font-sans` | `'IBM Plex Sans', system-ui, sans-serif` |
| `--font-mono` | `'IBM Plex Mono', ui-monospace, monospace` |
| `--tracking-label` | `.06em` |
| `--tracking-caps` | `.08em` |
| `--tracking-mono-label` | `.09em` |

⚠️ `cn.ts` must register every size name in its `font-size` conflict group. An
unregistered name is bucketed as a *colour*, and twMerge silently drops it when
a `text-*` colour sits alongside. `cn.test.ts` reads `--text-*` out of
`tokens.css` so an unregistered token fails the suite. Note `text-4` (size) and
`text-gray-4` (colour) are unambiguous — sizes are one segment, colours two.

---

## Radius

| Token | Value | Use |
|---|---|---|
| `--radius-1` | 4px | Chips, small marks |
| `--radius-2` | 6px | Controls, inputs, buttons |
| `--radius-3` | 8px | Cards, tiles |
| `--radius-4` | 12px | Panels, sheets, dialogs |

`--radius-*: initial` removes Tailwind's `rounded-sm`/`md`/`lg`/`xl` and bare
`rounded`. **`rounded-full` is retained** — a pill is not a step on the scale,
so it stays as the one exception, the same way `contrast` does for colour.

## Control height

**Not tokenized.** Tailwind's `h-*` is already a numbered scale on a 4px base,
so `--size-md: 36px` would only be a second way to write `h-9`.

Component APIs still share one size vocabulary — `sm` = `h-7` (28px), `md` =
`h-9` (36px), `lg` = `h-11` (44px), applied uniformly across Button, Input,
Textarea, Select, Combobox, DatePicker, NumberInput, Switch, Checkbox and
Avatar. That is a **prop contract**, not a design token. Icon-only is not a
size: `size="md" iconOnly` renders a square at that size's height.

## Border and focus

| Token | Value | Consumed as |
|---|---|---|
| `--border-thin` | 1px | `border-(length:--border-thin)` |
| `--border-thick` | 1.5px | `border-(length:--border-thick)` |
| `--ring-focus` | 3px | `ring-(length:--ring-focus)` |

Border *colour* comes from steps 6–8. Every interactive component spreads the
shared `focusRing` const from `variants.ts`; no component hand-writes a focus
ring.

## Shadow

Named by role, matching the layering scale.

| Token | Light | Dark |
|---|---|---|
| `--shadow-raised` | `0 1px 2px rgba(28,26,20,.06)` | `0 1px 2px rgba(0,0,0,.4)` |
| `--shadow-overlay` | `0 6px 16px rgba(28,26,20,.10), 0 2px 4px rgba(28,26,20,.06)` | `0 6px 16px rgba(0,0,0,.45), 0 2px 4px rgba(0,0,0,.3)` |
| `--shadow-modal` | `0 16px 40px rgba(28,26,20,.16), 0 4px 10px rgba(28,26,20,.08)` | `0 16px 40px rgba(0,0,0,.55), 0 4px 10px rgba(0,0,0,.4)` |

`raised` = cards · `overlay` = popovers and menus · `modal` = dialogs.

## Layering

| Token | Value | Use |
|---|---|---|
| `--z-sticky` | 10 | Sticky table headers |
| `--z-scrim` | 40 | Backdrops |
| `--z-overlay` | 50 | Floating portals |

Backdrops draw their colour from `gray-12` at reduced alpha rather than a
dedicated token.

## Motion

| Token | Value |
|---|---|
| `--duration-fast` | `120ms` |
| `--duration-base` | `200ms` |
| `--duration-slow` | `320ms` |
| `--ease-out` | `cubic-bezier(.2, 0, 0, 1)` |
| `--ease-in-out` | `cubic-bezier(.4, 0, .2, 1)` |
| `--animate-ai-spin` | `ai-spin 1.4s linear infinite` |
| `--animate-ai-pulse` | `ai-pulse 1.8s ease-out infinite` |

Tailwind v4 has no `--duration-*` namespace, so durations live in `:root` and
are consumed as `duration-(--duration-base)`.

All motion is suppressed under a global guard:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: .01ms !important;
    transition-duration: .01ms !important;
  }
}
```

## Breakpoints

| Token | Value | Use |
|---|---|---|
| `--breakpoint-narrow` | 1024px | Sidebar collapses to an overlay |
| `--breakpoint-wide` | 1536px | Docs view gains a second column |

Real Tailwind v4 namespace, so these generate `narrow:` and `wide:` variants.

---

## Not tokenized

Deliberate omissions, so their absence reads as a decision rather than a gap.

| | Why |
|---|---|
| **Spacing** | Tailwind's default scale is already 4px-based. Tokenize only when density mode becomes real. |
| **Component tier** | Per-part `className` escape hatches (`trackClassName`, `titleClassName`) cover per-instance overrides. |
| **Control height** | Tailwind's `h-*` is already a numbered 4px scale. A size token would duplicate it. |
| **Density, RTL** | Not supported. |
| **Role-named colour, type and radius** | Replaced by numbered steps. `contrast` and `rounded-full` are the only survivors. |
