# tickets — design

A multi-project ticket tracker with fully dynamic fields, replacing the file-based
`items-core/tasks/` dashboard. Same stack as items-core (React, Fastify, TypeScript,
pnpm + turbo), same visual, data in Postgres via Drizzle.

## Decisions

- **Multi-project from day one** — `projects` table, project switcher in the UI;
  items-core's `tasks.json` imports as the first project.
- **Dynamic fields** — everything user-visible on a ticket (title, status, severity,
  epic, area, …) is a field definition + typed value. Field _types_ are code, field
  _instances_ are data: adding a "Due date" field later is an INSERT, not a migration.
- **Ticket types** — `task`, `bug`, `subtask`, …; fields attach per type with
  per-type ordering and required-ness.
- **Subtasks are tickets** — a child ticket of type `subtask` via `tickets.parent_id`;
  progress is a rollup of children by status kind.
- **Statuses are a dedicated table** — not generic field options. Workflow semantics
  (`kind`) live there and nowhere else; `field_options` stays purely generic.
- **Workflow graph** — `status_transitions` edges define allowed status moves
  (optionally per ticket type, with entry edges for new tickets). No edges = no
  restriction, so v1 behaves like today until a graph is defined.
- **Config pattern** — on every vocabulary table (`ticket_types`, `statuses`,
  `field_options`, `fields`, `views`): identity/semantic data is columns
  (key, label, kind, position), everything presentational or behavioral is a
  `config` jsonb (color, icon, widget, flags) — extensible without migrations.
- **Relations are data-driven** — `link_types` (blocks / relates-to / duplicates / …)
  - `ticket_links`; dependencies are just `blocks` links. Parent/child is structural
    (`parent_id`), not a link.
- **Authors are rows** — `users` table (humans and agents); no free-text names.
- **Every mutation has an actor and leaves a trail** — all write endpoints carry an
  actor user id; the API appends `ticket_events` rows (who, what, when) in the same
  transaction, which also power the drawer's activity feed.
- **Archive, don't delete** — vocabulary rows (types, statuses, fields, options,
  link types, views) and tickets get `archived_at`: hidden from pickers, preserved
  for history. Hard delete only for never-referenced rows.
- **Optimistic locking** — ticket PATCHes carry the `updated_at` they read;
  mismatch → 409, so humans and agents can't silently clobber each other.
- **Storage types ≠ display** — field `type` describes the value; how to edit/render
  lives in `fields.config` (widget hints), `ticket_type_fields.position` (form order
  per type), and `views` (table columns/sort/filters).
- **No auth in v1** — local tool; the UI just picks a user.
- **Agent runner ("Solve with Claude") is a later phase** — it will add a `runs`
  table + jsonl logs when it lands; nothing reserved for it now.
- **v1 has no field-management UI** — system fields come from the seed, new fields
  via API; a settings page is a later phase.

## Stack

- `apps/api` — Fastify + drizzle-orm + valibot (port 4600)
- `apps/web` — Vite + React + TanStack Query (port 4610)
- `packages/db` — drizzle schema, migrations, seed, import script
- pnpm workspace + turbo (same ~2.9.x pin as items-core)
- Visual: port the tasks-dashboard CSS tokens/styles as-is (no Tailwind), including
  the tiny hand-rolled markdown renderer.

Conventions carried over from items-core: `environment.ts` is the only
`process.env` reader; named handler consts + `reply.send(...)`; multi-line
`v.object({...})`; `{ data, meta }` envelope on list endpoints; one helper per file;
braces on every `if`.

## DB schema (Postgres, drizzle)

### `projects`

- `id` — serial PK // internal identity, never rendered
- `key` — text, unique // url-safe slug ('items-core'), used in routes
- `name` — text // display name
- `ticket_prefix` — text // 'TASK' → tickets render as TASK-042
- `created_at` — timestamptz

### `users`

- `id` — serial PK
- `name` — text, unique // shown on comments; later on assignee-style fields
- `email` — text, nullable // hook-up point for future auth
- `kind` — enum: `human | agent` // agent rows ('claude') make bot activity attributable
- `archived_at` — timestamptz, nullable // deactivated users disappear from pickers, keep their history
- `created_at` — timestamptz

### `ticket_types`

- `id` — serial PK
- `project_id` — FK → projects
- `key` — text // 'task', 'bug', 'subtask' — unique(project_id, key)
- `label` — text // display name in the type picker
- `config` — jsonb // { color, icon, defaultValues? (keyed by field ID, not key), … } — everything presentational/behavioral; identity stays in columns
- `position` — int // sort order in the type picker / new-ticket dialog
- `archived_at` — timestamptz, nullable // archived types leave existing tickets untouched
- `created_at` — timestamptz

### `statuses` — dedicated workflow table, deliberately NOT generic options

- `id` — serial PK
- `project_id` — FK → projects // one status pool per project
- `key` — text // 'in-progress' — unique(project_id, key)
- `label` — text // 'In progress'
- `kind` — enum: `todo | active | blocked | done | dropped` // the ONLY hardcoded workflow semantic in the system: code must know what counts as done/active for tiles, progress rollups, and filter buckets. Everything else about a status is editable data.
- `config` — jsonb // { color, icon, initial?: true, … } — presentation + behavior flags; 'initial' marks the default status for new tickets
- `position` — int // order in dropdowns (and board columns later)
- `archived_at` — timestamptz, nullable // an in-use status can never be hard-deleted; archive hides it from pickers
- `created_at` — timestamptz

### `status_transitions` — the workflow graph: which status can move to which

- `id` — serial PK
- `from_status_id` — FK → statuses, nullable // NULL = a valid _starting_ status for new tickets (entry edge)
- `to_status_id` — FK → statuses
- `ticket_type_id` — FK → ticket_types, nullable // NULL = edge applies to all types; set it for per-type workflows (bug flow ≠ task flow)
- `config` — jsonb // future: { requireComment: true, requiredFields: [...] } on taking this edge
- unique(from_status_id, to_status_id, ticket_type_id)

Enforcement rule: **if a project has zero transition rows, any status change is
allowed** (v1 seeds none — today's behavior). Once edges exist, PATCHes are
validated against the graph and the status dropdown only offers reachable targets.

### `fields` — the definition; global per project, type-agnostic

- `id` — serial PK
- `project_id` — FK → projects
- `key` — text // 'title', 'status', 'due-date' — unique(project_id, key)
- `label` — text // column header / form label
- `type` — enum: `text | number | date | boolean | json | select | multi_select | status` // storage type of the value; future: user, relation, url — each lands as an additive enum value + value column
- `system` — boolean // seeded fields: undeletable, type locked; behave like any other field otherwise
- `config` — jsonb // display/edit hints: { widget: 'input' | 'textarea' | 'markdown', placeholder, schema? (json type), … } — rendering, never storage semantics
- `archived_at` — timestamptz, nullable // values survive; the field just stops rendering
- `created_at` — timestamptz

### `ticket_type_fields` — which fields a type has

- `ticket_type_id` — FK → ticket_types // composite PK with field_id
- `field_id` — FK → fields
- `position` — int // field order in the drawer/form for this type
- `required` — boolean // per-type: bug may require severity, subtask doesn't show it at all

### `field_options` — options for select/multi_select; purely generic, no workflow semantics

- `id` — serial PK
- `field_id` — FK → fields
- `value` — text // 'high' — unique(field_id, value)
- `label` — text // 'High'
- `config` — jsonb // { color, icon, … } — same pattern as types/statuses; color palette-assigned at creation
- `position` — int // order in the dropdown
- `archived_at` — timestamptz, nullable // referenced options archive instead of deleting

### `views` — how tickets are displayed; the answer to "where does table layout live"

- `id` — serial PK
- `project_id` — FK → projects
- `name` — text // 'Default' — v1 seeds one table view per project
- `config` — jsonb // { columns: [fieldId, …], sort: { fieldId, dir }, filters: { … } } — field IDs, never keys, so renaming a field can't break a view
- `position` — int // order in a future view switcher
- `archived_at` — timestamptz, nullable
- `created_at` — timestamptz

### `tickets` — pure skeleton; everything visible lives in values

- `id` — serial PK
- `project_id` — FK → projects
- `type_id` — FK → ticket_types
- `parent_id` — FK → tickets, nullable // hierarchy: subtasks are children with type 'subtask'; single parent, no link row
- `number` — int // display id TASK-042 — unique(project_id, number); max+1 per project under SELECT … FOR UPDATE on the project row; children get real numbers too
- `created_by` — FK → users // every ticket has a creator; imports attribute to the claude agent
- `archived_at` — timestamptz, nullable // archived tickets hidden from default views, history intact
- `created_at` / `updated_at` — timestamptz // updated_at doubles as the optimistic-lock token: PATCH sends the value it read, mismatch → 409

### `ticket_values`

- `id` — serial PK
- `ticket_id` — FK → tickets
- `field_id` — FK → fields
- `value_text` — text // text type (markdown is a widget, not a type)
- `value_number` — numeric // number type
- `value_date` — timestamptz // date type
- `value_bool` — boolean // boolean type
- `value_json` — jsonb // json type: freeform structured payload; optional shape check via fields.config.schema
- `option_id` — FK → field_options, nullable // select: one row; multi_select: N rows
- `status_id` — FK → statuses, nullable // status-type fields point at the workflow table
- unique(ticket_id, field_id, option_id) // multi_select: one row per option
- partial unique(ticket_id, field_id) where option_id is null // DB-enforced single row for text/number/date/bool/json/status values; single-SELECT rows carry an option_id so this can't cover them — the write path replaces (delete+insert in one tx) and that invariant is app-level (verified against live pg); future value columns (user_id, relation_ticket_id) are additive

### `comments`

- `id` — serial PK
- `ticket_id` — FK → tickets
- `author_id` — FK → users // no free text; agents are users too
- `body` — text // markdown-rendered
- `created_at` — timestamptz

### `ticket_events` — append-only audit trail; powers the activity feed

- `id` — serial PK
- `ticket_id` — FK → tickets
- `actor_id` — FK → users // humans and agents alike
- `kind` — text // 'created' | 'value-changed' | 'status-changed' | 'type-changed' | 'parent-changed' | 'link-added' | 'link-removed' | 'commented' | 'archived' — text on purpose, the vocabulary grows in app code
- `payload` — jsonb // { fieldId, from, to, … } — enough to render "status: open → in-progress"
- `created_at` — timestamptz

Written by the API inside the same transaction as the mutation it records; never
updated, never deleted.

### `link_types` — data-driven relation vocabulary

- `id` — serial PK
- `project_id` — FK → projects
- `key` — text // 'blocks', 'relates-to', 'duplicates' — unique(project_id, key)
- `label` — text // outward reading: 'blocks'
- `inverse_label` — text // inward reading: 'is blocked by'
- `directional` — boolean // relates-to is symmetric, blocks is not
- `position` — int // order in the link-type picker
- `archived_at` — timestamptz, nullable

### `ticket_links` — generic ticket ↔ ticket relations

- `id` — serial PK
- `link_type_id` — FK → link_types
- `source_ticket_id` — FK → tickets // reads: source {label} target
- `target_ticket_id` — FK → tickets // check ≠ source
- `created_at` — timestamptz
- unique(link_type_id, source_ticket_id, target_ticket_id)

Indexes: `tickets(project_id, type_id)`, `tickets(parent_id)`,
`ticket_values(ticket_id)`, `ticket_values(field_id, option_id)`,
`ticket_values(status_id)`, `comments(ticket_id)`,
`ticket_events(ticket_id, created_at)`,
`ticket_links(source_ticket_id)`, `ticket_links(target_ticket_id)`.

## Mechanics

- **New ticket**: pick type → form renders that type's fields from
  `ticket_type_fields` order, enforcing its `required` flags.
- **Changing type**: values for fields the new type doesn't include are kept but
  hidden, never deleted.
- **Subtasks**: quick-add in the drawer creates a child ticket (type `subtask`,
  `parent_id` set) with just a title; it's a real ticket — open it to add anything.
  Progress = children with done-kind status / children not dropped-kind.
- **Dependencies**: `blocks` links; the drawer shows both directions using
  label/inverse_label. Gate logic ("don't start until blockers fixed") reads
  incoming `blocks` links.
- **Board payload**: the API assembles EAV into
  `{ id, number, type, parentId, values: { title, status, … } }` — the frontend
  never sees rows of `ticket_values`.
- **Why typed value columns over one jsonb blob**: FK integrity on options/statuses
  (rename = one row, every ticket follows), native per-type querying/sorting,
  validation in one place per type.

## Policies

- **Hierarchy depth = 1** — a parent cannot itself have a parent; app-checked on
  create/PATCH (which also makes parent cycles impossible).
- **Link cycles** — creating a directional link (blocks) that would close a cycle
  is rejected at write time (cheap BFS; projects are small).
- **Type change vs required** — allowed even if the new type's required fields are
  empty: required gates creation (and later transitions), not type switches.
- **Concurrent edits** — PATCH carries expectedUpdatedAt; stale → 409 and the UI
  re-fetches. Applies to humans and agents equally. Implementation note (verified):
  compare as text (`updated_at::text`) end to end — a timestamptz round-tripped
  through a JS Date loses microseconds and never matches.
- **Deletion** — vocabulary rows and tickets archive; hard delete is reserved for
  rows nothing references yet.

## Seed (per new project)

- Ticket types: `task` (position 0), `subtask` (position 1).
- Statuses: open, investigating, investigated, brainstorming, designing,
  in-progress, review, fixed, dropped — plus `blocked` (kind blocked) so imported
  subtask states have a home.
- System fields: `title` (text, required), `description` (text, widget markdown),
  `status` (status), `severity` (select: high/medium/low), `epic` (select, starts
  empty), `area` (text). Type `task` attaches all six; type `subtask` attaches
  title/status/description only.
- Link types: `blocks` / `relates-to` / `duplicates`.
- Status transitions: none — the graph starts empty, so all moves are allowed
  until you define edges.
- One default view: columns [type, title, epic, progress, severity, status].
- Users: `claude` (agent); humans created on first use.

## Import (items-core one-shot)

- `tasks.json` + `details/*.md` → project `items-core`.
- Tickets → type `task`; detail md → `description` value; epic strings → epic
  options; statuses → statuses rows.
- Subtasks → child tickets of type `subtask` (note → description); status mapping:
  todo→open, in-progress→in-progress, blocked→blocked, done→fixed, skipped→dropped.
- `dependsOn` → `blocks` links (dep blocks the dependent ticket).
- Comment authors → users rows (`claude` → agent kind).
- Imported tickets: `created_by` = claude (agent), TASK numbers preserved exactly
  (TASK-027 → 27, sequence continues after the max), one 'imported' event each.
- Verify counts against the JSON when done.

## API surface (v1)

- `GET  /api/projects` — list
- `POST /api/projects` — create (runs the seed)
- `GET  /api/projects/:key/board` — types + fields (with options) + statuses +
  link types + views + assembled tickets (incl. children) + comments, one payload
- `POST /api/projects/:key/tickets` — `{ typeKey, parentId?, values: {...} }`
- `PATCH /api/tickets/:id` — `{ typeKey?, parentId?, values?: {...} }`; each value
  validated against its field's type/options/statuses
- `POST /api/tickets/:id/comments` — `{ authorId, body }`
- `POST /api/tickets/:id/links` · `DELETE /api/links/:id`
- `GET/POST /api/users`
- `GET  /api/tickets/:id/events` — activity feed, paged
- `POST/PATCH /api/projects/:key/fields` · `.../fields/:id/options` ·
  `.../statuses` · `.../status-transitions` · `.../link-types` — grow the
  vocabulary and the workflow graph later (no UI yet)

Every mutating endpoint carries `actorId` and writes a `ticket_events` row in the
same transaction; ticket PATCH also carries `expectedUpdatedAt` (409 on mismatch).
List endpoints use the `{ data, meta: { skip, take, total, sort } }` envelope.

## Step-by-step plan

1. **Scaffold** — git init `../tickets`, pnpm workspace, turbo, base tsconfig +
   prettier/lint copied from items-core, `.env` with `DATABASE_URL`; create the
   `tickets` database in local Postgres.
2. **`packages/db`** — drizzle schema above, `db:generate`/`db:migrate` via turbo,
   seed factory (types, statuses, system fields, link types, default view).
3. **Import script** — one-shot from `items-core/tasks/`; verify counts.
4. **`apps/api`** — Fastify routes above; validated with curl before any UI.
5. **`apps/web`** — field-driven port of the dashboard: tiles (status kinds),
   filter chips (select/status fields), table with view-driven columns
   (select/status → colored badge, text → plain, date → formatted) + progress
   rollup column, drawer (per-type field form, children as subtask list, comments,
   links, activity feed), new-ticket dialog (type picker → dynamic form), project
   switcher, user picker. TanStack Query with ~10s polling.
6. **Cutover** — run side by side against imported data, compare, freeze
   `tasks/tasks.json` as archive.
7. **Later phases** — agent runner (adds a `runs` table + jsonl logs + edit locks),
   field/status/view management UI, more field types (user, relation, url),
   auth on top of `users`.

## Known limits (accepted for v1, exits identified)

- The one-payload board endpoint strains around thousands of tickets per project;
  exit = server-side filter/sort via a jsonb snapshot column or a search table.
- Search is client-side substring over the board payload; real full-text over EAV
  values is a later tsvector/trgm pass.
- No attachments — needs a files table + storage decision; its own phase.
- Views are shared (not per-user); author choice is honor-system until auth lands.
- Vocabularies don't share across projects — no workspace templates yet.

## Dependencies to install (flagged per convention)

`fastify`, `drizzle-orm`, `drizzle-kit`, `postgres` (same driver items-core uses),
`react`, `react-dom`, `vite`,
`@vitejs/plugin-react`, `@tanstack/react-query`, `valibot`, `typescript`, `turbo`,
`prettier`.
