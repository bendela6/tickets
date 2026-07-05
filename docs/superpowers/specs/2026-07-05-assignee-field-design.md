# Assignee field: assign tickets to Claude models

**Date:** 2026-07-05
**Status:** Approved

## Purpose

Tickets need an "assign" concept. In this system the executor of a ticket is
Claude, so the assignee is a **Claude model**, not a person. The field also
carries an instruction so that when Claude plans a ticket it decides which
model fits the task and records that decision on the ticket.

## Decisions made during brainstorming

- **Assignees are Claude models only** — no humans, no mixed list, no second
  field.
- **Options are the current four model tiers**: Fable 5, Opus 4.8, Sonnet 5,
  Haiku 4.5. More can be added later via the existing field-option API.
- **Scope is all projects**: backfill the four existing projects (TASK, APP,
  GW, TIX) and add the field to the project seed so future projects get it.
- **Approach**: reuse the existing custom-field machinery (a `select` field
  with options) plus a small MCP change to surface the field description.
  Rejected: a data-only variant (instruction invisible to MCP consumers) and
  a first-class `assigned_to` column (schema/API churn for no current need).

## Field definition

One `select` field per project:

| Property | Value |
| -------- | ----- |
| key      | `assignee` |
| label    | `Assignee` |
| type     | `select` |
| system   | `true` (seeded, undeletable, type-locked — matches `severity`/`epic`) |
| required | `false` on both ticket types (planning sets it; creation is never gated) |
| attached | `task` and `subtask`, position appended after existing fields |

`config.description` (the planning instruction — statuses already use
`config.description`, so this follows an established convention):

> Which Claude model this ticket is assigned to. When Claude plans a ticket
> (brainstorming/designing), it must also decide which model fits the task
> and set this field — weigh task complexity against cost and speed:
> claude-fable-5 for the most demanding reasoning and long-horizon agentic
> work, claude-opus-4-8 for hard coding and agentic tasks, claude-sonnet-5
> for well-specified implementation work, claude-haiku-4-5 for quick
> mechanical changes.

Options — `value` is the exact model id (machine-usable if runs are ever
launched from tickets), `label` is the friendly name, one chip color each
drawn from the existing seed palette:

| position | value             | label     | config.color |
| -------- | ----------------- | --------- | ------------ |
| 0        | `claude-fable-5`  | Fable 5   | `#8f7ae8`    |
| 1        | `claude-opus-4-8` | Opus 4.8  | `#3987e5`    |
| 2        | `claude-sonnet-5` | Sonnet 5  | `#0ca30c`    |
| 3        | `claude-haiku-4-5`| Haiku 4.5 | `#898781`    |

## Components

### 1. Backfill script (existing projects)

New idempotent script in `packages/db/src/seed/` (pattern: existing seed and
import scripts), exposed as a pnpm script. For every project that has no
`assignee` field it inserts, in one transaction per project:

- the `fields` row (`system: true`, config as above),
- the four `field_options` rows,
- `ticket_type_fields` attachments for every live ticket type
  (`required: false`, position appended).

Projects that already have the field are skipped, so the script can be rerun
safely. Existing views are **not** modified — the Assignee column can be
added to a view via the existing update-view API when wanted.

### 2. Seed (future projects)

`packages/db/src/seed/seed-project.ts` gains:

- the `assignee` field in the seeded field list (same definition),
- its four options (like `SEVERITY_SEED`),
- attachment to `task` and `subtask` field lists,
- an Assignee column in the seeded Default view (after Severity).

### 3. MCP: surface field descriptions in `get_board`

`apps/mcp/src/tools/get-board.ts` currently collapses fields to
`key/type/options`, which would hide the planning instruction from agents.
Change: include `description` in each field entry, read from
`field.config.description`, omitted when absent. Applies to all fields, not
just `assignee` — any field description becomes agent-visible.

The API board endpoint already returns full field rows including `config`,
so there are **no API changes**. `create_ticket` / `update_ticket` already
validate select values against options — no MCP write-tool changes. Ticket
summary rows already include every field value, so `assignee` appears in
`get_board` / `search_tickets` / `get_ticket` rows automatically.

### 4. Docs

- `docs/mcp/get-board.md`: add `description?: string` to the fields shape
  (keeping the page self-contained on types).
- `docs/api/create-field.md`: mention the `config.description` convention
  with the assignee field as the example.

## Data flow

1. Agent calls `get_board` → sees
   `{ key: "assignee", type: "select", options: [...], description: "…decide which model fits…" }`.
2. While planning, the agent picks a model tier and calls `update_ticket`
   (or sets it at `create_ticket`) with `values: { assignee: "claude-sonnet-5" }`.
3. The API validates the value against the field's options (existing 400 on
   unknown values) and writes `ticket_values` + a `ticket_events` row —
   the standard audit trail covers assignment changes.
4. Board/search summary rows carry the assignee value; the redesigned web UI
   renders it as a normal select field with option colors.

## Error handling

Inherited from the existing field machinery: unknown option values 400,
archived fields are hidden from `get_board`, and the field being optional
means no creation path breaks. The backfill script is transactional per
project and idempotent.

## Testing

- Unit-level: seed a fresh project in a test DB → assert the `assignee`
  field, options, attachments, and view column exist. Run the backfill twice
  against a DB with pre-existing projects → assert the field exists once.
- MCP: `get_board` output includes `description` for fields that have one
  and omits it otherwise.
- End-to-end verification: run backfill on the dev DB, call `get_board`,
  set `assignee` on a real ticket via `update_ticket`, confirm the summary
  row shows it and an event was recorded.

## Out of scope

- Web UI work (the redesign renders it as a standard select field).
- Auto-launching Claude runs from the assignee value.
- Assigning humans or non-Claude agents.
- Updating existing projects' views.
