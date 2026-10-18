# Changelog

## 0.8.6 · 2026-10-18 15:04 +04:00

- fix(shell): write "1 commit" on the Version page's overview (2b06934)
  - Count the overview's commits in the singular for one, as the Releases cards do

## 0.8.5 · 2026-10-18 14:42 +04:00

- fix(shell): read the router's Link only when the Version page draws a link (fdff590)
  - Make AppLink a component that reads Link as it renders, not as the module loads
  - Let a test whose router mock leaves Link out import @bh/shell again

## 0.8.4 · 2026-10-18 14:24 +04:00

- feat(shell): leave services out of the Version page of a repo with none (a568d1c)
  - Hide the Overview's services, the Services tab and the Releases filter when the build has no services

## 0.8.3 · 2026-10-18 14:12 +04:00

- fix(shell): give tests no build info, even when they share the app's Vite config (56eb400)
  - Skip the build-info plugin in Vitest's test mode, so a frame under test draws no version line
  - Stop the plugin running git on every test run of an app whose vitest config merges its vite config

## 0.8.2 · 2026-10-18 14:08 +04:00

- fix(shell): let the Version page compile in an app whose router types its routes (dec1d27)
  - Link the page's tabs, History and filters through AppLink and useAppNavigate, which take any path and a plain search
  - Stop an app with typed routes and search, such as medialib, failing its typecheck on the page

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
