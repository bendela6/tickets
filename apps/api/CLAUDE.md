# @tickets/api

- Commands: `pnpm --filter @tickets/api test`, `… typecheck`, one file:
  `pnpm --filter @tickets/api test src/command/item/link.test.ts`.
- Write through `runCommand` and `ctx.emit`, never into `commands`, `events` or `outbox` from a
  route: the activity feed and the automations only see what the outbox carries.
  `no-raw-writes.test.ts` fails if a route does. Attachments are the one exception, a plain blob
  store.
- A command declares its input as a valibot schema; `runCommand` answers 400 to anything else, so
  don't check the body again in the route.
- A new automation is a file in `src/automation/rules/`, exported from its `index.ts`: importing that
  module is what registers it.
- A new endpoint gets a test beside it and a row in README.md › Endpoints.
