import { expect, test } from 'vitest';
import { assertChildAllowed } from './check-parent';

test('epic allows task', () => {
  expect(() => assertChildAllowed('epic', ['task', 'bug', 'spike'], 'task')).not.toThrow();
});
test('subtask allows nothing', () => {
  expect(() => assertChildAllowed('subtask', [], 'subtask')).toThrow();
});
test('task under task is rejected', () => {
  expect(() => assertChildAllowed('task', ['subtask'], 'task')).toThrow();
});
