import type { AgentProvider } from './agent-types';

// The provider registry is a CODE registry, not DB rows — adding a provider is a
// deploy, per the locked decision. Kept as a small factory so tests build an
// isolated registry with fake providers instead of mutating global state.
export interface ProviderRegistry {
  register(provider: AgentProvider): void;
  get(key: string): AgentProvider | undefined;
  require(key: string): AgentProvider;
  list(): AgentProvider[];
}

export function createProviderRegistry(initial: AgentProvider[] = []): ProviderRegistry {
  const providers = new Map<string, AgentProvider>();
  for (const provider of initial) providers.set(provider.key, provider);

  return {
    register(provider) {
      providers.set(provider.key, provider);
    },
    get(key) {
      return providers.get(key);
    },
    require(key) {
      const provider = providers.get(key);
      if (!provider) {
        const known = [...providers.keys()].join(', ') || 'none';
        throw new Error(`unknown agent provider "${key}" (registered: ${known})`);
      }
      return provider;
    },
    list() {
      return [...providers.values()];
    },
  };
}
