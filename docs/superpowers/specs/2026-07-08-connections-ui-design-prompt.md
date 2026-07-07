# tickets — Connections / Integrations UI design prompt

Ready-to-paste prompt for the Claude Design project that holds the **Instrument**
design system for "tickets". Everything below the horizontal rule is the prompt.
It assumes the Instrument system already exists (screens `01`–`07`, the
`design-system.html` library, and the **Automations** screen `08` with its
components — trigger badge, condition/action chips, run-status pill, builder row,
enable toggle). Reuse all of it; this is an extension, not a redesign.

Backing design decision: `docs/superpowers/specs/2026-07-07-automation-event-bus-and-rules-design.md`
(§ roadmap — Layer 3 custom connections: interface + generic no-code HTTP connector + code plugins).

---

# Design brief: "tickets" — Connections (integrations & custom connectors)

## Role & mission

You are extending the **Instrument** design system for "tickets" with a new
product area — **Connections** (integrations with external tools). It builds
directly on the Automations area (screen `08`): a Connection can push ticket
changes outward and, later, sync inbound. Match Instrument exactly and **reuse
the Automations components** (run-status pill, builder row, token chips, trigger
badge, enable toggle) wherever they fit. Add new components only where the domain
needs them. Deliver light + dark, desktop + mobile, plus the new design-system
components.

## The core concept (design around this)

There are two nouns, and the UI must keep them distinct:

- A **Connector** is the *type* of integration — Jira, Linear, Notion, or the
  **Custom (HTTP)** connector. It defines what auth and config it needs.
- A **Connection** is a *configured instance* — "our Jira workspace, these
  credentials, this project mapping." Users create, edit, enable/disable, and
  delete connections. Secrets are always masked.

The headline capability: **users can add a custom connection to any REST API from
the UI, no code** — via the Custom (HTTP) connector. Built-in connectors
(Jira/Linear/Notion) present a simpler credential + mapping form; the Custom one
exposes the full request-builder. Design both paths.

## Scope of this pass

- **Outbound is the primary flow** ("when ticket changes → push to the external
  system"). Design it fully.
- **Inbound / two-way sync is forward-looking** (Layer 4): design the IA and a
  status surface to accommodate it (a "Sync" area on the connection detail, a
  conflicts affordance), but keep field-level inbound mapping low-fidelity /
  directional — do not fully build conflict-resolution screens.

## New components to add to the system

1. **Provider card** — a selectable card for a connector type in the "Add
   connection" picker: logo/monogram, name, one-line description, and (for
   built-ins) an OAuth/credentials hint. Include a **Custom (HTTP)** card.
2. **Connection status pill** — `connected` (positive), `error` / `auth failed`
   (danger), `disabled` (muted), `syncing` (in-flight). (Reuse the run-status
   pill's visual language for consistency.)
3. **Secret input** — a masked credential field (dots), with reveal, "replace"
   affordance for editing an existing secret without showing it, and a "not set"
   state.
4. **Auth selector** — segmented/`Combobox` control choosing None / API key
   (header name + value) / Bearer token. (OAuth shown as a disabled "coming
   soon" option.)
5. **Mapping row** — a repeatable `local field ⇄ remote path` row (reuse the
   Automations **builder row** pattern): a local-field select, a direction glyph,
   and a remote-path input, with add/remove.
6. **Request-template editor** — for the Custom connector's outbound: method
   select + URL template input + headers + a JSON body textarea, all supporting
   the Automations token chips (`{{ticket.key}}`, `{{ticket.title}}`,
   `{{event.to}}`, `{{external.id}}`). Include a **"Send test"** affordance with
   success/error result.

## Working order (screens — light + dark, desktop + mobile each)

**A. Connections list**
Lives in the Settings/Admin shell under **WORKSPACE** (or a new "Integrations"
nav item). Content:
- Header: "Connections", a count, and a primary **＋ Add connection** button.
- A raised panel / card grid of existing connections. Each shows: connector
  logo + connection **name**, a **Connection status pill**, the target (e.g.
  `acme.atlassian.net`), which projects it's bound to, last-sync relative time,
  an enable toggle, and an overflow menu (Edit / Test / Disconnect).
- **Empty state**: "Connect an external tool" with the provider cards inline.

**B. Add connection — provider picker**
A dialog/drawer step showing the **provider cards** (Jira, Linear, Notion,
Custom HTTP). Selecting one advances to the editor (C or D).

**C. Built-in connection editor** (Jira / Linear / Notion)
The simpler form: connection name, **auth** (mostly "Connect with OAuth" button →
show a connected/authorized state; or a **Secret input** for token-based),
target workspace/base URL, **project mapping** (which tickets projects sync to
which remote project — a couple of **Mapping rows**), a **field mapping** section
(Mapping rows), and enable toggle. Save / Test / Cancel. Show a **connected/
authorized** success state and an **auth-failed** error state.

**D. Custom (HTTP) connection editor — the headline screen**
The full no-code builder. Sections top to bottom:
- **Name** + **enable** toggle.
- **Auth** — the **Auth selector** (None / API key / Bearer) with a **Secret
  input** when a credential is needed.
- **Base URL** input, with an SSRF/safety note (only public hosts allowed).
- **Outbound** — one or more **Request-template editors**, each tied to when it
  fires (reuse the Automations trigger badge / a small "on: status changed"
  selector): method + URL template + body template with token chips, and a
  **Send test** button showing the response (status + body preview).
- **Field mapping** — **Mapping rows** (local field ⇄ remote path) and the
  **id-mapping key** (how a local ticket is matched to a remote object).
- **Inbound (forward-looking, low-fi)** — show the read-only **inbound webhook
  URL** we would expose (`/api/connections/:id/inbound`) with a copy button and an
  **HMAC secret**, plus a directional/greyed inbound field-mapping placeholder
  labeled "coming soon".
- Footer: Save / Test / Cancel, with a **validation error** state.

**E. Connection detail / sync activity**
For an existing connection: header with status pill + Test + Disconnect (danger),
the config summary, and a **Sync activity** table reusing the Automations
**run-status pill** — recent pushes (ticket, direction, status, error, when),
with a run-detail expansion. A forward-looking **Conflicts** tab is a directional
placeholder (empty / "0 conflicts").

**F. Mobile** (consistent with screen `07-mobile-interactions`)
- Connections as a stacked card list (logo, name, status pill, toggle).
- The Custom editor as a full-screen sheet; request-template and mapping rows
  reflow to stacked controls.
- Sync activity as a stacked list with the status pill prominent.

## Sample data (use for realistic screens)

Connections:
1. **Acme Jira** — Custom is *not* needed; connector Jira · `connected` ·
   `acme.atlassian.net` · projects TIX→ACME · last sync 3m ago · enabled.
2. **Linear (Core)** — connector Linear · `connected` · projects TASK→ENG ·
   last sync 12m ago · enabled.
3. **Acme Tracker** — connector **Custom (HTTP)** · `connected` ·
   `api.acme.com` · Bearer auth · projects APP→(default) · last sync 1h ago.
4. **Notion Docs** — connector Notion · `auth failed` · needs reconnect ·
   disabled.

Custom (HTTP) editor populated example (for screen D):
- Name: `Acme Tracker`, Auth: Bearer `••••••••`, Base URL `https://api.acme.com`.
- Outbound (on: status changed): `PUT {{baseUrl}}/items/{{external.id}}` · body
  `{ "state": "{{event.to}}", "title": "{{ticket.title}}" }` · Send test → `200 OK`.
- Mapping: `status ⇄ $.state`, `title ⇄ $.title`, `assignee ⇄ $.owner`; id key
  `external.id ⇄ $.id`.

Sync activity (screen E), reuse run-status pills:
- TIX-90 · outbound · **done** · 3m ago
- TIX-88 · outbound · **error** · "PUT → 409 conflict" · 20m ago
- APP-3 · outbound · **syncing** · just now

## Constraints

- Reuse Instrument tokens/components and the Automations components; add only the
  six components listed.
- **Secrets are always masked**; show a safe "replace" flow, never echo a stored
  secret.
- Convey the **safety posture** (public-hosts-only note near URL fields; HMAC
  secret for inbound) as first-class UI, not fine print.
- Light **and** dark, desktop **and** mobile for every screen.
- Deliver new components as Design System cards and screens as new frames
  (suggested repo export name: `09-connections.html`).
