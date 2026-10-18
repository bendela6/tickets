#!/usr/bin/env node
// bh-commit-check <file>: the commit-msg hook bh-hooks installs. Refuses a
// message that is not a conventional header or names a ticket id; warns when
// the header's scopes differ from the staged folders'.

import { readFileSync } from 'node:fs';
import { checkMessage } from '../release/commits.mjs';
import { git } from '../release/git.mjs';
import { readWorkspace, unitOfFile } from '../release/workspace.mjs';

const file = process.argv[2];
if (!file) {
  console.error('usage: bh-commit-check <commit message file>');
  process.exit(2);
}

/** The staged files' scopes; null when they cannot be read. */
function stagedScopes() {
  try {
    const root = git(process.cwd(), ['rev-parse', '--show-toplevel']).trim();
    const units = readWorkspace(root).units.filter((u) => !u.vendored);
    const files = git(root, ['diff', '--cached', '--name-only']).split('\n').filter(Boolean);
    return [...new Set(files.map((f) => unitOfFile(f, units)?.short).filter(Boolean))];
  } catch {
    return null;
  }
}

const { errors, warnings } = checkMessage(readFileSync(file, 'utf8'), stagedScopes());
for (const warning of warnings) {
  console.error(`commit message: ${warning}`);
}
if (errors.length > 0) {
  for (const error of errors) {
    console.error(`commit message refused: ${error}`);
  }
  console.error("The format: bh's docs, Getting started › Versions and updates.");
  process.exit(1);
}
