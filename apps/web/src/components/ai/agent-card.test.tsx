import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import type { AiAgent } from '../../api/types';
import { AgentCard, PermissionBadge, providerLabel } from './agent-card';

test('providerLabel maps known keys and passes through unknowns', () => {
  expect(providerLabel('claude')).toBe('Claude');
  expect(providerLabel('ollama')).toBe('Local');
  expect(providerLabel('mystery')).toBe('mystery');
});

test('autonomous modes read as accent, approval modes as blocked', () => {
  const { rerender } = render(<PermissionBadge mode="bypassPermissions" />);
  expect(screen.getByText('autonomous')).toHaveClass('text-accent');
  rerender(<PermissionBadge mode="default" />);
  expect(screen.getByText('asks first')).toHaveClass('text-kind-blocked');
});

const agent: AiAgent = {
  id: 1,
  userId: 1,
  key: 'coder',
  name: 'Coder',
  providerKey: 'claude',
  model: 'claude-opus-4-8',
  systemPrompt: null,
  allowedTools: ['Read', 'Grep', 'Edit'],
  disallowedTools: [],
  permissionMode: 'bypassPermissions',
  mcpServers: {},
  effort: null,
  defaultWorkspaceId: null,
  config: {},
  archivedAt: null,
  createdAt: '2026-07-16T00:00:00Z',
};

test('card shows name, provider·model, tool count, and session count', () => {
  render(<AgentCard agent={agent} sessionCount={1} onEdit={() => {}} />);
  expect(screen.getByText('Coder')).toBeInTheDocument();
  expect(screen.getByText('Claude · claude-opus-4-8')).toBeInTheDocument();
  expect(screen.getByText('3 tools')).toBeInTheDocument();
  expect(screen.getByText('1 session')).toBeInTheDocument();
});
