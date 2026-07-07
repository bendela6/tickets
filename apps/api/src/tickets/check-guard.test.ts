import { expect, test } from 'vitest';
import { checkGuard } from './check-guard';

test('requiresField passes when field present', () => {
  expect(() =>
    checkGuard({ requiresField: 'pr' }, { hasField: () => true, commentCount: 0 }),
  ).not.toThrow();
});
test('requiresField throws when absent', () => {
  expect(() =>
    checkGuard({ requiresField: 'pr' }, { hasField: () => false, commentCount: 0 }),
  ).toThrow();
});
test('requiresComment needs at least one comment', () => {
  expect(() =>
    checkGuard({ requiresComment: true }, { hasField: () => true, commentCount: 0 }),
  ).toThrow();
  expect(() =>
    checkGuard({ requiresComment: true }, { hasField: () => true, commentCount: 1 }),
  ).not.toThrow();
});
test('no guard is a no-op', () => {
  expect(() => checkGuard(undefined, { hasField: () => false, commentCount: 0 })).not.toThrow();
});
