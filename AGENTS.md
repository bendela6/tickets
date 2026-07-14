# tickets

pnpm + turbo monorepo. `apps/api` (Fastify-style API, port 4600) · `apps/web` (React 19, TanStack Router/Query, Tailwind v4 via vite plugin, radix-ui, IBM Plex fonts) · `apps/mcp` (MCP server) · `packages/` incl. `@tickets/db`.

## UI redesign (in progress, branch `redesign`)

- Total redesign to the **Instrument** design system. Spec of record: `docs/design/design-system.html` (exported from the Claude Design project). Brief: `docs/superpowers/specs/2026-07-05-ui-redesign-design.md`; plans in `docs/superpowers/plans/`.
- Locked decisions: full-stack scope; **replace per phase** (legacy `styles/globals.css` screens coexist with redesigned ones until ported); extend vocabulary + seed data; verify by measurement, not screenshot judgment; autonomous execution with a commit per task.
- **Tailwind preflight is OFF.** Native controls and unlayered legacy CSS bite — see the trap tables in the project skills before debugging styles.

## Project skills (in `.agents/skills/` — use them)

Generic design→code method — stack specifics live in `design-system-adapter.md`:
- `tokenizing-the-design` — before adding/changing design tokens, or when a value would be hardcoded
- `mapping-component-states` — before implementing or verifying a component; enumerate the state matrix
- `implementing-a-component` — before building or changing a UI component
- `verifying-a-component` — before claiming a component matches its design and works

Project-specific ops:
- `running-the-stack` — ports, URLs, deploy, startup gotchas
- `migrating-legacy-screens` — porting screens off globals.css / deleting legacy CSS
- `syncing-design` — pushing/pulling the claude.ai/design project

## Running (details in running-the-stack)

`docker compose up -d` → single `app` container on :4610 (nginx serves web + reverse-proxies `/api` to an internal node api). Dev loop: `pnpm dev` (mprocs: api :4600, web :4620, studio, watchers). Publish to 4610 at phase boundaries: `docker compose up -d --build` (or `sh scripts/deploy-web.sh`). Checks: `pnpm typecheck` · `pnpm --filter @tickets/web test` · `pnpm build`.

## Conventions

- Conventional commits scoped by app: `fix(web): …`, `feat(deploy): …`; one commit per task/screen.
- Docs are self-contained on types: every named type used on a doc page is defined on that same page (bottom `## Types` section or inline).
- Ticket data spans 4 projects — items-core/TASK, items-app/APP, gateway/GW, tickets/TIX — partitioned by epic; migrated tickets keep their old IDs in description headings.
