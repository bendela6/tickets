// The build-info plugin's reading, against a throwaway repo: the stack, each service and
// package with its last change and the one before, who uses what, vendored
// copies, the release files, and a repository read from any spelling.

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { buildFiles, buildInfo, makeBuildInfo, repositoryUrl } from './index';

const root = mkdtempSync(join(tmpdir(), 'bh-build-info-'));
afterAll(() => rmSync(root, { recursive: true, force: true }));

function put(path: string, text: unknown) {
  mkdirSync(join(root, path, '..'), { recursive: true });
  writeFileSync(
    join(root, path),
    typeof text === 'string' ? text : `${JSON.stringify(text, null, 2)}\n`,
  );
}

put('package.json', {
  name: 'tickets',
  version: '0.4.1',
  repository: 'github:o/tickets',
  release: { services: ['apps/web', 'apps/api'], vendored: ['packages/bh/*'] },
});
put('pnpm-workspace.yaml', "packages:\n  - 'apps/*'\n  - 'packages/*'\n  - 'packages/bh/*'\n");
put('apps/web/package.json', {
  name: '@tickets/web',
  version: '0.3.2',
  dependencies: { '@tickets/shared': 'workspace:*', '@bh/ui': 'workspace:*' },
});
put('apps/api/package.json', {
  name: '@tickets/api',
  version: '0.5.0',
  dependencies: { '@tickets/shared': 'workspace:*' },
});
put('packages/shared/package.json', { name: '@tickets/shared', version: '0.2.5' });
put('packages/bh/ui/package.json', { name: '@bh/ui', version: '0.9.0' });
put(
  'CHANGELOG.md',
  `# Changelog

## 0.4.1 · 2026-10-17 14:32 +04:00

@tickets/web 0.3.2 · @tickets/shared 0.2.5

- feat(web): add drag and drop (a1b2c3d)
- fix(shared): store dates in UTC (b7c2e19)

## 0.4.0 · 2026-10-09 11:05 +04:00

@tickets/api 0.5.0

- fix(api): refuse an empty title (8e7d6c5)
`,
);
put(
  'changelog/2025.md',
  '# Changelog, 2025\n\n## 0.1.0 · 2025-12-01 10:00 +04:00\n\n- Start keeping versions and this changelog\n',
);
put(
  'apps/web/CHANGELOG.md',
  '# Changelog\n\n## 0.3.2 · 2026-10-17 14:32 +04:00\n\n- feat(web): add drag and drop (a1b2c3d)\n- fix(shared): store dates in UTC (b7c2e19)\n\n## 0.3.1 · 2026-10-09 11:05 +04:00\n\n- fix(web): x (1111111)\n',
);
put(
  'apps/api/CHANGELOG.md',
  '# Changelog\n\n## 0.5.0 · 2026-10-09 11:05 +04:00\n\n- fix(api): refuse an empty title (8e7d6c5)\n',
);
put(
  'packages/shared/CHANGELOG.md',
  '# Changelog\n\n## 0.2.5 · 2026-10-17 14:32 +04:00\n\n- fix(shared): store dates in UTC (b7c2e19)\n\n## 0.2.4 · 2026-10-01 09:00 +04:00\n\n- fix(shared): y (2222222)\n',
);
put(
  'packages/bh/ui/CHANGELOG.md',
  '# Changelog\n\n## 0.9.0 · 2026-10-18 09:00 +04:00\n\n- feat(ui)!: one file per renderer (3333333)\n',
);

describe('makeBuildInfo', () => {
  const { info, releases } = makeBuildInfo({
    appDir: join(root, 'apps/web'),
    base: '/app',
    now: new Date('2026-10-17T10:34:00Z'),
  });

  it('reads the stack, its release time and its tag on GitHub', () => {
    expect(info.stack).toEqual({
      name: 'tickets',
      version: '0.4.1',
      releasedAt: '2026-10-17T14:32:00+04:00',
      url: 'https://github.com/o/tickets/tree/v0.4.1',
    });
    expect(info.self).toBe('@tickets/web');
    expect(info.base).toBe('/app/');
    expect(info.builtAt).toBe('2026-10-17T10:34:00.000Z');
  });

  it('gives a service its last change, and the version before when this release changed it', () => {
    expect(info.services).toEqual([
      {
        name: '@tickets/api',
        dir: 'apps/api',
        version: '0.5.0',
        releasedAt: '2026-10-09T11:05:00+04:00',
        previous: undefined,
        commits: undefined,
      },
      {
        name: '@tickets/web',
        dir: 'apps/web',
        version: '0.3.2',
        releasedAt: '2026-10-17T14:32:00+04:00',
        previous: '0.3.1',
        commits: 2,
      },
    ]);
  });

  it('lists the repo’s packages and the vendored copies in one list, with who uses each', () => {
    expect(info.packages.map((p) => [p.name, p.version, p.previous, p.usedBy.join()])).toEqual([
      ['@bh/ui', '0.9.0', undefined, 'web'],
      ['@tickets/shared', '0.2.5', '0.2.4', 'api,web'],
    ]);
  });

  it("reads every release, the past years' files too, newest first", () => {
    expect(releases.map((r) => r.version)).toEqual(['0.4.1', '0.4.0', '0.1.0']);
    expect(releases[0]?.commits[0]?.scopes).toEqual(['web']);
    const files = buildFiles(info, releases);
    expect(JSON.parse(files.get('build.json') ?? '')).toMatchObject({ version: '0.4.1' });
    expect(JSON.parse(files.get('releases/index.json') ?? '')[1]).toMatchObject({
      version: '0.4.0',
      commits: 1,
    });
    expect(files.has('releases/0.1.0.json')).toBe(true);
  });
});

describe('buildInfo', () => {
  it('gives tests no build info, as Vitest runs in test mode', () => {
    const config = buildInfo().config as (
      config: object,
      env: { command: string; mode: string },
    ) => unknown;
    expect(config({}, { command: 'serve', mode: 'test' })).toBeUndefined();
  });
});

describe('repositoryUrl', () => {
  it('reads GitHub from a package.json field or a git remote', () => {
    expect(repositoryUrl('github:o/r', null)).toBe('https://github.com/o/r');
    expect(repositoryUrl({ url: 'git+https://github.com/o/r.git' }, null)).toBe(
      'https://github.com/o/r',
    );
    expect(repositoryUrl(undefined, 'git@github.com:o/r.git')).toBe('https://github.com/o/r');
    expect(repositoryUrl(undefined, null)).toBeUndefined();
  });
});
