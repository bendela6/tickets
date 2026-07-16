import { useMemo, useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useAiSessions } from '../../api/use-ai-sessions';
import { useAiWorkspaces } from '../../api/use-ai-workspaces';
import type { AiSession } from '../../api/types';
import { Button } from '../../ui/button';
import { SessionKindGlyph } from '../../ui/session-kind-glyph';
import { SessionStatusPill } from '../../ui/session-status-pill';
import { formatAge } from '../../utils/format-age';
import { NewSessionDialog } from './new-session-dialog';

function summarize(sessions: AiSession[]): string {
  const count = (s: AiSession['status']) => sessions.filter((x) => x.status === s).length;
  const parts = [`${sessions.length} session${sessions.length === 1 ? '' : 's'}`];
  const running = count('running') + count('starting');
  if (running) parts.push(`${running} running`);
  const idle = count('idle');
  if (idle) parts.push(`${idle} idle`);
  const exited = count('exited') + count('failed');
  if (exited) parts.push(`${exited} ended`);
  return parts.join(' · ');
}

export function AiSessionsScreen() {
  const navigate = useNavigate();
  const sessions = useAiSessions();
  const workspaces = useAiWorkspaces();
  const [creating, setCreating] = useState(false);

  const workspaceName = useMemo(() => {
    const byId = new Map((workspaces.data ?? []).map((w) => [w.id, w] as const));
    return (id: number) => byId.get(id)?.name ?? byId.get(id)?.path ?? '—';
  }, [workspaces.data]);

  const rows = sessions.data ?? [];

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5 px-6 py-7">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <h1 className="font-sans text-[19px] font-semibold text-ink">AI sessions</h1>
          {rows.length > 0 ? (
            <p className="mt-0.5 font-mono text-meta text-ink-3">{summarize(rows)}</p>
          ) : null}
        </div>
        <Link
          to="/ai/agents"
          className="font-sans text-meta text-ink-2 hover:text-ink"
        >
          Agents →
        </Link>
        <Button variant="primary" onClick={() => setCreating(true)}>
          ＋ New terminal session
        </Button>
      </div>

      {sessions.isError ? (
        <p className="rounded-card border border-hairline bg-raised p-4 font-sans text-ui text-danger">
          Could not load sessions.
        </p>
      ) : rows.length === 0 && sessions.isSuccess ? (
        <div className="rounded-panel border border-hairline bg-raised px-6 py-12 text-center">
          <p className="font-sans text-ui font-medium text-ink">No sessions yet</p>
          <p className="mt-1 font-sans text-meta text-ink-3">
            Start a terminal session and it stays alive here, scrollback intact, until you stop it.
          </p>
          <Button variant="primary" className="mt-4" onClick={() => setCreating(true)}>
            ＋ New terminal session
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-card border border-hairline bg-raised">
          <div className="grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-x-4 border-b border-hairline px-4 py-2 font-sans text-label font-medium uppercase tracking-wide text-ink-3">
            <span />
            <span>Session</span>
            <span>Status</span>
            <span>Workspace</span>
            <span className="text-right">Age</span>
          </div>
          {rows.map((session) => (
            <Link
              key={session.id}
              to="/ai/$sessionId"
              params={{ sessionId: String(session.id) }}
              className="grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-x-4 border-b border-hairline px-4 py-2.5 last:border-b-0 hover:bg-inset"
            >
              <SessionKindGlyph kind={session.kind} />
              <span className="truncate font-sans text-ui text-ink">{session.title}</span>
              <SessionStatusPill status={session.status} exitCode={session.exitCode} />
              <span className="truncate font-sans text-meta text-ink-2">
                {workspaceName(session.workspaceId)}
              </span>
              <span
                className="text-right font-mono text-meta text-ink-3"
                title={session.createdAt}
              >
                {formatAge(session.createdAt)}
              </span>
            </Link>
          ))}
        </div>
      )}

      <NewSessionDialog
        open={creating}
        onOpenChange={setCreating}
        onCreated={(sessionId) => {
          void navigate({ to: '/ai/$sessionId', params: { sessionId: String(sessionId) } });
        }}
      />
    </div>
  );
}
