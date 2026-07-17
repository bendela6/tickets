import { getTableConfig } from 'drizzle-orm/pg-core';
import { expect, it } from 'vitest';
import { agentSessions } from './agent-sessions';

it('agent sessions live in the agent schema and keep turn columns', () => {
  const cfg = getTableConfig(agentSessions);
  expect(cfg.schema).toBe('agent');
  const names = cfg.columns.map((c) => c.name);
  for (const kept of ['agent_id', 'item_id', 'parent_session_id',
                      'provider_session_id', 'worktree_path', 'cost_usd']) {
    expect(names).toContain(kept);
  }
  expect(names).not.toContain('kind');      // the discriminator is gone
  expect(names).not.toContain('exit_code'); // an agent run has a result, not an exit status
});
