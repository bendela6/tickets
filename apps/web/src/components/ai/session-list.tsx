import { useMemo } from 'react';
import { Link } from '@tanstack/react-router';
import type { AiSession } from '../../api/types';
import { SessionKindGlyph } from '../../ui/session-kind-glyph';
import { SessionStatusPill } from '../../ui/session-status-pill';
import { formatAge } from '../../utils/format-age';
import { buildSessionTree, type SessionTreeNode } from './build-session-tree';

// The mode-panel session list (Terminals / Agents). Dispatched children indent
// under their parent with a connector and a ticket chip.
export function SessionList({
  sessions,
  workspaceName,
}: {
  sessions: AiSession[];
  workspaceName: (id: number) => string;
}) {
  const tree = useMemo(() => buildSessionTree(sessions), [sessions]);
  return (
    <div className="flex flex-col gap-0.5">
      {tree.map((node) => (
        <SessionRow key={node.session.id} node={node} depth={0} workspaceName={workspaceName} />
      ))}
    </div>
  );
}

function SessionRow({
  node,
  depth,
  workspaceName,
}: {
  node: SessionTreeNode;
  depth: number;
  workspaceName: (id: number) => string;
}) {
  const { session } = node;
  return (
    <>
      <Link
        to="/ai/$sessionId"
        params={{ sessionId: String(session.id) }}
        title={`${workspaceName(session.workspaceId)} · ${formatAge(session.createdAt)}`}
        className="flex items-center gap-2 rounded-[7px] px-2 py-1.5 hover:bg-inset"
        style={{ paddingLeft: 8 + depth * 16 }}
      >
        {depth > 0 ? (
          <span aria-hidden className="font-mono text-meta text-ink-3">
            └
          </span>
        ) : null}
        <SessionKindGlyph kind={session.kind} />
        <span className="min-w-0 flex-1 truncate font-sans text-ui text-ink">{session.title}</span>
        {session.ticketId != null ? (
          <span className="shrink-0 rounded-[4px] border border-hairline px-1 font-mono text-[10px] text-accent">
            →#{session.ticketId}
          </span>
        ) : null}
        <SessionStatusPill status={session.status} exitCode={session.exitCode} />
      </Link>
      {node.children.map((child) => (
        <SessionRow key={child.session.id} node={child} depth={depth + 1} workspaceName={workspaceName} />
      ))}
    </>
  );
}
