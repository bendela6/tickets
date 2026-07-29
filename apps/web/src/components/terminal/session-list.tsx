import { Link } from '@tanstack/react-router';
import { useArchiveTerminalSession, useUnarchiveTerminalSession } from '../../api/use-archive-terminal-session';
import type { TerminalSession } from '../../api/types';
import { exitCodeTrailing, sessionStatus } from '../../domain/session-status';
import { Pill, SessionKindGlyph } from '@tickets/ui';
import { formatAge } from '../../utils/format-age';

// The mode-panel session list (Terminals). A terminal session never parents
// another — no dispatch tree here, unlike agent/session-list.tsx — so this
// renders flat, newest first (the caller's sort order).
export function SessionList({
  sessions,
  workdirName,
  onNavigate,
  archived,
}: {
  sessions: TerminalSession[];
  workdirName: (id: number) => string;
  onNavigate?: () => void;
  archived?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      {sessions.map((session) => (
        <SessionRow
          key={session.id}
          session={session}
          workdirName={workdirName}
          onNavigate={onNavigate}
          archived={archived}
        />
      ))}
    </div>
  );
}

function SessionRow({
  session,
  workdirName,
  onNavigate,
  archived,
}: {
  session: TerminalSession;
  workdirName: (id: number) => string;
  onNavigate?: () => void;
  archived?: boolean;
}) {
  const archiveSession = useArchiveTerminalSession();
  const unarchiveSession = useUnarchiveTerminalSession();
  const st = sessionStatus(session.status, 'terminal');

  return (
    <Link
      to="/terminals/$sessionId"
      params={{ sessionId: String(session.id) }}
      title={`${workdirName(session.workdirId)} · ${formatAge(session.createdAt)}`}
      className="group flex items-center gap-2 rounded-lg px-2 py-1.5 pl-2 hover:bg-surface-inset"
      onClick={onNavigate}
    >
      <SessionKindGlyph kind="terminal" />
      <span className="min-w-0 flex-1 truncate font-sans text-13/19 text-gray-12">{session.title}</span>
      <Pill {...st} trailing={exitCodeTrailing(session.status, session.exitCode)} />
      <button
        type="button"
        className="shrink-0 rounded-sm border border-gray-6 bg-surface-raised px-1.5 py-0.5 font-sans text-12/17 text-gray-11 opacity-0 hover:border-gray-7 group-hover:opacity-100"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          if (archived) unarchiveSession.mutate(session.id);
          else archiveSession.mutate(session.id);
        }}
      >
        {archived ? 'Unarchive' : 'Archive'}
      </button>
    </Link>
  );
}
