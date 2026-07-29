# Foundation scale vocabulary — design

**Date:** 2026-07-29 · **Status:** approved, ready to plan

Finishes the move begun by `c441276`/`1d25f57`/`4205792` (the type scale) across the
remaining foundation families: radius, border width, ring width, z-index, duration
and breakpoints.

## The rule

**A foundation class names its own value.** `border-1` is 1px, `z-10` is 10,
`duration-200` is 200ms, `ring-3` is 3px — no token lookup, no role name to
memorise, no second place the value could drift to.

Radius is the single deliberate exception. A corner radius has no legible unit-name
at a glance (4px on a chip and 12px on a panel read as the same softness), so it
keeps a four-rung t-shirt scale. Easing curves are the other exception, for the
same reason in reverse: `cubic-bezier(.2,0,0,1)` has no number that means anything.

A consequence worth stating up front: for five of the six families the correct
implementation is to **delete tokens, not rename them**. `--z-*`, `--duration-*`,
`--border-thin`, `--ring-focus` and `--breakpoint-narrow/wide` have zero consumers
outside the Foundation demo pages, and Tailwind's bare-value utilities already do
the job natively.

## The vocabulary

Counts are in-scope sites only (`packages/web` + `apps/web/src`; see Scope).

| Family | Class | Value | Job | Replaces | Sites |
|---|---|---|---|---|---|
| Radius | `rounded-sm` | 4px | chips, tags, inline marks | `rounded-xs`, `rounded-[1px\|1.5px\|2px\|3px\|3.5px\|4px]` | 47 |
| Radius | `rounded-md` | 6px | buttons, inputs, controls | `rounded-[5px\|6px]` | 23 |
| Radius | `rounded-lg` | 8px | cards, list rows, popovers | `rounded-[7px\|8px\|9px]` | 56 |
| Radius | `rounded-xl` | 12px | panels, dialogs, sheets | `rounded-[10px\|11px\|12px]`, `rounded-2xl` | 31 |
| Radius | `rounded-full` | pill | pills, avatars, dots | — off-scale, retained | 48 |
| Radius | `rounded-none` | 0 | square by intent | — unchanged | 1 |
| Border | `border-0` | 0px | edge removed | — unchanged | 15 |
| Border | `border-1` | 1px | dividers, table rules | bare `border`, `border-b/t/l/r` | ~385 |
| Border | `border-2` | 2px | inputs, cards, outline controls | `border-[1.5px]`, `--border-thick` | 27 |
| Ring | `ring-0` | 0px | ring removed | — unchanged | 2 |
| Ring | `ring-1` | 1px | selected-day mark | — unchanged | 1 |
| Ring | `ring-3` | 3px | focus-visible ring | `ring-[3px]`, `ring-(length:--ring-focus)` | 22 |
| Z-index | `z-10` | 10 | pinned headers, toolbars | `--z-sticky` | 2 |
| Z-index | `z-40` | 40 | scrim behind a dialog | `--z-scrim`, `z-30` | 7 |
| Z-index | `z-50` | 50 | dialogs, menus, toasts | `--z-overlay` | 9 |
| Duration | `duration-120` | 120ms | hover, press — feedback | `--duration-fast` | 0 |
| Duration | `duration-200` | 200ms | open, close — transitions | `--duration-base` | 0 |
| Duration | `duration-320` | 320ms | enter, layout — arrivals | `--duration-slow` | 0 |
| Easing | `ease-out` | `cubic-bezier(.2,0,0,1)` | exits, most motion | — named exception, kept | — |
| Easing | `ease-in-out` | `cubic-bezier(.4,0,.2,1)` | symmetric motion | — named exception, kept | — |
| Breakpoint | `sm:` | 640px | Tailwind standard | — unchanged | 40 |
| Breakpoint | `md:` | 768px | Tailwind standard | — unchanged | 64 |
| Breakpoint | `lg:` | 1024px | Tailwind standard | `--breakpoint-narrow` | 37 |
| Breakpoint | `xl:` | 1280px | Tailwind standard | — unchanged | 6 |
| Breakpoint | `2xl:` | 1536px | Tailwind standard | `--breakpoint-wide` | 3 |

**Retired — no longer legal:** `rounded-xs` · `rounded-2xl` · `rounded-3xl` ·
`rounded-4xl` · bare `rounded` · bare `border` · bare `border-b/t/l/r` · `z-30` ·
every `rounded-[Npx]` · `border-[1.5px]` · `ring-[3px]` ·
`ring-(length:--ring-focus)`. (`z-3` is retired too, but its only two sites are in
`apps/eer`, which is out of scope.)

**Tokens deleted:** `--border-thin` · `--border-thick` · `--ring-focus` ·
`--z-sticky` · `--z-scrim` · `--z-overlay` · `--duration-fast` · `--duration-base` ·
`--duration-slow` · `--breakpoint-narrow` · `--breakpoint-wide`

**Tokens declared:** `--radius-sm/md/lg/xl`, plus `--radius-xs/2xl/3xl/4xl: initial`

## What the framework enforces, and what it does not

Verified empirically against the installed Tailwind 4.3.2 by compiling each
candidate class through the `tailwindcss` `compile()` API:

| Class | Result |
|---|---|
| `border-1`, `border-b-1`, `border-x-1` | compile → `border-width: 1px` |
| `border-1.5` | **does not compile** — fractional widths are not bare values |
| `z-<n>`, `duration-<n>`, `ring-<n>` | bare-value utilities; always available, not theme-driven |
| bare `border` | static utility, `border-width: 1px` — **cannot be un-defined** |
| bare `rounded` | static utility, hardcoded `0.25rem` — **cannot be un-defined** |
| `rounded-xs/2xl/3xl/4xl` | theme-driven → `--radius-xs: initial` removes them |
| `rounded-full` | hardcoded `calc(infinity * 1px)` — survives `--radius-*: initial` |

So exactly four retired classes stop compiling. Everything else on the retired list
stays syntactically valid Tailwind and holds **by convention only**. That is the
argument for a lint gate, which is scoped out of this change (see Follow-ups).

`--radius-*: initial` is unnecessary for `3xl`/`4xl` in the sense that nothing uses
them, but it is declared anyway so the sheet states the whole scale rather than
leaving three rungs quietly inherited.

## Decisions and rationale

**Radius names align to values, not to rung position.** The four spec'd values
4/6/8/12 are *exactly* Tailwind's default `sm`/`md`/`lg`/`xl`. Naming them that way
makes 166 existing `rounded-sm/md/lg/xl` usages correct as written; naming them
`xs/sm/md/lg` would shift every value one rung and turn every un-migrated class
into a silent pixel change.

**1.5px collapses to `border-2`.** 1.5px has no numeric class and never will.
`design-system.html` — the spec of record — specifies `border:1.5px` in 30 rules, so
this is a **deliberate deviation from the design spec**, accepted to keep the border
family a clean integer ladder. Every outline Button, Pill and Tab edge becomes 33%
thicker. `check-design-tokens.mjs` maps `border.hairline`/`border.control` to
*colours*, not widths, so no gate flags this; the deviation is recorded here because
nothing else records it.

**Arbitrary radii are swept now, not deferred.** 139 `rounded-[Npx]` sites across 14
distinct values are the real radius vocabulary; renaming the scale while leaving them
in place would make the scale decorative.

**`apps/eer` is out of scope.** It declares its own `@theme` with
`--radius-lg: 9px`, `--radius-xl: 10px`, `--radius-2xl: 14px` and never imports
`tokens.css`. Its 72 `rounded-*` usages resolve against *its* scale, so sweeping it
in would restyle a separate app under cover of this change. It shares only `cn` and
`runtimeStyle` from `@tickets/ui`, neither of which changes here.

## Rounding rules for the sweep

Nearest rung, ties up:

```
1, 1.5, 2, 3, 3.5, 4px  →  rounded-sm   (4)
5, 6px                  →  rounded-md   (6)
7, 8, 9px               →  rounded-lg   (8)
10, 11, 12px            →  rounded-xl  (12)
```

Two classes of site must **not** be swept mechanically:

1. **Sub-2px hairline marks on tiny elements** — `signals/level-dot.tsx`,
   `signals/sparkline.tsx` (3px-wide bars), `shell/activity-rail.tsx`,
   `terminal/directory-picker.tsx`, `ui/directory-tree.tsx`. A 4px radius on a 3px
   bar is a circle. Each needs a per-site call between `rounded-sm`, `rounded-full`
   and `rounded-none`.
2. **`Button` / `Field` `size="lg"`** — 10px → 12px, the only pixel move inside
   `@tickets/ui`. `sm` (6px) and `md` (8px) are exact no-ops.

The stale comment at `button.tsx:87` ("not the 5px `rounded-md`") is corrected in
passing: `rounded-md` is 6px today; the 5px it refers to was the retired
`--radius-ctrl`.

## Files

**Token layer**
- `packages/web/ui/src/tokens/tokens.css` — declare the four radius rungs and the
  four `initial`s in `@theme inline`; delete the border/ring/z block at `:root`
  (lines ~56–65) and the duration/breakpoint lines (~699–706). All edits are in the
  hand-authored regions, never between `tokens:*` markers.
- `packages/web/ui/src/tokens/next/radius.tokens.json` — keys `1..4` → `sm/md/lg/xl`
- `packages/web/ui/src/tokens/next/layout.tokens.json` — `border.thin/thick` →
  `border.1/2`; `ring.focus` → `ring.3`; `z.sticky/scrim/overlay` → `z.10/40/50`;
  `breakpoint.narrow/wide` → the five standard rungs
- `packages/web/ui/src/tokens/next/motion.tokens.json` — `duration.fast/base/slow` →
  `duration.120/200/320`
- `packages/web/ui/src/tokens/safelist.generated.css` — regenerated (drops
  `rounded-[6px|7px|8px|10px]`)
- `packages/web/ui/scripts/build-tokens.mjs` — `emitTones()` emits `border-2` in
  place of `border-(length:--border-thick)`
- `packages/web/ui/src/style/tones/tones.generated.ts` — regenerated (14 tones)

**Components with retired vocabulary**
`components/copy-button/copy-button.tsx` · `components/pill/pill.tsx` ·
`components/tabs/tabs.tsx` · `components/button/button.tsx` ·
`components/field/field.ts` · `components/checkbox/checkbox.tsx` ·
`components/date-picker/date-picker.tsx` · `components/dropdown/dropdown.tsx`

**Tests asserting exact classes**
`button.test.tsx` · `field.test.tsx` · `input.test.tsx` · `tones.test.ts` ·
`foundation/spec.test.ts`

**Sweep** — every remaining `.tsx`/`.ts`/`.css` under `packages/web/ui/src`,
`packages/web/playground/src`, `apps/web/src`.

## Gallery

The gallery is where this vocabulary is *shown*, so it changes in three ways.

**The Foundation pages are rekeyed.** `foundation/radius/radius.demo.tsx` rekeys
`RADIUS_JOBS` to `radius-sm/md/lg/xl`; `foundation/layout/layout.demo.tsx` rekeys
`BORDER_JOBS` to `border-1`/`border-2`, `LAYER_JOBS` to `z-10`/`z-40`/`z-50`, and
the focus-ring row from `ring-(length:--ring-focus)` to `ring-3`;
`foundation/motion/motion.demo.tsx` rekeys `DURATION_JOBS` to
`duration-120/200/320`.

**Specimens render the class, not a computed value.** Both `Scale` and `InUse` in
`radius.demo.tsx` currently apply `style={{ borderRadius: radius.value }}` — a
JS-computed inline style. Now that every rung is a real utility, the specimens
apply `rounded-sm`/`md`/`lg`/`xl` directly, so the page demonstrates the class a
component would actually write. The 4×-magnified corner keeps its inline
`calc(… * 4)`, which has no class form and is a deliberate magnification rather than
a token value. The same applies to the border rows in `layout.demo.tsx`, which move
from `style={{ borderWidth }}` to `border-1`/`border-2`.

**The drift view narrows to tokenized families.** `foundation/spec.ts` builds a
live-vs-proposed table by parsing `tokens.css`. Once border, ring, z, duration and
breakpoint are deliberately un-tokenized, their drift rows would report every rung
as `dropped` — noise that reads as a regression. So:

- `drift()` covers only families that are genuinely tokenized: `radius`, `text`,
  `font`, `font-weight`, `shadow`, `ease`, `animate`.
- The `next/*.tokens.json` files keep the numeric ladders for the native families.
  They stop being a token *proposal* and become the record of sanctioned rungs,
  which is what the Foundation pages render.
- Native families render a "Tailwind-native — no token" note in place of a drift
  table, naming the rungs and their jobs. That is the honest statement: there is no
  drift to measure because there is no second copy of the value.
- The radius drift regex `liveTokens(/^radius-[a-z]+$/)` still matches; `BORDERS`,
  `RINGS`, `LAYERS`, `BREAKPOINTS` and `DURATIONS` stay exported (the demos read
  them) but no longer feed `drift()`.

**Component demos** need no special handling — all 37 `*.demo.tsx` files sit inside
the sweep scope, so gallery specimens stay identical to what the app renders, which
is the property that makes the gallery worth trusting.

## Verification

- `pnpm --filter @tickets/ui tokens:verify` — rebuilds tokens and fails on drift in
  `tokens.css`, `safelist.generated.css` and `tones.generated.ts`; all three change
  here, so all three must be committed rebuilt.
- `pnpm typecheck` · `pnpm --filter @tickets/web test` · `pnpm build`
- A grep gate run by hand at the end of the sweep, since no lint rule exists yet:
  zero hits for `rounded-\[`, `border-\[1.5px\]`, `ring-\[3px\]`, bare `border`,
  `rounded-xs`, `--border-th`, `--z-`, `--duration-`, `--breakpoint-` in scope.
- `/gallery` on :4620 (`WEB_DEV_PORT=4620 pnpm --filter @tickets/web dev`, docker API
  up): the Radius, Layout and Motion Foundation pages, then a pass over the component
  pages for the surfaces that moved — outline Button/Pill/Tab edges (1.5→2px),
  `size="lg"` Button and Field corners (10→12px), and the flagged hairline marks.
- Measured against the rungs, not eyeballed — per `verifying-a-component`.

## Commits

One per family, per repo convention:

1. `feat(ui)!: radius on a four-rung t-shirt scale` — tokens.css, next/radius, the
   157-site sweep, Button/Field, tests, safelist
2. `refactor(ui)!: border and ring widths as integers` — bare `border` retired,
   1.5px → `border-2`, the tone generator, next/layout
3. `chore(ui): z-index, duration and breakpoints go Tailwind-native` — token
   deletions, next/layout, next/motion
4. `docs(ui): foundation pages and token tables on the new vocabulary` — the three
   Foundation demos, `spec.ts` drift narrowing, `foundation-tokens.md`,
   `token-index.md`

## Follow-ups (not this change)

- **Lint gate.** A 385-site border sweep and a 157-site radius sweep with no ratchet
  regress on the next PR. `scan-hardcoded-values.mjs` is colour-only today; extending
  it to flag off-scale `rounded-*`/`border-*`/`ring-*` and literal `border-radius` in
  hand-written CSS is the natural next step. It needs the ~16 literal `border-radius`
  declarations in `tokens.css`'s component CSS migrated first.
- **`apps/eer`** aligned to the same vocabulary, as its own pass.
- **`design-system.html`** re-exported from the Claude Design project if the 1.5px →
  2px border decision should hold there too, rather than living only in this spec.

## Types

Types referenced above, defined in `packages/web/ui/src/foundation/spec.ts`:

```ts
/** One design token as the Foundation pages consume it. */
interface Token {
  /** Token name without the leading `--`, e.g. `radius-sm`. */
  name: string;
  value: string;
}

type DriftStatus = 'matched' | 'added' | 'dropped';

/** One row of the live-vs-proposed comparison table. */
interface DriftRow {
  family: string;
  status: DriftStatus;
  /** Proposed token name — absent when the row is a live token being dropped. */
  spec?: string;
  /** Live token name — absent when the row is a proposed token being added. */
  live?: string;
  value: string;
}

interface DriftFamily {
  family: string;
  rows: DriftRow[];
  /** Why a family drifts, where the raw counts would mislead. */
  note?: string;
}
```
