import { useMemo, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useAgentSessions } from '../../api/use-agent-sessions';
import { useWorkdirs } from '../../api/use-workdirs';
import { RailLabel } from '@tickets/ui';
import { SessionList } from '../agent/session-list';

export function AgentsPanel({ onNavigate }: { onNavigate?: () => void } = {}) {
  const [archived, setArchived] = useState(false);
  const sessions = useAgentSessions({ archived });
  const workdirs = useWorkdirs();
  const workdirName = useMemo(() => {
    const byId = new Map((workdirs.data ?? []).map((w) => [w.id, w] as const));
    return (id: number) => byId.get(id)?.name ?? byId.get(id)?.path ?? '—';
  }, [workdirs.data]);
  const rows = sessions.data ?? [];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between px-4 pb-8">
        <RailLabel>AGENTS</RailLabel>
        <div className="flex items-center gap-8">
          <button
            type="button"
            onClick={() => setArchived((v) => !v)}
            className="font-sans text-12/17 text-gray-9 hover:text-gray-11"
          >
            {archived ? 'Hide archived' : 'Show archived'}
          </button>
          <Link to="/agents/personas" className="font-sans text-12/17 text-indigo-9 hover:underline">
            Personas →
          </Link>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 font-sans text-12/17 text-gray-9">
          {archived ? 'No archived agent sessions.' : 'No agent sessions yet.'}
        </p>
      ) : (
        <SessionList
          sessions={rows}
          workdirName={workdirName}
          onNavigate={onNavigate}
          archived={archived}
        />
      )}
    </div>
  );
}
