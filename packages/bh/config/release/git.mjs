// The git a release reads and writes, run in the repo's root.

import { spawnSync } from 'node:child_process';
import { compareVersions, parseMessage, parseVersion } from './commits.mjs';

/** Runs git in `cwd`; throws with its stderr on failure. */
export function git(cwd, args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')}: ${result.stderr.trim()}`);
  }
  return result.stdout;
}

/** The newest version among tags `<prefix><version>`; null for none. */
export function newestTag(tags, prefix) {
  const versions = tags
    .filter((tag) => tag.startsWith(prefix) && parseVersion(tag.slice(prefix.length)))
    .map((tag) => tag.slice(prefix.length));
  return versions.sort(compareVersions)[0] ?? null;
}

/** Every tag reachable from HEAD. */
export function tagsOf(cwd) {
  return git(cwd, ['tag', '--merged', 'HEAD']).split('\n').filter(Boolean);
}

/**
 * The commits in `range` (`v0.4.0..HEAD`, or `HEAD`) touching `paths` (all
 * when empty), newest first, with every file each touched.
 * @returns {import('./plan.mjs').Commit[]}
 */
export function commitsIn(cwd, range, paths = []) {
  const out = git(cwd, [
    'log',
    '--no-merges',
    '--name-only',
    '--full-diff',
    '--format=%x1e%H%x1f%ct%x1f%B%x1f',
    range,
    ...(paths.length > 0 ? ['--', ...paths] : []),
  ]);
  return out
    .split('\x1e')
    .filter((part) => part.trim() !== '')
    .map((part) => {
      const [hash, time, body, files = ''] = part.split('\x1f');
      return {
        hash: hash.trim(),
        time: Number(time),
        message: parseMessage(body.trim()),
        files: files
          .split('\n')
          .map((f) => f.trim())
          .filter(Boolean),
      };
    });
}
