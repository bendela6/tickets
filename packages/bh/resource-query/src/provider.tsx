import { createContext, use, useMemo, type ReactNode } from 'react';
import { createRegistry, type Id, type Registry } from '@bh/resource';
import type { ResourceClient } from '@bh/resource/client';

// What every resource hook below it reads: the client that calls the routes,
// the registry the server runs with (bh's kinds and operators and the app's
// own), which a held list keeps or drops a written row by, and who is
// viewing, for `isMe`. It sits inside React Query's QueryClientProvider.

/** What the hooks read from the nearest ResourceProvider. */
export interface ResourceContextValue {
  client: ResourceClient;
  registry: Registry;
  /** The signed-in user's id, for `isMe`; undefined when no one is. */
  viewer?: Id;
}

const ResourceContext = createContext<ResourceContextValue | null>(null);

let base: Registry | undefined;

/** bh's kinds and operators alone, made once. */
function baseRegistry(): Registry {
  base ??= createRegistry();
  return base;
}

export interface ResourceProviderProps {
  /** The fetcher for the routes: resourceClient({ base: '/api' }). */
  client: ResourceClient;
  /** The kinds and operators the server runs with, the app's own beside bh's; bh's alone when absent. */
  registry?: Registry;
  /** The signed-in user's id, for `isMe`; undefined when no one is. */
  viewer?: Id;
  children?: ReactNode;
}

/** Gives the resource hooks below it their client, registry and viewer. */
export function ResourceProvider({ client, registry, viewer, children }: ResourceProviderProps) {
  const value = useMemo(() => {
    return {
      client,
      registry: registry ?? baseRegistry(),
      ...(viewer === undefined ? {} : { viewer }),
    };
  }, [client, registry, viewer]);
  return <ResourceContext value={value}>{children}</ResourceContext>;
}

/** The nearest ResourceProvider's client, registry and viewer; throws outside one. */
export function useResourceContext(): ResourceContextValue {
  const value = use(ResourceContext);
  if (!value) {
    throw new Error('A resource hook runs inside a ResourceProvider.');
  }
  return value;
}
