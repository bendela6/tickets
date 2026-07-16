import type { AgentRun } from './agent-types';
import type {
  AgentEvent,
  OutputChunk,
  PersistedMessage,
  PtyHandle,
  Runner,
  ServerFrame,
  SessionId,
  SessionKind,
  SessionStatus,
  SessionStore,
  Subscriber,
} from './types';

// The one stateful thing in an otherwise stateless API: a singleton holding a
// Map of live sessions. It owns every child process / agent run and is NOT
// coupled to any browser connection — sockets attach and detach from a session
// that outlives them, so closing the tab does not kill the process.
//
// The load-bearing invariant: a record is persisted BEFORE it is broadcast.
// `seq` is the single source of truth shared by the stored rows and the wire
// frames, so a client that has seen seq=N can always be brought current from the
// store alone. This holds identically for terminal output chunks and agent
// message events — the only per-kind difference is which store method persists
// and which frame carries the payload.

export interface StartSpec {
  id: SessionId;
  command: string;
  args?: string[];
  cwd: string;
  env?: Record<string, string>;
  cols?: number;
  rows?: number;
  // Called once when the session reaches a terminal state (exit/failure) — used
  // to tear down a dispatched run's git worktree (TIX-206).
  onEnd?: () => void | Promise<void>;
}

export interface StartAgentSpec {
  id: SessionId;
  run: AgentRun;
  maxBudgetUsd?: number;
  onEnd?: () => void | Promise<void>;
}

export interface Supervisor {
  start(spec: StartSpec): void;
  startAgent(spec: StartAgentSpec): void;
  attach(sessionId: SessionId, sub: Subscriber, lastSeq: number): Promise<void>;
  detach(sessionId: SessionId, sub: Subscriber): void;
  write(sessionId: SessionId, data: string): void;
  resize(sessionId: SessionId, cols: number, rows: number): void;
  // Agent-only: start a follow-up turn.
  prompt(sessionId: SessionId, text: string): void;
  // Kind-aware: Ctrl-C for a terminal, run.interrupt() for an agent.
  interrupt(sessionId: SessionId): void;
  // Agent-only: resolve a parked permission request (E3 wires the UI).
  respondToPermission(
    sessionId: SessionId,
    requestId: string,
    result: 'allow' | 'deny',
    reason?: string,
  ): void;
  stop(sessionId: SessionId): void;
  has(sessionId: SessionId): boolean;
  flush(sessionId: SessionId): Promise<void>;
}

export interface SupervisorOptions {
  runner: Runner;
  store: SessionStore;
  outputCap?: number;
  schedule?: (fn: () => void) => void;
}

// A sequenced record awaiting persist/broadcast — output for terminals, a
// normalized event for agents. Same seq space either way.
type SeqRecord =
  | { seq: number; kind: 'output'; data: string }
  | { seq: number; kind: 'message'; event: AgentEvent };

interface RunningSession {
  id: SessionId;
  kind: SessionKind;
  status: SessionStatus;
  exitCode: number | null;
  handle: PtyHandle | AgentRun;
  seq: number;
  buffer: SeqRecord[];
  flushing: Promise<void> | null;
  flushScheduled: boolean;
  subscribers: Set<Subscriber>;
  pending: Map<Subscriber, ServerFrame[]>;
  costUsd: number;
  maxBudgetUsd?: number;
  onEnd?: () => void | Promise<void>;
  ended: boolean;
}

function recordToFrame(record: SeqRecord): ServerFrame {
  return record.kind === 'output'
    ? { type: 'output', seq: record.seq, data: record.data }
    : { type: 'message', seq: record.seq, event: record.event };
}

export function createSupervisor(options: SupervisorOptions): Supervisor {
  const { runner, store } = options;
  const outputCap = options.outputCap ?? 20_000;
  const schedule = options.schedule ?? ((fn) => setTimeout(fn, 8));
  const sessions = new Map<SessionId, RunningSession>();

  function broadcast(rs: RunningSession, frame: ServerFrame): void {
    for (const sub of rs.subscribers) sub.send(frame);
    for (const buf of rs.pending.values()) buf.push(frame);
  }

  async function flushSession(rs: RunningSession): Promise<void> {
    rs.flushScheduled = false;
    const pending = rs.buffer.splice(0);
    if (pending.length === 0) return;
    // Persist BEFORE broadcast — the load-bearing invariant.
    if (rs.kind === 'terminal') {
      const chunks: OutputChunk[] = pending.map((r) =>
        r.kind === 'output' ? { seq: r.seq, data: r.data } : { seq: r.seq, data: '' },
      );
      await store.appendOutput(rs.id, chunks);
    } else {
      const messages: PersistedMessage[] = pending.flatMap((r) =>
        r.kind === 'message' ? [{ seq: r.seq, event: r.event }] : [],
      );
      await store.appendMessages(rs.id, messages);
    }
    for (const record of pending) broadcast(rs, recordToFrame(record));
    // Only terminal scrollback is capped (a chatty process); agent turns are
    // bounded by the budget cap instead.
    if (rs.kind === 'terminal' && rs.seq > outputCap) {
      await store.pruneOutput(rs.id, outputCap);
    }
  }

  function flush(rs: RunningSession): Promise<void> {
    const run = (rs.flushing ?? Promise.resolve()).then(() => flushSession(rs));
    rs.flushing = run.catch(() => {});
    return run;
  }

  function scheduleFlush(rs: RunningSession): void {
    if (rs.flushScheduled) return;
    rs.flushScheduled = true;
    schedule(() => {
      void flush(rs);
    });
  }

  // Non-terminal transition: persist any pending records first so the client
  // sees the message that caused the transition before the status frame.
  async function transition(rs: RunningSession, status: SessionStatus): Promise<void> {
    await flush(rs);
    rs.status = status;
    await store.setStatus(rs.id, status);
    broadcast(rs, { type: 'status', status });
  }

  async function finish(
    rs: RunningSession,
    status: SessionStatus,
    exitCode: number | null,
  ): Promise<void> {
    await flush(rs);
    rs.status = status;
    rs.exitCode = exitCode;
    await store.finishSession(rs.id, status, exitCode);
    broadcast(rs, { type: 'status', status, exitCode });
    // Fire the teardown hook exactly once (worktree cleanup for a dispatch).
    if (!rs.ended) {
      rs.ended = true;
      if (rs.onEnd) await Promise.resolve(rs.onEnd()).catch(() => {});
    }
  }

  function newSession(id: SessionId, kind: SessionKind, handle: PtyHandle | AgentRun): RunningSession {
    return {
      id,
      kind,
      status: 'running',
      exitCode: null,
      handle,
      seq: 0,
      buffer: [],
      flushing: null,
      flushScheduled: false,
      subscribers: new Set(),
      pending: new Map(),
      costUsd: 0,
      ended: false,
    };
  }

  function consumeTerminal(rs: RunningSession): void {
    const handle = rs.handle as PtyHandle;
    void (async () => {
      try {
        for await (const data of handle.output) {
          rs.buffer.push({ seq: ++rs.seq, kind: 'output', data });
          scheduleFlush(rs);
        }
        const { exitCode } = await handle.exit;
        await finish(rs, 'exited', exitCode);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        rs.buffer.push({ seq: ++rs.seq, kind: 'output', data: `\r\n[session error] ${message}\r\n` });
        await finish(rs, 'failed', null);
      }
    })();
  }

  function consumeAgent(rs: RunningSession): void {
    const run = rs.handle as AgentRun;
    void (async () => {
      try {
        for await (const event of run.events) {
          rs.buffer.push({ seq: ++rs.seq, kind: 'message', event });
          scheduleFlush(rs);
          if (event.type === 'permission_request') {
            await transition(rs, 'awaiting_input');
          } else if (event.type === 'result') {
            rs.costUsd += event.costUsd;
            await flush(rs);
            await store.setCost(rs.id, rs.costUsd);
            await transition(rs, 'idle');
            if (rs.maxBudgetUsd != null && rs.costUsd >= rs.maxBudgetUsd) {
              broadcast(rs, {
                type: 'notice',
                message: `budget cap reached — $${rs.costUsd.toFixed(2)} of $${rs.maxBudgetUsd.toFixed(2)}`,
              });
              run.interrupt().catch(() => {});
            }
          } else if (event.type === 'error') {
            await transition(rs, 'failed');
          }
        }
        await finish(rs, rs.status === 'failed' ? 'failed' : 'exited', null);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        rs.buffer.push({ seq: ++rs.seq, kind: 'message', event: { type: 'error', message } });
        await finish(rs, 'failed', null);
      }
    })();
  }

  async function replay(
    rs: RunningSession,
    lastSeq: number,
  ): Promise<{ frames: ServerFrame[]; oldestSeq: number | null }> {
    if (rs.kind === 'terminal') {
      const { chunks, oldestSeq } = await store.loadOutputSince(rs.id, lastSeq);
      return {
        frames: chunks.map((c) => ({ type: 'output', seq: c.seq, data: c.data })),
        oldestSeq,
      };
    }
    const { messages, oldestSeq } = await store.loadMessagesSince(rs.id, lastSeq);
    return {
      frames: messages.map((m) => ({ type: 'message', seq: m.seq, event: m.event })),
      oldestSeq,
    };
  }

  return {
    start(spec) {
      const handle = runner.spawnPty({
        cwd: spec.cwd,
        command: spec.command,
        args: spec.args ?? [],
        env: spec.env ?? {},
        cols: spec.cols ?? 80,
        rows: spec.rows ?? 24,
      });
      const rs = newSession(spec.id, 'terminal', handle);
      rs.onEnd = spec.onEnd;
      sessions.set(spec.id, rs);
      void store.markRunning(spec.id);
      broadcast(rs, { type: 'status', status: 'running' });
      consumeTerminal(rs);
    },

    startAgent(spec) {
      const rs = newSession(spec.id, 'agent', spec.run);
      rs.maxBudgetUsd = spec.maxBudgetUsd;
      rs.onEnd = spec.onEnd;
      sessions.set(spec.id, rs);
      void store.markRunning(spec.id);
      broadcast(rs, { type: 'status', status: 'running' });
      consumeAgent(rs);
    },

    async attach(sessionId, sub, lastSeq) {
      const rs = sessions.get(sessionId);
      if (!rs) {
        sub.send({ type: 'status', status: 'exited' });
        sub.close?.();
        return;
      }
      const buffered: ServerFrame[] = [];
      rs.pending.set(sub, buffered);
      try {
        const { frames, oldestSeq } = await replay(rs, lastSeq);
        if (oldestSeq !== null && oldestSeq > lastSeq + 1) {
          sub.send({
            type: 'notice',
            message: `history truncated — earlier records pruned (resumes at ${oldestSeq})`,
          });
        }
        let maxReplayed = lastSeq;
        for (const frame of frames) {
          sub.send(frame);
          const seq = 'seq' in frame ? frame.seq : lastSeq;
          if (seq > maxReplayed) maxReplayed = seq;
        }
        sub.send({ type: 'replay_done' });
        sub.send({ type: 'status', status: rs.status, exitCode: rs.exitCode });
        rs.pending.delete(sub);
        for (const frame of buffered) {
          if ((frame.type === 'output' || frame.type === 'message') && frame.seq <= maxReplayed) {
            continue;
          }
          sub.send(frame);
        }
        rs.subscribers.add(sub);
      } catch (err) {
        rs.pending.delete(sub);
        throw err;
      }
    },

    detach(sessionId, sub) {
      const rs = sessions.get(sessionId);
      if (!rs) return;
      rs.subscribers.delete(sub);
      rs.pending.delete(sub);
    },

    write(sessionId, data) {
      const rs = sessions.get(sessionId);
      if (rs?.kind === 'terminal') (rs.handle as PtyHandle).write(data);
    },

    resize(sessionId, cols, rows) {
      const rs = sessions.get(sessionId);
      if (rs?.kind === 'terminal') (rs.handle as PtyHandle).resize(cols, rows);
    },

    prompt(sessionId, text) {
      const rs = sessions.get(sessionId);
      if (rs?.kind !== 'agent') return;
      void (rs.handle as AgentRun).send(text).then(() => transition(rs, 'running'));
    },

    interrupt(sessionId) {
      const rs = sessions.get(sessionId);
      if (!rs) return;
      if (rs.kind === 'terminal') {
        (rs.handle as PtyHandle).write('\x03');
      } else {
        void (rs.handle as AgentRun).interrupt();
      }
    },

    respondToPermission(sessionId, requestId, result, reason) {
      const rs = sessions.get(sessionId);
      if (rs?.kind !== 'agent') return;
      void (rs.handle as AgentRun)
        .respondToPermission(requestId, result, reason)
        .then(() => transition(rs, 'running'));
    },

    stop(sessionId) {
      const rs = sessions.get(sessionId);
      if (!rs) return;
      if (rs.kind === 'terminal') (rs.handle as PtyHandle).kill();
      else (rs.handle as AgentRun).close();
    },

    has(sessionId) {
      return sessions.has(sessionId);
    },

    flush(sessionId) {
      const rs = sessions.get(sessionId);
      return rs ? flush(rs) : Promise.resolve();
    },
  };
}
