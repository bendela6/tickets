import { expect, test } from 'vitest';
import { mapOldStatusKey } from './status-map';

test('activity phases collapse to in-progress', () => {
  for (const k of ['investigating', 'brainstorming', 'designing', 'in-progress']) {
    expect(mapOldStatusKey(k, 'task')).toBe('in-progress');
  }
});
test('review maps to in-review', () => {
  expect(mapOldStatusKey('review', 'task')).toBe('in-review');
});
test('open/investigated become the type entry', () => {
  expect(mapOldStatusKey('open', 'task')).toBe('backlog');
  expect(mapOldStatusKey('open', 'subtask')).toBe('todo'); // subtask has no backlog
});
test('fixed maps to the type done terminal', () => {
  expect(mapOldStatusKey('fixed', 'task')).toBe('done');
  expect(mapOldStatusKey('fixed', 'bug')).toBe('fixed');
});
test('dropped maps to the type drop terminal', () => {
  expect(mapOldStatusKey('dropped', 'task')).toBe('cancelled');
  expect(mapOldStatusKey('dropped', 'bug')).toBe('wont-fix');
});
