// Run: node --test scripts/tickets-repos.test.mjs
//
// Every test works on a file, git repositories and a stub of tickets' API made for it in a
// temporary folder: the machine's real ~/.config/tickets/repos.json is never read or written.
import assert from 'node:assert/strict';
import { execFile, execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createServer } from 'node:http';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = realpathSync(mkdtempSync(path.join(tmpdir(), 'tickets-repos-')));
// Before the module loads, so even a default it falls back to lands here. And git looks no
// higher than the temporary folder for a repository, so a plain folder is never "in" one.
process.env.TICKETS_REPOS_FILE = path.join(ROOT, 'default-repos.json');
process.env.GIT_CEILING_DIRECTORIES = ROOT;

const repos = await import('./tickets-repos.mjs');
const {
  repositoryId,
  sameRepository,
  matchingRemote,
  folderOf,
  setFolder,
  readRepos,
  reposFile,
  apiUrl,
} = repos;

const SCRIPT = fileURLToPath(new URL('./tickets-repos.mjs', import.meta.url));
const slashes = (/** @type {string} */ p) => p.replace(/\\/g, '/');
const TICKETS_LINK = 'https://github.com/bendela6/tickets.git';

const PROJECTS = [
  {
    id: 1,
    key: 'tickets',
    name: 'Tickets',
    itemPrefix: 'TK',
    repositoryUrl: TICKETS_LINK,
    defaultBranch: 'main',
  },
  {
    id: 2,
    key: 'gateway',
    name: 'Gateway',
    itemPrefix: 'GW',
    repositoryUrl: 'git@github.com:bendela6/gateway.git',
    defaultBranch: null,
  },
  { id: 3, key: 'bh', name: 'bh', itemPrefix: 'BH', repositoryUrl: null, defaultBranch: null },
];

/** @type {import('node:http').Server} */
let server;
let api = '';
let closedApi = '';
let n = 0;

before(async () => {
  server = createServer((request, response) => {
    if (request.method === 'GET' && request.url === '/api/projects') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ data: PROJECTS }));
    } else {
      response.writeHead(404).end();
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(undefined)));
  api = `http://127.0.0.1:${/** @type {import('node:net').AddressInfo} */ (server.address()).port}`;
  // A port nothing listens on: one a server had, then closed.
  const closed = createServer();
  await new Promise((resolve) => closed.listen(0, '127.0.0.1', () => resolve(undefined)));
  closedApi = `http://127.0.0.1:${/** @type {import('node:net').AddressInfo} */ (closed.address()).port}`;
  await new Promise((resolve) => closed.close(() => resolve(undefined)));
});

after(() => {
  server.close();
  rmSync(ROOT, { recursive: true, force: true });
});

const git = (/** @type {string} */ cwd, /** @type {string[]} */ args) =>
  execFileSync(
    'git',
    ['-C', cwd, '-c', 'user.name=test', '-c', 'user.email=test@example.com', ...args],
    {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );

/** A fresh git repository with these remotes, its folder with forward slashes. */
function repository(/** @type {Record<string, string>} */ remotes = {}) {
  const dir = path.join(ROOT, `repo-${++n}`);
  mkdirSync(dir);
  git(dir, ['init', '-q']);
  for (const [name, url] of Object.entries(remotes)) git(dir, ['remote', 'add', name, url]);
  return slashes(dir);
}

const folder = () => {
  const dir = path.join(ROOT, `plain-${++n}`);
  mkdirSync(dir);
  return slashes(dir);
};
const file = () => path.join(ROOT, `repos-${++n}.json`);

/** Runs the command; resolves to its exit code and what it printed. */
function run(
  /** @type {string[]} */ args,
  /** @type {{ file: string, api?: string }} */ { file, api: url = api },
) {
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      [SCRIPT, ...args],
      { env: { ...process.env, TICKETS_REPOS_FILE: file, TICKETS_API_URL: url }, encoding: 'utf8' },
      (error, stdout, stderr) =>
        resolve({
          code: error ? (error.code ?? 1) : 0,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
        }),
    );
  });
}

describe('repositoryId: one repository, however its link is written', () => {
  const same = [
    'https://github.com/bendela6/tickets.git',
    'https://github.com/bendela6/tickets',
    'https://github.com/bendela6/tickets/',
    'https://github.com/bendela6/tickets.git/',
    'https://GitHub.COM/bendela6/tickets',
    'https://github.com/Bendela6/Tickets.GIT',
    'http://github.com/bendela6/tickets',
    'https://someone@github.com/bendela6/tickets.git',
    'https://github.com:443/bendela6/tickets.git',
    'ssh://git@github.com/bendela6/tickets.git',
    'ssh://git@github.com:22/bendela6/tickets',
    'git+ssh://git@github.com/bendela6/tickets.git',
    'git://github.com/bendela6/tickets.git',
    'git@github.com:bendela6/tickets.git',
    'git@github.com:bendela6/tickets',
    'git@github.com:/bendela6/tickets.git',
    'github.com:bendela6/tickets.git',
    '  git@GITHUB.com:bendela6/tickets.git  ',
  ];
  for (const link of same) {
    test(link.trim(), () => assert.equal(repositoryId(link), 'github.com/bendela6/tickets'));
  }

  test('another owner, another repository or another host is another repository', () => {
    assert.equal(sameRepository(TICKETS_LINK, 'https://github.com/someone/tickets.git'), false);
    assert.equal(sameRepository(TICKETS_LINK, 'git@github.com:bendela6/gateway.git'), false);
    assert.equal(sameRepository(TICKETS_LINK, 'git@gitlab.com:bendela6/tickets.git'), false);
    assert.equal(
      sameRepository(TICKETS_LINK, 'https://github.com/bendela6/tickets-old.git'),
      false,
    );
  });

  test('a path within a host keeps its folders', () => {
    assert.equal(
      repositoryId('https://git.example.com/group/sub/repo.git'),
      'git.example.com/group/sub/repo',
    );
    assert.equal(
      repositoryId('git@git.example.com:group/sub/repo.git'),
      'git.example.com/group/sub/repo',
    );
  });

  test('a local folder, file:// and a host with no repository name no other machine', () => {
    for (const local of [
      'C:/Users/bbend/repo',
      'C:\\Users\\bbend\\repo',
      '/srv/git/repo.git',
      './repo',
      '../repo',
      'file:///srv/git/repo.git',
      'https://github.com/',
      'git@github.com:',
      '',
    ]) {
      assert.equal(repositoryId(local), null, local);
    }
    assert.equal(sameRepository('/srv/git/repo.git', '/srv/git/repo.git'), false);
  });
});

describe('matchingRemote', () => {
  const remotes = [
    { name: 'origin', url: 'git@github-work:bendela6/tickets.git' },
    { name: 'mirror', url: 'https://gitlab.com/bendela6/tickets.git' },
  ];

  test("finds an ssh host alias through what ssh makes of it (~/.ssh/config's HostName)", () => {
    const hosts = (/** @type {string} */ host) => (host === 'github-work' ? 'github.com' : host);
    assert.equal(matchingRemote(remotes, TICKETS_LINK, hosts)?.name, 'origin');
  });

  test('finds nothing when no remote is the link, alias or not', () => {
    assert.equal(
      matchingRemote(remotes, TICKETS_LINK, (host) => host),
      undefined,
    );
  });

  test('takes the direct match without asking ssh', () => {
    const remotes = [{ name: 'origin', url: 'git@github.com:bendela6/tickets.git' }];
    assert.equal(
      matchingRemote(remotes, TICKETS_LINK, () => assert.fail('asked ssh'))?.name,
      'origin',
    );
  });
});

describe('set', () => {
  test('keeps the checkout of the project under its prefix', async () => {
    const f = file();
    const repo = repository({ origin: 'git@github.com:bendela6/tickets.git' });
    const result = await run(['set', 'TK', repo], { file: f });
    assert.equal(result.code, 0, result.stderr);
    assert.equal(
      result.stdout.split('\n')[0],
      `TK (tickets) is ${repo}: its origin remote, git@github.com:bendela6/tickets.git, is the project's git link (https://github.com/bendela6/tickets.git).`,
    );
    assert.deepEqual(readRepos(f), { TK: repo });
  });

  test("keeps the checkout's top folder, from any folder in it", async () => {
    const f = file();
    const repo = repository({ origin: TICKETS_LINK });
    mkdirSync(path.join(repo, 'apps', 'web'), { recursive: true });
    const result = await run(['set', 'TK', path.join(repo, 'apps', 'web')], { file: f });
    assert.equal(result.code, 0, result.stderr);
    assert.deepEqual(readRepos(f), { TK: repo });
  });

  test("takes the project's key, any case, and keeps it under the prefix", async () => {
    const f = file();
    const repo = repository({ upstream: 'https://GitHub.com/bendela6/tickets/' });
    assert.equal((await run(['set', 'tickets', repo], { file: f })).code, 0);
    assert.equal(
      (
        await run(['set', 'gw', repository({ origin: 'https://github.com/bendela6/gateway' })], {
          file: f,
        })
      ).code,
      0,
    );
    assert.deepEqual(Object.keys(readRepos(f)), ['GW', 'TK']);
  });

  test('writes the file sorted, with forward slashes, and nothing beside it', async () => {
    const dir = path.join(ROOT, `config-${++n}`, 'tickets');
    const f = path.join(dir, 'repos.json');
    assert.equal(
      (
        await run(['set', 'TK', repository({ origin: TICKETS_LINK }).replace(/\//g, '\\')], {
          file: f,
        })
      ).code,
      0,
    );
    assert.equal(
      (
        await run(['set', 'GW', repository({ origin: 'git@github.com:bendela6/gateway.git' })], {
          file: f,
        })
      ).code,
      0,
    );
    const text = readFileSync(f, 'utf8');
    assert.deepEqual(Object.keys(JSON.parse(text)), ['GW', 'TK']);
    assert.ok(!text.includes('\\'), text);
    assert.ok(text.endsWith('}\n'));
    assert.deepEqual(readdirSync(dir), ['repos.json']);
  });

  test('replaces the folder a project had, and says what it was', async () => {
    const f = file();
    const first = repository({ origin: TICKETS_LINK });
    const second = repository({ origin: TICKETS_LINK });
    await run(['set', 'TK', first], { file: f });
    const result = await run(['set', 'TK', second], { file: f });
    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, new RegExp(`It was ${first}`));
    assert.deepEqual(readRepos(f), { TK: second });
  });

  test('refuses a checkout of another repository, naming the remotes it has', async () => {
    const f = file();
    const repo = repository({
      origin: 'https://github.com/someone/else.git',
      fork: 'git@github.com:me/tickets-fork.git',
    });
    const result = await run(['set', 'TK', repo], { file: f });
    assert.equal(result.code, 1);
    assert.match(
      result.stderr,
      /is not a checkout of TK's repository, https:\/\/github\.com\/bendela6\/tickets\.git/,
    );
    assert.match(result.stderr, /origin https:\/\/github\.com\/someone\/else\.git/);
    assert.match(result.stderr, /fork git@github\.com:me\/tickets-fork\.git/);
    assert.equal(existsSync(f), false);
  });

  test('refuses a checkout with no remotes', async () => {
    const result = await run(['set', 'TK', repository()], { file: file() });
    assert.equal(result.code, 1);
    assert.match(result.stderr, /It has no remotes\./);
  });

  test("refuses a folder that isn't a git checkout, and one that isn't there", async () => {
    const f = file();
    const plain = await run(['set', 'TK', folder()], { file: f });
    assert.equal(plain.code, 1);
    assert.match(plain.stderr, /is not a git checkout/);
    const nowhere = await run(['set', 'TK', path.join(ROOT, 'no-such-folder')], { file: f });
    assert.equal(nowhere.code, 1);
    assert.match(nowhere.stderr, /There's no folder at/);
    assert.equal(existsSync(f), false);
  });

  test('refuses a project with no git link in tickets', async () => {
    const result = await run(
      ['set', 'BH', repository({ origin: 'https://github.com/bendela6/bh.git' })],
      { file: file() },
    );
    assert.equal(result.code, 1);
    assert.match(result.stderr, /BH \(bh\) has no git link in tickets/);
  });

  test('refuses a project tickets does not have, naming the ones it has', async () => {
    const result = await run(['set', 'XX', repository({ origin: TICKETS_LINK })], { file: file() });
    assert.equal(result.code, 1);
    assert.match(
      result.stderr,
      /tickets has no project XX\. Its projects: TK \(tickets\), GW \(gateway\), BH \(bh\)\./,
    );
  });

  test("refuses when tickets' API can't be reached, saying which variable points at it", async () => {
    const f = file();
    const result = await run(['set', 'TK', repository({ origin: TICKETS_LINK })], {
      file: f,
      api: closedApi,
    });
    assert.equal(result.code, 1);
    assert.match(result.stderr, /Can't reach tickets' API at .*TICKETS_API_URL/);
    assert.equal(existsSync(f), false);
  });

  test("refuses to write over a file it can't read", async () => {
    const f = file();
    writeFileSync(f, '{ not json');
    const result = await run(['set', 'TK', repository({ origin: TICKETS_LINK })], { file: f });
    assert.equal(result.code, 1);
    assert.match(result.stderr, /is not JSON/);
    assert.equal(readFileSync(f, 'utf8'), '{ not json');
  });

  test('says when the folder is a worktree, and keeps it', async () => {
    const f = file();
    const repo = repository({ origin: TICKETS_LINK });
    git(repo, ['commit', '-q', '--allow-empty', '-m', 'first']);
    const worktree = slashes(path.join(ROOT, `worktree-${++n}`));
    git(repo, ['worktree', 'add', '-q', worktree]);
    const result = await run(['set', 'TK', worktree], { file: f });
    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, new RegExp(`Note: that's a worktree of ${repo}\\.`));
    assert.deepEqual(readRepos(f), { TK: worktree });
  });

  test('setFolder takes the projects and an ssh alias resolver from its caller', async () => {
    const f = file();
    const repo = repository({ origin: 'git@github-work:bendela6/tickets.git' });
    const done = await setFolder('TK', repo, {
      file: f,
      projects: PROJECTS,
      resolveHost: (host) => (host === 'github-work' ? 'github.com' : host),
    });
    assert.equal(done.key, 'TK');
    assert.deepEqual(readRepos(f), { TK: repo });
  });
});

describe('get', () => {
  test("prints the project's folder, and only that", async () => {
    const f = file();
    const repo = repository({ origin: TICKETS_LINK });
    await run(['set', 'TK', repo], { file: f });
    assert.deepEqual(await run(['get', 'TK'], { file: f }), { code: 0, stdout: repo, stderr: '' });
    assert.equal((await run(['get', 'tk'], { file: f })).stdout, repo);
    assert.equal((await run(['get', 'tickets'], { file: f })).stdout, repo);
  });

  test('says plainly that this machine has no folder for a project, and fails', async () => {
    const f = file();
    await run(['set', 'TK', repository({ origin: TICKETS_LINK })], { file: f });
    const result = await run(['get', 'GW'], { file: f });
    assert.deepEqual(result, {
      code: 1,
      stdout: '',
      stderr:
        'This machine has no folder for GW. Set it with: node scripts/tickets-repos.mjs set GW <folder>',
    });
  });

  test('has no folder for a project without a file at all, even with no API', async () => {
    const result = await run(['get', 'TK'], { file: file(), api: closedApi });
    assert.equal(result.code, 1);
    assert.match(result.stderr, /This machine has no folder for TK/);
  });

  test("fails on a folder that's gone rather than handing it out", async () => {
    const f = file();
    const repo = repository({ origin: TICKETS_LINK });
    await run(['set', 'TK', repo], { file: f });
    rmSync(repo, { recursive: true, force: true });
    const result = await run(['get', 'TK'], { file: f });
    assert.equal(result.code, 1);
    assert.match(result.stderr, new RegExp(`TK's folder, ${repo}, is gone`));
  });
});

describe('folderOf, for sessions and the builder', () => {
  test('the folder, or null and the reason', async () => {
    const f = file();
    const repo = repository({ origin: TICKETS_LINK });
    await setFolder('TK', repo, { file: f, projects: PROJECTS });
    assert.deepEqual(folderOf('TK', { file: f }), { folder: repo, reason: null });
    assert.deepEqual(folderOf('tk', { file: f }), { folder: repo, reason: null });
    const unset = folderOf('GW', { file: f });
    assert.equal(unset.folder, null);
    assert.equal(unset.folder === null && unset.problem, 'unset');
  });

  test("takes a project's key only when given tickets' projects", async () => {
    const f = file();
    const repo = repository({ origin: TICKETS_LINK });
    await setFolder('TK', repo, { file: f, projects: PROJECTS });
    assert.equal(folderOf('tickets', { file: f }).folder, null);
    assert.equal(folderOf('tickets', { file: f, projects: PROJECTS }).folder, repo);
  });

  test("a folder that's no longer a checkout, and a file that's broken", () => {
    const f = file();
    const plain = folder();
    writeFileSync(f, JSON.stringify({ TK: plain }));
    const stale = folderOf('TK', { file: f });
    assert.equal(stale.folder === null && stale.problem, 'not-a-checkout');
    writeFileSync(f, '["TK"]');
    const broken = folderOf('TK', { file: f });
    assert.equal(broken.folder === null && broken.problem, 'unreadable');
  });
});

describe('list', () => {
  test('every folder, flagging the ones that are gone', async () => {
    const f = file();
    const tickets = repository({ origin: TICKETS_LINK });
    const gateway = repository({ origin: 'git@github.com:bendela6/gateway.git' });
    await run(['set', 'TK', tickets], { file: f });
    await run(['set', 'GW', gateway], { file: f });
    rmSync(gateway, { recursive: true, force: true });
    const result = await run(['list'], { file: f });
    assert.equal(result.code, 0);
    assert.deepEqual(result.stdout.split('\n'), [
      `GW  ${gateway}  (the folder is gone)`,
      `TK  ${tickets}`,
    ]);
  });

  test('says when there are none', async () => {
    const result = await run(['list'], { file: file() });
    assert.equal(result.code, 0);
    assert.match(result.stdout, /This machine has no project folders yet/);
  });
});

describe('remove', () => {
  test("forgets a project's folder and leaves the others", async () => {
    const f = file();
    const tickets = repository({ origin: TICKETS_LINK });
    const gateway = repository({ origin: 'git@github.com:bendela6/gateway.git' });
    await run(['set', 'TK', tickets], { file: f });
    await run(['set', 'GW', gateway], { file: f });
    const result = await run(['remove', 'tk'], { file: f });
    assert.equal(result.code, 0, result.stderr);
    assert.equal(result.stdout, `Forgot TK's folder, ${tickets}.`);
    assert.deepEqual(readRepos(f), { GW: gateway });
  });

  test("fails when there's nothing to remove", async () => {
    const result = await run(['remove', 'TK'], { file: file() });
    assert.equal(result.code, 1);
    assert.match(result.stderr, /no folder for TK, so there's nothing to remove/);
  });
});

describe('the command', () => {
  test('shows how to use it when used wrong', async () => {
    for (const args of [
      [],
      ['set', 'TK'],
      ['get'],
      ['list', 'TK'],
      ['toString', 'TK'],
      ['frobnicate'],
    ]) {
      const result = await run(args, { file: file() });
      assert.equal(result.code, 2, args.join(' '));
      assert.match(result.stderr, /node scripts\/tickets-repos\.mjs set <KEY> <folder>/);
    }
    assert.equal((await run(['help'], { file: file() })).code, 0);
  });

  test('the file is under the home folder unless TICKETS_REPOS_FILE moves it; the API is 127.0.0.1:4600 unless TICKETS_API_URL says', () => {
    assert.equal(reposFile({}), path.join(homedir(), '.config', 'tickets', 'repos.json'));
    assert.equal(reposFile({ TICKETS_REPOS_FILE: 'x.json' }), 'x.json');
    assert.equal(apiUrl({}), 'http://127.0.0.1:4600');
    assert.equal(apiUrl({ TICKETS_API_URL: 'http://localhost:4604/' }), 'http://localhost:4604');
  });
});
