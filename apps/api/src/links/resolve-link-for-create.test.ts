import { expect, test } from 'vitest';
import type { ProjectVocab } from '../vocab/load-project-vocab';
import { resolveLinkForCreate } from './resolve-link-for-create';

const TASK_TYPE_ID = 1;
const BUG_TYPE_ID = 2;

const blocksLink = { id: 301, key: 'blocks', ticketTypeId: TASK_TYPE_ID, archivedAt: null };
const archivedLink = { id: 302, key: 'relates-to', ticketTypeId: TASK_TYPE_ID, archivedAt: '2026-01-01T00:00:00Z' };

const vocab = {
  linkTypesByType: new Map([
    [TASK_TYPE_ID, [blocksLink, archivedLink]],
    [BUG_TYPE_ID, []],
  ]),
  linkTypeTargets: new Map([[blocksLink.id, new Set([BUG_TYPE_ID])]]),
} as unknown as ProjectVocab;

test('resolves a link the source type owns when the target type is allowed', () => {
  const linkType = resolveLinkForCreate(vocab, TASK_TYPE_ID, BUG_TYPE_ID, 'blocks');
  expect(linkType.id).toBe(blocksLink.id);
});

test('throws 422 when the target type is not allowed', () => {
  expect(() => resolveLinkForCreate(vocab, TASK_TYPE_ID, TASK_TYPE_ID, 'blocks')).toThrow(
    /cannot target this ticket type/,
  );
});

test('throws 400 when the source type does not own the link key', () => {
  expect(() => resolveLinkForCreate(vocab, BUG_TYPE_ID, TASK_TYPE_ID, 'blocks')).toThrow(
    /type does not own link/,
  );
});

test('throws 400 when the link key belongs to the type but is archived', () => {
  expect(() => resolveLinkForCreate(vocab, TASK_TYPE_ID, BUG_TYPE_ID, 'relates-to')).toThrow(
    /type does not own link/,
  );
});

test('throws 400 when the link key does not exist at all', () => {
  expect(() => resolveLinkForCreate(vocab, TASK_TYPE_ID, BUG_TYPE_ID, 'nope')).toThrow(
    /type does not own link/,
  );
});
