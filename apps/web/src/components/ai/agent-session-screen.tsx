import { useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from '@tanstack/react-router';
import type { AgentEvent } from '../../api/types';
import { useAiSession } from '../../api/use-ai-session';
import { useStopAiSession } from '../../api/use-stop-ai-session';
import { Button } from '../../ui/button';
import { SessionStatusPill } from '../../ui/session-status-pill';
import { buildMessageStream, type SeqEvent } from './build-message-stream';
import { MessageStream } from './message-stream';
import { useSessionSocket } from './use-session-socket';

type Entry = { kind: 'user'; id: number; text: string } | { kind: 'event'; seq: number; event: AgentEvent };

// The kind='agent' branch of /ai/:id: the structured chat rendered off `message`
// frames, with a prompt box to drive turns. The full composer + cost meter +
// model/effort switchers land in TIX-203; this screen is the message stream.
export function AgentSessionScreen({ sessionId }: { sessionId: number }) {
  const navigate = useNavigate();
  const session = useAiSession(sessionId);
  const stop = useStopAiSession();

  const [entries, setEntries] = useState<Entry[]>([]);
  const seenSeq = useRef<Set<number>>(new Set());
  const userId = useRef(0);
  const [draft, setDraft] = useState('');

  const socket = useSessionSocket(sessionId, {
    onMessage: (seq, event) => {
      if (seenSeq.current.has(seq)) return; // idempotent across reconnects
      seenSeq.current.add(seq);
      setEntries((prev) => [...prev, { kind: 'event', seq, event }]);
    },
  });
  const sendPromptRef = useRef(socket.sendPrompt);
  sendPromptRef.current = socket.sendPrompt;

  const data = session.data;
  const status = socket.status ?? data?.status ?? 'starting';
  const cost = data?.costUsd ? Number(data.costUsd) : agentCost(entries);

  // Split the timeline into user bubbles and runs of agent events (each run
  // becomes one MessageStream).
  const rendered = useMemo(() => renderTimeline(entries), [entries]);

  function send() {
    const text = draft.trim();
    if (!text) return;
    userId.current += 1;
    setEntries((prev) => [...prev, { kind: 'user', id: userId.current, text }]);
    sendPromptRef.current(text);
    setDraft('');
  }

  const running = status === 'running' || status === 'starting';

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 border-b border-hairline px-6 py-3">
        <button
          type="button"
          onClick={() => void navigate({ to: '/ai' })}
          className="font-sans text-meta text-ink-3 hover:text-ink-2"
        >
          ← sessions
        </button>
        <span className="inline-flex size-6 items-center justify-center rounded-md bg-accent-subtle font-mono text-[13px] text-accent">
          ✳
        </span>
        <span className="truncate font-sans text-ui font-medium text-ink">
          {data?.title ?? `agent session #${sessionId}`}
        </span>
        <span className="flex-1" />
        <span className="font-mono text-meta text-ink-3" title="spend so far">
          ${cost.toFixed(4)}
        </span>
        <SessionStatusPill status={status} exitCode={socket.exitCode ?? data?.exitCode ?? null} />
        {running ? (
          <Button size="compact" variant="secondary" onClick={() => socket.interrupt()}>
            Interrupt
          </Button>
        ) : null}
        <Button
          size="compact"
          variant="destructive"
          loading={stop.isPending}
          onClick={() => stop.mutate(sessionId)}
        >
          Stop
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-3xl flex-col gap-4 px-6 py-6">
          {rendered.length === 0 ? (
            <p className="py-10 text-center font-sans text-meta text-ink-3">
              Send a prompt to start the agent turn.
            </p>
          ) : (
            rendered
          )}
          {socket.conn === 'reconnecting' ? (
            <p className="font-sans text-meta text-ink-3">Reconnecting…</p>
          ) : null}
        </div>
      </div>

      <div className="border-t border-hairline px-6 py-3">
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                send();
              }
            }}
            rows={2}
            placeholder="Message the agent…  (⌘/Ctrl+Enter to send)"
            className="min-h-9.5 flex-1 resize-y rounded-[8px] border border-control bg-raised px-3 py-2 font-sans text-ui text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent-subtle"
          />
          <Button variant="primary" onClick={send} disabled={!draft.trim()}>
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}

// Accumulate consecutive agent events into MessageStream runs; render user
// entries as bubbles between them.
function renderTimeline(entries: Entry[]) {
  const out: React.ReactNode[] = [];
  let run: SeqEvent[] = [];
  const flush = (key: string) => {
    if (run.length === 0) return;
    out.push(<MessageStream key={key} blocks={buildMessageStream(run)} />);
    run = [];
  };
  for (const entry of entries) {
    if (entry.kind === 'event') {
      run.push({ seq: entry.seq, event: entry.event });
    } else {
      flush(`run-before-${entry.id}`);
      out.push(<UserBubble key={`user-${entry.id}`} text={entry.text} />);
    }
  }
  flush('run-tail');
  return out;
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2.5 self-end">
      <div className="max-w-[85%] rounded-[10px] border border-hairline bg-inset px-3 py-2 font-sans text-ui text-ink">
        {text}
      </div>
    </div>
  );
}

function agentCost(entries: Entry[]): number {
  let cost = 0;
  for (const entry of entries) {
    if (entry.kind === 'event' && entry.event.type === 'result') cost += entry.event.costUsd;
  }
  return cost;
}
