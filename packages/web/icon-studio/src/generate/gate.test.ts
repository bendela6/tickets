import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';
import { toDoc } from '../migrate';
import { renderSvg } from './render';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..');
const read = (rel: string) => readFileSync(path.join(repoRoot, rel), 'utf8');

/**
 * The acceptance gate for the element model: migrating the committed config and
 * re-rendering must reproduce the committed assets byte for byte. Looking at
 * the icons cannot prove the pivot changed nothing; this can.
 *
 * `apps/web/icons.config.json` is now committed in the new `IconDoc` schema
 * itself (landed once Generate proved it byte-identical — see task 9), so
 * `toDoc` takes the pass-through branch (`isDoc` true) on this fixture, not
 * the migration branch. That still matters — it is the file real Generate
 * runs read — but it no longer exercises `toDoc`'s old-schema conversion.
 */
test('the committed favicon re-renders byte-identically from its config', () => {
  const doc = toDoc(JSON.parse(read('apps/web/icons.config.json')));
  expect(renderSvg(doc, 'favicon')).toBe(read('apps/web/public/favicon.svg'));
});

test('the committed mono icon re-renders byte-identically from its config', () => {
  const doc = toDoc(JSON.parse(read('apps/web/icons.config.json')));
  expect(renderSvg(doc, 'mono')).toBe(read('apps/web/public/icon-mono.svg'));
});

/**
 * The old, pre-elements config shape — verbatim values from the
 * `apps/web/icons.config.json` this repo committed before the element model
 * landed (see git history). Kept inline, rather than read from disk, because
 * the on-disk file is now already-migrated and would silently stop exercising
 * `toDoc`'s conversion branch (`isDoc` false) the moment it does. This fixture
 * is what keeps that branch under test.
 */
const OLD_SCHEMA_CONFIG = {
  light: ['#7167ff', '#00bb9a', '#ff298a'],
  dark: ['#6652ff', '#12b898', '#ff378c'],
  chip: '#1b1830',
  angles: [62, 27, 160],
  bareWeight: 6,
  chipReach: 14,
  chipWeight: 4.6,
};

test('an old-schema config migrates and re-renders the same favicon byte for byte', () => {
  const doc = toDoc(OLD_SCHEMA_CONFIG);
  expect(renderSvg(doc, 'favicon')).toBe(read('apps/web/public/favicon.svg'));
});

test('an old-schema config migrates and re-renders the same mono icon byte for byte', () => {
  const doc = toDoc(OLD_SCHEMA_CONFIG);
  expect(renderSvg(doc, 'mono')).toBe(read('apps/web/public/icon-mono.svg'));
});
