# UI Library — Foundations & Component Taxonomy

Grouped by atomic design. `*` = commonly missed · `⊃` = family root, includes listed variants.

---

## 1. Subatomic — Design tokens

No markup. Consumed by every level above.

### Token tiers

| Tier | Example | Who consumes it |
|---|---|---|
| Primitive | `--blue-500`, `--space-4` | Semantic tier only — never components |
| Semantic | `--color-surface-raised`, `--color-fg-muted`, `--color-border-danger` | Components |
| Component | `--button-height-md` | One-off overrides, escape hatch from forking |

### Scales

- Color — OKLCH ramps (perceptually even lightness steps, predictable contrast)
- Space — 4px base
- Radius
- Border width
- Shadow / elevation
- Z-index layers — named: `dropdown`, `overlay`, `toast`, `tooltip`
- Motion — duration + easing pairs, `prefers-reduced-motion` override
- Breakpoints
- Typography — size + line-height as **paired** tokens, never independent scales

### Global conventions

- Size scale (`sm|md|lg`) with identical control heights across all form controls
- Density mode (`compact|comfortable`) as a token swap
- Theme switching via `[data-theme]` attribute — CSS variables, not React context
- RTL / direction support
- Focus-visible ring token, applied uniformly
- Event naming: `onValueChange` / `onOpenChange`, consistently

---

## 2. Off-ladder — Providers, primitives, hooks

Mechanism, not UI. Atomic design has no slot for these — keep them in a separate package.

### Providers

Theme · Locale/Intl\* · Direction · Portal container · Toast · Confirm\* · Hotkey scope\* · DnD\*

### Behavior primitives

Slot / `asChild` · Portal · Presence · FocusScope · DismissableLayer · RovingFocusGroup · Collection · VisuallyHidden · ScrollLock · LiveRegion\*

### Hooks

`useControllableState` · `useMergedRefs` · `useId` · `useFloating` · `useMediaQuery` · `useResizeObserver` · `useIntersectionObserver`\* · `useVirtualizer` · `useAnnouncer` · `useClipboard`\* · `useHotkeys`\* · `useDebouncedValue`\* · `useUnsavedChangesGuard`\* · `usePrefersReducedMotion`\*

### Utilities

Variant engine (CVA / tailwind-variants) · `cn` · icon system

---

## 3. Atoms

Indivisible. No internal state worth naming, no composition.

- **Button** ⊃ default, icon-only, toggle, loading, link-styled, split\*, group
- **Typography** ⊃ Text, Heading, Code, Kbd, Truncate/clamp\*, Highlight\*
- **Link**
- **Icon**
- **Badge** ⊃ status, count, removable tag/chip, status dot\*
- **Avatar** ⊃ initials fallback, image, group, presence indicator\*
- **Progress** ⊃ linear, circular, indeterminate (spinner)
- **Skeleton**
- **Separator**
- **AspectRatio**
- **Image**\* ⊃ lazy, fallback, blur-up
- **Timestamp**\* ⊃ absolute, relative, timezone-aware, duration
- **FormattedValue**\* ⊃ number, bytes, percent, currency
- **Layout** ⊃ Box, Flex/Stack, Grid, Container
- **Table primitives** ⊃ `Table`, `Thead`, `Tr`, `Th`, `Td`

---

## 4. Molecules

Two or more atoms with one job. Little or no async, shallow state.

- **Field** ⊃ label, description, error, required marker, character count\*, hint — the contract every input plugs into
- **Input** ⊃ text, password (reveal + strength\*), search, number w/ steppers, masked\*, textarea w/ autosize, addons/prefix/suffix, PIN/OTP, tags, mentions\*
- **Checkbox** ⊃ single, indeterminate, group, card-style\*
- **Radio** ⊃ single, group, card-style\*
- **Switch**
- **ToggleGroup** ⊃ segmented control, single/multi select
- **Slider** ⊃ single, range, marks\*
- **Rating**\*
- **ColorPicker**\* ⊃ swatch, full picker
- **Card** ⊃ basic, media, KPI/metric card
- **Stat** ⊃ value, delta/trend, sparkline\*
- **DescriptionList**
- **Callout** ⊃ alert, inline banner, page banner, system announcement bar\*
- **EmptyState** ⊃ no data, no results, no permission, error, offline\*
- **Tooltip**
- **Breadcrumb** ⊃ overflow collapse\*
- **Pagination** ⊃ numbered, cursor\*, load-more\*
- **Stepper** ⊃ horizontal, vertical, progress
- **Disclosure / Collapsible**
- **ScrollArea** ⊃ custom scrollbar, scroll shadows\*
- **CopyButton**\*
- **Sticky / Affix**\*

---

## 5. Organisms

Self-contained, stateful, usually portalled, virtualized, or async. Where the accessibility work lives.

### Overlays

- **Dialog** ⊃ modal, drawer/sheet, alert, confirm, imperative `confirm()`\*
- **Popover** ⊃ popover, hover card, popconfirm
- **Menu** ⊃ dropdown, context, menubar, submenus, checkbox/radio items
- **Toaster** ⊃ queue, promise toasts\*, undo action\*
- **CommandPalette**
- **ProductTour / Coachmark**\*
- **Lightbox / MediaViewer**\*

### Data entry

- **Combobox / Select** ⊃ single, multi, async, creatable, grouped, virtualized
- **TreeSelect / Cascader**\*
- **TransferList**\* — dual-list picker
- **DatePicker** ⊃ inline Calendar, date, range, time\*, datetime\*, presets
- **FileUpload** ⊃ dropzone, file list, progress, image crop\*
- **Form** ⊃ validation binding, field arrays\*, sections\*, sticky action bar\*, unsaved-changes guard\*, autosave indicator\*
- **Editor**\* ⊃ rich text, markdown, code (Monaco / CodeMirror)

### Data display

- **Table / DataGrid** ⊃ sort, filter, selection, row expansion, column pin/resize/reorder, sticky header, virtualization, inline edit\*, footer aggregations\*
- **Table controls**\* ⊃ column manager, density toggle, export menu, saved views
- **VirtualList / InfiniteScroll**\*
- **SortableList / DnD**\*
- **Tree** ⊃ selection, drag-reorder\*
- **Timeline / ActivityFeed**
- **Charts** ⊃ line, bar, area, pie, sparkline, gauge\*, heatmap\* — tokenized wrapper
- **CodeBlock**\* ⊃ syntax highlight, line numbers, copy
- **JSONViewer**
- **DiffViewer**
- **LogViewer** ⊃ virtualized, follow-tail, search/highlight, ANSI\*

### Navigation & structure

- **Tabs** ⊃ scrollable overflow\*, closeable\*, vertical
- **SideNav** ⊃ collapsible, nested, active state
- **Toolbar** ⊃ overflow menu\*
- **Accordion**
- **ResizablePanels**
- **Carousel**\*

### Domain

- **FilterBuilder** ⊃ nested AND/OR, filter chips, saved views
- **BulkActionBar**
- **PermissionMatrix**
- **NotificationCenter**\*
- **ResultState**\* ⊃ 403, 404, 500, offline, maintenance, ErrorBoundary fallback

---

## 6. Templates

Structure and slots, no real data. Where most design systems stop shipping and shouldn't.

- **AppShell** ⊃ header, sidenav, content, toast root, portal container
- **ListPage** ⊃ filter bar → table → bulk actions → pagination
- **DetailPage** ⊃ header, tabs, panels
- **SplitView** — master–detail
- **SettingsLayout**
- **WizardLayout**
- **ModalFormLayout**
- **DashboardGrid**
- **AuthLayout**\*
- **FullScreenEditorLayout**\*

---

## 7. Pages

Instances of templates with real data, real permissions, real empty states. **Not library-owned** — these live in the app.

---

## Appendix A — Merge decisions

| Merged | Into | Rationale |
|---|---|---|
| Spinner | Progress | Same semantics, different render |
| Tag / Chip | Badge | `removable` prop |
| ErrorState | EmptyState | One component, different illustration + action slot |
| Textarea | Input | Identical Field integration and sizing |
| IconButton, ToggleButton | Button | Variant, not a separate component |

**Deliberately not merged:** Tooltip stays separate from Popover — different ARIA role, different trigger model. Merging them is where teams accidentally ship inaccessible tooltips.

---

## Appendix B — Classification edge cases

**Compound components span levels.** `Dialog` is an organism but `Dialog.Title` is an atom. Classify by the root export, keep subcomponents with their parent, don't split them across packages.

**Select / Combobox is borderline.** A native-backed thin wrapper is a molecule; a portalled listbox with typeahead and virtualization is an organism. Pick one implementation rather than shipping both under one name.

---

## Appendix C — Build order

1. Tokens + variant engine + `cn` + Field contract + Slot / Portal / DismissableLayer
2. Button, Input, Select, Checkbox, Field — proves the size/density scale holds
3. Dialog, Popover, Menu, Toaster — proves the layering and portal model holds
4. Table + Combobox — proves the whole thing is real

Steps 1–3 land before anyone builds a feature on it. Getting the token tiers and Field contract wrong costs a rewrite; getting a Badge variant wrong costs ten minutes.

---

## Appendix D — Review bar by level

| Level | Reviewer | Required gates |
|---|---|---|
| Atoms, Molecules | Any frontend dev | Storybook story, visual regression snapshot |
| Organisms | + accessibility owner | Keyboard walkthrough, axe pass, virtualization/perf pass |
| Templates | + product | Encodes workflow assumptions — needs product sign-off |

---

## Appendix E — Library quality criteria

**Escape hatches** — the criterion that predicts regret

- `ref` forwarded on every component, `...rest` spread to the underlying DOM node
- Polymorphism: `asChild` / `as`
- Compound components instead of 40-prop monoliths
- Controlled *and* uncontrolled for every stateful component

**Accessibility** — the actual reason not to write your own

- WAI-ARIA APG conformance, focus trap/restore, roving tabindex, screen-reader tested

**Styling separated from behavior**

- Headless core + styling layer, or vendored source you own
- Tokens as CSS custom properties, not a JS theme context
- No runtime CSS-in-JS if RSC/streaming matters
- Overridable without `!important`; CSS layers for specificity

**Build hygiene**

- Per-component import paths, `"sideEffects": false`, real ESM, tree-shakes
- Hydration-safe IDs (`useId`)
- Doesn't fight react-hook-form / TanStack Form — accepts ref + onChange/onBlur rather than owning state

**Governance**

- Semver discipline, migration codemods, diffable changelog
- Docs with props tables *and* recipes for the weird case
- Bus factor and funding model

**Under Module Federation**

- Any context-based library (theme provider, portal container, toast queue) must be a shared singleton, or you get duplicate providers, duplicated CSS, and portals rendering into the wrong root
- Prefer CSS-variable theming over context theming for exactly this reason
- Classnames prefixed/scoped so remote stylesheets don't collide
- Test explicitly: can two versions coexist during migration, or does the shared-singleton constraint force a lockstep upgrade across every remote?
