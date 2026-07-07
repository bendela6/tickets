# Ticket taxonomy: types, statuses, priorities, fields

**Date:** 2026-07-07
**Status:** Draft (pending review)

## Purpose

Define the canonical vocabulary for the tickets system from scratch — the
**types**, their **per-type workflows** (statuses + transitions), the
**priority/severity** scales, and the **fields** each type carries. The goal is
a set that is expressive enough to manage real software delivery (including
merge/deploy/release) yet lean enough that a solo developer directing Claude
agents keeps it up to date without ceremony.

This supersedes the current seed vocabulary (10 project-wide statuses,
`task`/`subtask` types, severity-only, `epic`/`area` fields). It is a
**target-state** design; migrating existing data onto it is called out under
[Migration](#migration-considerations) but not solved here.

## Context that shaped it

- **Who works the tickets:** one human (the owner) directing **Claude agents**.
  "Different types of AI solve the tasks" — the executor is a Claude *model
  tier*, and that is already modelled by the approved
  [Assignee field spec](2026-07-05-assignee-field-design.md). This design
  reuses that, it does **not** add a human/user assignee.
- **The unit of work maps to code:** one shippable ticket = one branch = one
  PR = one deploy. The workflow therefore includes the real shipping pipeline
  (review → merge → deploy → done), not just "in progress → done".
- **The schema is already data-driven.** Types, statuses, and fields are config
  rows added per project, so this vocabulary is a **seed/config** change plus a
  few small schema extensions — not a rewrite.

## Design principles

1. **`kind` is the only cross-type spine.** Every status maps to one of the five
   hardcoded kinds (`todo` / `active` / `blocked` / `done` / `dropped`) that the
   code uses for progress rollups, the global All-Tickets view, and filter
   buckets. Labels and workflows are fully per-type; `kind` is what keeps
   cross-type views coherent.
2. **Promote to a *type* only when fields or lifecycle differ.** "What flavor of
   work is this?" is a **field** (Kind), not a type. A thing becomes a type only
   when it needs its own fields or its own workflow.
3. **Each field earns its slot.** Only Title is globally required. A field that
   would be empty on most tickets is scoped to the types that use it.
4. **Granularity needs decision rules.** Every priority/severity level is defined
   by *what puts a ticket there*, so classification is a one-second call, not a
   judgement between look-alike labels.

---

## 1. Types

Five types. Icons/colors assigned in the seed (see [Colors](#colors)).

| Type | Role | Ships code? | Hierarchy |
| --- | --- | --- | --- |
| **Epic** | Theme / container; ships via its children | no | parent of Task/Bug/Spike |
| **Task** | The shippable unit — **one Task = one PR = one deploy** | yes | child of Epic; parent of Subtask |
| **Bug** | Defect; also a PR unit | yes | child of Epic; parent of Subtask |
| **Subtask** | A step inside a Task/Bug/Spike | no | leaf |
| **Spike** | Timeboxed research; output is Findings | no | child of Epic; parent of Subtask |

"Story" is intentionally **absent**: having both Task and Story forces the
fuzziest classification call in any tracker. One shippable unit — the Task —
removes it. A user-facing capability is expressed by an **Epic** (a small theme)
or the Task's title, not a separate tier.

---

## 2. Statuses (owned per type)

Statuses are **owned by a type**, not shared across a project — Bug's
"In progress" and Task's "In progress" are separate rows. This lets each
workflow be edited in isolation and use its own vocabulary. The shared meaning
comes only from `kind`.

`◆` marks the **initial** status a new ticket of that type is created in.

### Epic
| Status | kind |
| --- | --- |
| ◆ Backlog | `todo` |
| In progress | `active` |
| Blocked | `blocked` |
| Done | `done` |
| Cancelled | `dropped` |

### Task
| Status | kind |
| --- | --- |
| ◆ Backlog | `todo` |
| To do | `todo` |
| In progress | `active` |
| In review | `active` |
| Merged | `active` |
| Deployed | `active` |
| Done | `done` |
| Blocked | `blocked` |
| Cancelled | `dropped` |

### Bug
| Status | kind |
| --- | --- |
| ◆ Triage | `todo` |
| To do | `todo` |
| In progress | `active` |
| In review | `active` |
| Merged | `active` |
| Deployed | `active` |
| Fixed | `done` |
| Blocked | `blocked` |
| Won't fix | `dropped` |

### Subtask
| Status | kind |
| --- | --- |
| ◆ To do | `todo` |
| In progress | `active` |
| In review | `active` |
| Done | `done` |
| Blocked | `blocked` |
| Cancelled | `dropped` |

### Spike
| Status | kind |
| --- | --- |
| ◆ To do | `todo` |
| In progress | `active` |
| Done | `done` |
| Blocked | `blocked` |
| Cancelled | `dropped` |

**On the shipping states:** `Merged` (on `main`, awaiting deploy) and `Deployed`
(running on the deployed env, being smoke-checked) both map to `kind: active` —
they count as *in flight, not done*, which is correct: a ticket is not done
until it is released and verified. No new `kind` is introduced; adding a sixth
kind (e.g. `shipping`) would touch rollup/board/filter code for little gain.

---

## 3. Transitions (the workflow graph)

Workflows are **enforced**: the API allows only defined edges (this is the
purpose of the existing `status_transitions` table, whose `ticket_type_id`
already scopes edges per type; `from_status_id = NULL` marks a valid initial
status). A defined graph is what keeps an agent from making illegal jumps.

Rather than enumerate every edge, the graph is the **happy path** below plus
these **universal rules**:

- **Block/unblock:** from any non-terminal status a ticket may move to
  `Blocked`; from `Blocked` it returns to the status it left (or any earlier
  active status).
- **Drop:** from any non-terminal status a ticket may move to the type's drop
  status (`Cancelled`, or `Won't fix` for Bug).
- **Reopen:** a `done`-kind status may return to `In progress`; a `dropped`
  status may return to the initial status.
- **Kick-back:** `In review → In progress` (changes requested);
  `Deployed → In progress` (regression found).

**Happy paths:**

- **Epic:** Backlog → In progress → Done
- **Task:** Backlog → To do → In progress → In review → Merged → Deployed → Done
- **Bug:** Triage → To do → In progress → In review → Merged → Deployed → Fixed
- **Subtask:** To do → In progress → In review → Done
- **Spike:** To do → In progress → Done

**Transition guards** (a move is rejected unless its condition holds):

| Guard | Applies to | Condition |
| --- | --- | --- |
| PR required to ship | Task, Bug: `→ Merged` | `PR / Branch` field is non-empty |
| Closing note | Bug: `→ Fixed`, `→ Won't fix`; any: `→ Cancelled` | a comment is present on the ticket (the reason / resolution) |

The closing-note guard is why a **separate Resolution field is unnecessary** —
the reason for a fix/drop is captured as a required closing comment, kept in the
`ticket_events` / comment trail.

---

## 4. Priority and Severity

### Priority — all types, default **Medium**
The universal "what order should this get done" signal; the field an agent sorts
the ready queue by.

| Level | The rule that puts it here |
| --- | --- |
| **Urgent** | Drop everything now — prod down, blocking other work, or due today. |
| **High** | Do next / this cycle. Clear unblocking or business value. |
| **Medium** | Normal queue; should happen, no deadline. *(default)* |
| **Low** | When time permits. Real but not pressing. |
| **Trivial** | Someday/maybe. Fine if it never ships. |

### Severity — Bug only
How bad the defect's impact is; used during `Triage` to help set the bug's
priority. Distinct from priority: a low-severity bug can be Urgent (demo
tomorrow), a high-severity bug can be Low (edge case nobody hits).

| Level | The rule that puts it here |
| --- | --- |
| **Critical** | Data loss, security hole, or crash/prod-down with **no workaround**. |
| **High** | Major feature broken; workaround exists but painful. |
| **Medium** | Feature partially broken; reasonable workaround exists. |
| **Low** | Minor / edge-case; small impact on few users. |
| **Cosmetic** | Visual glitch or typo; no functional impact. |

Both scales are depth **5** — the ceiling for buckets a human places
consistently without a lookup table, and symmetric so there is one mental model.

---

## 5. Fields

Each field is defined once and attached to the types that use it, in order,
with a required flag. `●` = shown, `◎` = optional (shown, never required).

### Catalog

| Field | key | type | Notes |
| --- | --- | --- | --- |
| Title | `title` | text | required, all types (system) |
| Description | `description` | text (markdown) | all types (system) |
| Status | `status` | status | all types (system); per-type statuses |
| Priority | `priority` | select (5) | all types; default Medium |
| Assignee | `assignee` | select | Claude model tiers — see [Assignee](#assignee-alignment-with-the-approved-spec) |
| Kind | `kind` | select (6) | **Task only** — flavor of change; see below |
| Component | `component` | select | subsystem: `api`/`web`/`mcp`/`db`… (replaces free-text `area`) |
| Labels | `labels` | multi_select | freeform cross-cutting tags |
| Severity | `severity` | select (5) | Bug only |
| Steps to reproduce | `steps` | text (markdown) | Bug only |
| Environment | `environment` | select | Bug only: `prod`/`staging`/`local` |
| PR / Branch | `pr` | text (link) | Task/Bug; the branch or PR URL; gates `→ Merged` |
| Findings | `findings` | text (markdown) | Spike only — the research output |
| Target date | `target_date` | date | optional; Epic/Task/Spike |
| Estimate | `estimate` | select | optional; Task/Bug; `S`/`M`/`L`/`XL` |

### Per-type attachment

| Field | Epic | Task | Bug | Subtask | Spike |
| --- | :-: | :-: | :-: | :-: | :-: |
| Title / Description / Status / Priority / Assignee | ● | ● | ● | ● | ● |
| Kind | | ● | | | |
| Component | ● | ● | ● | | ● |
| Labels | ● | ● | ● | ◎ | ◎ |
| Severity / Steps to reproduce / Environment | | | ● | | |
| PR / Branch | | ● | ● | | |
| Findings | | | | | ● |
| Target date | ◎ | ◎ | | | ◎ |
| Estimate | | ◎ | ◎ | | |

Only `title` is `required: true`. Everything else is optional so no creation
path is ever gated (transition guards, not required fields, enforce
"definition of done").

### Kind — Task only, default **Feature**

Aligned 1:1 with the repo's conventional-commit prefixes so the Kind doubles as
a commit-prefix hint for the agent and feeds clean release notes. `fix` is
absent because that is the **Bug** type.

| value | label | commit prefix | meaning |
| --- | --- | --- | --- |
| `feat` | Feature | `feat` | New capability *(default)* |
| `refactor` | Refactor | `refactor` | Internal restructure, no behavior change |
| `perf` | Perf | `perf` | Performance improvement |
| `chore` | Chore | `chore` | Deps, config, tooling, maintenance |
| `docs` | Docs | `docs` | Documentation only |
| `test` | Test | `test` | Test-only change |

### Assignee — alignment with the approved spec

The [approved Assignee spec](2026-07-05-assignee-field-design.md) already
defines `assignee` as a **`select` of Claude model tiers**
(`claude-fable-5` / `claude-opus-4-8` / `claude-sonnet-5` / `claude-haiku-4-5`),
carrying a planning instruction in `config.description`. This taxonomy **reuses
it unchanged** and only **extends its attachment** to the new types (Epic, Bug,
Spike in addition to Task/Subtask). Consequences:

- **No `user` field type is introduced** — the earlier idea of a human/agent
  user reference is dropped in favor of the existing model-tier select. This
  removes a schema change.
- **No standalone Reviewer field.** The `In review` status marks "awaiting
  verification" and the event log records who advanced it. If reviewer-*agents*
  are added later, a second model-tier select (`reviewer`) can be added with the
  same machinery and no schema change.

---

## 6. Hierarchy

Containment is **structural** (`tickets.parent_id`), not a field. The old `epic`
select field is **removed**; an Epic "contains" a Task by being its parent, so a
ticket's epic is read from the tree and its progress rolls up from real
children.

The current **depth-1** enforcement is replaced by **type-aware nesting rules**
(validated in the API):

| Parent type | Allowed child types |
| --- | --- |
| Epic | Task, Bug, Spike |
| Task | Subtask |
| Bug | Subtask |
| Spike | Subtask |
| Subtask | *(none — leaf)* |

A Task belongs to exactly one Epic (single parent). A cross-project or
multi-epic association is expressed with a **Label** or a **link**, not the
hierarchy — Epics are **project-scoped** (an Epic and its children live in one
project).

---

## 7. Links

Non-hierarchy relationships (the existing `link_types` machinery):

| key | label | inverse | directional |
| --- | --- | --- | --- |
| `blocks` | blocks | is blocked by | yes |
| `relates-to` | relates to | relates to | no |
| `duplicates` | duplicates | is duplicated by | yes |
| `caused-by` | caused by | causes | yes |

`caused-by/causes` is new — a defect trail ("this bug was caused by that
change"). The others are unchanged.

---

## 8. Numbering & default view

- **Numbering** is unchanged: per-project, shared across types
  (`tickets_project_number`). An Epic and a Bug in items-core are `TASK-41`,
  `TASK-42` — `TASK` is the *project* code, not the type. Type is shown as an
  icon/label.
- **Default view** columns: `number · type · title · priority · assignee ·
  status · progress`, sorted by priority descending. (The `epic`/`severity`
  columns from the old default are dropped/limited; severity appears on
  Bug-filtered views.)

---

## Colors

Status color derives from `kind` (existing `KIND_COLORS`):
`todo #3987e5` · `active #8f7ae8` · `blocked #d03b3b` · `done #0ca30c` ·
`dropped #898781`. Priority and Severity get their own option colors (adjustable
in seed):

| Priority | color | | Severity | color |
| --- | --- | --- | --- | --- |
| Urgent | `#d03b3b` | | Critical | `#d03b3b` |
| High | `#fab219` | | High | `#fab219` |
| Medium | `#3987e5` | | Medium | `#3987e5` |
| Low | `#898781` | | Low | `#898781` |
| Trivial | `#b8b6b0` | | Cosmetic | `#b8b6b0` |

---

## Schema changes required

The vocabulary is mostly seed/config, but four extensions are needed:

1. **`statuses.ticket_type_id`** — statuses become owned by a type (nullable FK
   to `ticket_types`, scoped within the project). `status_transitions` already
   carries `ticket_type_id`. Rollups/filters keep reading `kind`.
2. **Type-aware hierarchy** — replace the depth-1 check with the parent→child
   type rules in [Hierarchy](#6-hierarchy) (API validation; the allowed pairs
   can live in `ticket_types.config` or a small rules table).
3. **Transition guards** — the API status-change path enforces the two guards in
   [Transitions](#3-transitions-the-workflow-graph) (PR set before `Merged`;
   closing comment before `Fixed`/`Won't fix`/`Cancelled`).
4. **Field set changes** — remove the `epic` field; rename/convert `area`
   (free text) → `component` (select); add `kind`, `component`, `labels`,
   `steps`, `environment`, `pr`, `findings`, `target_date`, `estimate` to the
   seed and attach per the matrix. Add the `caused-by` link type.

No new `field_type` enum value and no new status `kind` are required.

## Migration considerations

Not solved in this spec; to be planned separately. Key mappings when moving the
four existing projects (TASK/APP/GW/TIX) onto this vocabulary:

- **Statuses:** map the old 10 project-wide statuses onto the per-type sets by
  `kind` (e.g. old `investigating`/`brainstorming`/`designing`/`in-progress` →
  `In progress`; `review` → `In review`; `fixed` → `Done`/`Fixed`;
  `open`/`investigated` → `Backlog`/`To do`; `dropped` → `Cancelled`/`Won't
  fix`). Duplicate the statuses per type and re-point `ticket_values.status_id`.
- **Epic field → hierarchy:** for each distinct `epic` field value, create an
  Epic ticket and re-parent its members; then drop the field.
- **`area` → `component`:** seed component options from existing distinct `area`
  strings; copy values.
- **Types:** existing `task` stays `Task`; `subtask` stays `Subtask`; classify
  existing bug-like tickets into `Bug`. New `Epic`/`Spike` created as needed.

## Out of scope (deliberately omitted — YAGNI)

- **Sprints / cycles / iterations** — priority ordering replaces them for a
  solo + agent flow.
- **Time tracking (hours)** — the S/M/L/XL Estimate suffices.
- **Separate Resolution field** — folded into terminal statuses + the closing
  comment guard.
- **Attachments (e.g. Bug screenshots)** — can be added as a field later if
  wanted; not in this pass.
- **Auto-assignment / agent routing by Component** — automation above this
  vocabulary; the fields (Component + Assignee) are designed to enable it later.
- **Human/user assignees** — superseded by the model-tier Assignee.
- **Auto-rollup of Epic status from children** — Epic status is manual for now;
  the progress column already shows child completion.

## Types (glossary)

- **kind** — one of `todo` | `active` | `blocked` | `done` | `dropped`; the
  hardcoded cross-type semantic every status maps to.
- **type** — a ticket type (Epic/Task/Bug/Subtask/Spike); owns its statuses,
  transitions, and field set.
- **status** — a per-type workflow state, carrying exactly one `kind`.
- **transition** — an allowed edge between two statuses of the same type; may
  carry a guard.
- **guard** — a precondition on a transition (field non-empty, comment present).
- **field** — a typed attribute attached to one or more types via
  `ticket_type_fields` (position + required).
- **link** — a non-hierarchy relationship between two tickets via `link_types`.
