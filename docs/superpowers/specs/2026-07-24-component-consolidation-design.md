# Component Consolidation — Primitive Tier Design

Unite the duplicated UI fragments across `apps/web` (and signals screens) into generic, configurable primitives that live in `@tickets/ui`, on top of two new foundations: a **generated tone system** and a **single icon registry**. Visual reference of record for this phase: the approved preview artifact (https://claude.ai/code/artifact/1d66b5ba-e9fb-475e-b38d-26650de9f187) — every specimen there was rendered with live Instrument token values.

## Decisions (locked with user)

1. **Born in the package**: unified components are built directly in `@tickets/ui` (with demos + playgrounds), web call sites are refactored to them, and the old duplicates are deleted. This organically starts P3 (moving primitives into the package).
2. **Primitive tier only**: Pill, Tabs, SegmentedControl, Meter, ScreenState, Spinner, CopyButton + small set (DialogFooter, RailLabel, SectionHeader). Screen-tier merges (FilterChips, DataTable, SessionList⟨T⟩, signals toolbars) are the next phase.
3. **Replace everywhere**: old components (StatusBadge, TypeBadge, OptionChip, SessionStatusPill, signals StatusChip, KindGlyph, spinners, ad-hoc chips/tabs/meters/empty-states) are **deleted**; every call site uses the new primitives directly with explicit props. No wrappers.
4. **One place for colors**: the token JSON is the single source. `build-tokens.mjs` additionally generates a `Tone` union + shared tone→class map. Adding a color = one JSON edit; every component's `tone` prop picks it up with zero component edits.
5. **One place for icons**: a single glyph registry. `IconName = keyof registry`; registering a glyph once makes it valid for every icon prop everywhere. Icons are **colorless by default** (`currentColor`), have **no baked-in animation**, are sized in **pixel numbers**, and are named by **what they draw, not where they're used**.
6. **The `kind-*` color family is retired**: statuses have no colors of their own at the library level. The five kind token families (20 pairs) are deleted from the token JSON; board status colors shift slightly (e.g. active `#2e6fcc` → blue `#2a5dae`). Accepted.
7. **`@tickets/ui` is 100% domain-free**: no `kindTone`, no `sessionStatus`, no knowledge of tickets/sessions/errors in the package. Each app keeps its own single mapping module (e.g. `apps/web/src/domain/status.ts`) so a status→tone decision is still written exactly once — in the app.

## Foundation 1 — Tone system

**Pipeline** (extends the existing token pipeline; same markers/verify discipline):

```
packages/web/ui/tokens/*.json      ← add/edit colors HERE only
        │  node build-tokens.mjs
        ├→ src/tokens.css           --ins-* vars + @theme --color-* (as today, minus kind-*)
        └→ src/tones.generated.ts   NEW: Tone union + TONES map (committed, verified)
```

**Tone vocabulary** (all generated from JSON):

- Semantic roles: `primary` (accent), `secondary` (ink-2), `success` (green), `warning` (orange), `danger`, `neutral` (ink-3/inset). Aliases are declared in the JSON (a tone entry referencing another family) — no duplicated hex values.
- Hues (the old `opt-*` palette, addressed by plain names): `red orange yellow green teal cyan blue indigo purple pink gray`.

**Emphases**: every tone resolves in four emphases via one shared map — `subtle` (tinted bg + toned text, the default), `solid` (toned bg + `on-*` text), `outline` (toned 1.5px border + toned text), `text` (toned text only). Hover pairs come from the existing `-hover` tokens where a component needs them.

**Implementation shape**: `tones.generated.ts` exports `type Tone`, `const TONE_NAMES`, and `toneClasses(tone, emphasis) → string` returning **literal Tailwind class strings** (e.g. `'bg-opt-green-subtle text-opt-green'`). Literals must live in the generated file because Tailwind cannot scan dynamically-built class names; the file sits under `src/` so the existing `@source './'` covers it. Generated file is committed; `tokens:verify` gains a check that it is in sync (same build+diff discipline as tokens.css). CSS var names (`--ins-opt-*`) stay as-is — only the *TypeScript-facing* names are friendly (`green` ↔ `opt-green` mapping lives in the generator).

**kind-\* retirement**: the 5 kind families are removed from the JSON, `tokens.css`, and the `@theme` block. Every `kind-*` class usage in web is migrated to the corresponding hue/semantic tone during the component migrations (the Pill/board sweep covers nearly all of them). `SWATCHES` and the scanner/ratchet baselines are updated accordingly.

## Foundation 2 — Icon

**Registry**: `packages/web/ui/src/icons/registry.tsx` — one entry per glyph: `{ viewBox, node }` (16×16 viewBox, strokes/fills use only `currentColor`). `export type IconName = keyof typeof registry`.

**Rules**:
- **Colorless**: no color values in glyph markup. Unset `tone` → the icon inherits the surrounding text color.
- **No baked-in animation**: spinning/pulsing exists only via the `animate` prop (reuses the existing `ai-spin`/`ai-pulse` keyframes).
- **Shape-descriptive names**: `circle`, `circle-half`, `circle-dot`, `circle-dashed`, `circle-check`, `circle-x`, `circle-info`, `diamond`, `square`, `dot`, `arc`, `triangle-alert`, chevrons/arrows, `plus x check search copy pencil trash filter refresh grip ellipsis eye`, `columns rows folder file terminal sliders calendar clock tag user link`, … Duplicated drawings collapse: KindGlyph's active shape and the spinning half-disc are both `circle-half`; `kind-todo`/disconnected-ring are `circle`; `kind-dropped`/interrupted are `circle-dashed`.
- **Seeded by sweep**: implementation starts with a sweep of every SVG in `apps/web` (the audit's 7 rendering techniques); each distinct drawing gets one registry entry under a shape name. The ~42 glyphs in the preview are the expected floor, not a cap.

**Component** `<Icon />`:

| prop | type | default |
|---|---|---|
| `name` | `IconName` | required |
| `size` | `number` (px) | `14` |
| `tone` | `Tone` | unset → `currentColor` |
| `animate` | `'spin' \| 'pulse'` | unset → static |
| `label` | `string` | unset → `aria-hidden` |
| `className` | `string` | — |

**Deleted by this foundation**: `KindGlyph`/`KindIcon` (all 6 colored-map copies), the six StatusDot implementations (a status dot is `<Icon name="circle-half" tone="blue" animate="spin" />`), `SessionKindGlyph`-style one-offs, every inline `<svg>` in components that the registry covers.

## Primitives

All are built in `packages/web/ui/src/`, each with tests, a `.demo.tsx` (meta + states), and a playground. All color via `tone` + the shared map; all glyphs via `IconName`. Props tables below are the contract (the preview artifact shows each rendered).

### Pill — replaces ~25 sites, 5 components deleted

The unified badge/chip shell: `h-5.5 px-2.25 rounded-md text-meta font-medium`, gap 1.5.

| prop | type | default |
|---|---|---|
| `label` | `ReactNode` | required |
| `tone` | `Tone` | `'neutral'` |
| `emphasis` | `'subtle' \| 'solid' \| 'outline' \| 'text'` | `'subtle'` |
| `icon` | `IconName \| ReactElement` | unset (element form for animated icons) |
| `shape` | `'md' \| 'full'` | `'md'` |
| `trailing` | `ReactNode` | unset (exit codes, counts) |
| `strikethrough` | `boolean` | `false` |
| `onClick` + `pressed` | `() => void` · `boolean` | unset → `<span>`; set → `<button aria-pressed>` |
| `className` | `string` | — |

Deletes: `status-badge.tsx`, `type-badge.tsx`, `option-chip.tsx`, `session-status-pill.tsx`, signals `status-chip.tsx`, plus the ad-hoc chip sites (ArchChip ×4, AppSlug ×4, EntryPill, DirectionChip ×2, prefix/key chips ×6, AGENT badge, ValueChip, HttpStatusChip, TagPill, AgentBadge, PermissionBadge, tools chip, toggle pills ×5). The pulsing "awaiting input" pill is `tone="orange" emphasis="solid"` + an `animate="pulse"` diamond icon (pulse on the pill via className from the app map).

### Tabs — replaces 8 sites, 3 dialects

| prop | type | default |
|---|---|---|
| `variant` | `'underline' \| 'pill' \| 'rail'` | `'underline'` |
| `items` | `{ value, label, icon?, badge? }[]` | required |
| `value` / `onChange` | `string` / `(v: string) => void` | required |

Real `role="tablist"`/`tab`/`aria-selected` semantics (most current sites lack them). Replaces view-tabs, all-items strip, item-detail tabs, settings rail, fields/workflow pill tabs, stack-trace tablist, new-app-dialog tabs, apps-screen nav. The playground's own ComponentPage tabs adopt it too (fixes the P3 tablist-aria carry-forward).

### SegmentedControl — replaces 4 sites

| prop | type | default |
|---|---|---|
| `options` | `{ value, label?, icon? }[]` | required (icon-only, label-only, or both) |
| `value` / `onChange` | `string` / `(v: string) => void` | required |

Inset track, raised active thumb with `shadow-sm`. Replaces the copied `segmentClasses` in board-header ×2, all-items, signals issues-toolbar.

### Meter — replaces 5 sites

| prop | type | default |
|---|---|---|
| `value` | `number` | required |
| `max` | `number` | `100` |
| `tone` | `Tone` | `'primary'` |
| `warnAt` · `dangerAt` | `number` | unset — fill switches to warning/danger tone at threshold |
| `label` / `trailing` | `ReactNode` | unset |

Replaces cost-meter and context-meter internals (the ≈85% warning behavior becomes `warnAt`), table ProgressCell, detail-children bar, projects-home bars.

### ScreenState — replaces 9 sites (6× verbatim)

| prop | type | default |
|---|---|---|
| `title` | `ReactNode` | required |
| `icon` | `IconName` | unset |
| `tone` | `Tone` | `'neutral'` |
| `body` / `action` | `ReactNode` | unset |

Centered icon-disc/title/body/action block. Replaces the six verbatim signals error+Retry blocks, table empty states ×2, workflow/panel empties.

### Spinner — replaces 4 sites

A preset of `<Icon name="arc" animate="spin" />`. Props: `size: number = 14`, `tone: Tone = 'primary'`. Replaces the three signals spinners and Button's private spinner markup (Button consumes Spinner).

### CopyButton + useCopy — replaces 2 sites

Props: `value: string` (required), `label = 'Copy'`, `copiedLabel = 'Copied'`, `resetMs = 1500`. `useCopy(resetMs?) → { copied, copy }` exported bare. Replaces the dsn-field and session-screen copy machines.

### Small set

- **DialogFooter** — `children`, `onCancel?`, `cancelLabel = 'Cancel'`; Cancel is always the ghost variant (ends the ghost-vs-secondary drift across 5 dialogs).
- **RailLabel** — `children`; the uppercase mono rail label (×6 sites).
- **SectionHeader** — `title`, `count?`, `action?`; title · count · action row (×4 sites).

## App-side mappings (outside the library)

Each app owns one mapping module per domain; nothing else in the app may declare a status→tone/icon decision:

- `apps/web/src/domain/status.ts` — `statusPill(kind) → { tone, icon }` for ticket statuses (todo→gray/circle, active→blue/circle-half, blocked→orange/diamond, done→green/circle-check, dropped→gray/circle-dashed + strikethrough).
- `apps/web/src/domain/session-status.ts` — `sessionStatus(status, kind?) → { tone, icon, animate?, emphasis?, label }` covering the nine session states (incl. terminal label overrides and exit-code trailing handled at the call site).
- `apps/web/src/domain/signal-status.ts` — the signals issue-status mapping.

These are plain data modules with unit tests; call sites spread them into primitives (`<Pill {...statusPill(s)} label={label} />`).

## Migration mechanics ("replace everywhere")

Per cluster, in one task: build the primitive TDD-first in the package (component + tests + demo + playground) → migrate **every** call site in `apps/web` → delete the old component files, their tests, and their demos → update the demo-coverage ratchet allowlist (old names out, new demo required). Old visual truth comes from the existing rendered components and `docs/design/design-system.html`; the ScreenState empty-state card additionally checks the design project's EmptyState card. Web tests that asserted old component internals are rewritten against the new primitives, never weakened. `eer` is untouched (its P6 migration lands directly on these primitives).

Sequencing (leaf-first; one commit per task):

1. **Tones** — generator extension, `tones.generated.ts`, aliases, verify hook. (kind-* stays temporarily.)
2. **Icon** — SVG sweep, registry, `<Icon>`, delete KindGlyph + dot implementations as their consumers migrate.
3. **Pill** — the big sweep; migrates most `kind-*` class usages.
4. **kind-\* removal** — delete the families from JSON/tokens.css/@theme, migrate stragglers, update SWATCHES + scanner baselines.
5. **Tabs**, 6. **SegmentedControl**, 7. **Meter**, 8. **ScreenState**, 9. **Spinner + CopyButton**, 10. **Small set**, 11. **Final sweep** — grep-verify no old component names, no `kind-` classes, no inline SVGs outside the registry; browser pass both themes; deploy.

## Testing & gates

- Standard battery green at every task: `pnpm typecheck` (18 projects), ui/playground/web test suites, `pnpm build`, `tokens:verify` (now also covering `tones.generated.ts` sync).
- New units: tone map resolution (every tone × emphasis produces classes; alias resolution), Icon (registry completeness, size/tone/animate/label rendering, aria-hidden default), each primitive's state matrix, each app mapping module.
- Demo-coverage ratchet: every new primitive has a demo; deleted components' demo entries removed in the same commit.
- Browser verification on the workbench (:4650) and the app (:4620/:4610): both themes, tone matrix page, icon registry page, migrated screens (board, all-items, settings, sessions, signals).

## Out of scope

Screen-tier merges (FilterChips, DataTable, SessionList⟨T⟩, SessionPanel, signals toolbars — next phase); eer retokenization (P6); moving the remaining untouched `src/ui` primitives (P3 continues after); design-project re-push (done at the phase boundary per syncing-design, including updating `docs/design/design-system.html` for the retired kind colors); publishing SDKs.
