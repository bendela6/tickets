# tickets — AI sessions UI design prompt

Ready-to-paste prompt for the Claude Design project that holds the **Instrument**
design system for "tickets". Everything below the horizontal rule is the prompt.
It assumes the Instrument system already exists (screens `01`–`07`, the
`design-system.html` library, **Automations** `08` and **Connections** `09` with
their components — run-status pill, builder row, token chips, provider card,
enable toggle, secret input). Reuse all of it; this is an extension, not a
redesign.

Backing design decisions:
`docs/superpowers/specs/2026-07-14-ai-sessions-design.md` (the initiative — two
session kinds, personas, dispatch) and
`docs/superpowers/specs/2026-07-14-ai-sessions-terminal-design.md` (E1).

---

# Design brief: "tickets" — AI sessions (terminal + agents)

## Role & mission

You are extending the **Instrument** design system for "tickets" with a new
product area — **AI sessions**. The ticket board becomes a place where AI agents
do real work: they run in a workspace, edit code, and report back on tickets.
Match Instrument exactly and **reuse existing components** (run-status pill,
provider card, builder row, token chips, secret input, avatar — note agents
already render as *square* avatars where humans are round) wherever they fit. Add
new components only where the domain genuinely needs them. Deliver light + dark,
desktop + mobile, plus the new design-system components.

## The core concept (design around this)

Three nouns. The UI must keep them distinct, and the distinction is the whole
design problem:

- A **Session** is one live run. It has exactly one of two **kinds**:
  - **Terminal** — a real shell streamed to the browser (xterm.js). You see and
    type exactly what a CLI shows. It is a *screen*, not data.
  - **Agent** — a structured run. Assistant text, tool calls, tool results, cost.
    The app renders its own chat UI from typed events, so this one can be rich.
  Both kinds live in **one list**. The kind must be legible at a glance.
- An **Agent** (persona) is a *reusable configuration* — name, provider, model,
  system prompt, allowed tools, permission mode. It is **also a user**: it appears
  in the assignee dropdown, owns tickets, and authors comments. Sessions are
  *runs* of an agent. "Backend Reviewer" is the noun; "Session #47" is the verb.
- A **Workspace** is the directory a session runs in.

The headline capability, and the thing the design should build toward: **an agent
session can dispatch another agent onto a ticket**, spawning a child session that
works it and comments back. The sessions list is therefore a **tree**, not a flat
table.

## Scope of this pass

- **The sessions list, both session kinds, and the agent library — design fully.**
- **Dispatch (parent → child sessions bound to tickets) — design fully at the
  list and header level** (the tree, the ticket link, the "put an agent on this"
  entry point from a ticket). This is the vision; it must be visible in the IA
  even though it ships last.
- **Tool-approval flow — design it,** but understand it is off by default
  (sessions run autonomously with a tool allowlist). It is a state the UI must
  support, not the default path.

## New components to add to the system

1. **Session status pill** — `starting`, `running` (in-flight/animated),
   `idle` (agent finished a turn, awaiting your prompt), `awaiting input`
   (blocked on an approval — must read as *needs you*, distinct from idle),
   `interrupted` (server restarted under it), `exited` (with code), `failed`.
   Reuse the Automations run-status pill's visual language.
2. **Session kind glyph** — a compact, unmistakable terminal-vs-agent mark used
   in the list, tabs, and headers.
3. **Terminal frame** — the chrome around the xterm canvas: title bar with
   workspace path and a **connection indicator** (live / reconnecting / ended),
   and a footer that renders the **exit code** on exit and a **scrollback
   truncation notice** when old output has been pruned. Also specify the
   **ANSI-16 terminal palette in Instrument tokens, light and dark** — this is a
   real deliverable, not a detail; xterm ships an ugly default palette and we
   need ours.
4. **Message stream blocks** (the agent chat, in one family):
   - **assistant text** block,
   - **thinking** block — collapsed by default, muted,
   - **tool call card** — collapsible: tool name + a one-line input summary
     collapsed, full input + result expanded; distinct **running**, **ok**, and
     **error** states; a **diff** presentation for `Edit`/`Write`,
   - **subagent group** — a nested, indented run of blocks attributed to a
     dispatched subagent, with its own header.
5. **Approval card** — an inline, blocking card in the stream: tool name, the
   exact input (a command, a file path + diff), and **Allow / Deny** with an
   optional deny reason. It must be the most visually arresting thing on screen —
   a run is *stopped*, waiting on a human.
6. **Prompt composer** — the agent session's input: multiline textarea, send, a
   **Stop/interrupt** control that is present *only while running*, and compact
   model + effort switchers.
7. **Cost meter** — spend so far against an optional budget cap. Small, always
   visible in the session header. Agent runs cost real money and the UI should
   never hide that.
8. **Agent card + agent editor** (the persona library):
   - **card** — square agent avatar, name, provider + model, a permission-mode
     badge, tool count, and "12 sessions · assigned to 3 open tickets."
   - **editor** — name, **provider** (reuse the Connections **provider card** for
     Claude / Codex / Gemini / Grok / local), model select, system prompt
     textarea, **tool allowlist** (chips: Read, Write, Edit, Bash, Grep, Glob,
     WebSearch…), **permission mode** selector, MCP servers, and a default
     workspace. Show a **capability-degraded** state: some providers cannot do
     approvals or resume, and the editor must say so honestly rather than offer
     a control that does nothing.
9. **Session tree row** — the list row, indentable one level: a dispatched child
   session nests under its parent and shows the **ticket it is working**.

## Working order (screens — light + dark, desktop + mobile each)

**A. Sessions list — `/ai`**
The main screen. In the primary nav.
- Header: "Sessions", counts by status, and a primary **＋ New session** button.
- A **tree** of session rows: kind glyph, title, **session status pill**, agent
  (square avatar + name, or "—" for terminal), workspace, linked ticket chip,
  age, cost. A dispatched child indents under its parent with a connector line
  and shows its ticket.
- Filters: kind, status, workspace, agent.
- **Empty state**: "Start a session" with the two kinds offered as cards.

**B. New session dialog**
Step 1: pick the **kind** (two cards — Terminal / Agent). Step 2 branches:
- *Terminal*: workspace select + optional command (default: shell).
- *Agent*: **agent picker** (agent cards from the library, plus "one-off" with
  inline provider/model), workspace, an optional ticket to attach, and the
  opening prompt.

**C. Terminal session — `/ai/:id`**
The **terminal frame** filling the content area. Header: title, workspace path,
session status pill, connection indicator, and Stop (danger). Show these states:
- **live** — running, cursor blinking;
- **reconnecting** — socket dropped, output buffered, a non-alarming banner;
- **exited** — exit code in the footer, scrollback still readable, a **Restart**
  action;
- **interrupted** — "the server restarted; this terminal is gone" + Restart.

**D. Agent session — `/ai/:id` (the headline screen)**
The structured chat. Header: title, agent (square avatar), model, workspace,
linked ticket chip, **session status pill**, **cost meter**, and Stop.
Body: the **message stream** — assistant text, a collapsed thinking block, tool
call cards (one `Bash` running, one `Read` ok collapsed, one `Edit` expanded
showing a **diff**, one `Bash` in error), and a **subagent group**. Footer: the
**prompt composer**.
Design these states explicitly:
- **running** (composer shows Stop),
- **idle** (finished a turn; composer invites the next prompt),
- **awaiting input** — an **approval card** mid-stream, everything below it
  frozen; this state must be unmissable from the *sessions list* too,
- **failed** — an error block with the message, plus Retry.

**E. Agent library — Settings → Agents**
In the Settings/Admin shell under **WORKSPACE**.
- A grid of **agent cards**, ＋ **New agent**.
- The **agent editor** as a full form (see component 8), with a capability-
  degraded example (a local model: approvals and resume disabled, explained).
- An **agent profile** view: the persona's stats, its recent sessions, and the
  open tickets currently assigned to it.

**F. Dispatch touchpoints**
- On the **ticket detail** screen (`04`): a **＋ Put an agent on this** action,
  and — when an agent is working it — a live **session status pill** + link to
  the session, right in the ticket header.
- In the sessions list: the parent/child tree from screen A, shown with a real
  fan-out (one Architect, three Coders on three tickets).

**G. Mobile** (consistent with `07-mobile-interactions`)
- Sessions as a stacked card list; children indented one step. Status pill
  prominent.
- Agent session: the message stream is the whole screen; the composer docks to
  the bottom; the approval card is a **sheet** that demands a decision.
- Terminal on mobile: read-only scrollback by default with an explicit "show
  keyboard" affordance — do not pretend a phone is a good place to type into a
  PTY.

## Sample data (use for realistic screens)

Agents (library):
1. **Architect** — Claude · `claude-opus-4-8` · plan mode · Read/Grep/Glob ·
   "8 sessions · 0 tickets".
2. **Coder** — Claude · `claude-opus-4-8` · auto-accept edits · Read/Write/Edit/
   Bash/Grep · "31 sessions · assigned to 3 open tickets".
3. **Backend Reviewer** — Claude · `claude-sonnet-5` · read-only · Read/Grep/Glob ·
   "12 sessions · 0 tickets".
4. **Triager** — local (Ollama) · `llama-3.3` · read-only · **capability-degraded**
   (no approvals, no resume).

Sessions list (screen A — a tree):
- **#47 · Break down Configurable Views** · agent · Architect · `tickets` ·
  **idle** · 18 messages · $0.42 · 2h ago
  - **#48 · Calendar renderer** · agent · Coder · → **TIX-152** · **running** ·
    $1.06 · 40m ago
  - **#49 · Timeline renderer** · agent · Coder · → **TIX-153** ·
    **awaiting input** · $0.88 · 35m ago
  - **#50 · View config API** · agent · Coder · → **TIX-154** · **exited (0)** ·
    $0.61 · 1h ago
- **#46 · pnpm test --filter web** · terminal · — · `tickets` · **exited (1)** ·
  3h ago
- **#45 · shell** · terminal · — · `tickets` · **running** · 5h ago

Agent session (screen D — session #49, "Timeline renderer", working TIX-153):
- assistant: "I'll add the timeline renderer. Let me look at how the board view
  resolves its columns first."
- thinking (collapsed): "The board assembles logical fields in…"
- tool `Grep` — ok, collapsed — `pattern: "logical-fields"` → 3 files
- tool `Read` — ok, collapsed — `apps/api/src/boards/logical-fields.ts`
- tool `Edit` — expanded, **diff** — `apps/web/src/views/timeline.tsx`
- tool `Bash` — **error** — `pnpm typecheck` → `TS2345: Argument of type 'Date'…`
- assistant: "Typecheck failed — the range needs to be a string. Fixing."
- **approval card** — `Bash` · `rm -rf apps/web/src/views/.cache` · Allow / Deny.
  (The session is **awaiting input**; this is the blocked state.)

Terminal session (screen C — session #46): `pnpm test --filter web`, a few passing
test lines, then a failure, then `exited (1)`.

Cost meter examples: `$1.06` (no cap), and `$0.88 / $5.00` (capped, ~18%).

## Constraints

- Reuse Instrument tokens and the Automations/Connections components; add only the
  nine components listed.
- **Agents are users.** Reuse the existing square agent avatar and `AGENT` badge —
  do not invent a second visual language for AI actors.
- **The two session kinds must never be confusable**, in the list or in a header.
- **Never hide cost.** A running agent spends money; the meter is always visible.
- **`awaiting input` must be unmissable** — it means a process is stopped, waiting
  on a human. It must read as urgent from the sessions list, not just inside the
  session.
- The terminal is a **real PTY**: design for arbitrary, ugly, high-volume output
  (progress bars, ANSI colors, huge stack traces) — not for pretty curated text.
- Light **and** dark, desktop **and** mobile for every screen.
- Deliver new components as Design System cards and screens as new frames
  (suggested repo export name: `10-ai-sessions.html`).
