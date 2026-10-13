# tickets

pnpm + turbo monorepo. `apps/api` (Fastify-style API, port 4600) · `apps/web` (React 19, TanStack Router/Query, Tailwind v4 via vite plugin, radix-ui, IBM Plex fonts) · `apps/mcp` (MCP server) · `packages/` incl. `@tickets/db`.

## Design system — Instrument

- The redesign is **complete** (2026-07-07): every screen is Instrument, the legacy `styles/globals.css` is deleted, and Tailwind **preflight is ON**. Spec of record: `docs/design/design-system.html` (exported from the Claude Design project). Brief: `docs/superpowers/specs/2026-07-05-ui-redesign-design.md`; plans in `docs/superpowers/plans/`.
- Shared components and tokens are bh's (`bendela6/bh`, the shared UI library): `@bh/ui`, `@bh/form`, `@bh/table`, `@bh/markdown` and `@bh/config`, copies of one bh release under `packages/bh/` (each `package.json` says which). **Never edit them here**: a change to a component or a token is a change in bh, copied in with its next version from the gateway's bh page, which shows a copy edited here as edited. Components only tickets uses live in `apps/web` (`ItemKey`, `RailLabel`).
- **`--spacing` is 1px, so a number in a class name IS pixels** — `p-16` is 16px, `gap-8` is 8px (changed 2026-08-04). Anything written against Tailwind's stock `.25rem` scale renders at a quarter size and still compiles.
- **Radius is a number too: `rounded-6` is 6px** (changed 2026-08-07). The t-shirt rungs and the parallel `rounded-control-*` ladder are gone; the design sanctions 3/4/5/6/8/12 but any number compiles. Radius is NOT on the spacing scale — it works because `border.css` redefines the fifteen `rounded[-corner]-*` utilities, so a t-shirt spelling emits no rule at all rather than the wrong size. `rounded-full`/`rounded-none`/`rounded-[7px]` still work; bare `rounded` no longer does.
- **Edge widths take fractions: `border-1.5` is 1.5px** (changed 2026-08-08). Same mechanism, in bh's `border.css` — it redefines `border-*` (+ its 8 sides), `outline-*` and `ring-*` with `--value(number)`, since Tailwind's own bare-value form takes integers only and rejects fractions silently. `divide-*`, `inset-ring-*` and `stroke-*` were left alone and still need `divide-y-[1.5px]`. The colour half of `border-*` is untouched.

## Project skills (in `.claude/skills/` — use them)

Generic design→code method — stack specifics live in `design-system-adapter.md`:
- `tokenizing-the-design` — before adding/changing design tokens, or when a value would be hardcoded
- `mapping-component-states` — before implementing or verifying a component; enumerate the state matrix
- `implementing-a-component` — before building or changing a UI component
- `verifying-a-component` — before claiming a component matches its design and works

Project-specific ops:
- `running-the-stack` — ports, URLs, deploy, startup gotchas
- `syncing-design` — pushing/pulling the claude.ai/design project

## Running (details in running-the-stack)

`docker compose up -d` → single `app` container on :4610 (nginx serves web + reverse-proxies `/api` to an internal node api). Dev loop: `pnpm dev` (mprocs: api :4600, web :4620, studio, watchers). Publish to 4610 at phase boundaries: `docker compose up -d --build` (or `sh scripts/deploy-web.sh`). Checks: `pnpm typecheck` · `pnpm --filter @tickets/web test` · `pnpm build`. The live app (tickets.bendelhome.cc) runs on the gateway, and **a push to `main` deploys it** within a minute — see running-the-stack.

## Tasks

- Every plan's tasks live here, in `tasks/*.json`, one file per project: `tickets.json` (TK), `gateway.json` (GW), `bh.json` (BH), `items-core.json` (IC), `auth.json` (AU, the shared authentication service, Rauthy; started 2026-10-13), `items-app.json` (IA, started 2026-10-13 from the older APP tickets). Moved in from those repos on 2026-10-12; they keep no task list of their own.
- The shape and its rules are `tasks/tasks.schema.json`: epics → features (status, where, today, chosen, open choices, plan) → tickets → subtickets. Ids never change; a new one takes the next number under its parent. Titles say what is done, verb first: Add, Replace, Move, Fix … when ….
- `pnpm tasks:check` validates them (the schema, ids, references, titles, approvals); `pnpm tasks` serves the viewer (`tasks/viewer.html`) at http://127.0.0.1:4741, launch config "tasks". Ask before moving an open choice to `chosen`.
- Approval is the user's: they press Approve in the viewer, which writes `approved: true` on items without children. A parent (an epic, a feature with tickets, a ticket with subtickets) is approved when all its children are: worked out, never stored, and approving it approves everything under it. Don't set `approved` yourself.
- `blockedBy` (on an epic, feature, ticket or subticket) lists what must be done first, each with a why; an item also waits on its parents' blockers. An approved item whose blockers aren't all done waits: don't build it before them (the viewer flags it "Approved, waiting"). Blockers name the most specific item, never the item's own parent or child, and make no cycle; `pnpm tasks:check` enforces it. `waitingOn` is only for waits in words ("your choices").
- The viewer also writes the user's other words, through `POST /edit`: `cancelled: true` (on items without children, never beside `approved` or `done`) means don't build it; an item dropped as a duplicate or moved elsewhere is cancelled the same way, never marked done, keeping its title, its description saying where the work went; a parent whose items are all cancelled is cancelled too, so it isn't `done`; `notes` are the user's notes on an item, to read before working on it (a note with a `quote` is about that fragment of the item's description, marked in the viewer, shown with its fragment; the viewer shows a feature's notes and all its tickets' as one chat with the planner, in a panel beside the page that any of their Notes buttons opens, a ticket's notes tagged with its id and the feature's open questions at the end; each note is still stored on its own item; notes with `closed` fold away as resolved); and a feature's `openChoices` are questions ({question, options, recommended}) the user answers in place (`answer`, `answeredOn`). Fold an answered question into `chosen` ("your answer") and the plan, then remove it; never write an `answer` yourself.
- Two sessions work the plans, each started in a new session in the tickets folder (not a worktree): the **builder** (`/building-the-plan`) builds what is approved through worker subagents, and the **planner** (`/keeping-the-plan`) takes in your answers and notes. Run one of each.
- The **planner** session does that folding as the user works, and talks to them only in the viewer: skill `keeping-the-plan`. `node scripts/tasks-planner.mjs wait`, run in the background, wakes it when an answer or an unread note (one without `seen`) has settled. It replies with notes `by: "claude"` (under a question, in the question's own `notes`), sets `seen` on the notes it has read, and shows what it is doing in the viewer's corner badge (`POST /planner`). Every session edits these files through `edit()` in `scripts/tasks-lib.mjs`, one read-modify-write at once, since the viewer, the builder and the planner all write them.
- Every agent on the plans says what it is doing: `node scripts/tasks-agents.mjs say <name> <state> [--item <id>] [text]`. The states are listening, working, done, failed, abandoned and stopped. The viewer shows each one in its corner ("Worker TK-7 working: Running the tests") and as a chip on the item's card. The builder says `builder listening` every 20 seconds while it waits, and `working` while it dispatches. Each worker it dispatches has its own name (`worker-tk-7`), says `working` with what it is doing at every step, and ends with `done`, `failed` or `abandoned`; the builder says it for a worker that ended without. A worker that says nothing for 30 minutes shows as "abandoned?". What they said is kept in `tasks/.runtime/agents.json`, which git ignores.

## Conventions

- Conventional commits scoped by app: `fix(web): …`, `feat(deploy): …`; one commit per task/screen.
- Docs are self-contained on types: every named type used on a doc page is defined on that same page (bottom `## Types` section or inline).
- Ticket data spans 4 projects — items-core/TASK, items-app/APP, gateway/GW, tickets/TIX — partitioned by epic; migrated tickets keep their old IDs in description headings.
