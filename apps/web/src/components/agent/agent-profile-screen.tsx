import { useMemo, useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useAgents } from '../../api/use-agents';
import { useAgentProviders } from '../../api/use-agent-providers';
import { useAgentSessions } from '../../api/use-agent-sessions';
import { useCreateAgentSession } from '../../api/use-create-agent-session';
import { Avatar } from '../../ui/avatar';
import { Button } from '../../ui/button';
import { SessionKindGlyph } from '../../ui/session-kind-glyph';
import { SessionStatusPill } from '../../ui/session-status-pill';
import { formatAge } from '../../utils/format-age';
import { AgentBadge, PermissionBadge, providerLabel } from './agent-card';
import { AgentEditor } from './agent-editor';

// An agent's profile: identity, all-time stats, and its recent sessions. Assigned
// tickets are shown once a project surfaces the agent as an assignee option — the
// agent is already a first-class user (kind='agent'), so it renders with the
// square avatar + AGENT badge in assignee dropdowns via the existing plumbing.
export function AgentProfileScreen({ agentId }: { agentId: number }) {
  const navigate = useNavigate();
  const agents = useAgents();
  const providers = useAgentProviders();
  const sessions = useAgentSessions();
  const createSession = useCreateAgentSession();
  const [editing, setEditing] = useState(false);

  const agent = agents.data?.find((a) => a.id === agentId);

  const mine = useMemo(
    () =>
      (sessions.data ?? [])
        .filter((s) => s.agentId === agentId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [sessions.data, agentId],
  );
  const totalCost = mine.reduce((sum, s) => sum + (s.costUsd ? Number(s.costUsd) : 0), 0);

  if (agents.isSuccess && !agent) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-7">
        <p className="font-sans text-ui text-ink-2">Agent not found.</p>
        <Link to="/agents/personas" className="font-sans text-meta text-accent hover:underline">
          ← Agents
        </Link>
      </div>
    );
  }
  if (!agent) return <div className="px-6 py-7 font-sans text-meta text-ink-3">Loading…</div>;

  function runSession() {
    createSession.mutate(
      { agentId },
      {
        onSuccess: (created) =>
          void navigate({ to: '/agents/$sessionId', params: { sessionId: String(created.id) } }),
      },
    );
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-7">
      <div className="flex items-start gap-4">
        <Avatar name={agent.name} kind="agent" size="md" className="size-11 text-[15px]" />
        <div className="flex-1">
          <div className="flex items-center gap-2 font-mono text-meta text-ink-3">
            <Link to="/agents/personas" className="hover:text-ink-2">
              Agents
            </Link>
            <span>/</span>
            <span className="text-ink-2">{agent.name}</span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <h1 className="font-sans text-[22px] font-semibold text-ink">{agent.name}</h1>
            <AgentBadge />
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 font-mono text-meta text-ink-3">
            <span>
              {providerLabel(agent.providerKey)} · {agent.model}
            </span>
            <PermissionBadge mode={agent.permissionMode} />
            <span className="inline-flex h-5 items-center rounded-[5px] border border-hairline px-1.75 text-[10px] text-ink-2">
              {agent.allowedTools.length} tools
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => setEditing(true)}>
            Edit
          </Button>
          <Button variant="primary" loading={createSession.isPending} onClick={runSession}>
            ✳ Run session
          </Button>
        </div>
      </div>

      <div className="flex gap-3">
        <Stat value={String(mine.length)} label="sessions all-time" />
        <Stat value={`$${totalCost.toFixed(2)}`} label="spend all-time" />
        <Stat value="0" label="open tickets assigned" />
      </div>

      <section>
        <h2 className="mb-2 font-sans text-label font-medium uppercase tracking-wide text-ink-2">
          Recent sessions
        </h2>
        {mine.length === 0 ? (
          <p className="rounded-card border border-hairline bg-raised px-4 py-6 text-center font-sans text-meta text-ink-3">
            No sessions yet — run one to get started.
          </p>
        ) : (
          <div className="overflow-hidden rounded-card border border-hairline bg-raised">
            {mine.slice(0, 8).map((s) => (
              <Link
                key={s.id}
                to="/agents/$sessionId"
                params={{ sessionId: String(s.id) }}
                className="flex items-center gap-3 border-b border-hairline px-4 py-2.5 last:border-b-0 hover:bg-inset"
              >
                <SessionKindGlyph kind="agent" />
                <span className="flex-1 truncate font-sans text-ui text-ink">{s.title}</span>
                <SessionStatusPill status={s.status} />
                <span className="font-mono text-meta text-ink-3">{formatAge(s.createdAt)}</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {editing ? (
        <AgentEditor
          key={agent.id}
          open
          onOpenChange={setEditing}
          agent={agent}
          providers={providers.data ?? []}
        />
      ) : null}
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex-1 rounded-panel border border-hairline bg-raised px-4 py-3">
      <div className="font-mono text-[18px] font-semibold text-ink">{value}</div>
      <div className="mt-0.5 font-sans text-meta text-ink-3">{label}</div>
    </div>
  );
}
