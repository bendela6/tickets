// bh-release: reading commits, writing and reading changelogs, planning a
// release, and whole releases in throwaway repos. Run: pnpm --filter @bh/config test
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { addEntry, formatEntry, parseChangelog, stamp } from '../release/changelog.mjs';
import { changeOf, checkMessage, largest, nextVersion, parseMessage } from '../release/commits.mjs';
import { planRelease } from '../release/plan.mjs';
import { matches, workspaceGlobs } from '../release/workspace.mjs';
import { setVersion } from '../release/write.mjs';

const bin = fileURLToPath(new URL('../bin/release.mjs', import.meta.url));
const check = fileURLToPath(new URL('../bin/commit-check.mjs', import.meta.url));
const tmp = mkdtempSync(join(tmpdir(), 'bh-release-'));
after(() => rmSync(tmp, { recursive: true, force: true }));

test('a message reads as its type, scope, headline, bullets and breaking change', () => {
  const m = parseMessage(
    'feat(api)!: require a title on every ticket\n\n- Refuse an empty title with 422\n- Trim the title\n  before saving\n\nBREAKING CHANGE: send a title;\nan empty one is refused\n',
  );
  assert.equal(m.type, 'feat');
  assert.equal(m.scope, 'api');
  assert.equal(m.headline, 'require a title on every ticket');
  assert.deepEqual(m.bullets, ['Refuse an empty title with 422', 'Trim the title before saving']);
  assert.equal(m.change, 'send a title; an empty one is refused');
  assert.equal(m.breaking, true);
  assert.equal(parseMessage("Merge branch 'x'").generated, true);
  assert.equal(parseMessage('just words').type, null);
});

test('feat is a feature; fix, perf, build and chore(deps) a fix; breaking wins; the rest none', () => {
  const c = (text) => changeOf(parseMessage(text));
  assert.equal(c('feat(web): add a board'), 'feature');
  assert.equal(c('fix: keep the scroll'), 'fix');
  assert.equal(c('build: target node 24'), 'fix');
  assert.equal(c("chore(deps): bring in bh's changes to ui"), 'fix');
  assert.equal(c('chore: tidy'), null);
  assert.equal(c('refactor(ui)!: drop Pill'), 'breaking');
  assert.equal(largest([null, 'fix', 'feature', 'fix']), 'feature');
  assert.equal(largest([null]), null);
});

test('below 1.0.0 breaking is a minor version and the rest a patch; from 1.0.0 semver', () => {
  assert.equal(nextVersion('0.4.2', 'fix'), '0.4.3');
  assert.equal(nextVersion('0.4.2', 'feature'), '0.4.3');
  assert.equal(nextVersion('0.4.2', 'breaking'), '0.5.0');
  assert.equal(nextVersion('1.4.2', 'feature'), '1.5.0');
  assert.equal(nextVersion('1.4.2', 'breaking'), '2.0.0');
});

test('the commit-msg check refuses a bad header and ticket ids, and warns on scopes', () => {
  assert.deepEqual(checkMessage('feat(web): add a board\n\n- Add columns\n').errors, []);
  assert.equal(checkMessage('added a board').errors.length, 1);
  assert.match(checkMessage('fix(web): keep scroll\n\nTK-79').errors[0], /TK-79/);
  assert.deepEqual(checkMessage('fix(web): read UTF-8 names').errors, []);
  assert.deepEqual(checkMessage("Merge branch 'main' of github.com:x/y").errors, []);
  assert.match(checkMessage('fix(web): x', ['api', 'web']).warnings[0], /staged folders/);
  assert.deepEqual(checkMessage('fix(api,web): x', ['web', 'api']).warnings, []);
  assert.match(checkMessage('feat(web): the board').warnings[0], /verb/);
});

const line = (type, scopes, headline, hash, extra = {}) => ({
  type,
  scopes,
  breaking: false,
  headline,
  hash,
  bullets: [],
  change: null,
  ...extra,
});

test('an entry is written with a fixed heading and read back as it was', () => {
  const lines = [
    line('fix', ['api', 'web'], 'refuse tickets with an empty title', '8e7d6c5', {
      bullets: ['Disable Save until the title has text'],
    }),
    line('feat', ['api'], 'require a title', 'a1b2c3d', { breaking: true, change: 'send a title' }),
    line(null, [], 'Start keeping versions and this changelog', null),
  ];
  const text = formatEntry({
    version: '0.4.1',
    stampText: '2026-10-17 14:32 +04:00',
    versions: [
      { name: '@tickets/web', version: '0.3.2' },
      { name: '@tickets/api', version: '0.5.1' },
    ],
    lines,
  });
  assert.match(
    text,
    /^## 0\.4\.1 · 2026-10-17 14:32 \+04:00\n\n@tickets\/web 0\.3\.2 · @tickets\/api 0\.5\.1\n\n- fix\(api,web\): refuse/,
  );
  const [entry] = parseChangelog(`# Changelog\n\n${text}`);
  assert.equal(entry.version, '0.4.1');
  assert.equal(entry.date, '2026-10-17T14:32:00+04:00');
  assert.deepEqual(entry.versions, [
    { name: '@tickets/web', version: '0.3.2' },
    { name: '@tickets/api', version: '0.5.1' },
  ]);
  assert.deepEqual(entry.lines, lines);
});

test('a stamp is the local time with its offset', () => {
  assert.match(stamp(new Date()), /^\d{4}-\d{2}-\d{2} \d{2}:\d{2} [+-]\d{2}:\d{2}$/);
});

test("a new year's entry moves the earlier years' entries out, by year", () => {
  const old = `# Changelog\n\n${formatEntry({ version: '0.2.0', stampText: '2025-12-30 10:00 +04:00', lines: [line('fix', ['web'], 'b', 'bbbbbbb')] })}\n${formatEntry({ version: '0.1.0', stampText: '2024-05-01 10:00 +04:00', lines: [line('fix', ['web'], 'a', 'aaaaaaa')] })}`;
  const entry = formatEntry({
    version: '0.3.0',
    stampText: '2026-01-02 10:00 +04:00',
    lines: [line('feat', ['web'], 'c', 'ccccccc')],
  });
  const { text, moved } = addEntry(old, entry, 2026);
  assert.deepEqual(
    parseChangelog(text).map((e) => e.version),
    ['0.3.0'],
  );
  assert.deepEqual([...moved.keys()], ['2025', '2024']);
  assert.match(moved.get('2025'), /## 0\.2\.0/);
});

test('workspace globs read from pnpm-workspace.yaml, and match folders segment by segment', () => {
  assert.deepEqual(
    workspaceGlobs(
      'packages:\n  - \'packages/*/*\'\n  - "apps/*"\n\nallowBuilds:\n  esbuild: true\n',
    ),
    ['packages/*/*', 'apps/*'],
  );
  assert.equal(matches('packages/bh/*', 'packages/bh/ui'), true);
  assert.equal(matches('packages/bh/*', 'packages/shared'), false);
});

test('a version line goes into package.json, in place or after the name', () => {
  assert.equal(
    setVersion('{\n  "name": "a",\n  "version": "0.1.0"\n}\n', '0.2.0'),
    '{\n  "name": "a",\n  "version": "0.2.0"\n}\n',
  );
  assert.equal(
    setVersion('{\n  "name": "a",\n  "private": true\n}\n', '0.2.0'),
    '{\n  "name": "a",\n  "version": "0.2.0",\n  "private": true\n}\n',
  );
});

// --- planning ---------------------------------------------------------------

const unit = (name, dir, extra = {}) => ({
  name,
  short: name.split('/')[1],
  dir,
  version: '0.0.1',
  service: false,
  vendored: false,
  deps: [],
  ...extra,
});
let clock = 1000;
const commit = (text, files, hash = String(clock).padStart(7, 'c')) => ({
  hash: `${hash}${'0'.repeat(33)}`,
  time: (clock += 1),
  message: parseMessage(text),
  files,
});

test('a service takes a patch from a package it uses, and lists its features and fixes', () => {
  const units = [
    unit('@t/web', 'apps/web', { service: true, deps: ['@t/shared'] }),
    unit('@t/api', 'apps/api', { service: true, deps: ['@t/shared'] }),
    unit('@t/mcp', 'apps/mcp', { service: true }),
    unit('@t/shared', 'packages/shared'),
  ];
  const shared = commit(
    'fix(shared): store dates in UTC',
    ['packages/shared/src/date.ts'],
    'aaaaaaa',
  );
  const both = commit(
    'fix(api,web): refuse an empty title',
    ['apps/api/a.ts', 'apps/web/w.ts'],
    'bbbbbbb',
  );
  const tidy = commit('refactor(shared): split a file', ['packages/shared/src/x.ts'], 'ccccccc');
  const plan = planRelease({
    name: 't',
    units,
    stackFrom: '0.4.0',
    tagged: new Map([
      ['@t/web', '0.3.1'],
      ['@t/api', '0.5.0'],
      ['@t/mcp', '0.1.4'],
      ['@t/shared', '0.2.4'],
    ]),
    commits: new Map([
      ['@t/web', [both]],
      ['@t/api', [both]],
      ['@t/mcp', []],
      ['@t/shared', [tidy, shared]],
    ]),
    stackCommits: [tidy, both, shared],
  });
  assert.deepEqual(
    plan.released.map((r) => `${r.name} ${r.to}`),
    ['@t/web 0.3.2', '@t/api 0.5.1', '@t/shared 0.2.5'],
  );
  const web = plan.released[0];
  assert.deepEqual(
    web.lines.map((l) => `${l.type}(${l.scopes.join(',')}): ${l.headline}`),
    ['fix(api,web): refuse an empty title', 'fix(shared): store dates in UTC'],
  );
  assert.equal(plan.stack.to, '0.4.1');
  assert.equal(
    plan.message.split('\n')[0],
    'chore(release): release web 0.3.2, api 0.5.1 and shared 0.2.5 as v0.4.1',
  );
  assert.match(plan.message, /- Refuse an empty title\n- Store dates in UTC/);
  assert.deepEqual(plan.tags, ['@t/web@0.3.2', '@t/api@0.5.1', '@t/shared@0.2.5', 'v0.4.1']);
});

test("a first release starts each package at the stack's version, bumped if it changed", () => {
  const units = [unit('@b/ui', 'packages/web/ui'), unit('@b/form', 'packages/web/form')];
  const breaking = commit('feat(ui)!: one file per renderer', ['packages/web/ui/a.tsx']);
  const plan = planRelease({
    name: 'b',
    units,
    stackFrom: '0.8.0',
    tagged: new Map(),
    commits: new Map([
      ['@b/ui', [breaking]],
      ['@b/form', []],
    ]),
    stackCommits: [breaking],
  });
  assert.deepEqual(
    plan.released.map((r) => `${r.name} ${r.from} ${r.to}`),
    ['@b/ui null 0.9.0', '@b/form null 0.8.0'],
  );
  assert.match(plan.released[1].lines[0].headline, /unchanged since v0\.8\.0/);
  assert.equal(plan.stack.to, '0.9.0');
});

test('a commit to a vendored copy versions the services that use it', () => {
  const units = [
    unit('@t/web', 'apps/web', { service: true, deps: ['@bh/ui'], version: '0.3.1' }),
    unit('@bh/ui', 'packages/bh/ui', { vendored: true }),
  ];
  const deps = commit("chore(deps): bring in bh's changes to ui\n\n- Add a date range\n", [
    'packages/bh/ui/x.ts',
    'pnpm-lock.yaml',
  ]);
  const plan = planRelease({
    name: 't',
    units,
    stackFrom: '0.4.0',
    tagged: new Map([['@t/web', '0.3.1']]),
    commits: new Map([['@t/web', [deps]]]),
    stackCommits: [deps],
  });
  assert.deepEqual(
    plan.released.map((r) => `${r.name} ${r.to}`),
    ['@t/web 0.3.2'],
  );
  assert.equal(plan.released[0].lines[0].scopes.join(), 'deps');
});

test('nothing to release is null', () => {
  const plan = planRelease({
    name: 't',
    units: [unit('@t/web', 'apps/web')],
    stackFrom: '0.4.0',
    tagged: new Map([['@t/web', '0.3.1']]),
    commits: new Map([['@t/web', [commit('docs(web): a readme', ['apps/web/README.md'])]]]),
    stackCommits: [],
  });
  assert.equal(plan, null);
});

// --- whole releases -----------------------------------------------------------

function run(cwd, cmd, args, input) {
  const result = spawnSync(cmd, args, { cwd, encoding: 'utf8', input });
  if (result.status !== 0) {
    throw new Error(`${cmd} ${args.join(' ')}: ${result.stdout}${result.stderr}`);
  }
  return result.stdout;
}

function repo(name) {
  const origin = join(tmp, `${name}.git`);
  const dir = join(tmp, name);
  run(tmp, 'git', ['init', '--quiet', '--bare', '--initial-branch=main', origin]);
  run(tmp, 'git', ['clone', '--quiet', origin, dir]);
  for (const [k, v] of [
    ['user.name', 'T'],
    ['user.email', 't@t'],
    ['commit.gpgsign', 'false'],
    ['core.autocrlf', 'false'],
  ]) {
    run(dir, 'git', ['config', k, v]);
  }
  const files = {
    'package.json': JSON.stringify(
      { name: 'tickets', private: true, release: { services: ['apps/api', 'apps/web'] } },
      null,
      2,
    ),
    'pnpm-workspace.yaml': "packages:\n  - 'apps/*'\n  - 'packages/*'\n",
    'apps/web/package.json': JSON.stringify(
      {
        name: '@tickets/web',
        version: '0.1.0',
        dependencies: { '@tickets/shared': 'workspace:*' },
      },
      null,
      2,
    ),
    'apps/api/package.json': JSON.stringify(
      {
        name: '@tickets/api',
        version: '0.1.0',
        dependencies: { '@tickets/shared': 'workspace:*' },
      },
      null,
      2,
    ),
    'packages/shared/package.json': JSON.stringify(
      { name: '@tickets/shared', version: '0.0.1' },
      null,
      2,
    ),
  };
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(dir, path, '..'), { recursive: true });
    writeFileSync(join(dir, path), `${text}\n`);
  }
  run(dir, 'git', ['add', '-A']);
  run(dir, 'git', ['commit', '--quiet', '-m', 'chore: start the repo']);
  run(dir, 'git', ['push', '--quiet', 'origin', 'main']);
  return { dir, origin };
}

function change(dir, files, message) {
  for (const path of files) {
    mkdirSync(join(dir, path, '..'), { recursive: true });
    writeFileSync(join(dir, path), `${Math.random()}\n`);
  }
  run(dir, 'git', ['add', '-A']);
  run(dir, 'git', ['commit', '--quiet', '-m', message]);
}

const release = (dir, ...args) => run(dir, process.execPath, [bin, ...args]);

test('a whole release: versions, changelogs, one commit, tags, pushed at once', () => {
  const { dir, origin } = repo('whole');
  const first = release(dir, '--yes');
  assert.match(first, /tickets \(none\) → v0\.1\.0/);
  assert.deepEqual(run(origin, 'git', ['tag', '--list']).split('\n').filter(Boolean).sort(), [
    '@tickets/api@0.1.0',
    '@tickets/shared@0.1.0',
    '@tickets/web@0.1.0',
    'v0.1.0',
  ]);
  assert.match(
    readFileSync(join(dir, 'apps/web/CHANGELOG.md'), 'utf8'),
    /- Start keeping versions and this changelog/,
  );

  change(
    dir,
    ['packages/shared/src/date.ts'],
    'fix(shared): store dates in UTC\n\n- Compare dates in UTC',
  );
  change(dir, ['apps/api/src/t.ts', 'apps/web/src/t.ts'], 'feat(api,web): refuse an empty title');
  change(dir, ['apps/web/README.md'], 'docs(web): describe the board');
  assert.match(release(dir, '--dry-run'), /v0\.1\.0 → v0\.1\.1/);
  assert.equal(run(dir, 'git', ['status', '--porcelain']), '');

  release(dir, '--yes');
  const web = parseChangelog(readFileSync(join(dir, 'apps/web/CHANGELOG.md'), 'utf8'));
  assert.equal(web[0].version, '0.1.1');
  assert.deepEqual(
    web[0].lines.map((l) => `${l.type}(${l.scopes.join(',')}): ${l.headline}`),
    [
      'docs(web): describe the board',
      'feat(api,web): refuse an empty title',
      'fix(shared): store dates in UTC',
    ],
  );
  const root = parseChangelog(readFileSync(join(dir, 'CHANGELOG.md'), 'utf8'));
  assert.deepEqual(
    root.map((e) => e.version),
    ['0.1.1', '0.1.0'],
  );
  assert.deepEqual(
    root[0].versions.map((v) => `${v.name} ${v.version}`),
    ['@tickets/api 0.1.1', '@tickets/web 0.1.1', '@tickets/shared 0.1.1'],
  );
  assert.equal(
    JSON.parse(readFileSync(join(dir, 'apps/web/package.json'), 'utf8')).version,
    '0.1.1',
  );
  assert.equal(JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).version, '0.1.1');
  assert.equal(
    run(origin, 'git', ['log', '-1', '--format=%s', 'main']).trim(),
    'chore(release): release api 0.1.1, web 0.1.1 and shared 0.1.1 as v0.1.1',
  );
  assert.match(release(dir, '--dry-run'), /nothing to release/);
});

test('--no-commit writes and stops; --continue commits, tags and pushes', () => {
  const { dir, origin } = repo('pause');
  release(dir, '--yes');
  change(dir, ['apps/api/x.ts'], 'fix(api): answer 404 for a missing ticket');
  release(dir, '--yes', '--no-commit');
  assert.notEqual(run(dir, 'git', ['status', '--porcelain']), '');
  release(dir, '--continue');
  assert.match(run(origin, 'git', ['tag', '--list']), /@tickets\/api@0\.1\.1/);
});

test('a release is refused off main or with changes', () => {
  const { dir } = repo('refuse');
  writeFileSync(join(dir, 'stray.txt'), 'x');
  assert.throws(() => release(dir, '--dry-run'), /commit or stash/);
  rmSync(join(dir, 'stray.txt'));
  run(dir, 'git', ['checkout', '--quiet', '-b', 'side']);
  assert.throws(() => release(dir, '--dry-run'), /made on main/);
});

test('bh-commit-check refuses a message file, with the reason', () => {
  const file = join(tmp, 'MSG');
  writeFileSync(file, 'fix: keep scroll\n\nBH-20.1\n');
  const result = spawnSync(process.execPath, [check, file], { cwd: tmp, encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /BH-20\.1/);
  writeFileSync(file, 'fix(web): keep the scroll on reload\n');
  assert.equal(spawnSync(process.execPath, [check, file], { cwd: tmp }).status, 0);
});
