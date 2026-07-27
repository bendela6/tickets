import { useMemo, useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import type { Agent } from '../../api/types';
import { useAgents } from '../../api/use-agents';
import { useAgentProviders } from '../../api/use-agent-providers';
import { useAgentSessions } from '../../api/use-agent-sessions';
import { Button, ScreenState } from '@tickets/ui';
import { AgentCard } from './agent-card';
import { AgentEditor } from './agent-editor';

// Settings → Agents: the persona library. A grid of cards; a card opens the
// editor, "New agent" opens an empty one. Session counts are derived from the
// sessions list (assigned-ticket counts land with the profile view, TIX-205).
export function AgentLibraryScreen() {
  const navigate = useNavigate();
  const agents = useAgents();
  const providers = useAgentProviders();
  const sessions = useAgentSessions();
  const [editing, setEditing] = useState<Agent | 'new' | null>(null);

  const sessionCount = useMemo(() => {
    const counts = new Map<number, number>();
    for (const s of sessions.data ?? []) {
      if (s.agentId != null) counts.set(s.agentId, (counts.get(s.agentId) ?? 0) + 1);
    }
    return counts;
  }, [sessions.data]);

  const rows = agents.data ?? [];

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5 px-6 py-7">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 font-mono text-meta text-gray-9">
            <Link to="/agents" className="hover:text-gray-11">
              Sessions
            </Link>
            <span>/</span>
            <span className="text-gray-11">Agents</span>
          </div>
          <h1 className="mt-0.5 font-sans text-[19px] font-semibold text-gray-12">Agents</h1>
        </div>
        <Button variant="solid" onClick={() => setEditing('new')}>
          ＋ New agent
        </Button>
      </div>

      {rows.length === 0 && agents.isSuccess ? (
        <div className="rounded-xl border border-gray-6 bg-surface-raised">
          <ScreenState
            title="No agents yet"
            body="An agent is a reusable persona — a provider, model, prompt, and tool allowlist — that you can run in a session or assign to a ticket."
            action={
              <Button variant="solid" onClick={() => setEditing('new')}>
                ＋ New agent
              </Button>
            }
          />
        </div>
      ) : (
        <div className="flex flex-wrap gap-3">
          {rows.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              sessionCount={sessionCount.get(agent.id) ?? 0}
              onEdit={() =>
                void navigate({ to: '/agents/personas/$agentId', params: { agentId: String(agent.id) } })
              }
            />
          ))}
        </div>
      )}

      {editing != null ? (
        <AgentEditor
          key={editing === 'new' ? 'new' : editing.id}
          open
          onOpenChange={(open) => {
            if (!open) setEditing(null);
          }}
          agent={editing === 'new' ? undefined : editing}
          providers={providers.data ?? []}
        />
      ) : null}
    </div>
  );
}
