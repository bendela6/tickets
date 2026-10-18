// @bh/shell/vite: the Vite plugin that gives readBuildInfo its BuildInfo, and
// serves build.json and the release files beside the app.
//
//   plugins: [react(), tailwindcss(), buildInfo()]
//
// One file with no relative imports: Vite loads a config's plugins with Node,
// which runs TypeScript as it is but resolves no extensionless path.

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { cwd } from 'node:process';
import type { Plugin } from 'vite';
import { parseChangelog, type Entry } from '@bh/config/release/changelog';
import { readWorkspace, shortName, usesOf } from '@bh/config/release/workspace';
import type { BuildInfo, Release } from '../version/build-info';

/** The folder holding pnpm-workspace.yaml, at or above `from`. */
export function findRepoRoot(from: string): string {
  let dir = resolve(from);
  while (!existsSync(join(dir, 'pnpm-workspace.yaml'))) {
    const up = dirname(dir);
    if (up === dir) {
      return resolve(from);
    }
    dir = up;
  }
  return dir;
}

const readJson = (file: string): Record<string, unknown> => {
  return JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
};

function entriesOf(dir: string, years = false): Entry[] {
  const file = join(dir, 'CHANGELOG.md');
  const entries = existsSync(file) ? parseChangelog(readFileSync(file, 'utf8')) : [];
  const older = join(dir, 'changelog');
  if (years && existsSync(older)) {
    for (const name of readdirSync(older)
      .filter((f) => /^\d{4}\.md$/.test(f))
      .sort()
      .reverse()) {
      entries.push(...parseChangelog(readFileSync(join(older, name), 'utf8')));
    }
  }
  return entries;
}

function git(root: string, args: string[]): string | null {
  try {
    return execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

/** `https://github.com/owner/repo` from a package.json `repository`, or the git remote. */
export function repositoryUrl(field: unknown, remote: string | null): string | undefined {
  const raw =
    typeof field === 'string'
      ? field
      : typeof field === 'object' && field !== null && 'url' in field
        ? String(field.url)
        : remote;
  if (!raw) {
    return undefined;
  }
  const match =
    /^github:([^/]+\/[^/#]+)$/.exec(raw) ??
    /github\.com[:/]([^/]+\/[^/#]+?)(?:\.git)?\/?$/.exec(raw) ??
    /^([\w.-]+\/[\w.-]+)$/.exec(raw);
  return match ? `https://github.com/${match[1]}` : undefined;
}

/** What a build at `appDir` is made of, and every stack release, newest first. */
export function makeBuildInfo({
  appDir,
  base = '/',
  dev = false,
  now = new Date(),
}: {
  appDir: string;
  base?: string;
  dev?: boolean;
  now?: Date;
}): { info: BuildInfo; releases: Release[] } {
  const root = findRepoRoot(appDir);
  const rootPkg = readJson(join(root, 'package.json'));
  const ws = readWorkspace(root);
  const version = typeof rootPkg.version === 'string' ? rootPkg.version : '0.0.0';
  const stackEntries = entriesOf(root, true);
  const current = stackEntries.find((e) => e.version === version);
  const inRelease = new Set((current?.versions ?? []).map((v) => v.name));
  const repository = repositoryUrl(rootPkg.repository, git(root, ['remote', 'get-url', 'origin']));

  const about = (unit: { name: string; dir: string; version: string }) => {
    const entries = entriesOf(join(root, unit.dir));
    const at = entries.findIndex((e) => e.version === unit.version);
    const entry = at >= 0 ? entries[at] : undefined;
    return {
      releasedAt: entry?.date ?? '',
      previous: inRelease.has(unit.name) ? entries[at + 1]?.version : undefined,
      commits: entry ? entry.lines.filter((l) => l.hash !== null).length : undefined,
    };
  };

  const services = ws.units.filter((u) => u.service);
  const info: BuildInfo = {
    stack: {
      name: ws.name,
      version,
      releasedAt: current?.date ?? '',
      url: repository ? `${repository}/tree/v${version}` : undefined,
    },
    repository,
    base: base.endsWith('/') ? base : `${base}/`,
    builtAt: now.toISOString(),
    self: String(readJson(join(appDir, 'package.json')).name ?? ''),
    services: services.map((u) => {
      const { releasedAt, previous, commits } = about(u);
      return {
        name: u.name,
        dir: u.dir,
        version: u.version,
        releasedAt,
        previous,
        commits: previous ? commits : undefined,
      };
    }),
    packages: ws.units
      .filter((u) => !u.service)
      .map((u) => {
        const { releasedAt, previous } = about(u);
        const usedBy = services
          .filter((s) => usesOf(s, ws.units).has(u.name))
          .map((s) => shortName(s.name));
        return { name: u.name, dir: u.dir, version: u.version, releasedAt, previous, usedBy };
      }),
  };

  if (dev) {
    const tagged = git(root, ['rev-parse', '--verify', '--quiet', `v${version}`]) !== null;
    info.dev = {
      branch: git(root, ['rev-parse', '--abbrev-ref', 'HEAD']) ?? '',
      ahead: tagged ? Number(git(root, ['rev-list', '--count', `v${version}..HEAD`]) ?? 0) : 0,
      dirty: (git(root, ['status', '--porcelain']) ?? '') !== '',
    };
  }

  const releases: Release[] = stackEntries.map((e) => {
    return {
      version: e.version,
      date: e.date,
      versions: e.versions ?? [],
      commits: e.lines,
    };
  });
  return { info, releases };
}

/** The files the plugin writes beside the app, by path under its base. */
export function buildFiles(
  info: { stack: { name: string; version: string }; builtAt: string },
  releases: Release[],
) {
  const files = new Map<string, string>();
  files.set(
    'build.json',
    JSON.stringify({ name: info.stack.name, version: info.stack.version, builtAt: info.builtAt }),
  );
  files.set(
    'releases/index.json',
    JSON.stringify(
      releases.map((r) => {
        return {
          version: r.version,
          date: r.date,
          versions: r.versions,
          commits: r.commits.length,
        };
      }),
    ),
  );
  for (const release of releases) {
    files.set(`releases/${release.version}.json`, JSON.stringify(release));
  }
  return files;
}

/**
 * Reads the repo's versions and changelogs once, as the build or the dev
 * server starts. The BuildInfo goes into the bundle; build.json and the
 * releases are served beside it, not bundled.
 */
export function buildInfo(): Plugin {
  let files = new Map<string, string>();
  let base = '/';
  return {
    name: 'bh:build-info',
    config(config, env) {
      base = config.base ?? '/';
      const made = makeBuildInfo({
        appDir: resolve(config.root ?? cwd()),
        base,
        dev: env.command === 'serve',
      });
      files = buildFiles(made.info, made.releases);
      return { define: { __BH_BUILD_INFO__: JSON.stringify(made.info) } };
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = (req.url ?? '').split('?')[0] ?? '';
        const file = path.startsWith(base) ? files.get(path.slice(base.length)) : undefined;
        if (file === undefined) {
          next();
          return;
        }
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-store');
        res.end(file);
      });
    },
    generateBundle() {
      for (const [fileName, source] of files) {
        this.emitFile({ type: 'asset', fileName, source });
      }
    },
  };
}
