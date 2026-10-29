# tickets

@README.md

Each package has its own README.md and CLAUDE.md: read the ones for the folder you are changing.

## Commands

- One package: `pnpm --filter @tickets/api test` (or `@tickets/web`, `@tickets/db`).
- One test file: `pnpm --filter @tickets/api test src/command/item/link.test.ts`.
- Before committing, run `pnpm typecheck` and `pnpm test`.

## Rules

- Spell new names and text the American way: `color`, not `colour`. Leave existing names as they
  are.
- Scope each commit by the packages it touches (`api`, `web`, `db`), one commit per task.
