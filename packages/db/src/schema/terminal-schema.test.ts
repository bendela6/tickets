import { getTableConfig } from 'drizzle-orm/pg-core';
import { expect, it } from 'vitest';
import { terminalOutput, terminalSessions } from './terminal-sessions';

it('terminal tables live in the terminal schema', () => {
  expect(getTableConfig(terminalSessions).schema).toBe('terminal');
  expect(getTableConfig(terminalOutput).schema).toBe('terminal');
});

it('a terminal session carries no agent columns', () => {
  const names = getTableConfig(terminalSessions).columns.map((c) => c.name);
  for (const dead of ['kind', 'agent_id', 'item_id', 'parent_session_id',
                      'provider_session_id', 'worktree_path', 'cost_usd']) {
    expect(names).not.toContain(dead);
  }
  expect(names).toContain('exit_code'); // terminal-only, stays
});
