import { useMemo, useState } from 'react';
import { Link } from '@tanstack/react-router';
import type { AiAgent } from '../../api/types';
import { useAiAgents } from '../../api/use-ai-agents';
import { useAiProviders } from '../../api/use-ai-providers';
import { useAiSessions } from '../../api/use-ai-sessions';
import { Button } from '../../ui/button';
import { AgentCard } from './agent-card';
import { AgentEditor } from './agent-editor';

// Settings → Agents: the persona library. A grid of cards; a card opens the
// editor, "New agent" opens an empty one. Session counts are derived from the
// sessions list (assigned-ticket counts land with the profile view, TIX-205).
export function AgentLibraryScreen() {
  const agents = useAiAgents();
  const providers = useAiProviders();
  const sessions = useAiSessions();
  const [editing, setEditing] = useState<AiAgent | 'new' | null>(null);

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
          <div className="flex items-center gap-2 font-mono text-meta text-ink-3">
            <Link to="/ai" className="hover:text-ink-2">
              Sessions
            </Link>
            <span>/</span>
            <span className="text-ink-2">Agents</span>
          </div>
          <h1 className="mt-0.5 font-sans text-[19px] font-semibold text-ink">Agents</h1>
        </div>
        <Button variant="primary" onClick={() => setEditing('new')}>
          ＋ New agent
        </Button>
      </div>

      {rows.length === 0 && agents.isSuccess ? (
        <div className="rounded-panel border border-hairline bg-raised px-6 py-12 text-center">
          <p className="font-sans text-ui font-medium text-ink">No agents yet</p>
          <p className="mt-1 font-sans text-meta text-ink-3">
            An agent is a reusable persona — a provider, model, prompt, and tool allowlist — that you
            can run in a session or assign to a ticket.
          </p>
          <Button variant="primary" className="mt-4" onClick={() => setEditing('new')}>
            ＋ New agent
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-3">
          {rows.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              sessionCount={sessionCount.get(agent.id) ?? 0}
              onEdit={() => setEditing(agent)}
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
