import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// @tickets/ui is an atomic library: its components describe shape, size and
// tone, never what the thing standing in front of them means. `Avatar` used to
// take kind="human" | "agent", which is a ticket-domain distinction — an app
// concept that had leaked into a primitive. It now takes a shape and a
// typeface, and apps/web assigns the meaning in domain/actor.ts.
//
// This guards the boundary, because the leak is easy to reintroduce: adding
// one more value to an enum feels smaller than it is.

const COMPONENTS = path.join(import.meta.dirname, '.');

// Words that name something in the ticket domain rather than something visual.
const DOMAIN_WORDS = [
  'human',
  'agent',
  'ticket',
  'epic',
  'sprint',
  'assignee',
  'reporter',
  'backlog',
  'todo',
  'blocked',
  'triage',
];

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      sourceFiles(full, out);
    } else if (/\.tsx?$/.test(entry) && !/\.(test|demo)\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

describe('@tickets/ui stays domain-free', () => {
  it('has no component whose prop values name a ticket-domain concept', () => {
    const offenders: { file: string; match: string }[] = [];
    // Only string-literal *values* — prose in comments is fine, and so is an
    // icon named for a shape it happens to depict.
    const literal = new RegExp(`'(${DOMAIN_WORDS.join('|')})'`, 'g');
    for (const file of sourceFiles(COMPONENTS)) {
      const rel = path.relative(COMPONENTS, file).replaceAll('\\', '/');
      // The icon registry keys name shapes; `terminal` there is a picture of a
      // terminal window, the same way `folder` is a picture of a folder.
      if (rel.startsWith('icon/registry')) continue;
      // SessionKindGlyph is a known leak, already sitting in the Deprecated
      // group and on its way to apps/web. Listed rather than silently skipped.
      if (rel.startsWith('session-kind-glyph/')) continue;

      const src = readFileSync(file, 'utf8');
      // Strip comments so prose explaining the rule does not trip it.
      const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      for (const match of code.matchAll(literal)) {
        offenders.push({ file: rel, match: match[0] });
      }
    }
    expect(offenders).toEqual([]);
  });
});
