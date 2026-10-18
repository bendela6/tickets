// Writes a release's versions into package.json files and its entries into
// CHANGELOG.md files, moving a past year's entries to changelog/<year>.md.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { addEntry, addToYear, formatEntry, stamp } from './changelog.mjs';

/** The package.json text with `version` set. */
export function setVersion(text, version) {
  if (/"version"\s*:\s*"[^"]*"/.test(text)) {
    return text.replace(/"version"\s*:\s*"[^"]*"/, `"version": "${version}"`);
  }
  return text.replace(/("name"\s*:\s*"[^"]*",?)(\r?\n)(\s*)/, `$1$2$3"version": "${version}",$2$3`);
}

/** Writes `plan` under `root` as of `now`; returns the files written. */
export function writeRelease(root, plan, now) {
  const written = [];
  const text = stamp(now);
  const year = now.getFullYear();
  const put = (file, content) => {
    mkdirSync(join(file, '..'), { recursive: true });
    writeFileSync(file, content);
    written.push(file);
  };
  const read = (file) => (existsSync(file) ? readFileSync(file, 'utf8') : '');
  const log = (dir, entry) => {
    const file = join(root, dir, 'CHANGELOG.md');
    const { text: next, moved } = addEntry(read(file), entry, year);
    put(file, next);
    for (const [y, entries] of moved) {
      const yearFile = join(root, dir, 'changelog', `${y}.md`);
      put(yearFile, addToYear(read(yearFile), entries, y));
    }
  };
  for (const r of plan.released) {
    const pkgFile = join(root, r.dir, 'package.json');
    put(pkgFile, setVersion(readFileSync(pkgFile, 'utf8'), r.to));
    log(r.dir, formatEntry({ version: r.to, stampText: text, lines: r.lines }));
  }
  const rootPkg = join(root, 'package.json');
  put(rootPkg, setVersion(readFileSync(rootPkg, 'utf8'), plan.stack.to));
  log(
    '',
    formatEntry({
      version: plan.stack.to,
      stampText: text,
      versions: plan.versions,
      lines: plan.rootLines,
    }),
  );
  return written;
}
