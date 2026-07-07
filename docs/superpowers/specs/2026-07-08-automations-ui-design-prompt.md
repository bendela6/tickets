# tickets — Automations UI design prompt

This document is a ready-to-paste prompt for the Claude Design project that
holds the **Instrument** design system for "tickets". Everything below the
horizontal rule is the prompt; paste it wholesale into that design project. The
design tool has no access to this repo, so the prompt is self-contained — but it
assumes the Instrument design system already exists in the project (it is the
source of `docs/design/design-system.html` and screens `01`–`07`). Reuse that
system; do not invent a new visual language.

Backing spec: `docs/superpowers/specs/2026-07-07-automation-event-bus-and-rules-design.md`.
Backing plan: `docs/superpowers/plans/2026-07-07-automation-event-bus-and-rules.md`.

---

# Design brief: "tickets" — Automations (no-code rules + runs)

## Role & mission

You are extending the UI for **tickets**, a multi-project ticket tracker used by
humans and AI agents together, already designed in the **Instrument** design
system in this project. You are adding one new product area — **Automations** —
and the components it needs. Match Instrument exactly: same tokens, type scale,
spacing, panels, controls, light + dark, desktop + mobile. This is an extension,
not a redesign. Reuse existing components (panels, tables, dialogs/drawers,
selects/comboboxes, inputs, buttons, badges, toggles, avatars, relative-date)
wherever they fit; only add new components where the domain genuinely needs one.

Deliverables: the screens listed under "Working order", each in **light and
dark**, **desktop and mobile**, plus the handful of **new design-system
components** they introduce (documented as cards in the Components group).

## The product in one paragraph

tickets is a local-first tracker. A workspace holds multiple **projects** (keys
like `items-core`, ticket prefixes like `TASK`, so tickets render `TASK-042`).
Every attribute of a ticket beyond its number — title, status, priority, type,
assignee, epic — is a dynamic **field** defined in data. Users manage fields,
types, statuses, workflows, and views in a **Settings / Admin** area (screen
`06-settings-admin`), which has a 212px secondary nav down the left with a
PROJECT section and a WORKSPACE section. **Automations is a new item in that
Settings secondary nav.**

## What Automations is

A no-code automation builder. A user writes rules like *"when a Bug in TIX moves
to Done, add a comment and POST a webhook."* Rules are stored as data and run
automatically whenever a matching ticket event occurs. Every run is recorded, so
there is also a **Runs** (execution log) view for debugging. Automated actions
are performed by a system user named **Automation** (show it like an agent
user — it already has an avatar treatment in the system).

This is the internal-actions release: actions act on tickets and can POST a
webhook. Real Jira/Linear/Notion connectors and two-way sync come later (see
"Forward-looking" — design the navigation so they slot in, but do not build
their screens as primary deliverables).

## The domain, precisely (use these exact vocabularies in the UI)

A **rule** = a **trigger** + **conditions** (all must match, AND-only) +
**actions** (run top to bottom).

- **Trigger** — exactly one event kind. The seven kinds, with human labels:
  - `created` → "Ticket created"
  - `status-changed` → "Status changed"
  - `value-changed` → "Field changed"
  - `parent-changed` → "Parent changed"
  - `commented` → "Comment added"
  - `archived` → "Archived"
  - `unarchived` → "Unarchived"

- **Condition** — `field` + `operator` + `value`:
  - `field` is a ticket field key (`priority`, `assignee`, `type`, …) or a
    special token `status.from` / `status.to`.
  - `operator` ∈ `is` (eq), `is not` (neq), `is any of` (in), `changed`,
    `changed to` (changed_to), `changed from` (changed_from).
  - Example rendered as a chip: `Type is Bug`, `Status → Done`, `Priority is any
    of High, Critical`.

- **Action** — one of four types, each with its own params:
  - **Add comment** — a body with templating tokens `{{ticket.key}}`,
    `{{event.from}}`, `{{event.to}}`. Show the tokens as insertable chips.
  - **Set field** — a field + a value.
  - **Change status** — a target status (must be a legal transition, else the run
    fails — this is a real, common failure to represent).
  - **Send webhook** — a URL + a JSON body template.

- **Run** (execution) — one record per (event × rule). Status ∈ `pending`,
  `running`, `done`, `failed`, `skipped`. Carries an attempt count, an optional
  error message, and per-action outcomes. Semantics for color:
  - `done` = success (positive/accent), `failed` = terminal error after retries
    (danger), `skipped` = deliberately not run, e.g. loop-depth cap (muted),
    `pending`/`running` = in flight (neutral/insBetween).
  - A rule can retry: failed runs show e.g. "attempt 3 of 5".

- Rules have an **enabled** on/off toggle and belong to a project.

## New components to add to the system

Design these as reusable Instrument components (they recur across the screens):

1. **Trigger badge** — a small chip for an event kind (icon + label), one visual
   treatment, seven contents.
2. **Condition chip** — compact read-only summary chip (`Type is Bug`,
   `Status → Done`) used in the rules list to summarize a rule at a glance.
3. **Action chip** — compact summary chip for an action (`＋ Comment`, `Set
   priority`, `→ Done`, `Webhook`).
4. **Run status pill** — the five execution states with the semantic colors
   above; include an attempt suffix variant ("failed · 3/5").
5. **Builder row** — the repeatable form-row used inside the rule editor: a row of
   inline selects/inputs with a drag affordance and a remove (×) button, plus an
   "＋ Add condition" / "＋ Add action" affordance beneath the group. This is the
   heart of the editor — make it dense, keyboard-friendly, and calm.
6. **Enable toggle** — if the system lacks a switch, add one; otherwise reuse.

## Working order (screens — light + dark, desktop + mobile each)

**A. Automations list** (Settings → Automations)
Rendered inside the existing Settings/Admin shell (reuse the 212px secondary nav;
add an "Automations" item under PROJECT). Content:
- Header: "Automations", a count ("4 rules · 1 disabled"), and a primary
  **＋ New rule** button.
- A raised panel table of rules. Each row: rule **name** (link), a **Trigger
  badge**, a compact **condition + action summary** (using condition/action
  chips, truncating with "+2 more"), an **enabled toggle**, a **last run**
  cell (a Run status pill + relative time), and a row overflow menu
  (Edit / Duplicate / Delete). Disabled rules read dimmed.
- **Empty state**: friendly zero-rules panel with a "Create your first rule" CTA
  and one example of what a rule can do.

**B. Rule editor** (create + edit)
Recommend a **right-side drawer** (or full panel) over a modal, given the density.
Design both the **new** and **edit** states. Sections top to bottom:
- **Name** input + **enabled** toggle.
- **When** — a single **Trigger** select (the seven kinds).
- **If** — the conditions group: zero or more **Builder rows** (field select →
  operator select → value input), with "＋ Add condition". Show the AND semantics
  clearly (a subtle "and" between rows). Empty conditions = "runs on every
  <trigger>".
- **Then** — the actions group: one or more **Builder rows** keyed by action
  type, where the trailing fields change with the type:
  - Add comment → a textarea with insertable token chips.
  - Set field → field select + value control.
  - Change status → status select.
  - Send webhook → URL input + JSON body textarea.
- Footer: **Save** / **Cancel**, and a **validation error** state (e.g. "Add at
  least one action").
- Design a **populated** example (the "escalate blocked criticals" rule below) so
  the density is real, not a single empty row.

**C. Runs / execution log**
A view (own tab within Automations, or a section beneath the list — your call)
that lists recent runs across the project's rules:
- Filters: by rule and by status.
- Table rows: rule name, the ticket it ran on (`TIX-90` link), a **Run status
  pill** (with attempt suffix when retried), the error message (truncated) for
  failures, and a relative timestamp.
- A **run detail** treatment (expand-in-place or side panel) showing the
  triggering event and the **per-action outcomes** (each action ✓/✗ with detail:
  posted comment id, webhook 200, or "transition Done → In Progress not allowed").
- **Empty state** ("No runs yet").
- Represent all five statuses in the sample data, including one `failed`
  (illegal transition) and one `skipped` (loop-depth cap, with the tooltip/detail
  "stopped at depth 5 to prevent a loop").

**D. Mobile** (consistent with screen `07-mobile-interactions`)
- Automations list as a stacked card list (name, trigger badge, enabled toggle,
  last-run pill).
- Rule editor as a full-screen sheet with the same When / If / Then sections,
  builder rows reflowing to stacked controls.
- Runs as a stacked list with the status pill prominent.

## Forward-looking (design the IA to accommodate; not primary deliverables)

Leave room in the Automations area (and/or the WORKSPACE settings nav) for a
future **Integrations / Connections** area — a list of provider connections
(Jira, Linear, Notion) with connected/disconnected state and an "Add connection"
CTA — and for actions/triggers that reference an external connection. A single
low-fidelity placeholder of a "Connections" list is welcome but optional; do not
build connection-detail, field-mapping, or sync-status screens in this pass.

## Sample data (use for realistic screens)

Projects: `items-core` (TASK), `items-app` (APP), `gateway` (GW), `tickets` (TIX).

Rules (for the list + editor):
1. **Announce shipped bugs** — enabled · When Status changed · If `Type is Bug`
   and `Status → Done` · Then Add comment "{{ticket.key}} shipped 🎉". Last run:
   done, 4m ago.
2. **Escalate blocked criticals** — enabled · When Status changed · If `Priority
   is Critical` and `Status → Blocked` · Then Set field `assignee = Team Lead`;
   Add comment "Escalated — blocked & critical". Last run: done, 1h ago. (Use
   this as the populated editor example.)
3. **Auto-triage new bugs** — enabled · When Ticket created · If `Type is Bug` ·
   Then Set field `priority = Medium`. Last run: done, 20m ago.
4. **Ping ops on new epics** — disabled · When Ticket created · If `Type is Epic`
   · Then Send webhook `https://hooks.example.com/epics`. Last run: —.

Runs (for the log), mixing statuses:
- `Announce shipped bugs` · TIX-90 · **done** · 4m ago
- `Escalate blocked criticals` · GW-14 · **done** · 1h ago
- `Ping ops on new epics` · APP-3 · **failed · 3/5** · "webhook POST → 503" · 2h ago
- `Auto-triage new bugs` · TASK-77 · **failed** · "transition To Do → Done not
  allowed" · 3h ago
- `Announce shipped bugs` · TIX-88 · **skipped** · "stopped at depth 5 to prevent
  a loop" · 5h ago
- `Escalate blocked criticals` · GW-9 · **running** · just now

Automated actions are attributed to the **Automation** system user (agent-style
avatar).

## Constraints

- Reuse Instrument tokens and components; add only the six components listed.
- Light **and** dark for every screen; desktop **and** mobile.
- Dense where work happens (lists, builder rows), calm elsewhere.
- No native-looking controls; use the system's custom form controls.
- Deliver the new/updated components as Design System cards and the screens as
  new frames (suggested export name for the repo: `08-automations.html`).
