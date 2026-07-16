import type { SessionKind } from '../../api/types';

export type Mode = 'tasks' | 'terminals' | 'agents';

// Which rail mode a route belongs to. The universal session viewer /ai/:id
// follows the loaded session kind; until it loads, no mode is forced active.
export function modeForPath(pathname: string, sessionKind?: SessionKind | null): Mode | null {
  if (pathname.startsWith('/terminals')) return 'terminals';
  if (pathname.startsWith('/agents')) return 'agents';
  if (pathname.startsWith('/ai/')) {
    if (sessionKind === 'agent') return 'agents';
    if (sessionKind === 'terminal') return 'terminals';
    return null;
  }
  return 'tasks';
}
