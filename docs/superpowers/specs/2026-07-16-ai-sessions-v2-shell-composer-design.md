# AI Sessions v2 — workbench shell + composer

**Date:** 2026-07-16
**Branch:** `worktree-ai-sessions`
**Status:** design (approved for planning)

Follow-on to the completed AI sessions initiative (TIX-186..212). Six user tweaks after
using the built feature. This spec covers **A (shell restructure)** and **B (composer +
meters)**. The larger **C (configurable terminal profiles)** is deferred to its own spec.

## Motivation (the six tweaks)

1. The header top-right **Stop** doesn't make sense — while a turn runs, the **Send**
   button itself should become the stop control.
2. Show **context window usage** and **tokens spent**, not just dollar cost.
3. Agent sessions and terminal sessions must be **two separate lists / two separate nav
   entries**.
4. The left sidebar gets **icons to switch between Tasks / Terminals / Agents**.
5. Selecting **Tasks** shows the projects list in the panel; selecting **Terminals** or
   **Agents** shows that mode's session list.
6. *(→ C, separate spec)* New-terminal flow chooses a launch profile (git-bash / wsl /
   powershell / …), profiles are configurable, plain non-AI TTYs, remote, project/folder
   association, and a new-session button at project level.

Tweaks 3–5 are one coherent change (the shell). Tweaks 1–2 are the composer.

## A — Workbench shell

Today `AppShell` (`apps/web/src/components/shell/app-shell.tsx`) is a single ~236px
sidebar: search, ＋New ticket, a nav block (Home / All tickets / AI sessions), the
PROJECTS list, and a footer (Settings / actor / theme). All AI screens render inside it;
`/ai` is one combined session list.

v2 replaces the single sidebar with an **activity rail + mode panel**.

### Rail (always visible, ~46px)

Vertical icon column:

- **▦ Tasks**
- **▷_ Terminals**
- **✳ Agents**
- (spacer)
- **⚙ Settings** and the **actor avatar + theme toggle**, pinned bottom.

The active mode is **derived from the current route** (not local state), so deep-linking to
a terminal or an agent session lights the correct rail icon. Clicking a rail icon navigates
to that mode's list route.

### Panel (~210px), swaps entirely by mode

- **Tasks** — the existing content: Home, All tickets, then the PROJECTS list with ticket
  prefix chips + progress bars, and ＋New project. ＋New ticket stays here (Tasks-scoped).
- **Terminals** — list of `kind:'terminal'` sessions (title, status pill, workspace, age)
  + ＋New terminal.
- **Agents** — the existing dispatch **tree** filtered to `kind:'agent'` sessions
  (`buildSessionTree`, indent + connector + ticket chip), + ＋New agent session, + a
  **Personas** link to the agent library.

Each panel owns its own empty state.

### Routes

| Route | Mode | Screen |
|---|---|---|
| `/`, `/all`, `/p/$projectKey/...` | Tasks | unchanged |
| `/terminals` | Terminals | terminal sessions list |
| `/agents` | Agents | agent sessions list (tree) |
| `/agents/personas` | Agents | agent library (moved from `/ai/agents`) |
| `/agents/personas/$agentId` | Agents | agent profile (moved from `/ai/agents/$agentId`) |
| `/ai/$sessionId` | follows `session.kind` | universal session viewer, **unchanged** |
| `/ai` | — | **redirect → `/terminals`** |

`AiSessionsScreen` is split: the current all-sessions list becomes two screens driven by a
`kind` filter (`TerminalSessionsScreen`, `AgentSessionsScreen`) sharing the row/tree
components. The old single "AI sessions" nav entry is retired in favour of the two rail
icons. Mode-from-route is a pure helper: `modeForPath(pathname, sessionKind?)`.

For `/ai/$sessionId`, the loaded `session.kind` selects the rail highlight; until the row
loads, no AI icon is forced active (avoids a flash).

### Mobile (< md)

The rail has no room below `md`. The slide-over keeps today's structure but adds a **mode
row** (the three icons) at the top; the panel content below follows the selected mode. This
is the "one sidebar, mode row on top" arrangement, used on mobile only.

## B — Composer + meters

### B1 — Send↔Stop toggle (tweak 1)

Two stop concepts are conflated today:

- **Interrupt the current turn** — composer `onInterrupt` → `socket.interrupt()`; session
  stays alive, returns to idle.
- **End the whole session** — header destructive **Stop** → `useStopAiSession` mutation;
  session status → `exited`.

v2 separates them:

- The composer's **primary button is the run control**: label **Send** when idle, **■
  Stop** while `running` (`status === 'running' || 'starting'`), occupying one slot. The
  separate always-on ■ Stop button is removed. Send is disabled with empty input; Stop is
  always enabled while running.
- The header top-right destructive **Stop** is removed. Ending a session moves to a **⋯
  overflow menu** in the header → **End session** (destructive, with a confirm), reusing the
  `Menu` component. The same overflow (with End session) is added to the terminal session
  header for parity.

### B2 — Context + token meters (tweak 2)

**Backend gap:** `mapSdkMessage` (`apps/api/src/ai/providers/map-sdk-message.ts`) maps the
SDK `result` message to a `result` AgentEvent carrying only `costUsd / durationMs /
isError`. The SDK result's `usage` (token counts) is dropped.

Change: extend the `result` `AgentEvent` in `apps/api/src/ai/types` (and the web mirror in
`apps/web/src/api/types.ts`) with:

```
usage?: {
  inputTokens: number;        // total tokens sent this turn (incl. cache) = current context size
  outputTokens: number;       // tokens generated this turn
  cacheReadTokens: number;
  cacheCreationTokens: number;
}
```

`mapSdkMessage` reads `msg.usage` (fields: `input_tokens`, `output_tokens`,
`cache_read_input_tokens`, `cache_creation_input_tokens`) defensively — all optional,
default 0, `usage` omitted entirely when the SDK provides none (keeps existing result tests
valid). Purely additive; no persistence change (the meters derive live on the client from
`message` frames, exactly like the existing client-side `agentCost`).

**Per-model context window** — a `CONTEXT_WINDOW` constant (new, beside `AGENT_MODELS` in
`prompt-composer.ts` or a small `agent-models.ts`):

```
'claude-opus-4-8'        → 1_000_000
'claude-sonnet-5'        →   200_000
'claude-haiku-4-5-...'   →   200_000
```
Unknown model → fall back to 200_000.

**Header meter cluster** (beside the existing `CostMeter`), a new `ContextMeter`:

- **Context fill** — `▣ 72k / 200k` with a thin bar, from the **last** result event's
  `usage.inputTokens` vs the session model's window. Bar turns danger-coloured near/over the
  window. Absent until the first result arrives.
- **Tokens spent** — cumulative **output** tokens summed across result events (`↓ 148k`),
  the honest non-double-counted figure. Cache-read total shown in the `title` tooltip.

Formatting is a pure helper `formatTokens(n)` (`0`, `948`, `72k`, `1.2M`).

The existing `CostMeter` ($ cost) stays.

## Files touched (indicative)

**Web**
- `components/shell/app-shell.tsx` → split into a rail + a mode panel; new
  `components/shell/activity-rail.tsx`, `components/shell/mode-panel.tsx`, pure
  `components/shell/mode-for-path.ts` (+ test).
- `components/ai/ai-sessions-screen.tsx` → `terminal-sessions-screen.tsx` +
  `agent-sessions-screen.tsx` (kind-filtered; shared row/tree helpers unchanged).
- New routes `terminals-route.tsx`, `agents-route.tsx`; move agent library/profile routes
  under `/agents/personas`; `/ai` redirect.
- `components/ai/prompt-composer.tsx` → Send↔Stop toggle.
- `components/ai/agent-session-screen.tsx` + `ai-session-screen.tsx` → header ⋯ overflow
  (End session); mount `ContextMeter`.
- New `components/ai/context-meter.tsx` (+ test), `agent-models.ts` (`CONTEXT_WINDOW`,
  `formatTokens`) (+ test).
- `api/types.ts` → `result` event `usage`.

**API**
- `ai/providers/map-sdk-message.ts` → extract `usage` (+ test cases).
- `ai/types` (AgentEvent `result`) → `usage?`.

## Testing

- `mapSdkMessage`: result with/without `usage`; partial usage fields default to 0.
- `formatTokens` / context-meter formatting: `72k/200k`, exact-window, over-window danger.
- Send↔Stop: label + handler + disabled logic across idle/running/empty-input.
- `modeForPath`: each route → correct mode; `/ai/$id` with/without known kind.
- Existing api (132) + web (116) + db (18) suites stay green; typecheck + build green.

## Non-goals (this spec)

- C: configurable launch profiles, non-AI TTYs, remote runners, project/folder association,
  project-level new-session button. Its own spec after this ships.
- No change to the session/socket/supervisor protocol, DB schema, or dispatch.
- No new persisted token columns (client-derived meters only).
