import { Link } from '@tanstack/react-router';
import { useArchiveTerminalSession, useUnarchiveTerminalSession } from '../../api/use-archive-terminal-session';
import type { TerminalSession } from '../../api/types';
import { exitCodeTrailing, sessionStatus } from '../../domain/session-status';
import { Pill } from '@tickets/ui/pill';
import { SessionKindGlyph } from '../../ui/session-kind-glyph';
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
      className="group flex items-center gap-2 rounded-[7px] px-2 py-1.5 pl-2 hover:bg-inset"
      onClick={onNavigate}
    >
      <SessionKindGlyph kind="terminal" />
      <span className="min-w-0 flex-1 truncate font-sans text-ui text-ink">{session.title}</span>
      <Pill {...st} trailing={exitCodeTrailing(session.status, session.exitCode)} />
      <button
        type="button"
        className="shrink-0 rounded-[4px] border border-hairline bg-raised px-1.5 py-0.5 font-sans text-meta text-ink-2 opacity-0 hover:border-control group-hover:opacity-100"
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
