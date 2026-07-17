import { describe, expect, it } from 'vitest';
import { buildRunSpec, type AgentSpecInput } from './agent-run-spec';

const base: AgentSpecInput = {
  model: 'claude-opus-4-8',
  systemPrompt: null,
  allowedTools: [],
  disallowedTools: [],
  permissionMode: 'bypassPermissions',
  mcpServers: {},
  effort: null,
  config: {},
};

describe('buildRunSpec', () => {
  it('maps model, cwd, and permission mode, omitting empty optionals', () => {
    const spec = buildRunSpec(base, '/work');
    expect(spec).toEqual({
      cwd: '/work',
      model: 'claude-opus-4-8',
      permissionMode: 'bypassPermissions',
      config: {},
    });
  });

  it('normalizes jsonb tool lists to string[] and drops non-strings', () => {
    const spec = buildRunSpec(
      { ...base, allowedTools: ['Read', 'Grep', 7], disallowedTools: ['Bash'] },
      '/work',
    );
    expect(spec.allowedTools).toEqual(['Read', 'Grep']);
    expect(spec.disallowedTools).toEqual(['Bash']);
  });

  it('folds effort into config and carries systemPrompt + mcpServers', () => {
    const spec = buildRunSpec(
      {
        ...base,
        systemPrompt: 'You are terse.',
        effort: 'high',
        mcpServers: { tickets: { command: 'node' } },
        config: { foo: 1 },
      },
      '/work',
    );
    expect(spec.systemPrompt).toBe('You are terse.');
    expect(spec.mcpServers).toEqual({ tickets: { command: 'node' } });
    expect(spec.config).toEqual({ foo: 1, effort: 'high' });
  });

  it('passes through budget cap and resume id', () => {
    const spec = buildRunSpec(base, '/work', { maxBudgetUsd: 5, resumeSessionId: 'sess_9' });
    expect(spec.maxBudgetUsd).toBe(5);
    expect(spec.resumeSessionId).toBe('sess_9');
  });
});
