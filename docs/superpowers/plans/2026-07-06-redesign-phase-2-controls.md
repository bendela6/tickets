# Redesign Phase 2 — Overlays & Complex Controls Implementation Plan

> **For agentic workers:** executed inline via a self-paced `/loop`. TDD, commit after each task, keep TIX-90 in sync. Steps use checkbox (`- [ ]`) tracking.

**Goal:** Build the Instrument overlay family and complex form controls on `radix-ui`, then rewire the field-renderer registry (`src/registry/`) onto them so every dynamic field renders/edits through the new control library.

**Architecture:** New controls live in `apps/web/src/ui/`, one per file + colocated `.test.tsx`, composed from the Phase-1 primitives (`cn`, Button, Input, OptionChip, StatusBadge, KindGlyph) and `radix-ui` namespaces. The combobox is hand-built on `Popover` (no combobox lib). The field registry (`field-widget.tsx` editable + `get-cell-content.tsx` read) is migrated off inline-styled native controls onto these.

**Tech stack:** React 19, TS 6, Tailwind v4 (Instrument tokens), `radix-ui@^1.6.1`, vitest + Testing Library.

**Design refs:** `docs/design/design-system.html` §07 inputs, §08 selects (single/multi/status), §09 date picker, §10 checkbox/switch/radio (done in P1), §11 markdown editor, §13 overlays. Verify on local vite `http://localhost:4610/gallery` (proxies API 4600).

## Global constraints

- Backend/DB is dockerized (postgres + api 4600); dev is local vite on 4610. Do NOT kill `turbo dev`; the servers are already up (tasks may need restart if HMR misses new routes — restart the specific vite task only).
- Every control: keyboard-navigable, visible focus (3px accent halo), WCAG AA both themes, ≥40px touch targets; nothing native-looking.
- radix usage: `import { Popover, DropdownMenu, Dialog, Tooltip, Toast } from 'radix-ui'` → `<Popover.Root>` etc. Style `*.Content` with `bg-raised border border-hairline rounded-card shadow-sm`, portal by default.
- Commit after each task: `git add apps/web/src/ui && git commit -m "feat(web): <control>"`. Typecheck (`pnpm --filter @tickets/web typecheck`) + tests (`pnpm --filter @tickets/web test`) green before commit.

## Tasks (each = one control + tests + gallery entry + commit)

- [ ] **T1 — Popover** `ui/popover.tsx`: re-export `Popover.Root/Trigger/Anchor/Portal/Close` + a styled `PopoverContent` (panel look, `sideOffset=6`, `collisionPadding`). Produces the surface every other overlay/combobox sits on.
- [ ] **T2 — Combobox (single)** `ui/combobox.tsx`: searchable single-select on Popover. Props `{ options: {value,label,color?}[], value, onChange, placeholder?, size?, disabled?, clearable? }`. Trigger shows selected `OptionChip`/label + chevron + clear ×; panel = search Input + filtered roving-focus list (↑↓/↵/esc, type-to-filter), selected ✓. Colored options render `OptionChip`.
- [ ] **T3 — Combobox (multi)** `ui/multi-combobox.tsx`: same base; trigger shows selection chips (each removable ×) + `+N` overflow; panel adds Select all / Clear (N); count summary when collapsed.
- [ ] **T4 — StatusSelect** `ui/status-select.tsx`: workflow-aware single select. Props `{ statuses: {key,label,kind}[], legalTargets: string[], value, onChange, hiddenCount? }`. Groups options by kind (label header), kind-colored via `StatusBadge`, illegal targets omitted, footer "N statuses hidden by workflow". Built on Combobox internals.
- [ ] **T5 — DropdownMenu** `ui/menu.tsx`: styled `DropdownMenu` — `Menu`, `MenuTrigger`, `MenuContent`, `MenuItem` (with optional `shortcut` kbd slot + `destructive`), `MenuSeparator`.
- [ ] **T6 — Tooltip** `ui/tooltip.tsx`: `TooltipProvider` (delayDuration 300) + `Tooltip` convenience `{ content, children }` → styled dark content.
- [ ] **T7 — Dialog** `ui/dialog.tsx`: styled overlay+content (`DialogRoot/Trigger/Content/Title/Description/Close`) + `ConfirmDialog` helper `{ open, onOpenChange, title, body, confirmLabel, destructive?, onConfirm }` (mirrors the "Archive CORE-128?" exhibit).
- [ ] **T8 — Toast** `ui/toast.tsx`: `ToastProvider` + `useToast()` returning `toast({ title, action? })`; styled viewport bottom-right; used for "Saved to view … · Undo".
- [ ] **T9 — DatePicker** `ui/date-picker.tsx`: Popover + month calendar grid (prev/next, week headers, day cells, today ring, selected accent), manual `YYYY-MM-DD` entry, ISO string value; plus `RelativeDate` display component ("in 7 days" / "3 days ago" / "overdue 2d") with exact date tooltip.
- [ ] **T10 — NumberInput** `ui/number-input.tsx`: Input + ▲▼ steppers, min/max/step, compact size for cells.
- [ ] **T11 — MarkdownEditor restyle** `components/markdown-editor.tsx` → Instrument look: Write/Preview tab pair, mono write surface, prose preview (reuse `lib/render-markdown.ts`), B/I/</>/link toolbar affordances.
- [ ] **T12 — Rewire registry + gallery + verify** `registry/field-widget.tsx` (editable) onto Combobox/MultiCombobox/StatusSelect/DatePicker/NumberInput/MarkdownEditor/Checkbox; `get-cell-content.tsx` read cells onto `OptionChip`/`StatusBadge` (drop `ValueBadge`). Add all controls to `/gallery`. Screenshot-verify both themes vs design §07–13. Typecheck + full test suite green.

## Notes for the registry rewire (T12)

- `field.type` → control: `text`→Input/Textarea, `text+widget=markdown`→MarkdownEditor, `number`→NumberInput, `date`→DatePicker, `boolean`→Checkbox, `json`→Textarea(mono, JSON-validated as today), `select`→Combobox, `multi_select`→MultiCombobox, `status`→StatusSelect (targets from `legalStatusTargets(board, indexes, ticket)`).
- Options carry `config.color` (hex today). Map hex→nearest `OptionColor` name, or extend OptionChip to accept a raw hex fallback. Prefer: add an optional `hex` prop path so existing colored options keep working; the settings UI (Phase 6) will migrate options to palette-name colors.
- `get-cell-content` status mark: `done`/`dropped` already flagged; switch to `StatusBadge kind={status.kind}`.

## Done when

All 12 tasks committed, TIX-90 fixed, gallery shows every control in both themes matching the design, typecheck + tests green. Then loop advances to Phase 3 (TIX-91, app shell + home) — the first phase that replaces real screens.
