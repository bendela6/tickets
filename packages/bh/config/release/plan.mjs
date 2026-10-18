// What a release makes, from the packages and their commits: each one's next
// version and changelog lines, the stack's version, the commit and the tags.
// No git and no files here: bin/release.mjs gathers the input.

import { changeOf, largest, nextVersion, parseVersion } from './commits.mjs';
import { usesOf } from './workspace.mjs';

/**
 * A commit as gathered from git.
 * @typedef {object} Commit
 * @property {string} hash Full.
 * @property {number} time Its commit time, in seconds.
 * @property {import('./commits.mjs').Message} message
 * @property {string[]} files
 */

/** Whether a release lists a commit: not a merge, not a release. */
export const listed = (commit) =>
  !commit.message.generated &&
  !(commit.message.type === 'chore' && commit.message.scope === 'release');

/** A commit's scopes: the short names of the units it touched; else its header's scope. */
export function scopesOf(commit, units) {
  const touched = new Set();
  for (const file of commit.files) {
    for (const unit of units) {
      if (!unit.vendored && (file === unit.dir || file.startsWith(`${unit.dir}/`))) {
        touched.add(unit.short);
      }
    }
  }
  if (touched.size > 0) {
    return [...touched].sort();
  }
  return commit.message.scope ? [commit.message.scope] : [];
}

/** A commit as a changelog line. @returns {import('./changelog.mjs').Line} */
export function lineOf(commit, units) {
  const { type, breaking, headline, bullets, change } = commit.message;
  return {
    type,
    scopes: scopesOf(commit, units),
    breaking,
    headline,
    hash: commit.hash.slice(0, 7),
    bullets,
    change,
  };
}

const note = (headline) => ({
  type: null,
  scopes: [],
  breaking: false,
  headline,
  hash: null,
  bullets: [],
  change: null,
});

/** A commit a service's notes take from a package it uses: a feature, a fix or a breaking change. */
const counts = (commit) =>
  commit.message.breaking || ['feat', 'fix', 'perf'].includes(commit.message.type ?? '');

const capital = (text) => text.charAt(0).toUpperCase() + text.slice(1);

/** `a, b and c`. */
const and = (items) =>
  items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;

/**
 * @param {object} input
 * @param {string} input.name The repo's: `tickets`.
 * @param {import('./workspace.mjs').Unit[]} input.units Every workspace package, vendored ones too.
 * @param {string | null} input.stackFrom The newest `v*` tag's version; null before the first.
 * @param {Map<string, string | null>} input.tagged Each unit's newest own tag's version, by name; null for none.
 * @param {Map<string, Commit[]>} input.commits Each unit's commits since it was last versioned, newest first.
 * @param {Commit[]} input.stackCommits The repo's commits since the newest `v*` tag, newest first.
 * @param {Map<string, string>} [input.set] Versions declared with `--set`, by name; the repo's name sets the stack.
 */
export function planRelease({
  name,
  units,
  stackFrom,
  tagged,
  commits,
  stackCommits,
  set = new Map(),
}) {
  const releasing = units.filter((u) => !u.vendored);
  const results = new Map();

  for (const unit of releasing) {
    const own = (commits.get(unit.name) ?? []).filter(listed);
    const tag = tagged.get(unit.name) ?? null;
    const from = tag ?? stackFrom;
    const fresh = from === null;
    const start =
      parseVersion(unit.version) && unit.version !== '0.0.0' && !unit.version.startsWith('0.0.')
        ? unit.version
        : '0.1.0';
    results.set(unit.name, {
      unit,
      from,
      own,
      change: fresh ? null : largest(own.map((c) => changeOf(c.message))),
      first: tag === null,
      fresh,
      start,
    });
  }

  const versioned = (r) => set.has(r.unit.name) || r.change !== null || r.first;
  for (const r of results.values()) {
    if (!r.unit.service) {
      continue;
    }
    const used = usesOf(r.unit, units);
    const changed = [...results.values()].filter(
      (p) => !p.unit.service && used.has(p.unit.name) && p.change !== null,
    );
    r.fromPackages = changed.flatMap((p) => p.own.filter(counts));
    if (changed.length > 0) {
      r.change = largest([r.change, 'fix']);
    }
  }

  const released = [];
  for (const r of results.values()) {
    if (!versioned(r)) {
      continue;
    }
    const to =
      set.get(r.unit.name) ??
      (r.fresh ? r.start : r.change ? nextVersion(r.from, r.change) : r.from);
    const seen = new Set();
    const listedCommits = [...r.own, ...(r.fromPackages ?? [])]
      .filter((c) => !seen.has(c.hash) && seen.add(c.hash))
      .sort((a, b) => b.time - a.time);
    let lines = listedCommits.map((c) => lineOf(c, units));
    if (r.fresh) {
      lines = [note('Start keeping versions and this changelog')];
    } else if (lines.length === 0) {
      lines = [note(`Start keeping its own version, unchanged since v${r.from}`)];
    }
    released.push({
      name: r.unit.name,
      short: r.unit.short,
      dir: r.unit.dir,
      from: r.first ? null : r.from,
      to,
      change: r.change,
      lines,
    });
  }
  if (released.length === 0 && !set.has(name)) {
    return null;
  }

  const stackChange = largest(released.map((r) => r.change));
  const stackTo =
    set.get(name) ?? (stackFrom === null ? '0.1.0' : nextVersion(stackFrom, stackChange ?? 'fix'));
  const rootListed = stackCommits.filter(listed);
  const rootLines =
    stackFrom === null
      ? [note('Start keeping versions and this changelog')]
      : rootListed.map((c) => lineOf(c, units));

  const named = released.map((r) => `${r.short} ${r.to}`);
  const header =
    released.length <= 3
      ? `chore(release): release ${and(named)} as v${stackTo}`
      : `chore(release): release ${released.length} packages as v${stackTo}`;
  const bullets = [
    ...new Set(rootListed.filter(counts).map((c) => `- ${capital(c.message.headline)}`)),
  ];

  return {
    stack: { name, from: stackFrom, to: stackTo, change: stackChange },
    released,
    rootLines,
    versions: released.map((r) => ({ name: r.name, version: r.to })),
    message: bullets.length > 0 ? `${header}\n\n${bullets.join('\n')}\n` : `${header}\n`,
    tags: [...released.map((r) => `${r.name}@${r.to}`), `v${stackTo}`],
  };
}
