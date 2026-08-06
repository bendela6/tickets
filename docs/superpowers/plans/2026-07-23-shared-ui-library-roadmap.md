# @tickets/ui Shared Component Library — Master Roadmap

> **For agentic workers:** This is the HIGH-LEVEL master plan. Do not execute it directly. Before starting a phase, write a detailed task plan for that phase with `superpowers:writing-plans` (bite-sized steps, full code), then execute via `superpowers:subagent-driven-development`. Each phase below defines scope, ordering, and exit criteria only.

**Goal:** One shared, generic, configurable component library (`packages/ui`, published in-workspace as `@tickets/ui`) used by every React app in the monorepo (web, eer, future apps), with a component gallery as the living reference, and the Instrument tokens as the single styling source of truth.

**Architecture:** Extract tokens first (everything depends on them), then scaffold the package + gallery, then move the 30 existing primitives with API normalization, then land the ranked de-duplication merges, then build the missing primitives from their design cards, and finally retokenize + migrate eer. Code stays canonical; the claude.ai/design project is re-pushed at phase boundaries via design-sync.

**Tech stack:** React 19, TypeScript, Tailwind v4 (`@theme`, preflight ON), Radix primitives where already used, vitest + testing-library, pnpm + turbo workspace.

**Evidence base:** Audit report artifact <https://claude.ai/code/artifact/81d0ef82-564a-4b4c-8de7-a4748f5606b8> (2026-07-23, six-agent audit; every claim has file:line refs).

## Global constraints

- Conventional commits scoped by package: `feat(ui): …`, `refactor(web): …`; one commit per task/component.
- No visual regressions in web during phases 1–3: screens must render pixel-identical until a merge task deliberately changes them. Verify by `pnpm typecheck`, `pnpm --filter @tickets/web test`, `pnpm build`, and screenshot spot-checks of /gallery + one screen per area.
- The twMerge trap: the shared `cn` must register the **union** of custom font-size groups (`ui,meta,label` + eer's `3xs,2xs`) or color classes get silently dropped next to text-size tokens (see memory `preflight-off-control-gotchas`).
- `docs/design/design-system.html` stays the spec of record — any pull from the design project updates it in the same task; push the library back to the design project at each phase boundary (`syncing-design` skill).
- Project skills are mandatory per component: `tokenizing-the-design`, `mapping-component-states`, `implementing-a-component`, `verifying-a-component`.
- Deploy to :4610 (`docker compose up -d --build`) only at phase boundaries.

---

## Phase 1 — Tokens package (the foundation)

Everything else depends on this. No component work until it's green.

Scope:
1. Scaffold `packages/ui` (package.json `@tickets/ui`, tsconfig, vitest, exports map with subpaths `./tokens.css`, `./cn`, later `./<component>`).
2. Move `apps/web/src/styles/instrument.css` → `packages/ui/src/tokens.css`; web imports it from the package. Zero value changes in this step.
3. Add the new tokens from audit §1, each as its own commit so regressions bisect cleanly:
   - type scale: `text-nano` 9, `text-micro` 10, `text-body` 14, `text-title` 16, `text-heading` 18–20, `text-display` 22–24 (normalize half-px sizes onto the scale)
   - radii: `radius-xs` 4, `radius-sm` 6, `radius-xl` 10
   - `border-hair` 1.5px, `ring-focus` 3px, tracking set, z scale (`z-sticky` 10, `z-scrim` 40, `z-overlay` 50)
4. Shared `cn` with union font-size registration (+ port `cn.test`), shared `variants`, shared `runtime-style` (from eer).
5. Fix the two token-adjacent bugs found: stale `.rt` "raw colors" comment; `SWATCHES` hex arrays (×2) become a token-derived export from the package.

Exit criteria: web builds and all web tests pass with tokens served from the package; eer untouched; new tokens exist but nothing consumes them yet.

## Phase 2 — Gallery workbench

Decision already leaned: hand-rolled gallery promoted into the package, not Storybook.

Scope:
1. Demo-file convention: each component ships `<name>.demo.tsx` beside it (title, states grid — driven by `mapping-component-states`).
2. Tiny vite dev app in `packages/ui` (`pnpm --filter @tickets/ui dev`) rendering all demos with theme toggle.
3. web's `/gallery` route becomes a thin re-export of the package demos (route stays, content moves).
4. Demos remain the screenshot source for design-sync `@dsCard` pushes.

Exit criteria: gallery runs standalone from the package; web /gallery renders the same content; existing gallery sections all ported.

## Phase 3 — Move the 30 primitives + API normalization

Write the normalization spec first (one page, part of this phase's detailed plan), then move components leaf-first, one commit each, updating web imports per component.

The normalization contract (from audit §2):
- one change-callback convention: `onChange(value | null)` for custom controls; native event for native controls; `onValueChange` retired
- one size vocabulary: `compact / regular / touch` everywhere it makes sense; Avatar joins it
- `invalid` + ref forwarding + `className` passthrough on every form control and visual primitive
- children over required `label:` (keep `label` as optional convenience); aria-only variants for Checkbox/Switch
- unify control archetype: `rounded-ctrl`-family radius + `text-ui` for all field controls (Input/Textarea/DatePicker align to the selects)
- replace raw `z-40/z-50`, `ring-[3px]`, `border-[1.5px]`, off-scale `text-[Npx]`, arbitrary radii with phase-1 tokens
- rebuild the badge family shells on `variants()` (finally using it); rename to kill the `KindGlyph` collision
- add the 7 missing test files (textarea, field-label, field-error, type-badge, option-chip, kind-glyph, combobox-list)

Order: cn/variants (done in P1) → display atoms (badges, chips, glyphs, item-key, relative-date, avatar) → form controls (button, input, textarea, number-input, checkbox, switch, radio-group, field-label+hint, field-error) → overlays (tooltip, popover, menu, dialog, toast) → pickers (combobox-list, combobox, multi-combobox, status-select, date-picker, directory-tree) → session pieces.

Exit criteria: `apps/web/src/ui` is deleted; all web imports point at `@tickets/ui`; typecheck/tests/build green; gallery shows every moved component; deploy + design-sync push.

## Phase 4 — De-duplication merges (extract from screens)

Land in audit-ranked order; each merge is: build shared component in `packages/ui` (TDD, demo file) → swap call sites → delete duplicates.

1. `FilterChips` + `FilterBuilderPopover` (collapses the two ~85%-identical files, ~200 lines)
2. `DataTable` + `Pagination` + `ColumnsMenu` (6 hand-built tables, 3 paginations, 2 column pickers)
3. `SessionList<T>` + `SessionPanel` (agent/terminal pair + both shell panels)
4. `ScreenState` / `EmptyState` (kills the 6× verbatim error/Retry block)
5. `SegmentedControl`, `Tabs` (underline|pill|rail), `Pill` shell, `Meter`, signals `ToolbarShell`
6. Small set: `Spinner`, `Chip` (ArchChip/AppSlug/HttpStatus/AgentBadge/TagPill/prefix), `StatusDot` (unifies 6 dot impls), `DialogFooter` (fixes Cancel-variant drift), `CopyButton`/`useCopy`, `GhostInput`/`InlineEditable`, `KindIcon`, `RailLabel`, `SectionHeader`, `Panel`, `ProgressBar` (alias of Meter), `Skeleton`
7. Shared utils: `slugify`, `isPastDate`, `StatusCell`, `workdirName`, option-color map

Exit criteria: audit's repeated-patterns table reads 1 implementation per pattern; screens visually unchanged except deliberate consistency fixes noted in commits.

## Phase 5 — Build the missing primitives (design-card driven)

Pull each design card first (design-sync), update `docs/design/design-system.html`, then implement via `implementing-a-component`.

- `Select` (styled native — 14 raw `<select>`s waiting) — Select.dc.html
- `Icon` (consolidate ~15 glyph concepts / 7 rendering techniques) — Icon.dc.html
- `Text` (typography primitive on the phase-1 type scale) — Text.dc.html
- `ListShell` (list-screen scaffold) — ListShell.dc.html
- `ColorSwatchInput` (settings ×2 + eer ×4)
- `PathPicker` composite over DirectoryTree — PathPicker.dc.html
- Primitive upgrades deferred from P3 if any remain: Toast severity/duration, Dialog width + confirm loading, Avatar image, DatePicker min/max

Exit criteria: every design-project component card has a code counterpart in the gallery; design-sync push includes the full library.

## Phase 6 — eer retokenization + migration

Prerequisite acknowledged as the audit's blocker; do not start before P3.

1. eer adopts `@tickets/ui/tokens.css` (semantic classes; gains light theme). Resolve `shadow-lg` collision and text-scale naming during the swap. Diagram canvas keeps its `mix()` machinery, pointed at token vars.
2. Run the audit's migration table: promote Kbd/Section/Stat/Dot/Tabs; `btn`→`Button` (~15 sites); `field/label/errorRow/iconBtn` strings → Input/FieldLabel/FieldError/Button icon; Badge/RoleTag/Card → Pill/Chip; `Modal`→`Dialog` (~8 call sites, handle `size:'wide'`); ModelMenu discard bar → ConfirmDialog.
3. Decide `ErrorBanner`: keep app-local restyled (default) or add persistent Toast variant.
4. Delete `apps/eer/src/ui` except `color-mix.ts`.

Exit criteria: eer renders on Instrument tokens in both themes; no hand-rolled primitive remains outside the diagram canvas and domain editors.

## Phase 7 — Rich text + AI sub-entries, wrap-up

1. Move `apps/web/src/components/rich-text/*` UI → `packages/web/ui/rich-text` (or into `packages/web/richtext` beside its logic — decide at phase start); rebuild `Suggestions` on ComboboxList/Popover; replace the 2 raw textareas.
2. `@tickets/ui/ai`: MessageStream, PromptComposer, CostMeter/ContextMeter (on Meter), ProviderPicker, StackTrace.
3. Final design-sync push, deploy, update CLAUDE.md (package map + stale redesign section), close-out commit.

---

## Sequencing summary

P1 → P2 → P3 are strictly serial. P4 and P5 can interleave after P3 (P4 items are independent of each other; run subagent-per-merge). P6 needs P3 (+P5's Select/ColorSwatchInput for full coverage). P7 last.

## Risks

- **twMerge font-size trap** — mitigated by union `cn` in P1 and a test asserting color+size class coexistence.
- **Silent visual drift during P3 moves** — mitigated by move-then-normalize as separate commits and gallery screenshot checks per component.
- **eer dark-only assumptions** — components may encode dark-ground contrast; P6 needs a light-theme pass of every eer surface.
- **xterm theme + GROUP_PALETTE** — legit hex exceptions; document them as such so future lint gates skip them.
