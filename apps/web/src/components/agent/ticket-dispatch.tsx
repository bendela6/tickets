import { useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import type { AgentSessionStatus } from '../../api/types';
import { useAgents } from '../../api/use-agents';
import { useAgentSessions } from '../../api/use-agent-sessions';
import { useDispatchAgent } from '../../api/use-dispatch-agent';
import { sessionStatus } from '../../domain/session-status';
import { Pill } from '@tickets/ui/pill';
import { Button } from '../../ui/button';
import { Combobox } from '../../ui/combobox';
import { DialogContent, DialogDescription, DialogRoot, DialogTitle } from '../../ui/dialog';
import { Textarea } from '../../ui/textarea';

const LIVE: AgentSessionStatus[] = ['starting', 'running', 'idle', 'awaiting_input'];

// The item-detail touchpoint (screen 04): when an agent is working the item,
// a live session pill + link; and a "＋ Put an agent on this" action that
// dispatches a persona onto it. Closes the loop — the item board becomes an
// agent work queue.
export function TicketDispatch({ itemId, actorId }: { itemId: number; actorId?: number }) {
  const navigate = useNavigate();
  const sessions = useAgentSessions();
  const agents = useAgents();
  const dispatch = useDispatchAgent();

  const [open, setOpen] = useState(false);
  const [agentId, setAgentId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [error, setError] = useState<string | null>(null);

  // The most recent still-live session working this item.
  const live = (sessions.data ?? [])
    .filter((s) => s.itemId === itemId && LIVE.includes(s.status))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

  async function submit() {
    setError(null);
    if (agentId == null || !prompt.trim()) return;
    try {
      const session = await dispatch.mutateAsync({
        agentId: Number(agentId),
        itemId,
        prompt: prompt.trim(),
        actorId,
      });
      setOpen(false);
      setPrompt('');
      void navigate({ to: '/agents/$sessionId', params: { sessionId: String(session.id) } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not dispatch the agent');
    }
  }

  return (
    <span className="flex items-center gap-2">
      {live ? (
        <Link
          to="/agents/$sessionId"
          params={{ sessionId: String(live.id) }}
          className="inline-flex items-center gap-1.5"
          title="an agent is working this ticket"
        >
          <span className="font-mono text-meta text-ink-3">✳ {live.title}</span>
          <Pill {...sessionStatus(live.status)} />
        </Link>
      ) : null}
      <Button size="compact" onClick={() => setOpen(true)}>
        ＋ Put an agent on this
      </Button>

      <DialogRoot open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>Put an agent on this ticket</DialogTitle>
          <DialogDescription>
            The agent runs in its own worktree and comments its result back here.
          </DialogDescription>
          <div className="mt-4 flex flex-col gap-3">
            <Combobox
              options={(agents.data ?? []).map((a) => ({ value: String(a.id), label: a.name }))}
              value={agentId}
              onChange={setAgentId}
              placeholder={agents.isLoading ? 'Loading agents…' : 'Select an agent…'}
            />
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              placeholder="What should the agent do on this ticket?"
            />
            {error ? <p className="font-sans text-meta text-danger">{error}</p> : null}
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={submit}
              disabled={agentId == null || !prompt.trim()}
              loading={dispatch.isPending}
            >
              Dispatch
            </Button>
          </div>
        </DialogContent>
      </DialogRoot>
    </span>
  );
}
