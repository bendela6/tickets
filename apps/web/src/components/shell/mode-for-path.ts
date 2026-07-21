export type Mode = 'tasks' | 'terminals' | 'agents' | 'signals';

// Which rail mode a route belongs to. The session viewer routes are split by
// kind (/terminals/$sessionId, /agents/$sessionId) now that there is no
// `kind` discriminator to look a session up by, so the path alone always
// determines the mode — no session-data lookup needed.
export function modeForPath(pathname: string): Mode | null {
  if (pathname.startsWith('/terminals')) return 'terminals';
  if (pathname.startsWith('/agents')) return 'agents';
  if (pathname.startsWith('/signals')) return 'signals';
  return 'tasks';
}
