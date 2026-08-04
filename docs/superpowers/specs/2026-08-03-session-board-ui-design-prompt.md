# session board — UI design prompt

Ready-to-paste prompt for the Claude Design project. Everything below the
horizontal rule is the prompt.

Deliberately **unguided**: it supplies the data model, real sample data, and the
hard technical constraints, and leaves every layout, structure, navigation and
visual decision to the designer. The subject is not a tickets feature and is not
bound to the Instrument system — it is a standalone local dev tool
(`~/.claude/session-board.js`, one self-contained page on `localhost:4680`).

---

# Design brief: "session board"

## What this is

A local web page that shows what Claude Code is doing on a developer's machine.

Claude Code is a terminal AI coding assistant. A developer runs several
conversations at once — different repositories, different features — and each one
tracks its own task list, its own decisions, and sits in its own git working
tree. All of that currently lives inside the chat transcripts, so answering
"where is everything at" means scrolling back through several terminal windows.

This page reads that state off disk and displays it. It is **read-only** — it
observes, it never acts.

Design it however you think it should work. Everything below is data and
constraints, not direction.

## The data

### Session

One Claude Code conversation. Between 1 and ~30 exist at once; 5–10 is typical.

| Field | Notes |
|---|---|
| title | Auto-generated, e.g. "Create session status check skill". **May be missing.** |
| project | The repository it runs in. Several sessions share one project. |
| worktree | Optional. A checkout of the project; belongs to that project, not beside it. |
| live | Whether it is actively working right now |
| last activity | Timestamp — ranges from seconds to days ago |
| started | Timestamp — sessions can run for days |
| turns | Two counts: messages from the developer, messages from Claude |
| tool calls | Integer, can reach the hundreds |
| subagents | Integer, often 0 |
| model | e.g. `opus-5` |
| directory | Absolute path, can be long |

### Task

Belongs to a session. A session has 0–30; 7–10 is typical. Many sessions have none at all.

| Field | Notes |
|---|---|
| text | One line, e.g. "Mirror the todo list to disk via a PostToolUse hook" |
| status | `in progress`, `pending`, or `completed`. Usually 0 or 1 in progress. |

### Prompt

The last six things the developer typed in that session.

| Field | Notes |
|---|---|
| text | Three words to a full paragraph |
| timestamp | |

### Git state

Belongs to a session, via its directory. **May be absent** — not every session runs in a repository.

| Field | Notes |
|---|---|
| branch | |
| unpushed | Commit count. Can be 0, can be 200+. |
| modified / untracked | Counts |
| files | Up to 12: a two-letter status code and a path |
| commits | Last four: short SHA, subject line, relative date |

### Decision

Belongs to a session. A record of something the developer settled during the
conversation. 0–20 per session. The richest object here.

| Field | Notes |
|---|---|
| id | Sequential number |
| icon | One emoji chosen for the topic |
| topic | Short label, e.g. "Flashing console windows" |
| status | `decided`, `open`, `reversed`, or `superseded` |
| context | A paragraph: why this came up, what was at stake |
| question | The question as it was actually asked |
| options | 2–4. Each has a label, a description, and two independent flags: `recommended` and `chosen`. |
| decided | Which option won |
| rationale | Why — often in the developer's own words |
| supersededBy | Optional pointer to the decision id that replaced this one |

Note on options: `recommended` and `chosen` are **independent**. An option can be
both, either, or neither. A recommendation that was *not* chosen is meaningful
information, not an error — across the sample data below, 8 of 16 decisions
carried a recommendation and only 4 of those recommendations were accepted.

## Real sample data

### Sessions

| Title | Project | Worktree | Tasks | State |
|---|---|---|---|---|
| Create session status check skill | tickets | — | 7 total, 7 done | live |
| Create icons for app | tickets | icon-studio | 9 total, 8 done, 1 in progress | idle 32m |
| Check UI components in items-core | tickets | — | none | idle 2h |
| Create reusable sidebar drawer component | tickets | — | 10 total, 10 done | idle 14h |
| Move eer package and make it web-importable | tickets | ui-primitives-treeview | none | idle 2d |
| *(no title)* | items-core | — | none | idle 13h |
| *(no title)* | termostat | — | none | idle 1d |

The live session's detail: running 55h · 26 turns from the developer, 340 from
Claude · 139 tool calls · 7 subagents · model `opus-5` ·
`C:\Users\bbend\Desktop\Projects\tickets`

### Tasks (from the live session)

- Build the session-status skill — completed
- Build the catch-me-up skill — completed
- Build the Stop guard hook and wire it into settings.json — completed
- Mirror the todo list to disk via a PostToolUse hook on TodoWrite — completed
- Build the session board web UI on :4680 — completed
- Put the four ~/.claude files under version control — pending

### Prompts (newest first)

- "I want to completely redesign this page(s). give me prompt so I can ask to claude design"
- "I need more details in decisions. I need context, I need question, I need suggested answers, recommended answers, and decided answers"
- "I think there is some bug. some terminal is opening every second"
- "instead of putting all content in 1 page I prefer to have tasks, prompts, git, decisions"
- "group them by project"
- "difficult to understand which session is which. we need to get some title or preview of what session is about"

### Git

Branch `main` · **222 unpushed** · 8 modified · 1 untracked

```
 M  apps/web/icons.config.json
 M  apps/web/public/favicon.svg
 M  apps/web/public/icon-192.png
 M  packages/web/ui/src/foundation/typography/typography.demo.tsx
 ??  ui.md
```

Recent commits:

```
935ea20  docs(ui): record follow-ups left open at merge for the panel primitives   2 days ago
1a33963  fix(playground): the gallery sidebar is sticky again                      2 days ago
9e987a0  refactor(web): drop ItemDetail's unused onClose                           2 days ago
```

### Decisions

Tally across the set: **13 decided · 1 open · 1 reversed · 1 superseded.**

**A decided one**

- icon 🪟 · topic "Flashing console windows" · status `decided`
- context — "After auto-start made the board run detached, console windows began
  opening several times a second. A detached process has no console, and on
  Windows a child whose parent has none gets its own window. The board ran git
  four times per 1.5s poll."
- question — "How should the console-window bug be handled?"
- options
  - "windowsHide plus a git cache" — "Suppress the window and cut spawns from ~12
    per 5s to 4." — recommended ✓, chosen ✓
  - "Drop git from the board" — "Git is the only thing that spawns a process, so
    removing it makes the bug impossible rather than suppressed."
  - "Leave the board off" — "Guaranteed quiet, no board."
- decided — "windowsHide plus a git cache"
- rationale — "Verified in the detached configuration — the failing path, not a
  safer substitute. Measured 2 real git rounds per 12 polls."

**A reversed one**

- icon 🚀 · topic "Board auto-start" · status `reversed` · supersededBy 15
- context — "The board was a child process of Claude Code, so restarting the
  editor killed it."
- question — "How should the board start from now on?"
- options
  - "SessionStart hook" — "Launches on every session start; a duplicate start is
    a safe no-op." — recommended ✓, chosen ✓
  - "Windows startup task" — "Survives everything, but lives outside your dotfiles."
  - "Leave it manual" — "A command after each restart."
- decided — "SessionStart hook — then removed"
- rationale — "Reversed after it caused decision 15. Running detached is what
  removed the board's console, and that is what made every git spawn open a
  window."

**An open one**

- icon 📦 · topic "Version control for the new files" · status `open`
- context — "Seven files now live in ~/.claude — two skills, three hooks, the
  board and its launcher. None are in a git repository, so there is no history
  and no backup."
- question — "Should the ~/.claude files be put under version control?"
- options
  - "Leave unversioned for now" — "Deferred once already, when it was three small
    files." — chosen ✓
  - "Init a repo in ~/.claude" — "History and backup for everything, including
    unrelated config."
  - "Move them into a dotfiles repo" — "Versioned and portable, at the cost of
    symlinks or a sync step."
- decided — "Leave unversioned for now"
- rationale — "Still open — reasonable when it was three files, less so at seven."

**A decision with no options recorded** also occurs, where the developer simply
stated what they wanted rather than picking from a list. Those have a topic,
context, decided and rationale, but an empty options array.

## How it gets used

Left open in a browser tab, often on a second monitor, for hours at a time.
Glanced at frequently; read properly occasionally. The developer is on Windows.

## Data states to handle

- No sessions at all
- One session, live, with no tasks yet
- A session with a title but no tasks, no git repository and no decisions — common
- 30 sessions across 6 projects
- Everything idle for a day
- Sessions with no title
- A single project containing both normal sessions and worktree sessions

## Hard technical constraints

- **One self-contained HTML page.** Inline `<style>` and `<script>` only. No build
  step, no framework, no CDN, no external stylesheet, no web fonts, no image
  files. Icons must be inline SVG or text glyphs.
- **System fonts only** — `ui-sans-serif, system-ui, -apple-system, "Segoe UI"`,
  plus `ui-monospace` for paths, SHAs and ids.
- **Light and dark**, via `prefers-color-scheme`.
- **The page re-renders from JSON every 1.5 seconds.** Counts, states and lists
  change while the developer is reading. Nothing may jump or lose scroll position
  when a value changes.
- **Browser tab, 900–1400px wide**, frequently docked to around 700px.
- **Read-only** — nothing on the page can change anything outside the page's own
  view state.

Everything else — structure, navigation, hierarchy, density, typography, colour,
iconography, how many screens there are and what belongs on each — is yours.


---

# Follow-up prompt — the single update message

Paste everything below the horizontal rule as one message, after the brief above.

---

# Addition to the session board brief

Three additions. The first **replaces** the Task section of the original brief.
Everything else in the brief still stands, including the constraints.

## 1. Features and tasks — replaces the earlier Task section

Tasks belong to **features**, not to the session directly.

### Feature

A named unit of work owning a set of tasks. A session has 1–8 features; 3–5 is
typical. A feature holds 1–12 tasks.

| Field | Notes |
|---|---|
| name | Short title, e.g. "Stop guard hook" |
| description | **Markdown.** A paragraph to roughly a screenful. Often absent. |
| tasks | 1–12 |

A feature can be entirely finished, entirely unstarted, or mid-flight. Sessions
that tracked no work have no features at all.

### Task

| Field | Notes |
|---|---|
| title | One line |
| description | **Markdown.** Usually one or two sentences, occasionally longer. Often absent. |
| status | One of `todo`, `in progress`, `blocked`, `done`, `cancelled` |
| blockedBy | Only when blocked. A sentence naming what it waits on — usually an unanswered question, sometimes an external job. |
| estimated | Minutes. Often absent; plenty of tasks are never estimated. |
| spent | Minutes. Present once work starts. Can be 0. |

Facts about these fields that affect what has to be displayable:

- **`spent` can exceed `estimated`**, sometimes by a lot. Over budget is a normal
  state, not an error, and both numbers stay meaningful.
- A task can have **`spent` with no `estimated`**, or **`estimated` with no `spent`**.
- **`cancelled` tasks can carry real `spent` time.** Work happened, then the task
  was dropped. That time still counts.
- **`blocked` is not `todo`.** Blocked means work was ready or underway and cannot
  proceed; the reason matters as much as the state.
- Usually **0 or 1 task is `in progress`** across a whole session, occasionally 2.
- Totals roll up per feature and per session: counts by status, total estimated,
  total spent.

## 2. Descriptions are markdown

Feature descriptions, task descriptions, and the `context` and `rationale` fields
of a decision are all **markdown**, rendered to HTML with
[TanStack Markdown](https://tanstack.com/markdown) (`@tanstack/markdown` — no
runtime dependencies, roughly 4.9 KB gzip for the parser plus 6.7 KB for the HTML
renderer, with a vanilla-JS path via `renderHtml`).

The rendered subset is bounded and known. Prose styles are needed for:

- Headings, with generated duplicate-safe ids
- Bold and italic
- Inline code, and fenced code blocks
- Links and images
- Bulleted and numbered lists, including nesting
- Tables
- Footnotes

Not supported, so no styling is needed: MDX, automatic linkification, and the
long tail of CommonMark and GFM edge cases.

The constraint this creates: **long-form prose has to live inside a dashboard
that is otherwise dense and scannable**, and a single feature description can run
to a screenful. Both the reading case and the scanning case are real.

### A real feature description, verbatim

The markdown below is one `description` field, shown as the renderer receives it.

    Refuses to end a session while todo items are still actionable.

    The hook cannot see the todo list directly — Claude Code keeps it in memory
    rather than on disk — so a `PostToolUse` hook mirrors it to
    `~/.claude/.session-guard/` first, and the guard reads the mirrored counts.

    ## Decision order

    1. Release file present → consume it and allow the stop
    2. No mirror file → allow, since a session that never tracked tasks has none
       to guard
    3. `actionable == 0` → allow
    4. Otherwise → block, and say exactly what is outstanding

    | Path | Result |
    |---|---|
    | release file present | allow, then re-arm |
    | no mirror file | allow |
    | 3 actionable | block |

    The escape is a **consumed release file** rather than an attempt counter: a
    counter ends the session whether or not work remains, which is the wrong
    condition. See [the guard](https://example.invalid/guard) for the full order.

That single field contains a paragraph, a heading, a numbered list, a table,
inline code, bold, and a link — which is representative, not a worst case.

## 3. Real sample data for features and tasks

**session-status skill** — 5 tasks · 110m estimated · 119m spent

| Task | Status | Est. | Spent | Description |
|---|---|---|---|---|
| Write the skill file | done | 45m | 62m | Session-scoped report with evidence slots and feature grouping |
| Run the RED/GREEN subagent test | done | 30m | 34m | Watch an agent fail without the skill, then pass with it |
| Fix the icon and git-count defects | done | 15m | 11m | Testing found an invented icon and counts contradicting git |
| Re-verify after the fixes | blocked | 20m | 4m | *blocked by:* the test subagent was killed by an editor restart and has not been re-run |
| Add a Prompts panel to the skill output | cancelled | — | 8m | Dropped — the board covers this better than a chat report |

**Stop guard hook** — 4 tasks · 50m estimated · 90m spent

| Task | Status | Est. | Spent | Description |
|---|---|---|---|---|
| Build the guard | done | 30m | 41m | Refuse to end a session while todo items are still actionable |
| Replace jq with sed | done | — | 18m | `jq` is in the allowlist but absent from the machine, and every example assumed it |
| Teach it to count actionable todos | done | 20m | 22m | Read the mirrored counts instead of blocking blindly |
| Decide the release mechanism | done | — | 9m | A consumed release file rather than an attempt counter |

**Session board** — 6 tasks · 260m estimated · 196m spent

| Task | Status | Est. | Spent | Description |
|---|---|---|---|---|
| Serve tasks, git and decisions | done | 60m | 74m | One self-contained node file, no dependencies |
| Add session titles and switching | done | 30m | 45m | Titles come from the transcript, not the session id |
| Split the detail pane into tabs | done | 20m | 16m | — |
| Fix the flashing console windows | done | 15m | 38m | A detached process has no console, so every git spawn opened a window |
| Redesign the whole page | in progress | 120m | 23m | — |
| Add cost and file-change panels | todo | 45m | 0m | Token totals and the files a session edited |

**Housekeeping** — 2 tasks · 25m estimated · 0m spent

| Task | Status | Est. | Spent | Description |
|---|---|---|---|---|
| Put the ~/.claude files under version control | todo | 20m | 0m | Seven files, no history, no backup |
| Delete the leftover test fixture | blocked | 5m | 0m | *blocked by:* removal was denied by a permission rule; the developer must do it |

Session rollup: **17 tasks · 11 done · 1 in progress · 3 todo · 2 blocked ·
1 cancelled · 445m estimated · 405m spent.**

## 4. Additional session data

All of the following is available per session. Treat it as optional — a design
need not surface all of it, and any of it can be absent.

**Cost and consumption** — token totals (real example: output `688,035`, cache
read `102,003,708`, cache write `6,266,821`, input `833`); a derived cost
estimate, which is an estimate because prices are not in the data; effort level
such as `xhigh`, which can change mid-session.

**Tool activity** — a breakdown by tool name (real example: `Bash` 73, `Edit` 46,
`Write` 23, `AskUserQuestion` 16, `TodoWrite` 10, `Read` 8, `Agent` 7,
`Skill` 3); the actual shell commands run, with timestamps; tool calls that were
denied by a permission rule.

**Files touched** — the distinct paths edited during the session, 14 in the real
example, with full absolute paths; when each was last edited; whether a path is
inside the session's repository or outside it, since in the real example most
edits were outside it; and a per-file revision count, because every edit is
backed up.

**Subagents** — a list rather than a count (real example: 7); the task each was
given, from one line to a paragraph; each one's size, duration, and whether it
finished or was killed.

**Hooks** — every firing with its message (real example: 25 firings of one hook);
whether a firing blocked the session; hook errors; and which skill was driving
each part of the session (real example: `superpowers:brainstorming`,
`superpowers:writing-skills`, `update-config`, `session-status`).

**Time and rhythm** — a timestamp on every message (430 assistant, 234 user in
the real example), which yields an activity timeline, response latencies, the
longest idle gap, and which hours held the most work.

**Environment** — git branch per message, so mid-session branch switches are
visible; working directory per message; permission mode and changes to it; and
the Claude Code version.

**Conversation shape** — messages queued while busy and how many were cancelled
before running (real example: 35 enqueued, 28 ran, 7 cancelled); where the
developer interrupted mid-work; where the conversation was compacted.
