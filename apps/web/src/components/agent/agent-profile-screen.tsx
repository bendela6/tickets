import { useMemo, useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useAgents } from '../../api/use-agents';
import { useAgentProviders } from '../../api/use-agent-providers';
import { useAgentSessions } from '../../api/use-agent-sessions';
import { useCreateAgentSession } from '../../api/use-create-agent-session';
import { sessionStatus } from '../../domain/session-status';
import { Avatar, Button, Pill, SectionHeader, SessionKindGlyph } from '@tickets/ui';
import { avatarFor } from '../../domain/actor';
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
        <p className="font-sans text-13/19 text-gray-11">Agent not found.</p>
        <Link to="/agents/personas" className="font-sans text-12/17 text-indigo-9 hover:underline">
          ← Agents
        </Link>
      </div>
    );
  }
  if (!agent) return <div className="px-6 py-7 font-sans text-12/17 text-gray-9">Loading…</div>;

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
        <Avatar name={agent.name} {...avatarFor('agent')} size="md" className="size-11 text-15" />
        <div className="flex-1">
          <div className="flex items-center gap-2 font-mono text-12/17 text-gray-9">
            <Link to="/agents/personas" className="hover:text-gray-11">
              Agents
            </Link>
            <span>/</span>
            <span className="text-gray-11">{agent.name}</span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <h1 className="font-sans text-22 font-600 text-gray-12">{agent.name}</h1>
            <AgentBadge />
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 font-mono text-12/17 text-gray-9">
            <span>
              {providerLabel(agent.providerKey)} · {agent.model}
            </span>
            <PermissionBadge mode={agent.permissionMode} />
            <span className="inline-flex h-5 items-center rounded-md border border-gray-6 px-1.75 text-10 text-gray-11">
              {agent.allowedTools.length} tools
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setEditing(true)}>
            Edit
          </Button>
          <Button variant="solid" loading={createSession.isPending} onClick={runSession}>
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
        <SectionHeader as="h2" title="Recent sessions" className="mb-2 tracking-wide" />
        {mine.length === 0 ? (
          <p className="rounded-lg border border-gray-6 bg-surface-raised px-4 py-6 text-center font-sans text-12/17 text-gray-9">
            No sessions yet — run one to get started.
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-6 bg-surface-raised">
            {mine.slice(0, 8).map((s) => (
              <Link
                key={s.id}
                to="/agents/$sessionId"
                params={{ sessionId: String(s.id) }}
                className="flex items-center gap-3 border-b border-gray-6 px-4 py-2.5 last:border-b-0 hover:bg-surface-inset"
              >
                <SessionKindGlyph kind="agent" />
                <span className="flex-1 truncate font-sans text-13/19 text-gray-12">{s.title}</span>
                <Pill {...sessionStatus(s.status)} />
                <span className="font-mono text-12/17 text-gray-9">{formatAge(s.createdAt)}</span>
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
    <div className="flex-1 rounded-xl border border-gray-6 bg-surface-raised px-4 py-3">
      <div className="font-mono text-18 font-600 text-gray-12">{value}</div>
      <div className="mt-0.5 font-sans text-12/17 text-gray-9">{label}</div>
    </div>
  );
}
