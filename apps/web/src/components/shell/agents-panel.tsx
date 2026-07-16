import { useMemo } from 'react';
import { Link } from '@tanstack/react-router';
import { useAiSessions } from '../../api/use-ai-sessions';
import { useAiWorkspaces } from '../../api/use-ai-workspaces';
import { SessionList } from '../ai/session-list';
import { agentsOf } from '../ai/select-sessions';

// The personas route is registered in Task 9 (route-splitting); until then,
// widen through a `string` local so TanStack Router's literal `to` union
// (which doesn't include it yet) doesn't fail the build — same trick
// `activity-rail.tsx` uses for `/terminals` and `/agents`.
const PERSONAS_HREF: string = '/agents/personas';

export function AgentsPanel() {
  const sessions = useAiSessions();
  const workspaces = useAiWorkspaces();
  const workspaceName = useMemo(() => {
    const byId = new Map((workspaces.data ?? []).map((w) => [w.id, w] as const));
    return (id: number) => byId.get(id)?.name ?? byId.get(id)?.path ?? '—';
  }, [workspaces.data]);
  const rows = agentsOf(sessions.data ?? []);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between px-1 pb-2">
        <span className="font-mono text-[10px] font-medium tracking-[0.09em] text-ink-3">AGENTS</span>
        <Link to={PERSONAS_HREF} className="font-sans text-meta text-accent hover:underline">
          Personas →
        </Link>
      </div>
      {rows.length === 0 ? (
        <p className="px-1 font-sans text-meta text-ink-3">No agent sessions yet.</p>
      ) : (
        <SessionList sessions={rows} workspaceName={workspaceName} />
      )}
    </div>
  );
}
