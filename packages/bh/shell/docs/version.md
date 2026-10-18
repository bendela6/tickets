---
title: Version
summary: "Show the stack's version at the sidebar's foot, and open the Version
  page from it: services, packages and every release's commits."
order: 9
related: [AppShell, Pages, Releases, Versions and updates]
---

[//]: # 'written from version.doc.yaml by pnpm docs:sync; edit that file, not this one'

# Version

Show the stack's version at the sidebar's foot, and open the Version page
from it: services, packages and every release's commits.

Everything comes from the repo at build time. `@bh/shell/vite` reads the
`package.json` and `CHANGELOG.md` files that `pnpm release` writes
([Releases](../../../shared/config/docs/releases.md)); nothing is passed into the build.

## Import

```tsx
import { BuildFooter, readBuildInfo, VersionPage } from '@bh/shell';
```

## The plugin

```ts
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { buildInfo } from '@bh/shell/vite';

export default defineConfig({
  plugins: [react(), tailwindcss(), buildInfo()],
});
```

As the build or dev server starts, it reads the root's, each service's and
each package's versions and changelogs, vendored copies included, and works
out which services use each package.

- **Into the bundle:** a `BuildInfo`, which `readBuildInfo()` returns.
- **Beside the app:** `build.json`, `releases/index.json` and one
  `releases/<version>.json` per release, fetched when the page opens.
- **On a dev server:** the branch, the commits past the stack's tag, and
  whether there are uncommitted changes.

The root `package.json`'s `repository`, `github:owner/repo`, gives the
links to GitHub; a build without `.git` has no remote to read.

## The line

```tsx
import { BuildFooter, readBuildInfo, ThemeFooter } from '@bh/shell';

const BUILD = readBuildInfo();

/** AppShell's footer: the theme, then the version line, last. */
export function footer(collapsed: boolean) {
  return (
    <>
      <ThemeFooter collapsed={collapsed} />
      {BUILD ? <BuildFooter info={BUILD} collapsed={collapsed} /> : null}
    </>
  );
}
```

`v0.4.1 · 2 hours ago`: the stack's version and how long ago it was
released, small and muted, the exact time its title. It links to the
Version page and wraps when the sidebar is narrow. At rail width it is one
icon, the version and time its tooltip. It goes last in the footer, with
room below for the browser's link preview.

- **Dev server:** `dev v0.4.1+3`, with the build's time.
- **A dot:** a version this browser has not seen, until its Version page
  is opened. A browser's first visit counts as seen.
- **Reload:** when the window regains focus and `build.json` names a newer
  version.

## The page

Route the page's path and each tab under it to `VersionPage`:

```tsx
import { createRootRoute, createRoute } from '@tanstack/react-router';
import { readBuildInfo, VersionPage } from '@bh/shell';

const BUILD = readBuildInfo();
const rootRoute = createRootRoute();

function VersionRoute() {
  return BUILD ? <VersionPage info={BUILD} /> : null;
}

/** The Version page, and each of its tabs. */
export const versionRoutes = ['version', 'version/$tab'].map((path) => {
  return createRoute({ getParentRoute: () => rootRoute, path, component: VersionRoute });
});
```

The header shows the version, released and built times, **Copy details**
(everything a bug report needs) and the tag on GitHub. Four tabs follow,
each at its own path:

| Tab          | Path                | Shows                                                                            |
| ------------ | ------------------- | -------------------------------------------------------------------------------- |
| **Overview** | `/version`          | Each service's version and last update, and what is new in this release          |
| **Releases** | `/version/releases` | Every release, newest first, one list of commits each; filter by service, search |
| **Services** | `/version/services` | Folder, version and the one before, last update, this release's commits, History |
| **Packages** | `/version/packages` | The repo's own packages and the vendored copies in one table, and who uses each  |

A commit reads as its git header, `fix(api,web):` in the type's colour and
then the headline, its hash linking to GitHub, its bullets under it.
Releases loads 20 at a time. A service's **History** opens Releases at
`?service=web`.

## Rules

- **From the repo alone.** The build reads files, not git, so a build
  from a tarball shows the same page.
- **Nothing bundled but the summary.** Releases are separate files,
  fetched as the page opens them.
- **Domain-free.** `BuildFooter` and `VersionPage` only take a
  `BuildInfo`.
