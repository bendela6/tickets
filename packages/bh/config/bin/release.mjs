#!/usr/bin/env node
// bh-release: a repo's `pnpm release`. Versions every package and service
// changed since its last version, and the stack; writes package.json versions
// and CHANGELOG.md entries; commits, tags and pushes. Docs: docs/releases.md.
//
//   bh-release               show the plan, ask, release
//   bh-release --dry-run     show the plan only
//   bh-release --no-commit   write the files and stop, to edit the notes
//   bh-release --continue    commit, tag and push what --no-commit wrote
//   bh-release --yes         release without asking
//   bh-release --set @tickets/api=1.0.0   declare a version; the repo's name sets the stack

import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { headerOf } from '../release/changelog.mjs';
import { commitsIn, git, newestTag, tagsOf } from '../release/git.mjs';
import { planRelease } from '../release/plan.mjs';
import { readWorkspace, usesOf } from '../release/workspace.mjs';
import { writeRelease } from '../release/write.mjs';

const HELP = readFileSync(new URL(import.meta.url), 'utf8')
  .split('\n')
  .filter((line) => line.startsWith('//   '))
  .map((line) => line.slice(5))
  .join('\n');

function fail(message) {
  console.error(`release: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const args = { dryRun: false, noCommit: false, cont: false, yes: false, set: new Map() };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') {
      args.dryRun = true;
    } else if (arg === '--no-commit') {
      args.noCommit = true;
    } else if (arg === '--continue') {
      args.cont = true;
    } else if (arg === '--yes' || arg === '-y') {
      args.yes = true;
    } else if (arg === '--set') {
      i += 1;
      const at = (argv[i] ?? '').lastIndexOf('=');
      const [name, version] = [argv[i]?.slice(0, at), argv[i]?.slice(at + 1)];
      if (at < 1 || !/^\d+\.\d+\.\d+$/.test(version)) {
        fail('--set takes <name>=<x.y.z>');
      }
      args.set.set(name, version);
    } else if (arg === '--help' || arg === '-h') {
      console.log(HELP);
      process.exit(0);
    } else {
      fail(`unknown option ${arg}\n\n${HELP}`);
    }
  }
  return args;
}

/** Refuses a release from anywhere but a clean main that is not behind origin. */
function checkRepo(root) {
  const branch = git(root, ['rev-parse', '--abbrev-ref', 'HEAD']).trim();
  if (branch !== 'main') {
    fail(`releases are made on main; this is ${branch}`);
  }
  if (git(root, ['status', '--porcelain']).trim() !== '') {
    fail('commit or stash your changes first');
  }
  git(root, ['fetch', '--quiet', 'origin', 'main', '--tags']);
  const behind = Number(git(root, ['rev-list', '--count', 'HEAD..origin/main']).trim());
  if (behind > 0) {
    fail(`main is ${behind} commit${behind === 1 ? '' : 's'} behind origin; pull first`);
  }
}

function gather(root, set) {
  const ws = readWorkspace(root);
  const tags = tagsOf(root);
  const stackFrom = newestTag(tags, 'v');
  const tagged = new Map();
  const commits = new Map();
  for (const unit of ws.units.filter((u) => !u.vendored)) {
    const own = newestTag(tags, `${unit.name}@`);
    tagged.set(unit.name, own);
    const since = own ? `${unit.name}@${own}` : stackFrom ? `v${stackFrom}` : null;
    const used = usesOf(unit, ws.units);
    const vendored = ws.units.filter((u) => u.vendored && used.has(u.name)).map((u) => u.dir);
    commits.set(unit.name, since ? commitsIn(root, `${since}..HEAD`, [unit.dir, ...vendored]) : []);
  }
  const stackCommits = stackFrom ? commitsIn(root, `v${stackFrom}..HEAD`) : [];
  return planRelease({
    name: ws.name,
    units: ws.units,
    stackFrom,
    tagged,
    commits,
    stackCommits,
    set,
  });
}

function show(plan) {
  const { stack, released, rootLines } = plan;
  const width = Math.max(...released.map((r) => r.name.length));
  const out = [
    `${stack.name} ${stack.from ? `v${stack.from}` : '(none)'} → v${stack.to}${stack.change ? ` (${stack.change})` : ''}`,
    '',
  ];
  for (const r of released) {
    const n = r.lines.filter((l) => l.hash).length;
    const commits = `${n} commit${n === 1 ? '' : 's'}`;
    out.push(
      `  ${r.name.padEnd(width)}  ${(r.from ?? '-').padEnd(7)} → ${r.to.padEnd(7)}  ${(r.change ?? '').padEnd(8)}  ${commits}`,
    );
  }
  out.push('', stack.from ? `Commits since v${stack.from}:` : 'Commits:');
  for (const line of rootLines) {
    out.push(`  ${headerOf(line)}${line.hash ? ` (${line.hash})` : ''}`);
  }
  out.push('', `Commit: ${plan.message.split('\n')[0]}`, `Tags: ${plan.tags.join(' ')}`);
  return out.join('\n');
}

/** Commits what is written, tags it and pushes the commit and tags at once. */
function finish(root, message, tags) {
  git(root, ['add', '--all']);
  const file = join(root, '.git', 'BH_RELEASE_MSG');
  writeFileSync(file, message);
  try {
    git(root, ['commit', '--quiet', '-F', file]);
  } finally {
    rmSync(file, { force: true });
  }
  for (const tag of tags) {
    git(root, ['tag', tag]);
  }
  git(root, ['push', '--quiet', '--atomic', 'origin', 'main', ...tags]);
  const head = git(root, ['rev-parse', '--short', 'HEAD']).trim();
  console.log(`release: ${head} pushed with ${tags.length} tags; the stack is ${tags.at(-1)}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = git(process.cwd(), ['rev-parse', '--show-toplevel']).trim();
  const pending = join(root, '.git', 'bh-release.json');

  if (args.cont) {
    if (!existsSync(pending)) {
      fail('nothing to continue: run bh-release --no-commit first');
    }
    const { message, tags } = JSON.parse(readFileSync(pending, 'utf8'));
    finish(root, message, tags);
    rmSync(pending);
    return;
  }

  checkRepo(root);
  const plan = gather(root, args.set);
  if (!plan) {
    console.log(
      'release: nothing to release; no feature, fix or breaking change since each last version',
    );
    return;
  }
  console.log(show(plan));
  if (args.dryRun) {
    return;
  }
  if (!args.yes) {
    if (!process.stdin.isTTY) {
      fail('no terminal to ask in: run with --yes to release without asking');
    }
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl.question('\nRelease? [y/N] ');
    rl.close();
    if (!/^y(es)?$/i.test(answer.trim())) {
      console.log('release: stopped; nothing written');
      return;
    }
  }
  writeRelease(root, plan, new Date());
  if (args.noCommit) {
    writeFileSync(pending, JSON.stringify({ message: plan.message, tags: plan.tags }));
    console.log(
      '\nrelease: written, not committed. Edit the notes, then run bh-release --continue.',
    );
    return;
  }
  finish(root, plan.message, plan.tags);
}

main().catch((error) => fail(error.message));
