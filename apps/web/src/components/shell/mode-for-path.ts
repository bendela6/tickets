export type Mode = 'tasks' | 'signals' | 'schema';

// Which rail mode a route belongs to — the path alone decides it.
export function modeForPath(pathname: string): Mode | null {
  if (pathname.startsWith('/signals')) return 'signals';
  if (pathname.startsWith('/schema')) return 'schema';
  return 'tasks';
}
