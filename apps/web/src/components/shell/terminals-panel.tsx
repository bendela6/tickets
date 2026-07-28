import { useMemo, useState } from 'react';
import { useTerminalSessions } from '../../api/use-terminal-sessions';
import { useWorkdirs } from '../../api/use-workdirs';
import { RailLabel } from '@tickets/ui';
import { NewSessionDialog } from '../terminal/new-session-dialog';
import { SessionList } from '../terminal/session-list';

export function TerminalsPanel({
  onNavigateSession,
  onNavigate,
}: {
  onNavigateSession: (sessionId: number) => void;
  onNavigate?: () => void;
}) {
  const [archived, setArchived] = useState(false);
  const sessions = useTerminalSessions({ archived });
  const workdirs = useWorkdirs();
  const [creating, setCreating] = useState(false);
  const workdirName = useMemo(() => {
    const byId = new Map((workdirs.data ?? []).map((w) => [w.id, w] as const));
    return (id: number) => byId.get(id)?.name ?? byId.get(id)?.path ?? '—';
  }, [workdirs.data]);
  const rows = sessions.data ?? [];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between px-1 pb-2">
        <RailLabel>TERMINALS</RailLabel>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setArchived((v) => !v)}
            className="font-sans text-12/17 text-gray-9 hover:text-gray-11"
          >
            {archived ? 'Hide archived' : 'Show archived'}
          </button>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="font-sans text-12/17 text-indigo-9 hover:underline"
          >
            ＋ New
          </button>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="px-1 font-sans text-12/17 text-gray-9">
          {archived ? 'No archived terminal sessions.' : 'No terminal sessions yet.'}
        </p>
      ) : (
        <SessionList
          sessions={rows}
          workdirName={workdirName}
          onNavigate={onNavigate}
          archived={archived}
        />
      )}
      <NewSessionDialog open={creating} onOpenChange={setCreating} onCreated={onNavigateSession} />
    </div>
  );
}
