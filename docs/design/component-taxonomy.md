# Component taxonomy

Inventory and disposition for every React component in the web stack — 47 total,
36 of them currently in the gallery. Audited 2026-07-25.

## Two axes, not one

"Generic" and "atomic" are independent properties, and conflating them is where
this kind of audit goes wrong:

- **Composition depth** (atom → molecule → organism) — how much structure the
  component owns.
- **Scope** (generic vs domain) — whether its props speak the product's
  vocabulary.

`SessionKindGlyph` is a single `<span>` — maximally atomic — and domain-bound.
`Meter` composes a label, a track and a trailing slot — a molecule — and knows
nothing about tickets. So "everything must be atomic" and "everything must be
generic" are two separate demands, and only the second is achievable for all 47.

**Only one gallery component imports a domain module**: `StatusSelect` pulls
`StatusKind`, `KIND_ICON` and `KIND_TONE` from `apps/web/src/domain/status.ts`.
Every other leak is invisible to the import graph — it lives in the prop
signature (`kind: 'human' | 'agent'`, `costUsd`, `AGENT_MODELS`). The coupling
that matters here is vocabulary, not dependencies.

## Tier tests

Operational, so classification is checkable rather than a matter of taste.

| Tier | Test |
|---|---|
| **Foundation** | Not a component — a token, registry or hook documented as a page. |
| **Atom** | One visual element that no other component in the library already renders. Props are primitives/`ReactNode`. Imports at most `cn`, `Icon`/`Spinner`, `tones`. Local state allowed if it is about that one element (`checked`). |
| **Molecule** | Composes ≥2 elements into one unit with a single job, wraps a Radix trigger/content/portal set, or is an existing atom driven by a state machine. Data arrives as props. |
| **Organism** | Owns a region: branches over a domain data shape, or coordinates ≥2 molecules with their own state. |
| **Screen** | Route-level composition. Never a gallery candidate. |

The atom test's second clause matters: a component that rebuilds an element the
library already owns is a molecule wearing an atom's clothes. `CopyButton`
hand-rolls a `<button>` only because `@tickets/ui` cannot import `Button` — see
[Findings](#findings-outside-the-per-component-actions).

## The grid

**Pkg** — `ui` = `@tickets/ui` (`packages/web/ui/src`) · `web` =
`apps/web/src/ui` · `agent` = `apps/web/src/components/agent`

**Action** — `keep` no change · `move` relocate to `@tickets/ui` under P3 ·
`extend`/`merge`/`dissolve`/`recompose` API change · `add` promote into the
gallery · `evict` remove from the gallery, code stays in the app · `skip` never
a gallery candidate

| Component | Pkg | Ln | Tier | Scope | Gallery | Action |
|---|---|---:|---|---|:-:|---|
| Icon | ui | 39+72 | Foundation | generic | ✅ | keep |
| Colors | ui | 33 | Foundation | generic | ✅ | **replaces `Swatches`** — document the palette; `SWATCHES` becomes one presets row inside it |
| Typography | ui | — | Foundation | generic | — | **add** — 2 families, 9-step scale, 3 tracking tokens; nothing documents them today |
| Pill | ui | 64 | Atom | generic | ✅ | **extend** — add `shape="square"` to absorb SessionKindGlyph |
| RailLabel | ui | 14 | Atom | generic | ✅ | **rename + fold** — named for its location, not its job; it is a mono caption style. Belongs in Typography or a generic `Text` |
| Spinner | ui | 22 | Atom | generic | ✅ | keep |
| Avatar | web | 31 | Atom | **domain** | ✅ | **dissolve** → `shape`/`tone`/`mono`; then move |
| Button | web | 91 | Atom | generic | ✅ | move — **unblocks CopyButton and DialogFooter** |
| Checkbox | web | 91 | Atom | generic | ✅ | move |
| FieldError | web | 12 | Atom | generic | — | **add** + move |
| FieldLabel | web | 16 | Atom | generic | ✅ | move |
| Input | web | 36 | Atom | generic | ✅ | move |
| ItemKey | web | 17 | Atom | generic | ✅ | move — mechanics are `{prefix}-{number}`; only the name sounds domain |
| RelativeDate | web | 45 | Atom | generic | ✅ | move |
| SessionKindGlyph | web | 31 | Atom | **domain** | ✅ | **merge into Pill**; delete |
| Switch | web | 46 | Atom | generic | ✅ | move |
| Textarea | web | 23 | Atom | generic | ✅ | move |
| CopyButton | ui | 68 | Molecule | generic | ✅ | **recompose** — Button + `useCopy`, once Button moves |
| DialogFooter | ui | 28 | Molecule | generic | ✅ | keep — revisit `cancel` prop once Button moves |
| Meter | ui | 58 | Molecule | generic | ✅ | keep |
| ScreenState | ui | 44 | Molecule | generic | ✅ | keep |
| SectionHeader | ui | 65 | Molecule | generic | ✅ | keep |
| SegmentedControl | ui | 45 | Molecule | generic | ✅ | keep |
| Tabs | ui | 70 | Molecule | generic | ✅ | keep |
| Combobox | web | 89 | Molecule | generic | ✅ | move |
| ComboboxList | web | 174 | Molecule | generic | — | move — already generic; becomes `Select`'s internal, not its own entry |
| DatePicker | web | 181 | Molecule | generic | ✅ | move |
| Dialog | web | 100 | Molecule | generic | ✅ | move |
| Menu | web | 61 | Molecule | generic | ✅ | move |
| MultiCombobox | web | 119 | Molecule | generic | ✅ | move |
| NumberInput | web | 90 | Molecule | generic | ✅ | move |
| Popover | web | 37 | Molecule | generic | ✅ | move |
| RadioGroup | web | 57 | Molecule | generic | ✅ | move |
| Toast | web | 74 | Molecule | generic | ✅ | move |
| Tooltip | web | 36 | Molecule | generic | ✅ | move |
| ContextMeter | agent | 48 | Molecule | **domain** | — | skip — app composition over Meter |
| CostMeter | agent | 37 | Molecule | **domain** | ✅ | **evict** — Meter's `label`/`trailing` already cover it |
| DirectoryTree | web | 96 | Organism | **domain** | — | skip — imports `api` |
| StatusSelect | web | 116 | Organism | **domain** | ✅ | **extract `Select`** into the library; evict the wrapper |
| AgentCard | agent | 87 | Organism | **domain** | — | skip |
| AgentEditor | agent | 229 | Organism | **domain** | — | skip |
| MessageStream | agent | 399 | Organism | **domain** | ✅ | **evict** — 7 agent block kinds, no generic core |
| PromptComposer | agent | 92 | Organism | **domain** | ✅ | **evict** — hardcodes `AGENT_MODELS`/`EFFORT_LEVELS` |
| SessionList | agent | 109 | Organism | **domain** | — | skip |
| TicketDispatch | agent | 107 | Organism | **domain** | — | skip |
| AgentLibraryScreen | agent | 90 | Screen | **domain** | — | skip |
| AgentProfileScreen | agent | 149 | Screen | **domain** | — | skip |
| AgentSessionScreen | agent | 217 | Screen | **domain** | — | skip |

## Totals

| | Count |
|---|---:|
| Components audited | 47 |
| In the gallery today | 36 |
| Generic today | 30 of 36 |
| Move `apps/web` → `@tickets/ui` | 26 |

Reconciling the gallery count:

| | Δ | Running |
|---|---:|---:|
| Today | | 36 |
| Evict domain — CostMeter, MessageStream, PromptComposer, StatusSelect | −4 | 32 |
| Merge SessionKindGlyph into Pill | −1 | 31 |
| Fold RailLabel into Typography | −1 | 30 |
| Add Typography, `Select`, FieldError, `ColorSwatchInput` | +4 | **34** |

`Colors` replaces `Swatches` and `ComboboxList` becomes `Select`'s internal, so
neither changes the count. All 34 entries are generic.

The package boundary already **is** the scope boundary: `@tickets/ui` was
declared domain-free during the consolidation phase, and it holds — all 12 of
its gallery entries are generic. Every one of the six leaks lives in `apps/web`.
The gallery simply flattens the two packages into one list.

## Findings outside the per-component actions

### The one-way package split forces duplication

`@tickets/ui` cannot import `apps/web/src/ui/button.tsx`, and two components in
the package answer that constraint differently:

- `DialogFooter` takes `cancel` as a `ReactNode` so the caller passes its own
  `<Button>`. Documented in the source.
- `CopyButton` rebuilds a `<button>` from scratch.

CopyButton's copy is missing everything Button provides — **no focus-visible
ring** (a keyboard-reachable control with no visible focus indicator), no `ref`,
no `disabled`, no `size`, no `active:translate-y-px` — and diverges on radius
(`rounded-ctrl` 5px vs 6/8/10px per size) and type (`font-mono text-[11px]` vs
`font-sans font-medium text-[12px]`).

`useCopy` is exported separately and is used **without** CopyButton as often as
with it — `item-detail.tsx:120` and `signals/session-screen.tsx:174` take the
hook alone; only `signals/dsn-field.tsx:22` and `signals/sdk-snippet.tsx:68` use
the button. The hook is the reusable unit. Moving Button collapses CopyButton to
roughly ten lines, at which point it may not warrant a gallery entry of its own.

### Typography is undocumented, and most of the scale is inert

`tokens.css` defines 2 families (`--font-sans`/`--font-mono`, both IBM Plex), a
**9-step size scale** each with its own line-height — `nano` 9px, `micro` 10,
`label` 11 (+`0.06em` letter-spacing), `meta` 12, `ui` 13, `body` 14, `title` 16,
`heading` 20, `display` 24 — and 3 tracking tokens (`caps` .08em, `label` .06em,
`mono-label` .09em). **No gallery page documents any of it.**

Usage across `apps` + `packages` shows why that matters:

| Token | Uses |
|---|---:|
| `text-meta` | 180 |
| `text-ui` | 120 |
| `text-label` | 72 |
| `text-nano` | 4 |
| `text-micro` · `text-body` · `text-heading` | 2 each |
| `text-display` | 1 |

The three original steps carry 372 of 383 uses; the six added during the token
audit total 11. An undocumented scale does not get adopted.

`RailLabel` is the proof: it hardcodes `text-[10px]` while `--text-micro` **is**
10px — which is part of why `text-micro` shows two uses. It also illustrates the
naming problem, being named for the sidebar rail rather than for what it is (a
mono caption). `SectionHeader`'s title is the same thing in sans at 11px. Both
are typographic styles rather than components, and the six-agent audit already
listed **`Text`** as a missing primitive.

(`text-2xs`/`text-3xs`, 31 uses, are eer's own tokens — defined in
`apps/eer/src/styles/tailwind.css`, registered in `cn.ts` because `cn` is
shared. Not a gap; relevant only to roadmap step 6.)

### Missing primitives

- **`Select`** — the six-agent audit counted **14 raw `<select>`s** across the
  app. `StatusSelect` produces it; `ComboboxList` is already most of it.
- **`Text`** — flagged by the six-agent audit. Would absorb `RailLabel` and
  `SectionHeader`'s title as variants and give the 9-step scale a call site,
  rather than each caption hardcoding its own size.
- **`ColorSwatchInput`** — the picker built around `SWATCHES` exists twice,
  byte-for-byte: `settings/types-tab.tsx:40-62` and
  `settings/workflow-tab.tsx:100-125`, identical props
  (`value`/`onChange`/`disabled`), aria and classes, differing only by an `mt-2`
  on the outer div. Neither copy knows anything about types or statuses.

### Smaller items

- **Arbitrary Tailwind values**, concentrated in exactly the components under
  discussion: `text-[8px]`/`text-[9px]`/`text-[10px]` (Avatar,
  SessionKindGlyph), `rounded-[8px]`/`ring-[3px]` (PromptComposer),
  `text-[11px]` (CopyButton). These violate the class-hygiene rule and should
  map to `text-nano`/`text-micro` while those files are open. Button's
  `text-[12px]`/`text-[13px]` are a documented deliberate exception — see the
  `cn.ts` font-size note in its source.
- **PromptComposer reimplements `Textarea`** — a raw `<textarea>` with
  hand-rolled classes sits next to a 23-line library `Textarea` that does the
  same job. Same class of problem as CopyButton, without the package excuse.
- **Location-based naming.** `RailLabel` is named for the sidebar rail. A
  generic component named after one call site tells a reader where it was born,
  not what it does — and quietly discourages reuse anywhere else. Worth a sweep
  for others on the move.

## Open decisions

1. **Pill / SessionKindGlyph** — merging costs 2px (Pill is `h-5.5`/22px, the
   glyph is `size-5`/20px) or requires a size prop.
2. **RailLabel / SectionHeader** — do captions become a `Text` component with
   variants, or are they pure styles that live only on the Typography page and
   get applied as classes? `SectionHeader` keeps its row layout either way.
3. **CopyButton** — after Button moves, keep it as a ten-line documented
   molecule, or delete it and let the two call sites compose Button + `useCopy`?
4. **Evicted components** — CostMeter, MessageStream and PromptComposer stay in
   the app but stop being documented anywhere. Acceptable, or do they need a
   separate Patterns tier?
5. **ItemKey** — generic but domain-named. Rename on the move, or keep.

## Relationship to the roadmap

This is steps 3–5 of the shared-UI-library roadmap with a taxonomy attached:

3. move 30 primitives with API normalization ← every row marked `move`; Button
   first, since CopyButton and DialogFooter both wait on it
4. top merges ← Pill/SessionKindGlyph, RailLabel/SectionHeader, CopyButton
5. build missing primitives ← `Select`, `Text`, `ColorSwatchInput`

Two Foundation pages (`Colors`, `Typography`) sit outside those steps and can be
built first — they document tokens that already exist, so they block nothing and
would surface the unused half of the type scale immediately.
