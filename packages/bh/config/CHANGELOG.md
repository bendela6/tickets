# Changelog

## 0.8.3 · 2026-10-18 15:01 +04:00

- fix(config): let bh-release run in a linked worktree (be41f71)
  - Ask git for the release's message and pending files' paths, as a worktree's .git is a file
  - Stop a release in a worktree failing after writing versions, before its commit

## 0.8.2 · 2026-10-18 14:24 +04:00

- feat(config): move the stack on commits outside every package (e945860)
  - Count a feature or fix outside every package of the repo's own, such as the root or a bh copy, toward the stack's version
  - Release a repo whose app is its root, such as cv, as the stack alone, from its first release on
  - Write such a release's commit as chore(release): release v<stack>

## 0.8.1 · 2026-10-18 13:35 +04:00

- feat(config,shell): add the version line, the Version page and the build-info plugin (600fa40)
  - Add BuildFooter: the stack's version and release time at the sidebar's foot, linking to the Version page
  - Dot the line until this browser opens a new version's page, and offer Reload when a newer version is live
  - Add VersionPage with Overview, Releases, Services and Packages tabs, each at its own path
  - Show each commit as its git header, filter releases by service, search them, and load 20 at a time
  - Table the repo's packages and the vendored copies together, with who uses each
  - Add @bh/shell/vite: reads every package.json and CHANGELOG.md at build time into a BuildInfo, and serves build.json and the release files beside the app
  - Export @bh/config's workspace reader, with types for both release modules
  - Add the Version docs page
- docs(config,docs): describe pnpm release and how to write a commit (fc3464c)
  - Rewrite the Releases page as bh-release's reference: flags, steps, tags, changelogs, setup, the commit check
  - Rewrite Versions and updates for per-package versions, the stack version and the new copy
  - Add how to write a commit: a verb first, one bullet per change, no ticket ids, several services in one header
  - List bh-release, bh-hooks and bh-commit-check in the tooling overview
- feat(config): add bh-release, a version for every package, service and stack (a94778a)
  - Add bh-release: versions each package and service changed since its own tag, then the stack
  - Give a service a patch when a package it uses gets a version, with that package's features and fixes in its notes
  - Write package.json versions and one flat CHANGELOG.md list per package, plus the root's
  - Take each commit's scopes from the folders it touched
  - Commit, tag and push in one atomic push; --dry-run, --no-commit, --continue, --set and --yes
  - Move a past year's entries to changelog/<year>.md
  - Add bh-commit-check, a commit-msg check that refuses a bad header or a ticket id
  - Add bh-hooks, which installs that check from a repo's prepare script
  - Export the changelog reader as @bh/config/release/changelog
