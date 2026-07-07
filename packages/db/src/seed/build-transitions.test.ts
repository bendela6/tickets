import { expect, test } from 'vitest';
import { buildTransitions } from './build-transitions';
import { SOFTWARE_SCHEME } from './software-scheme';

const task = SOFTWARE_SCHEME.types.find((t) => t.key === 'task')!;
const bug = SOFTWARE_SCHEME.types.find((t) => t.key === 'bug')!;
const edges = buildTransitions(task);

test('has one entry edge to the initial status', () => {
  const entries = edges.filter((e) => e.fromKey === null);
  expect(entries).toHaveLength(1);
  expect(entries[0]!.toKey).toBe('backlog');
});

test('forward path connects backlog→todo→in-progress', () => {
  expect(edges.some((e) => e.fromKey === 'backlog' && e.toKey === 'todo')).toBe(true);
  expect(edges.some((e) => e.fromKey === 'todo' && e.toKey === 'in-progress')).toBe(true);
});

test('→merged carries the PR guard', () => {
  const merged = edges.find((e) => e.toKey === 'merged' && e.fromKey === 'in-review');
  expect(merged?.config?.guard?.requiresField).toBe('pr');
});

test('bug →fixed and →wont-fix require a comment', () => {
  const be = buildTransitions(bug);
  expect(be.find((e) => e.toKey === 'fixed')?.config?.guard?.requiresComment).toBe(true);
  expect(be.find((e) => e.toKey === 'wont-fix')?.config?.guard?.requiresComment).toBe(true);
});

test('every non-terminal status can block and reach a drop', () => {
  expect(edges.some((e) => e.fromKey === 'in-progress' && e.toKey === 'blocked')).toBe(true);
  expect(edges.some((e) => e.fromKey === 'in-progress' && e.toKey === 'cancelled')).toBe(true);
});

test('done reopens to in-progress', () => {
  expect(edges.some((e) => e.fromKey === 'done' && e.toKey === 'in-progress')).toBe(true);
});
