import { describe, expect, it } from 'vitest';
import type { AgentProvider } from './agent-types';
import { createProviderRegistry } from './provider-registry';

function fakeProvider(key: string, permissions = true): AgentProvider {
  return {
    key,
    models: () => [{ id: `${key}-model`, label: key, contextWindow: 200_000 }],
    capabilities: { permissions, resume: true, mcp: true, subagents: true },
    start: () => {
      throw new Error('not used in registry tests');
    },
  };
}

describe('provider registry', () => {
  it('registers and looks providers up by key', () => {
    const registry = createProviderRegistry([fakeProvider('claude')]);
    registry.register(fakeProvider('ollama', false));

    expect(registry.get('claude')?.key).toBe('claude');
    expect(registry.list().map((p) => p.key).sort()).toEqual(['claude', 'ollama']);
    // Capability flags survive so the UI can degrade honestly.
    expect(registry.get('ollama')?.capabilities.permissions).toBe(false);
  });

  it('require throws a helpful error for an unknown provider', () => {
    const registry = createProviderRegistry([fakeProvider('claude')]);
    expect(() => registry.require('codex')).toThrow(/unknown agent provider "codex".*claude/);
  });

  it('register replaces a provider with the same key', () => {
    const registry = createProviderRegistry();
    registry.register(fakeProvider('claude', true));
    registry.register(fakeProvider('claude', false));
    expect(registry.list()).toHaveLength(1);
    expect(registry.get('claude')?.capabilities.permissions).toBe(false);
  });
});
