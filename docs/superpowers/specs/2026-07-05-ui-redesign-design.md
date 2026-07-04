# tickets — UI redesign design prompt

This document is a ready-to-paste prompt for Claude design. Everything below the
horizontal rule is the prompt; paste it wholesale into a fresh design session.
The design tool has no access to this repo, so the prompt is fully self-contained.

Decisions baked in (from brainstorming, 2026-07-05): total redesign (new visual
identity, new shell, full admin UI, user-arrangeable layout); visual direction is
the designer's choice; target stack TypeScript + React + Tailwind + headless
components; light + dark equal citizens; fully responsive with mobile as a
first-class surface; global all-projects view is a full working view; every DB
entity gets management UI; custom form-control library (no native-looking
controls, searchable single/multi selects).

---

# Design brief: "tickets" — complete UI redesign

## Role & mission

You are designing the complete UI for **tickets**, a multi-project ticket
tracker used by humans and AI agents together. This is a ground-up redesign:
new visual identity, new app shell, new screens. Nothing from the old UI needs
to be preserved.

The visual identity is yours to propose — no reference style is imposed. Make
it feel like a serious, modern tool someone lives in all day: distinctive
without being loud, dense where work happens, calm everywhere else.

Deliverables: a design system first, then every screen listed below — each in
light **and** dark, desktop **and** mobile. Details in "Working order" at the
end.

## The product in one paragraph

tickets is a local-first tracker. A workspace holds multiple **projects**
(each with a key like `items-core` and a ticket prefix, so tickets render as
`TASK-042`). Every attribute of a ticket beyond its number — title, status,
severity, epic, due date, anything — is a **dynamic field** defined in data,
not code. Users create fields, ticket types, statuses, workflows, and views at
runtime. Humans and AI agents both read and write; every mutation is
attributed to an actor and appears in an append-only activity feed. There is
no auth in v1 — you simply pick which user you are.

## Domain model (what the UI must express)

- **Projects** — key, name, ticket prefix. Progress is computable per project:
  tickets with a done-kind status vs. all non-dropped tickets.
- **Tickets** — belong to a project, have an immutable **type** (task, bug,
  subtask, …), a per-project number, an optional parent (one level deep:
  subtasks are real tickets with a parent), and a bag of field values.
- **Fields** — typed definitions: `text`, `number`, `date`, `boolean`, `json`,
  `select`, `multi_select`, `status`. Display hints refine them (e.g. a text
  field whose widget is a markdown editor). Select/multi-select fields have
  colored options. Fields attach to ticket types with per-type ordering and
  required flags — a bug's form differs from a task's form.
- **Statuses** — a dedicated per-project vocabulary. Each status has a color
  and a **kind**: `todo`, `active`, `blocked`, `done`, `dropped`. Kinds drive
  progress rollups, KPI buckets, and filter shortcuts. A **workflow graph**
  (allowed status→status transitions, optionally per ticket type) constrains
  moves; status pickers only offer legal targets.
- **Views** — named, saved configurations of a ticket list: visible columns,
  column order/widths, sort, filters. Views are shared, not per-user. Every
  layout change the user makes persists into the view; ad-hoc filter tweaks
  live in the URL until explicitly saved into the view.
- **Links** — typed, directional relations between tickets: `blocks` / "is
  blocked by", `relates to`, `duplicates`. Link types are data — users can
  define new ones.
- **Subtask progress** — a parent shows children-done / children-not-dropped
  as a progress indicator.
- **Comments** — markdown, attributed.
- **Activity** — append-only event feed per ticket: created, value changed,
  status changed, linked, commented, archived… with actor and timestamp.
- **Users** — humans and **agents**. Agent actions (e.g. a Claude bot updating
  a ticket) are first-class and must be visually attributable everywhere
  activity appears.
- **Archive, not delete** — tickets and every vocabulary item archive; the UI
  needs archived-state affordances (hidden by default, findable, restorable).

## Hard constraints

- **Implementation target**: TypeScript + React + **Tailwind CSS** + headless
  component primitives (Radix-style or internal). Design tokens must map
  cleanly to a Tailwind theme. No component library's stock look.
- **Light and dark are equal citizens.** Every screen and every component is
  designed in both from the start — not a dark theme retrofitted onto a light
  design.
- **Fully responsive, mobile first-class.** Each screen gets a real mobile
  layout, not a squeezed desktop. Tables may become cards, drawers become
  full-screen sheets, the shell nav collapses — show these transformations.
- **Dynamic-fields-first.** The design can never assume a fixed set of
  columns or form fields. Every renderer is driven by field type: select →
  colored badge, status → kind-colored badge, date → formatted, boolean →
  check, number → right-aligned, json → code chip, markdown text → rendered
  prose. Tables, cards, forms, and detail panes all compose from this
  type-driven registry.
- **Scale realities**: a project holds hundreds of tickets (design for ~50–500
  rows; no infinite-scroll gymnastics needed), a form holds 5–15 fields, a
  workspace holds a handful of projects.
- **Accessibility**: keyboard-first navigation throughout, visible focus
  states, WCAG AA contrast in both themes, hit targets ≥ 40px on mobile.

## Form-control library (its own deliverable)

Nothing may look or behave like a native browser control. Design a complete,
consistent control set — these appear everywhere (filters, forms, admin,
inline table editing), so they carry the product's feel:

- **Select (single)** — searchable combobox: type to filter options, keyboard
  navigable, colored option badges where the field defines colors, clear
  affordance. Compact (inline table cell) and regular (form) sizes.
- **Select (multi)** — same combobox plus token/chip display of selections,
  select-all/clear, count summary when collapsed.
- **Status select** — a select variant aware of the workflow graph: legal
  targets enabled, illegal ones hidden or explained; grouped by status kind;
  kind-colored.
- **Text input / textarea / markdown editor** — the markdown editor has an
  edit/preview affordance and is the description surface.
- **Date picker** — calendar popover with manual entry; relative display
  ("3 days ago") with exact-on-hover where shown as a value.
- **Checkbox / switch / radio group** — custom-drawn, obvious states.
- **Number input** — with steppers where appropriate.
- **Buttons** — primary / secondary / ghost / destructive / icon; loading
  states.
- **Chips & badges** — option colors, status kinds, ticket type, link
  direction, agent-vs-human actor markers.
- **Menus, popovers, dialogs, toasts, tooltips** — the overlay family.
- Every control: default, hover, focus, active, disabled, error, and loading
  states, in both themes, desktop + touch sizing.

## Screens

### 1. App shell & navigation

Persistent frame around everything. Must house: workspace-level navigation
(Home, All tickets, per-project entries, Settings), a **project switcher**,
the **current-user picker** (this sets who your actions are attributed to —
make it visible, it matters), theme toggle, a **global search / command
palette** (jump to ticket by number, search titles, quick actions like "new
ticket"), and a prominent **New ticket** action. Propose the shell shape
(sidebar vs. top bar vs. hybrid) — justify the choice. Show collapsed /
mobile behavior.

### 2. Home — projects overview

The landing screen. Every project as a rich card/row: name, key, ticket
counts, **progress** (done-kind vs. non-dropped, as a visual — bar, ring,
your call), breakdown by status kind, recent activity pulse. Create-project
affordance. This screen answers "where does work stand?" in five seconds.

### 3. All tickets — global cross-project view

A full working view over every ticket in every project — not a dashboard.
Same power as a project board: filter, sort, choose columns, **group by
project** (or any groupable field), saved cross-project views, open and edit
tickets inline. Project shows as a column/badge and is just another filter.
Only fields shared across projects (by key) are offered as columns/filters;
design the affordance for that gracefully.

### 4. Project board

The core work surface, with **two modes on one view model**:

- **Table mode** — view-driven columns (resize, reorder, show/hide), sort,
  inline status editing via the badge, subtask progress column, row →
  opens the ticket peek. Density toggle (comfortable / compact).
- **Kanban mode** — columns by status (or any select field), kind-colored
  column headers, drag between columns respecting the workflow graph
  (illegal drops clearly rejected), card design that composes from dynamic
  fields (which fields show on cards is view-configurable).

Around both modes: **view tabs** (saved views; create, rename, archive),
**filter builder** (field → operator → value(s), status filters can target
kinds or specific statuses; ad-hoc state clearly marked "unsaved" with a
save-to-view action), **KPI tiles** (counts by status kind — user can toggle
this strip), text search, and a result count. The user arranges the
furniture: KPI strip on/off, density, mode — all persisted per view.

### 5. Ticket detail — peek drawer + full page

One detail design rendered two ways: a **drawer/peek** over the board (board
stays visible; for triage flow) and a **dedicated full page** (deep links,
focus work). Contents: title (inline-editable), type + number + project
identity, the **per-type dynamic field form** (respecting field order and
required flags, markdown description prominent), **subtasks** (list with
status, quick-add creating a real child ticket, progress rollup, breadcrumb
back from child to parent), **links** (grouped by direction with
label/inverse-label phrasing — "blocks X" vs "is blocked by Y" — add/remove),
**comments** (markdown editor), and the **activity feed** (compact,
human-readable diffs: "status: open → in progress", agent actors visibly
marked). Propose the information architecture — tabs vs. stacked vs.
side-rail — for both drawer and page widths.

### 6. New ticket flow

Type picker first (type is immutable after creation — the design should make
that consequence felt), then the type's field form with required-field
enforcement. Fast path matters: title-only quick create for subtasks from the
detail view.

### 7. Settings / admin — UI for every entity

Everything configurable in the data model gets a management UI. This is new
territory (today it's API-only) and a major part of the redesign. One
coherent settings area, per project, plus workspace-level bits:

- **Fields** — list, create, edit (label, type, widget hints, placeholder),
  archive. For select fields: manage **options** (label, color from a defined
  palette, reorder, archive).
- **Ticket types** — create/edit/archive; per type, **attach fields** with
  drag-to-order and per-type required toggles. This is the form builder —
  make it feel like one.
- **Statuses** — create/edit/reorder/archive; kind assignment, color.
- **Workflow** — a **visual editor for the status transition graph**: nodes
  are statuses (kind-colored), edges are allowed moves, optionally scoped per
  ticket type; entry edges mark valid starting statuses. Empty graph =
  everything allowed; the editor must communicate that state.
- **Link types** — label / inverse label / directionality.
- **Views** — list, rename, reorder, archive saved views.
- **Users** — list humans and agents, create, archive; agent kind visible.
- **Projects** — name, key, prefix; create; archive.

Design the settings shell (nav within settings), one exemplary CRUD screen in
full detail (Fields is the richest), the type/field attachment builder, and
the workflow graph editor. Other entity screens can be shown as the pattern
applied.

### 8. Mobile

For each screen above, show the small-screen form: shell nav collapse,
projects overview, board (table→card list, kanban→swipeable columns or
stacked groups — your call), ticket detail as full-screen sheet, filter
builder on touch, settings lists. Inline editing and the command palette need
touch-appropriate equivalents.

## Working order

1. **Design system first**: color tokens (including semantic colors for the
   five status kinds and a categorical palette for field options — both
   themes), type scale, spacing, radii, elevation/borders, and the
   form-control library above. Present this and stop for sign-off before
   screens.
2. Then screens in the order listed. Each screen: desktop light, desktop
   dark, mobile (one theme is fine if identical), plus key interaction states
   (hover, drag, empty, loading, error). Empty states are part of the design
   — new project, no tickets, empty graph, no results.
3. Name components as you go — the implementation will mirror your names.

## Out of scope (do not design, leave room)

- Authentication / permissions (users are picked, not logged in).
- File attachments.
- Agent-runner UI ("Solve with Claude" run logs) — a later phase; it will
  slot into ticket detail as another tab/section eventually.
- Real-time presence/collaboration indicators.
