// A repo's packages as a release sees them: from pnpm-workspace.yaml, and the
// root package.json's `release` block, which names the services and the
// folders that are vendored (another repo's copies: versioned there, not here).
//
//   "release": { "services": ["apps/api", "apps/web"], "vendored": ["packages/bh/*"] }

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * @typedef {object} Unit
 * @property {string} name `@tickets/web`
 * @property {string} short `web`: its scope in a commit header.
 * @property {string} dir `apps/web`, from the repo's root, with forward slashes.
 * @property {string} version Its package.json's.
 * @property {boolean} service Named in `release.services`.
 * @property {boolean} vendored Under a `release.vendored` folder: never versioned here.
 * @property {string[]} deps The workspace packages it names in any dependency field.
 */

/** The `packages:` globs of a pnpm-workspace.yaml. */
export function workspaceGlobs(yaml) {
  const globs = [];
  let inList = false;
  for (const line of yaml.replace(/\r/g, '').split('\n')) {
    if (/^packages:\s*$/.test(line)) {
      inList = true;
      continue;
    }
    if (inList) {
      const item = /^\s+-\s+['"]?([^'"#]+?)['"]?\s*(#.*)?$/.exec(line);
      if (item) {
        globs.push(item[1]);
      } else if (/^\S/.test(line)) {
        inList = false;
      }
    }
  }
  return globs;
}

/** Whether `dir` matches a glob of `*` segments: `packages/*` matches `packages/ui`. */
export function matches(glob, dir) {
  const a = glob.replace(/\/+$/, '').split('/');
  const b = dir.split('/');
  return a.length === b.length && a.every((part, i) => part === '*' || part === b[i]);
}

/** The folders a glob names under `root`. */
function expand(root, glob) {
  let dirs = [''];
  for (const part of glob.replace(/\/+$/, '').split('/')) {
    const next = [];
    for (const dir of dirs) {
      if (part === '*') {
        const full = join(root, dir);
        if (!existsSync(full)) {
          continue;
        }
        for (const entry of readdirSync(full)) {
          if (
            entry !== 'node_modules' &&
            !entry.startsWith('.') &&
            statSync(join(full, entry)).isDirectory()
          ) {
            next.push(dir ? `${dir}/${entry}` : entry);
          }
        }
      } else {
        next.push(dir ? `${dir}/${part}` : part);
      }
    }
    dirs = next;
  }
  return dirs;
}

/** `@tickets/web` → `web`. */
export const shortName = (name) => name.replace(/^@[^/]+\//, '');

/**
 * The repo's name, its release settings and its packages, in folder order.
 * @returns {{ name: string, services: string[], vendored: string[], units: Unit[] }}
 */
export function readWorkspace(root) {
  const rootPkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const release = rootPkg.release ?? {};
  const services = release.services ?? [];
  const vendored = release.vendored ?? [];
  const yamlPath = join(root, 'pnpm-workspace.yaml');
  const globs = existsSync(yamlPath) ? workspaceGlobs(readFileSync(yamlPath, 'utf8')) : [];
  const dirs = [];
  for (const glob of globs.filter((g) => !g.startsWith('!'))) {
    for (const dir of expand(root, glob)) {
      const excluded = globs.some((g) => g.startsWith('!') && matches(g.slice(1), dir));
      if (!excluded && !dirs.includes(dir) && existsSync(join(root, dir, 'package.json'))) {
        dirs.push(dir);
      }
    }
  }
  dirs.sort();
  const pkgs = dirs.map((dir) => ({
    dir,
    pkg: JSON.parse(readFileSync(join(root, dir, 'package.json'), 'utf8')),
  }));
  const names = new Set(pkgs.map((p) => p.pkg.name));
  const shorts = new Map();
  for (const { pkg } of pkgs) {
    shorts.set(shortName(pkg.name), (shorts.get(shortName(pkg.name)) ?? 0) + 1);
  }
  const units = pkgs.map(({ dir, pkg }) => {
    const fields = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];
    const deps = [...new Set(fields.flatMap((f) => Object.keys(pkg[f] ?? {})))].filter(
      (dep) => names.has(dep) && dep !== pkg.name,
    );
    const short = shorts.get(shortName(pkg.name)) > 1 ? dir : shortName(pkg.name);
    return {
      name: pkg.name,
      short,
      dir,
      version: pkg.version ?? '0.0.0',
      service: services.includes(dir),
      vendored: vendored.some((glob) => matches(glob, dir)),
      deps,
    };
  });
  return { name: rootPkg.name, services, vendored, units };
}

/** Every workspace package `unit` uses, through the ones it uses, by name. */
export function usesOf(unit, units) {
  const byName = new Map(units.map((u) => [u.name, u]));
  const seen = new Set();
  const walk = (u) => {
    for (const dep of u.deps) {
      if (!seen.has(dep)) {
        seen.add(dep);
        walk(byName.get(dep));
      }
    }
  };
  walk(unit);
  return seen;
}

/** The unit a file belongs to, by the longest folder it sits in; null for the repo's own files. */
export function unitOfFile(file, units) {
  let best = null;
  for (const unit of units) {
    if (
      (file === unit.dir || file.startsWith(`${unit.dir}/`)) &&
      (!best || unit.dir.length > best.dir.length)
    ) {
      best = unit;
    }
  }
  return best;
}
