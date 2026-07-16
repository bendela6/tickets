import { useMemo, useState } from 'react';
import { useAiSessions } from '../../api/use-ai-sessions';
import { useAiWorkspaces } from '../../api/use-ai-workspaces';
import { NewSessionDialog } from '../ai/new-session-dialog';
import { SessionList } from '../ai/session-list';
import { terminalsOf } from '../ai/select-sessions';

export function TerminalsPanel({
  onNavigateSession,
}: {
  onNavigateSession: (sessionId: number) => void;
}) {
  const sessions = useAiSessions();
  const workspaces = useAiWorkspaces();
  const [creating, setCreating] = useState(false);
  const workspaceName = useMemo(() => {
    const byId = new Map((workspaces.data ?? []).map((w) => [w.id, w] as const));
    return (id: number) => byId.get(id)?.name ?? byId.get(id)?.path ?? '—';
  }, [workspaces.data]);
  const rows = terminalsOf(sessions.data ?? []);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between px-1 pb-2">
        <span className="font-mono text-[10px] font-medium tracking-[0.09em] text-ink-3">TERMINALS</span>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="font-sans text-meta text-accent hover:underline"
        >
          ＋ New
        </button>
      </div>
      {rows.length === 0 ? (
        <p className="px-1 font-sans text-meta text-ink-3">No terminal sessions yet.</p>
      ) : (
        <SessionList sessions={rows} workspaceName={workspaceName} />
      )}
      <NewSessionDialog open={creating} onOpenChange={setCreating} onCreated={onNavigateSession} />
    </div>
  );
}
