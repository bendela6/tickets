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

## Conventions

- Conventional commits scoped by app: `fix(web): …`, `feat(deploy): …`; one commit per task/screen.
- Docs are self-contained on types: every named type used on a doc page is defined on that same page (bottom `## Types` section or inline).
- Ticket data spans 4 projects — items-core/TASK, items-app/APP, gateway/GW, tickets/TIX — partitioned by epic; migrated tickets keep their old IDs in description headings.
