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
 */
test('the committed favicon re-renders byte-identically from its config', () => {
  const doc = toDoc(JSON.parse(read('apps/web/icons.config.json')));
  expect(renderSvg(doc, 'favicon')).toBe(read('apps/web/public/favicon.svg'));
});

test('the committed mono icon re-renders byte-identically from its config', () => {
  const doc = toDoc(JSON.parse(read('apps/web/icons.config.json')));
  expect(renderSvg(doc, 'mono')).toBe(read('apps/web/public/icon-mono.svg'));
});
