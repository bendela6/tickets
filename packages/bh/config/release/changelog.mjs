// CHANGELOG.md entries: bh-release writes them; @bh/shell's Vite plugin and the
// gateway read them. Each entry is a fixed heading, then one flat list of commits.
//
//   ## 0.3.2 · 2026-10-17 14:32 +04:00
//
//   @tickets/web 0.3.2 · @tickets/api 0.5.1        (the root's only)
//
//   - fix(api,web): refuse tickets with an empty title (8e7d6c5)
//     - Disable Save in the new-ticket form until the title has text
//     - BREAKING CHANGE: a ticket needs a title; send one

/**
 * A commit as a changelog lists it.
 * @typedef {object} Line
 * @property {string | null} type `fix`; null for a plain note.
 * @property {string[]} scopes The folders it touched, by short name.
 * @property {boolean} breaking
 * @property {string} headline
 * @property {string | null} hash Short.
 * @property {string[]} bullets
 * @property {string | null} change The `BREAKING CHANGE:` text.
 */

/**
 * @typedef {object} Entry
 * @property {string} version
 * @property {string} date ISO, with its offset: `2026-10-17T14:32:00+04:00`.
 * @property {{ name: string, version: string }[] | null} versions The root's versions line.
 * @property {Line[]} lines Newest first.
 */

const HEADING = /^## (\d+\.\d+\.\d+) · (\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}) ([+-]\d{2}:\d{2})$/;
const LINE = /^- (\w+)(?:\(([^)]*)\))?(!)?: (.+?)(?: \(([0-9a-f]{7,40})\))?$/;
const NOTE = /^- (.+)$/;
const SUB = /^ {2}- (.+)$/;
const BREAKING = /^BREAKING CHANGE: ?/;

/** `2026-10-17 14:32 +04:00`: the date in the machine's time zone. */
export function stamp(date) {
  const pad = (n) => String(Math.abs(n)).padStart(2, '0');
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())} ` +
    `${sign}${pad(Math.trunc(offset / 60))}:${pad(offset % 60)}`
  );
}

/** A line's header: `fix(api,web)!: refuse tickets with an empty title`. */
export function headerOf(line) {
  if (line.type === null) {
    return line.headline;
  }
  const scopes = line.scopes.length > 0 ? `(${line.scopes.join(',')})` : '';
  return `${line.type}${scopes}${line.breaking ? '!' : ''}: ${line.headline}`;
}

/** A line as markdown, with its bullets and breaking change under it. */
export function formatLine(line) {
  const out = [`- ${headerOf(line)}${line.hash ? ` (${line.hash})` : ''}`];
  for (const bullet of line.bullets) {
    out.push(`  - ${bullet}`);
  }
  if (line.change) {
    out.push(`  - BREAKING CHANGE: ${line.change}`);
  }
  return out.join('\n');
}

/** An entry as markdown, its heading first. `stampText` is `stamp(date)`. */
export function formatEntry({ version, stampText, versions = null, lines }) {
  const parts = [`## ${version} · ${stampText}`];
  if (versions && versions.length > 0) {
    parts.push(versions.map((v) => `${v.name} ${v.version}`).join(' · '));
  }
  parts.push(lines.map(formatLine).join('\n'));
  return `${parts.join('\n\n')}\n`;
}

/** Reads a changelog's entries, newest first. @returns {Entry[]} */
export function parseChangelog(text) {
  const entries = [];
  let entry = null;
  for (const raw of text.replace(/\r/g, '').split('\n')) {
    const heading = HEADING.exec(raw);
    if (heading) {
      const [, version, day, time, offset] = heading;
      entry = { version, date: `${day}T${time}:00${offset}`, versions: null, lines: [] };
      entries.push(entry);
      continue;
    }
    if (!entry || raw.trim() === '') {
      continue;
    }
    const sub = SUB.exec(raw);
    const last = entry.lines[entry.lines.length - 1];
    if (sub && last) {
      if (BREAKING.test(sub[1])) {
        last.change = sub[1].replace(BREAKING, '');
      } else {
        last.bullets.push(sub[1]);
      }
      continue;
    }
    const line = LINE.exec(raw);
    if (line) {
      const [, type, scopes, bang, headline, hash] = line;
      entry.lines.push({
        type,
        scopes: scopes ? scopes.split(',').map((s) => s.trim()) : [],
        breaking: bang === '!',
        headline,
        hash: hash ?? null,
        bullets: [],
        change: null,
      });
      continue;
    }
    const note = NOTE.exec(raw);
    if (note) {
      entry.lines.push({
        type: null,
        scopes: [],
        breaking: false,
        headline: note[1],
        hash: null,
        bullets: [],
        change: null,
      });
      continue;
    }
    if (entry.lines.length === 0 && entry.versions === null) {
      entry.versions = raw.split(' · ').map((part) => {
        const at = part.trim().lastIndexOf(' ');
        return { name: part.trim().slice(0, at), version: part.trim().slice(at + 1) };
      });
    }
  }
  for (const e of entries) {
    for (const line of e.lines) {
      if (line.change) {
        line.breaking = true;
      }
    }
  }
  return entries;
}

const TITLE = '# Changelog\n';

/** Splits a changelog into its text before the first entry and each entry's text. */
function split(text) {
  const at = text.search(/^## /m);
  if (at < 0) {
    return { head: text, entries: [] };
  }
  const entries = text
    .slice(at)
    .split(/^(?=## )/m)
    .map((part) => `${part.trimEnd()}\n`);
  return { head: text.slice(0, at), entries };
}

const yearOf = (entryText) => /^## \S+ · (\d{4})/.exec(entryText)?.[1] ?? null;

/**
 * The changelog with `entryText` on top. Entries of earlier years than `year`
 * leave it, by year: `moved` maps each year to its entries' text, newest first,
 * for `changelog/<year>.md`.
 * @returns {{ text: string, moved: Map<string, string> }}
 */
export function addEntry(existing, entryText, year) {
  const { head, entries } = split(existing ?? '');
  const kept = [];
  const moved = new Map();
  for (const part of entries) {
    const y = yearOf(part);
    if (y !== null && Number(y) < year) {
      moved.set(y, (moved.get(y) ?? '') + `${part}\n`);
    } else {
      kept.push(part);
    }
  }
  const top = head.trim() === '' ? TITLE : `${head.trimEnd()}\n`;
  const text = `${top}\n${[entryText, ...kept].map((e) => e.trimEnd()).join('\n\n')}\n`;
  return { text, moved };
}

/** A year's file with `entriesText` added above what it holds. */
export function addToYear(existing, entriesText, year) {
  const { head, entries } = split(existing ?? '');
  const top = head.trim() === '' ? `# Changelog, ${year}\n` : `${head.trimEnd()}\n`;
  const all = [...split(entriesText).entries, ...entries].map((e) => e.trimEnd());
  return `${top}\n${all.join('\n\n')}\n`;
}
