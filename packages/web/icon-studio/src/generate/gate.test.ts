import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';
import { BARE_REACH, DEFAULT_DOC, type IconDoc } from '../doc';
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

/**
 * The same mark, written as a document. Migration is proved against *this*, not
 * against the committed SVGs.
 *
 * An earlier version of these two tests compared the migrated fixture to
 * `apps/web/public/favicon.svg`. That passed only while the committed icons
 * happened to be this exact mark, so retuning the icon — the entire purpose of
 * the studio — broke a test about migration. Asserting the two shapes agree
 * with *each other* is the property actually under test, and it holds whatever
 * the shipped icon later becomes.
 */
const EQUIVALENT_DOC: IconDoc = {
  inks: {
    field: { light: '#1b1830', dark: '#1b1830' },
    top: { light: '#7167ff', dark: '#6652ff' },
    mid: { light: '#00bb9a', dark: '#12b898' },
    low: { light: '#ff298a', dark: '#ff378c' },
  },
  elements: [
    { id: 'top', type: 'stick', ink: 'top', spin: true, angle: 62, reach: BARE_REACH, weight: 6 },
    { id: 'mid', type: 'stick', ink: 'mid', spin: true, angle: 27, reach: BARE_REACH, weight: 6 },
    { id: 'low', type: 'stick', ink: 'low', spin: true, angle: 160, reach: BARE_REACH, weight: 6 },
  ],
  variants: {
    favicon: { inks: 'theme', scale: 1 },
    mono: { inks: 'black', scale: 1 },
    chip: { inks: 'dark', scale: 14 / BARE_REACH, field: { ink: 'field', radius: 11 } },
    apple: { inks: 'dark', scale: 14 / BARE_REACH, field: { ink: 'field', radius: 0 } },
  },
  motion: DEFAULT_DOC.motion,
};

test.each(['favicon', 'mono', 'chip', 'apple'])(
  'an old-schema config migrates to a document that renders the same %s',
  (variant) => {
    expect(renderSvg(toDoc(OLD_SCHEMA_CONFIG), variant)).toBe(renderSvg(EQUIVALENT_DOC, variant));
  },
);
