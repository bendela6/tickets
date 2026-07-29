import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from '@tanstack/react-router';
import type { AgentEvent, AgentSessionStatus } from '../../api/types';
import { useAgentSession } from '../../api/use-agent-session';
import { useArchiveAgentSession, useStopAgentSession } from '../../api/use-archive-agent-session';
import { sessionStatus } from '../../domain/session-status';
import { Menu, MenuContent, MenuItem, MenuTrigger, Pill } from '@tickets/ui';
import { useSessionSocket } from '../session/use-session-socket';
import { contextWindowFor } from './agent-models';
import { buildMessageStream, type SeqEvent } from './build-message-stream';
import { ContextMeter } from './context-meter';
import { CostMeter } from './cost-meter';
import { deriveUsage } from './derive-usage';
import { MessageStream, type RespondFn } from './message-stream';
import { AGENT_MODELS, PromptComposer } from './prompt-composer';

type Entry = { kind: 'user'; id: number; text: string } | { kind: 'event'; seq: number; event: AgentEvent };

// /agents/:id: the structured chat rendered off `message` frames, with a
// prompt box to drive turns. There is no `kind` branch here any more — an
// agent session is always the normalized AgentEvent stream (apps/api
// agent/*); the terminal screen (xterm, restart, archive) lives entirely
// separately under components/terminal/. The full composer + cost meter +
// model/effort switchers land in TIX-203; this screen is the message stream.
export function AgentSessionScreen({ sessionId }: { sessionId: number }) {
  const navigate = useNavigate();
  const session = useAgentSession(sessionId);
  const stopSession = useStopAgentSession();
  const archiveSession = useArchiveAgentSession();

  const [entries, setEntries] = useState<Entry[]>([]);
  const seenSeq = useRef<Set<number>>(new Set());
  const userId = useRef(0);
  const [draft, setDraft] = useState('');
  const [model, setModel] = useState(AGENT_MODELS[0]!.value);
  const [effort, setEffort] = useState('medium');

  const socket = useSessionSocket<AgentSessionStatus>(sessionId, {
    basePath: '/api/agent/sessions',
    onMessage: (seq, event) => {
      if (seenSeq.current.has(seq)) return; // idempotent across reconnects
      seenSeq.current.add(seq);
      setEntries((prev) => [...prev, { kind: 'event', seq, event }]);
    },
  });
  const sendPromptRef = useRef(socket.sendPrompt);
  sendPromptRef.current = socket.sendPrompt;
  const sendPermissionRef = useRef(socket.sendPermission);
  sendPermissionRef.current = socket.sendPermission;
  // Stable so the timeline memo isn't invalidated every render.
  const respond = useCallback(
    (requestId: string, result: 'allow' | 'deny', reason?: string) =>
      sendPermissionRef.current(requestId, result, reason),
    [],
  );

  const data = session.data;
  const status = socket.status ?? data?.status ?? 'starting';
  const cost = data?.costUsd ? Number(data.costUsd) : agentCost(entries);
  const usage = useMemo(
    () => deriveUsage(entries.flatMap((e) => (e.kind === 'event' ? [e.event] : []))),
    [entries],
  );

  // Split the timeline into user bubbles and runs of agent events (each run
  // becomes one MessageStream).
  const rendered = useMemo(() => renderTimeline(entries, respond), [entries, respond]);

  function send() {
    const text = draft.trim();
    if (!text) return;
    userId.current += 1;
    setEntries((prev) => [...prev, { kind: 'user', id: userId.current, text }]);
    sendPromptRef.current(text);
    setDraft('');
  }

  const running = status === 'running' || status === 'starting';
  // The run is over: no process left to stop, so the menu offers Archive
  // rather than a destructive "End session" that would stop nothing. Mirrors
  // the terminal screen's socket.conn === 'ended' branch.
  const ended = status === 'exited' || status === 'failed' || status === 'interrupted';

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 border-b-1 border-gray-6 px-6 py-3">
        <button
          type="button"
          onClick={() => void navigate({ to: '/agents' })}
          className="font-sans text-12/17 text-gray-9 hover:text-gray-11"
        >
          ← sessions
        </button>
        <span className="inline-flex size-6 items-center justify-center rounded-md bg-indigo-3 font-mono text-13 text-indigo-9">
          ✳
        </span>
        <span className="truncate font-sans text-13/19 font-500 text-gray-12">
          {data?.title ?? `agent session #${sessionId}`}
        </span>
        <span className="flex-1" />
        <ContextMeter
          contextTokens={usage.contextTokens}
          contextWindow={contextWindowFor(model)}
          tokensOut={usage.tokensOut}
          cacheReadTokens={usage.cacheReadTokens}
        />
        <CostMeter costUsd={cost} />
        <Pill {...sessionStatus(status)} />
        <Menu>
          <MenuTrigger asChild>
            <button
              type="button"
              aria-label="Session actions"
              className="inline-flex size-6 items-center justify-center rounded-md border-1 border-gray-6 bg-surface-raised font-sans text-gray-11 hover:border-gray-7"
            >
              ⋯
            </button>
          </MenuTrigger>
          <MenuContent align="end">
            {/* Ending stops the run and leaves the session listed, to read its
                transcript; archiving is the separate act that hides it. */}
            {!ended ? (
              <MenuItem
                destructive
                disabled={stopSession.isPending}
                onSelect={() => {
                  if (window.confirm('End this session? The process will be stopped.')) {
                    stopSession.mutate(sessionId);
                  }
                }}
              >
                End session
              </MenuItem>
            ) : (
              <MenuItem
                disabled={archiveSession.isPending}
                onSelect={() => archiveSession.mutate(sessionId)}
              >
                Archive
              </MenuItem>
            )}
          </MenuContent>
        </Menu>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-3xl flex-col gap-4 px-6 py-6">
          {rendered.length === 0 ? (
            <p className="py-10 text-center font-sans text-12/17 text-gray-9">
              Send a prompt to start the agent turn.
            </p>
          ) : (
            rendered
          )}
          {socket.conn === 'reconnecting' ? (
            <p className="font-sans text-12/17 text-gray-9">Reconnecting…</p>
          ) : null}
        </div>
      </div>

      <div className="border-t-1 border-gray-6 px-6 py-3">
        <PromptComposer
          value={draft}
          onChange={setDraft}
          onSend={send}
          onInterrupt={() => socket.interrupt()}
          running={running}
          model={model}
          onModelChange={setModel}
          effort={effort}
          onEffortChange={setEffort}
        />
      </div>
    </div>
  );
}

// Accumulate consecutive agent events into MessageStream runs; render user
// entries as bubbles between them.
function renderTimeline(entries: Entry[], onRespond: RespondFn) {
  const out: ReactNode[] = [];
  let run: SeqEvent[] = [];
  const flush = (key: string) => {
    if (run.length === 0) return;
    out.push(<MessageStream key={key} blocks={buildMessageStream(run)} onRespond={onRespond} />);
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
      <div className="max-w-[85%] rounded-xl border-1 border-gray-6 bg-surface-inset px-3 py-2 font-sans text-13/19 text-gray-12">
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
