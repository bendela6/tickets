# tickets

pnpm + turbo monorepo. `apps/api` (Fastify-style API, port 4600) · `apps/web` (React 19, TanStack Router/Query, Tailwind v4 via vite plugin, radix-ui, IBM Plex fonts) · `apps/mcp` (MCP server) · `packages/` incl. `@tickets/db`.

## Design system — Instrument

- The redesign is **complete** (2026-07-07): every screen is Instrument, the legacy `styles/globals.css` is deleted, and Tailwind **preflight is ON**. Spec of record: `docs/design/design-system.html` (exported from the Claude Design project). Brief: `docs/superpowers/specs/2026-07-05-ui-redesign-design.md`; plans in `docs/superpowers/plans/`.
- Shared components and tokens live in `packages/web/ui` (`@tickets/ui`). Tokens are GENERATED from `tokens/*.tokens.json` into `styles/generated/` and `src/style/generated/` — never hand-edit either; run `pnpm --filter @tickets/ui tokens:build`. Details in `design-system-adapter.md`.
- `@tickets/ui` is three layers — `src/style/` (paint), `src/library/` (eight role groups), `src/docs/` (gallery + token pages) — and imports point downward only. Inside a group: `components/` is what you reach for, `parts/` is what those are built from. Full rationale in `docs/superpowers/specs/2026-08-06-ui-package-structure-design.md`.
- **`--spacing` is 1px, so a number in a class name IS pixels** — `p-16` is 16px, `gap-8` is 8px (changed 2026-08-04). Anything written against Tailwind's stock `.25rem` scale renders at a quarter size and still compiles.
- **Radius is a number too: `rounded-6` is 6px** (changed 2026-08-07). The t-shirt rungs and the parallel `rounded-control-*` ladder are gone; the design sanctions 3/4/5/6/8/12 but any integer compiles. Radius is NOT on the spacing scale — it works because `border.css` redefines the fifteen `rounded[-corner]-*` utilities, so a t-shirt spelling or a fraction emits no rule at all rather than the wrong size. `rounded-full`/`rounded-none`/`rounded-[7px]` still work; bare `rounded` no longer does.

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

`docker compose up -d` → single `app` container on :4610 (nginx serves web + reverse-proxies `/api` to an internal node api). Dev loop: `pnpm dev` (mprocs: api :4600, web :4620, signals :4640, board :4681, studio, watchers). Publish to 4610 at phase boundaries: `docker compose up -d --build` (or `sh scripts/deploy-web.sh`). Checks: `pnpm typecheck` · `pnpm --filter @tickets/web test` · `pnpm build`.

## Conventions

- Conventional commits scoped by app: `fix(web): …`, `feat(deploy): …`; one commit per task/screen.
- Docs are self-contained on types: every named type used on a doc page is defined on that same page (bottom `## Types` section or inline).
- Ticket data spans 4 projects — items-core/TASK, items-app/APP, gateway/GW, tickets/TIX — partitioned by epic; migrated tickets keep their old IDs in description headings.
