import { expect, test } from 'vitest';
import type { AiSession } from '../../api/types';
import { buildSessionTree } from './build-session-tree';

function session(id: number, parentSessionId: number | null): AiSession {
  return {
    id,
    kind: 'agent',
    title: `s${id}`,
    workspaceId: 1,
    agentId: null,
    itemId: null,
    parentSessionId,
    status: 'running',
    providerSessionId: null,
    cwd: null,
    worktreePath: null,
    exitCode: null,
    costUsd: null,
    startedBy: null,
    createdAt: '2026-07-16T00:00:00Z',
    updatedAt: '2026-07-16T00:00:00Z',
    endedAt: null,
    archivedAt: null,
  };
}

test('nests children under their parent, preserving order', () => {
  // One Architect (1) that dispatched three Coders (2,3,4).
  const tree = buildSessionTree([session(1, null), session(2, 1), session(3, 1), session(4, 1)]);
  expect(tree).toHaveLength(1);
  expect(tree[0]!.session.id).toBe(1);
  expect(tree[0]!.children.map((c) => c.session.id)).toEqual([2, 3, 4]);
});

test('supports deeper nesting', () => {
  const tree = buildSessionTree([session(1, null), session(2, 1), session(3, 2)]);
  expect(tree[0]!.children[0]!.children[0]!.session.id).toBe(3);
});

test('an orphan (parent not in the list) surfaces at the top level', () => {
  const tree = buildSessionTree([session(5, 99)]);
  expect(tree.map((n) => n.session.id)).toEqual([5]);
});
