import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import type { GitState } from '../shared/types.js';

// Git is the only thing on the board that spawns a process, and that has bitten before:
// a detached parent has no console, so on Windows every child got its own console
// window. `windowsHide` suppresses that, and the cache keeps the spawn rate down —
// without it a 1.5s poll meant roughly three git processes a second.

const TTL = 5_000;
const cache = new Map<string, { at: number; value: GitState | null }>();

function git(cwd: string, args: string[]): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
    windowsHide: true,
  }).trim();
}

export function readGit(cwd: string | null | undefined): GitState | null {
  if (!cwd || !fs.existsSync(cwd)) return null;

  const hit = cache.get(cwd);
  if (hit && Date.now() - hit.at < TTL) return hit.value;

  let value: GitState | null = null;
  try {
    const status = git(cwd, ['status', '--porcelain=v1']).split('\n').filter(Boolean);

    let ahead = 0;
    try {
      ahead = Number(git(cwd, ['rev-list', '--count', '@{u}..HEAD'])) || 0;
    } catch {
      // No upstream configured — not an error, just nothing to be ahead of.
    }

    let commits: GitState['commits'] = [];
    try {
      commits = git(cwd, ['log', '-6', '--pretty=%h%s%cr'])
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          const [sha = '', subject = '', when = ''] = line.split('');
          return { sha, subject, when };
        });
    } catch {
      // A repository with no commits yet.
    }

    value = {
      branch: git(cwd, ['rev-parse', '--abbrev-ref', 'HEAD']),
      ahead,
      commits,
      files: status.slice(0, 20).map((line) => ({
        code: line.slice(0, 2).trim() || '??',
        path: line.slice(3),
      })),
      modified: status.filter((l) => !l.startsWith('??')).length,
      untracked: status.filter((l) => l.startsWith('??')).length,
    };
  } catch {
    // Not a repository. Cache the miss too, or a non-repo path retries every poll.
    value = null;
  }

  cache.set(cwd, { at: Date.now(), value });
  return value;
}
