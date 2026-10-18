# Changelog

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
