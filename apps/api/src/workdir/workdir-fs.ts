import { realpathSync } from 'node:fs';
import { readdir, realpath, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, resolve, sep } from 'node:path';
import { environment } from '../environment';
import { HttpError } from '../errors';

export type RootDir = { path: string; symbol: string; annotation: string };
export type DirEntry = { name: string; path: string };
export type DirListing = { path: string; parent: string | null; entries: DirEntry[]; error?: string };

// A typo'd workdir path must fail the create/dispatch request, not spawn a
// process that dies a moment later. This is the one filesystem check a route
// does before handing off to a driver; kept here so it can be tested against a
// real temp dir and a bogus path.
export async function assertWorkdirDir(path: string): Promise<void> {
  let info: Awaited<ReturnType<typeof stat>>;
  try {
    info = await stat(path);
  } catch {
    throw new HttpError(400, `workdir path does not exist: ${path}`);
  }
  if (!info.isDirectory()) {
    throw new HttpError(400, `workdir path is not a directory: ${path}`);
  }
}

// The configured browse roots, as pickable rows. `symbol` is the keycap chip
// the tree renders (`~` for home, else the trailing segment); `annotation` is
// the absolute path shown beside it.
export function listRoots(): RootDir[] {
  const home = homedir();
  return environment.workdirRoots.map((path) => {
    const abs = resolve(path);
    const symbol = abs === home ? '~' : abs.split(sep).filter(Boolean).at(-1) ?? abs;
    return { path: abs, symbol, annotation: abs };
  });
}

// True when `abs` (already realpath'd) is one of the roots or nested beneath
// one. Roots are realpath'd too — symlinks inside a configured root are
// legitimate and must be collapsed the same way on both sides of the compare,
// otherwise a symlinked root itself would fail to contain its own children.
function isInsideRoots(abs: string): boolean {
  return environment.workdirRoots.some((root) => {
    let r: string;
    try {
      r = realpathSync(resolve(root));
    } catch {
      r = resolve(root);
    }
    return abs === r || abs.startsWith(r + sep);
  });
}

// Immediate sub-directories of `requested`, confined to WORKDIR_ROOTS. Files
// are omitted. Traversal outside the roots is a 403; a non-existent path is a
// 400; an unreadable directory returns an inline `error` with empty entries.
//
// The containment check runs against the *real* path (symlinks resolved), not
// the lexical one — a symlink under a root that points outside every root
// still string-matches the root prefix lexically, so without this it would
// bypass the boundary and let readdir list the target's contents.
export async function listSubdirs(requested: string): Promise<DirListing> {
  const abs = resolve(requested);
  const real = await realpath(abs).catch(() => abs);
  if (!isInsideRoots(real)) {
    throw new HttpError(403, `path is outside the allowed roots: ${real}`);
  }
  await assertWorkdirDir(real);
  let entries: DirEntry[];
  try {
    const dirents = await readdir(real, { withFileTypes: true });
    entries = dirents
      .filter((d) => d.isDirectory())
      .map((d) => ({ name: d.name, path: resolve(real, d.name) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return { path: real, parent: dirname(real), entries: [], error: 'permission denied' };
  }
  return { path: real, parent: dirname(real), entries };
}
