// @ts-check
// Where this machine keeps each project's repository.
//
// tickets keeps a project's git link (`repositoryUrl`), the same for everyone. Where a
// developer has that repository checked out is theirs, so it stays on their machine, in
// `~/.config/tickets/repos.json`: a project's prefix to its folder.
//
//   { "GW": "C:/Users/bbend/Desktop/Projects/gateway", "TK": "C:/Users/bbend/Desktop/Projects/tickets" }
//
// Run it to change the file (`node scripts/tickets-repos.mjs help`), or import it to read it:
//
//   import { folderOf } from './tickets-repos.mjs';
//   const { folder, reason } = folderOf('TK');   // folder is null, and reason says why, when there's none
//
// Nothing here guesses a folder: a project this machine has no folder for, or whose folder
// has gone, is answered with null and the reason, for the session to say.
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** @typedef {Record<string, string>} Repos  a project's prefix (`TK`) to its folder, with forward slashes */
/** @typedef {{ key: string, itemPrefix: string, name?: string, repositoryUrl?: string | null }} Project  as `GET /api/projects` answers it */
/** @typedef {'unset' | 'missing' | 'not-a-checkout' | 'unreadable'} Problem */
/** @typedef {{ folder: string, reason: null } | { folder: null, reason: string, problem: Problem }} Found */
/** @typedef {{ name: string, url: string }} Remote */

export const DEFAULT_API = 'http://127.0.0.1:4600';
const SCRIPT = 'node scripts/tickets-repos.mjs';

/** A refusal or a problem worth saying in a sentence; anything else is a bug. */
export class ReposError extends Error {}

/** The file: `TICKETS_REPOS_FILE` when set, else `~/.config/tickets/repos.json`. */
export function reposFile(env = process.env) {
  return env.TICKETS_REPOS_FILE || path.join(homedir(), '.config', 'tickets', 'repos.json');
}

/** tickets' API: `TICKETS_API_URL` when set, else 127.0.0.1:4600. */
export function apiUrl(env = process.env) {
  return (env.TICKETS_API_URL || DEFAULT_API).replace(/\/+$/, '');
}

const slashes = (/** @type {string} */ p) => p.replace(/\\/g, '/');

/**
 * Every folder the file holds. No file is no folders; a file that isn't an object of
 * strings is refused rather than read around, so a write never drops what it held.
 * @returns {Repos}
 */
export function readRepos(file = reposFile()) {
  if (!existsSync(file)) return {};
  const text = readFileSync(file, 'utf8');
  if (text.trim() === '') return {};
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new ReposError(
      `${file} is not JSON (${/** @type {Error} */ (error).message}). Fix or delete it.`,
    );
  }
  const ok =
    parsed !== null &&
    typeof parsed === 'object' &&
    !Array.isArray(parsed) &&
    Object.values(parsed).every((v) => typeof v === 'string');
  if (!ok)
    throw new ReposError(
      `${file} should map project prefixes to folders ({"TK": "C:/…/tickets"}). Fix or delete it.`,
    );
  return parsed;
}

/** Writes the whole file at once (a temporary file renamed over it), keys sorted. */
export function writeRepos(/** @type {Repos} */ repos, file = reposFile()) {
  mkdirSync(path.dirname(file), { recursive: true });
  const sorted = Object.fromEntries(
    Object.entries(repos).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
  );
  const temporary = `${file}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(sorted, null, 2)}\n`);
  try {
    renameSync(temporary, file);
  } catch (error) {
    rmSync(temporary, { force: true });
    throw error;
  }
}

/**
 * The file's key for `key`: the prefix in any case (`tk` is `TK`), or, given tickets'
 * projects, a project's key (`tickets` is `TK`). Undefined when the file has neither.
 * @param {Repos} repos
 * @param {string} key
 * @param {Project[]} [projects]
 */
function keyIn(repos, key, projects) {
  const byPrefix = (/** @type {string} */ prefix) =>
    Object.keys(repos).find((k) => k.toUpperCase() === prefix.trim().toUpperCase());
  const direct = byPrefix(key);
  if (direct !== undefined || !projects) return direct;
  const project = projects.find((p) => p.key?.toLowerCase() === key.trim().toLowerCase());
  return project ? byPrefix(project.itemPrefix) : undefined;
}

/**
 * The folder this machine has for a project, or null and the reason, in words to show.
 * `key` is the project's prefix (`TK`, any case); pass `projects` (from `GET /api/projects`)
 * to take its key (`tickets`) too. It reads the file only: no git, no network.
 * @param {string} key
 * @param {{ file?: string, projects?: Project[] }} [options]
 * @returns {Found}
 */
export function folderOf(key, { file = reposFile(), projects } = {}) {
  let repos;
  try {
    repos = readRepos(file);
  } catch (error) {
    return { folder: null, reason: /** @type {Error} */ (error).message, problem: 'unreadable' };
  }
  const found = keyIn(repos, key, projects);
  if (found === undefined) {
    return {
      folder: null,
      reason: `This machine has no folder for ${key}. Set it with: ${SCRIPT} set ${key} <folder>`,
      problem: 'unset',
    };
  }
  const folder = /** @type {string} */ (repos[found]);
  if (!existsSync(folder)) {
    return {
      folder: null,
      reason: `${found}'s folder, ${folder}, is gone. Set it again with: ${SCRIPT} set ${found} <folder>`,
      problem: 'missing',
    };
  }
  if (!existsSync(path.join(folder, '.git'))) {
    return {
      folder: null,
      reason: `${found}'s folder, ${folder}, is no longer a git checkout. Set it again with: ${SCRIPT} set ${found} <folder>`,
      problem: 'not-a-checkout',
    };
  }
  return { folder, reason: null };
}

/**
 * Every folder in the file, each with what's wrong with it now (null when nothing).
 * @returns {{ key: string, folder: string, problem: string | null }[]}
 */
export function listFolders({ file = reposFile() } = {}) {
  return Object.entries(readRepos(file))
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, folder]) => {
      const found = folderOf(key, { file });
      const problem =
        found.folder !== null
          ? null
          : found.problem === 'missing'
            ? 'the folder is gone'
            : 'no longer a git checkout';
      return { key, folder, problem };
    });
}

/**
 * Forgets a project's folder. Returns what it was, or null when there was none.
 * @param {string} key
 * @param {{ file?: string, projects?: Project[] }} [options]
 */
export function removeFolder(key, { file = reposFile(), projects } = {}) {
  const repos = readRepos(file);
  const found = keyIn(repos, key, projects);
  if (found === undefined) return null;
  const folder = /** @type {string} */ (repos[found]);
  delete repos[found];
  writeRepos(repos, file);
  return { key: found, folder };
}

// ---------------------------------------------------------------------------------- git links

/**
 * What names a repository in a git link: `host/path`, lowercased, without the scheme, the
 * user, the port, slashes at either end of the path, or `.git`. So
 * `https://GitHub.com/bendela6/tickets/`, `ssh://git@github.com:22/bendela6/tickets.git` and
 * `git@github.com:bendela6/tickets.git` are all `github.com/bendela6/tickets`. Null for what
 * names no other machine: a local folder, `file://`, a bare word.
 *
 * Case is dropped from the path as well as the host: GitHub and GitLab take a repository's
 * path in any case, and two repositories a case apart on one host is no real setup.
 * @param {string} url
 */
export function repositoryId(url) {
  const text = url.trim();
  let host;
  let repoPath;
  const scheme = /^([A-Za-z][A-Za-z0-9+.-]*):\/\//.exec(text);
  if (scheme) {
    if (/** @type {string} */ (scheme[1]).toLowerCase() === 'file') return null;
    let parsed;
    try {
      parsed = new URL(text);
    } catch {
      return null;
    }
    host = parsed.hostname;
    try {
      repoPath = decodeURIComponent(parsed.pathname);
    } catch {
      repoPath = parsed.pathname;
    }
  } else {
    // git's scp-like form, `[user@]host:path`, which git reads only when no slash comes
    // before the first colon. A one-letter host is a Windows drive (`C:/repo`).
    const scp = /^(?:[^@\s/:\\]+@)?([^@\s/:\\]+):(.+)$/.exec(text);
    if (!scp || /** @type {string} */ (scp[1]).length === 1) return null;
    host = /** @type {string} */ (scp[1]);
    repoPath = /** @type {string} */ (scp[2]);
  }
  repoPath = repoPath
    .replace(/\/+$/, '')
    .replace(/\.git$/i, '')
    .replace(/^\/+|\/+$/g, '');
  host = host.replace(/^\[|\]$/g, '');
  if (host === '' || repoPath === '') return null;
  return `${host}/${repoPath}`.toLowerCase();
}

/** Whether two git links name the same repository (see `repositoryId`). */
export function sameRepository(/** @type {string} */ a, /** @type {string} */ b) {
  const id = repositoryId(a);
  return id !== null && id === repositoryId(b);
}

/**
 * The host an ssh link's host stands for: `ssh -G` prints what `~/.ssh/config` makes of it,
 * so `git@github-work:owner/repo` with `Host github-work / HostName github.com` is
 * github.com. The host itself when ssh says nothing (no ssh, no such alias).
 * @param {string} host
 */
export function sshHostname(host) {
  if (!/^[A-Za-z0-9._-]+$/.test(host)) return host;
  try {
    const config = execFileSync('ssh', ['-G', host], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 5000,
    });
    return /^hostname\s+(\S+)/im.exec(config)?.[1] ?? host;
  } catch {
    return host;
  }
}

/** The host an ssh link goes to (scp-like or ssh://), or null for any other link. */
function sshHost(/** @type {string} */ url) {
  const ssh = /^ssh:\/\/(?:[^@/]+@)?([^/:]+)/i.exec(url);
  if (ssh) return /** @type {string} */ (ssh[1]);
  if (/^[A-Za-z][A-Za-z0-9+.-]*:\/\//.test(url)) return null;
  const scp = /^(?:[^@\s/:\\]+@)?([^@\s/:\\]{2,}):/.exec(url);
  return scp ? /** @type {string} */ (scp[1]) : null;
}

/**
 * The remote whose link names the same repository as `link`, if any: first as written,
 * then with an ssh link's host alias looked up (`resolveHost`, by default `ssh -G`).
 * @param {Remote[]} remotes
 * @param {string} link
 * @param {(host: string) => string} [resolveHost]
 */
export function matchingRemote(remotes, link, resolveHost = sshHostname) {
  const direct = remotes.find((r) => sameRepository(r.url, link));
  if (direct) return direct;
  const want = repositoryId(link);
  if (want === null) return undefined;
  return remotes.find((r) => {
    const host = sshHost(r.url);
    if (host === null) return false;
    const real = resolveHost(host);
    if (real.toLowerCase() === host.toLowerCase()) return false;
    const id = repositoryId(r.url);
    return id !== null && `${real.toLowerCase()}${id.slice(host.length)}` === want;
  });
}

// ---------------------------------------------------------------------------------- checkouts

const git = (/** @type {string} */ folder, /** @type {string[]} */ args) =>
  execFileSync('git', ['-C', folder, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

/**
 * The checkout `folder` is in: its top folder, its remotes (each link once, fetch and push),
 * and, for a linked worktree, the main checkout it hangs off.
 * @param {string} folder
 * @returns {{ top: string, remotes: Remote[], mainCheckout: string | null }}
 */
export function checkoutOf(folder) {
  const resolved = path.resolve(folder);
  if (!existsSync(resolved)) throw new ReposError(`There's no folder at ${slashes(resolved)}.`);
  let top;
  try {
    top = slashes(git(resolved, ['rev-parse', '--show-toplevel']));
  } catch (error) {
    const said = String(/** @type {{ stderr?: unknown }} */ (error).stderr ?? '')
      .trim()
      .split('\n')[0];
    throw new ReposError(
      `${slashes(resolved)} is not a git checkout${said ? ` (git: ${said})` : ''}.`,
    );
  }
  /** @type {Remote[]} */
  const remotes = [];
  for (const line of git(top, ['remote', '-v']).split('\n')) {
    const match = /^(\S+)\s+(\S+)/.exec(line);
    if (!match) continue;
    const name = /** @type {string} */ (match[1]);
    const url = /** @type {string} */ (match[2]);
    if (!remotes.some((r) => r.name === name && r.url === url)) remotes.push({ name, url });
  }
  let mainCheckout = null;
  const gitDir = slashes(git(top, ['rev-parse', '--path-format=absolute', '--git-dir']));
  const commonDir = slashes(git(top, ['rev-parse', '--path-format=absolute', '--git-common-dir']));
  if (gitDir !== commonDir && path.basename(commonDir) === '.git')
    mainCheckout = path.dirname(commonDir);
  return { top, remotes, mainCheckout: mainCheckout === null ? null : slashes(mainCheckout) };
}

// ---------------------------------------------------------------------------------- tickets' API

/**
 * tickets' projects, from `GET /api/projects`.
 * @returns {Promise<Project[]>}
 */
export async function fetchProjects(api = apiUrl()) {
  const url = `${api}/api/projects`;
  let response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  } catch (error) {
    const cause = /** @type {{ cause?: { code?: string } }} */ (error).cause?.code;
    throw new ReposError(
      `Can't reach tickets' API at ${api} (${cause ?? /** @type {Error} */ (error).message}). Start it, or point TICKETS_API_URL at it.`,
    );
  }
  if (!response.ok) throw new ReposError(`tickets' API answered ${response.status} to GET ${url}.`);
  const body = /** @type {{ data?: unknown }} */ (await response.json().catch(() => ({})));
  if (!Array.isArray(body.data))
    throw new ReposError(`GET ${url} didn't answer a list of projects.`);
  return body.data;
}

/** The project `key` names: its prefix (`TK`) or its key (`tickets`), in any case. */
export function findProject(/** @type {Project[]} */ projects, /** @type {string} */ key) {
  const wanted = key.trim().toLowerCase();
  return (
    projects.find((p) => p.itemPrefix?.toLowerCase() === wanted) ??
    projects.find((p) => p.key?.toLowerCase() === wanted)
  );
}

/**
 * Keeps `folder` as this machine's checkout of a project, once it's sure it is one: the
 * folder is in a git checkout, and one of its remotes is the project's git link in tickets.
 * The file gets the checkout's top folder, under the project's prefix.
 * @param {string} key  the project's prefix (`TK`) or key (`tickets`)
 * @param {string} folder
 * @param {{ file?: string, api?: string, projects?: Project[], resolveHost?: (host: string) => string }} [options]
 */
export async function setFolder(
  key,
  folder,
  { file = reposFile(), api = apiUrl(), projects, resolveHost } = {},
) {
  const repos = readRepos(file); // a broken file refuses before anything else
  const checkout = checkoutOf(folder);
  const all = projects ?? (await fetchProjects(api));
  const project = findProject(all, key);
  if (!project) {
    const known = all.map((p) => `${p.itemPrefix} (${p.key})`).join(', ');
    throw new ReposError(
      `tickets has no project ${key}. ${known ? `Its projects: ${known}.` : 'It has no projects.'}`,
    );
  }
  const prefix = project.itemPrefix.toUpperCase();
  const link = project.repositoryUrl;
  if (!link) {
    throw new ReposError(
      `${prefix} (${project.key}) has no git link in tickets, so there's nothing to check ${checkout.top} against. Set it in the project's Settings, Repository tab.`,
    );
  }
  const remote = matchingRemote(checkout.remotes, link, resolveHost);
  if (!remote) {
    const has = checkout.remotes.length
      ? `Its remotes: ${checkout.remotes.map((r) => `${r.name} ${r.url}`).join(', ')}.`
      : 'It has no remotes.';
    throw new ReposError(
      `${checkout.top} is not a checkout of ${prefix}'s repository, ${link}. ${has}`,
    );
  }
  const previousKey = keyIn(repos, prefix);
  const previous = previousKey === undefined ? null : /** @type {string} */ (repos[previousKey]);
  if (previousKey !== undefined) delete repos[previousKey];
  repos[prefix] = checkout.top;
  writeRepos(repos, file);
  return {
    key: prefix,
    project: project.key,
    folder: checkout.top,
    remote,
    link,
    previous,
    mainCheckout: checkout.mainCheckout,
  };
}

// ---------------------------------------------------------------------------------- the command

const USAGE = `Where this machine keeps each project's checkout.

  ${SCRIPT} set <KEY> <folder>   check the folder is a checkout of the project's git link, then keep it
  ${SCRIPT} get <KEY>            print the project's folder; fails when this machine has none
  ${SCRIPT} list                 every project's folder, flagging the ones that are gone
  ${SCRIPT} remove <KEY>         forget the project's folder

<KEY> is the project's prefix (TK, GW), or its key in tickets (tickets, gateway).
The file is ${reposFile()} (TICKETS_REPOS_FILE moves it).
tickets' API, which has each project's git link, is ${apiUrl()} (TICKETS_API_URL).`;

/** The CLI. Resolves to the exit code: 0 done, 1 refused or not found, 2 used wrong. */
export async function main(
  argv = process.argv.slice(2),
  { out = console.log, err = console.error } = {},
) {
  const [command, key, folder, ...extra] = argv;
  const needs = { set: 2, get: 1, remove: 1, list: 0 };
  if (command === 'help' || command === '--help' || command === '-h') {
    out(USAGE);
    return 0;
  }
  const given = [key, folder, ...extra].filter((a) => a !== undefined).length;
  if (
    !command ||
    !Object.hasOwn(needs, command) ||
    given !== needs[/** @type {keyof typeof needs} */ (command)]
  ) {
    err(USAGE);
    return 2;
  }
  const file = reposFile();
  try {
    if (command === 'set') {
      const done = await setFolder(/** @type {string} */ (key), /** @type {string} */ (folder), {
        file,
      });
      const link = done.remote.url === done.link ? '' : ` (${done.link})`;
      out(
        `${done.key} (${done.project}) is ${done.folder}: its ${done.remote.name} remote, ${done.remote.url}, is the project's git link${link}.`,
      );
      if (done.previous !== null && done.previous !== done.folder) out(`It was ${done.previous}.`);
      if (done.mainCheckout) {
        out(
          `Note: that's a worktree of ${done.mainCheckout}. The builder makes its worktrees beside the folder set here, so the main checkout is usually the one to set.`,
        );
      }
      out(`Kept in ${file}.`);
      return 0;
    }
    if (command === 'list') {
      const rows = listFolders({ file });
      if (rows.length === 0) {
        out(
          `This machine has no project folders yet (${file}). Set one with: ${SCRIPT} set <KEY> <folder>`,
        );
        return 0;
      }
      const width = Math.max(...rows.map((r) => r.key.length));
      for (const row of rows)
        out(`${row.key.padEnd(width)}  ${row.folder}${row.problem ? `  (${row.problem})` : ''}`);
      return 0;
    }
    // get and remove take the project's key too, which only tickets can turn into its prefix.
    const projectsIfNeeded = async () => {
      if (keyIn(readRepos(file), /** @type {string} */ (key)) !== undefined) return undefined;
      return fetchProjects().catch(() => undefined);
    };
    if (command === 'get') {
      const found = folderOf(/** @type {string} */ (key), {
        file,
        projects: await projectsIfNeeded(),
      });
      if (found.folder === null) {
        err(found.reason);
        return 1;
      }
      out(found.folder);
      return 0;
    }
    const removed = removeFolder(/** @type {string} */ (key), {
      file,
      projects: await projectsIfNeeded(),
    });
    if (removed === null) {
      err(`This machine has no folder for ${key}, so there's nothing to remove.`);
      return 1;
    }
    out(`Forgot ${removed.key}'s folder, ${removed.folder}.`);
    return 0;
  } catch (error) {
    if (error instanceof ReposError) {
      err(error.message);
      return 1;
    }
    throw error;
  }
}

const realpath = (/** @type {string} */ p) => {
  try {
    return realpathSync(p);
  } catch {
    return p;
  }
};
if (
  process.argv[1] &&
  realpath(path.resolve(process.argv[1])) === realpath(fileURLToPath(import.meta.url))
) {
  process.exitCode = await main();
}
