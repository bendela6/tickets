import { useMemo, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useAgentSessions } from '../../api/use-agent-sessions';
import { useWorkdirs } from '../../api/use-workdirs';
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
      <div className="flex items-center justify-between px-1 pb-2">
        <span className="font-mono text-[10px] font-medium tracking-[0.09em] text-ink-3">AGENTS</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setArchived((v) => !v)}
            className="font-sans text-meta text-ink-3 hover:text-ink-2"
          >
            {archived ? 'Hide archived' : 'Show archived'}
          </button>
          <Link to="/agents/personas" className="font-sans text-meta text-accent hover:underline">
            Personas →
          </Link>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="px-1 font-sans text-meta text-ink-3">
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
