import { useMemo } from 'react';
import { Link } from '@tanstack/react-router';
import { useArchiveSession, useUnarchiveSession } from '../../api/use-archive-session';
import type { AiSession } from '../../api/types';
import { SessionKindGlyph } from '../../ui/session-kind-glyph';
import { SessionStatusPill } from '../../ui/session-status-pill';
import { formatAge } from '../../utils/format-age';
import { buildSessionTree, type SessionTreeNode } from './build-session-tree';

// The mode-panel session list (Terminals / Agents). Dispatched children indent
// under their parent with a connector and a ticket chip. `archived` selects
// whether the hover affordance offers Archive or Unarchive.
export function SessionList({
  sessions,
  workspaceName,
  onNavigate,
  archived,
}: {
  sessions: AiSession[];
  workspaceName: (id: number) => string;
  onNavigate?: () => void;
  archived?: boolean;
}) {
  const tree = useMemo(() => buildSessionTree(sessions), [sessions]);
  return (
    <div className="flex flex-col gap-0.5">
      {tree.map((node) => (
        <SessionRow
          key={node.session.id}
          node={node}
          depth={0}
          workspaceName={workspaceName}
          onNavigate={onNavigate}
          archived={archived}
        />
      ))}
    </div>
  );
}

function SessionRow({
  node,
  depth,
  workspaceName,
  onNavigate,
  archived,
}: {
  node: SessionTreeNode;
  depth: number;
  workspaceName: (id: number) => string;
  onNavigate?: () => void;
  archived?: boolean;
}) {
  const { session } = node;
  const archiveSession = useArchiveSession();
  const unarchiveSession = useUnarchiveSession();

  return (
    <>
      <Link
        to="/ai/$sessionId"
        params={{ sessionId: String(session.id) }}
        title={`${workspaceName(session.workspaceId)} · ${formatAge(session.createdAt)}`}
        className="group flex items-center gap-2 rounded-[7px] px-2 py-1.5 hover:bg-inset"
        style={{ paddingLeft: 8 + depth * 16 }}
        onClick={onNavigate}
      >
        {depth > 0 ? (
          <span aria-hidden className="font-mono text-meta text-ink-3">
            └
          </span>
        ) : null}
        <SessionKindGlyph kind={session.kind} />
        <span className="min-w-0 flex-1 truncate font-sans text-ui text-ink">{session.title}</span>
        {session.itemId != null ? (
          <span className="shrink-0 rounded-[4px] border border-hairline px-1 font-mono text-[10px] text-accent">
            →#{session.itemId}
          </span>
        ) : null}
        <SessionStatusPill status={session.status} exitCode={session.exitCode} kind={session.kind} />
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
      {node.children.map((child) => (
        <SessionRow
          key={child.session.id}
          node={child}
          depth={depth + 1}
          workspaceName={workspaceName}
          onNavigate={onNavigate}
          archived={archived}
        />
      ))}
    </>
  );
}
