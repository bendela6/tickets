import { expect, test } from 'vitest';
import { initialStatusFor, resolveStatus } from './resolve-status';

const vocab = {
  statusByTypeKey: new Map([
    ['1:in-progress', { id: 11, key: 'in-progress' }],
    ['2:in-progress', { id: 22, key: 'in-progress' }],
    ['2:triage', { id: 20, key: 'triage' }],
  ]),
  initialStatusByTypeId: new Map([[2, { id: 20, key: 'triage' }]]),
} as never;

test('resolves the same key to different ids per type', () => {
  expect(resolveStatus(vocab, 1, 'in-progress').id).toBe(11);
  expect(resolveStatus(vocab, 2, 'in-progress').id).toBe(22);
});

test('unknown status throws', () => {
  expect(() => resolveStatus(vocab, 1, 'nope')).toThrow();
});

test('initial status is per type', () => {
  expect(initialStatusFor(vocab, 2)?.key).toBe('triage');
});
