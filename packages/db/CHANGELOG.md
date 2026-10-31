# Changelog

## 0.1.1 · 2026-10-31 05:26 +04:00

- docs(db,web): rename bh to tilewise in comments (98acace)
  - Rename `bh's` to `tilewise's` in the comments of web and the seed types
- chore(api,db): remove the agent reports and the unused items metadata (4f1dca9)
  - Remove the /api/agents routes and apps/api/src/agents, which only the removed plan builders called
  - Drop core.agent_reports in a new migration and take it out of the schema model, registry and table counts
  - Remove apps/api/src/resource/items-meta.ts, which no route served, and the @tilewise/resource dependency it needed
- docs(api,db,web): add a README.md and CLAUDE.md to each package (b46f0d7)
  - Add apps/api's docs: how a write flows, its endpoints, its settings, and the write-through-commands rule
  - Add apps/web's docs: its pages, ports and proxy, where things live, and the tilewise and Tailwind rules
  - Add packages/db's docs: its exports, schemas, scripts and settings, and how to change the schema
  - Link each package from the root README and add how the packages fit together
  - Move the tilewise rule from the root CLAUDE.md to apps/web's, and add the commands for one package and one test file
  - Add the American spelling rule to the root CLAUDE.md
- fix(api,db): create and migrate the dev and test databases on a fresh clone (89f8fc8)
  - Create tickets_dev and tickets_test when the Postgres volume is first made
  - Migrate tickets_test once before the db and api test suites run
  - Move the migration into migrateDatabase so the CLI and the test setup share it
  - Say in the README which databases the compose step makes
- chore(api,db,web): install tilewise's packages from npm in place of the bh copies (6a2b0e7)
  - Depend on @tilewise/* from npm, config and shell at ^0.2.0 and the rest at ^0.1.2, and delete packages/bh
  - Rename every @bh import, stylesheet and bin to its @tilewise name, and take the build-info Vite plugin from @tilewise/config/vite
  - Read the hue test's colours.css from the installed @tilewise/ui instead of the copy's path
  - Drop the copies from the workspace, the release config, the Prettier ignore list and the token-check task
- chore(db): remove drizzle studio (8a049ab)
  - Remove the db:studio scripts, drizzle.studio.config.ts and the studio pane in pnpm dev
  - Drop it from the README and CLAUDE.md; the container's /studio (pgweb) stays
- chore(api,db): remove the plans, their tooling and the Claude config (27e2f2c)
  - Remove tasks/ (every project's plan files, their schema and viewer) and scripts/ (the viewer server, checker, planner and builder helpers, the agents' status script, the repos.json helper and deploy-web.sh)
  - Remove .claude/skills: running-the-stack and the builder's and planner's skills
  - Remove the task scripts from package.json, the plans and skills sections from CLAUDE.md, the repos.json section from the README, and the runtime folder from .gitignore
  - Keep the history in the comments that explain the plan scheme and the agents' reports, without the paths of the removed files
- refactor(api,db,web): remove code nothing uses (c9b2d50)
  - Remove the API's parse-query helper and its commandKind lookup, which nothing calls
  - Remove the db's verify-scheme script, which no script runs and which wrote a throwaway scheme into the database
  - Remove the web's form registry and session-age formatter, left from the deleted New-session picker and sessions list, with their tests, and a smoke test that rendered only a bare button
  - Remove three API types nothing references, and the avatar mapping's own copy of the user kind
  - Remove scripts/migrate-stale-branch.mjs, the one-off for the August spacing change
- chore(db): remove the legacy import and the cutover tooling (94bd842)
  - Remove the legacy importer and its verifier (packages/db/src/import) with the db:import, db:verify-import and db:restore-legacy scripts: the legacy projects left the live database on 2026-10-15
  - Remove the schema guard (db:check-schema) and its call in the container's start script: it only refused a database still on the pre-items schema, and none is left
  - Remove scripts/cutover.sh, the one-off production cutover
  - Move the production database's name into the project delete, its only user
  - Drop the importer from the README and the running-the-stack skill
- docs(db,web): remove the docs folder and the outdated notes at the root (1f80b7c)
  - Remove DESIGN.md, ui.md, ideas.md and the bh reuse audit, which describe the schema, components and plans from before the items platform and bh
  - Remove docs/: the July design explorations and mockups, the API reference for /api/tickets routes that no longer exist, the cutover runbook, the database pages, and the finished plans and specs
  - Replace the README's HTTP API tables with a pointer to the routes
  - Drop the citations of the removed mockups from the web's and the round-trip's comments

## 0.1.0 · 2026-10-18 14:03 +04:00

- Start keeping versions and this changelog
