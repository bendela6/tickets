import type { AgentRun } from './agent-types';
import { createActivityScanner } from './activity-scanner';
import { createChannel } from '../session-core/channel';
import type { Channel, SessionStore as CoreSessionStore } from '../session-core/types';
import { integrationFor } from './shell-integration';
import type {
  AgentEvent,
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
// The load-bearing invariant — a record is persisted BEFORE it is broadcast,
// `seq` is the single source of truth shared by the stored rows and the wire
// frames, and a reconnecting client is replayed exactly the frames it missed
// — lives in session-core's `Channel`, which is generic over the frame shape.
// This module is the terminal/agent-aware ADAPTER around it: it decides,
// per session kind, which frame shape to publish and which store method
// persists it. session-core itself never learns the difference.

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

// The one frame shape session-core's channel moves for this supervisor: a
// terminal output chunk or a normalized agent message, each already carrying
// its seq and already shaped exactly like the ServerFrame variant a
// subscriber expects. session-core treats this as an opaque `F`; only this
// adapter knows the two cases exist.
type ChannelFrame = Extract<ServerFrame, { type: 'output' | 'message' }>;

interface RunningSession {
  id: SessionId;
  kind: SessionKind;
  status: SessionStatus;
  exitCode: number | null;
  handle: PtyHandle | AgentRun;
  seq: number;
  subscriberDetachers: Map<Subscriber, () => void>;
  costUsd: number;
  maxBudgetUsd?: number;
  onEnd?: () => void | Promise<void>;
  ended: boolean;
  // Maps a provider permission id → the ai_permission_requests row awaiting a
  // human decision (TIX-209).
  permissionRows: Map<string, number>;
  // Strips OSC 133 shell-integration markers from terminal output and turns
  // them into activity events; null when the shell has no registered
  // integration (coarse activity is not tracked in that case).
  scanner?: ReturnType<typeof createActivityScanner> | null;
  // Last known activity busy state (integrated terminals only), re-sent to a
  // client that attaches after start() so it learns the session is integrated.
  busy: boolean;
}

export function createSupervisor(options: SupervisorOptions): Supervisor {
  const { runner, store } = options;
  const outputCap = options.outputCap ?? 20_000;
  const sessions = new Map<SessionId, RunningSession>();

  // The session-core adapter: routes the generic append/replay contract to
  // this driver's two persistence shapes, keyed off the RunningSession kind
  // recorded when the session started. Neither branch is visible to
  // session-core — it only ever calls `append`/`replay` and gets an opaque F
  // back.
  const channelStore: CoreSessionStore<ChannelFrame> = {
    async append(sessionId, frames) {
      const kind = sessions.get(sessionId)?.kind;
      if (kind === 'agent') {
        await store.appendMessages(
          sessionId,
          frames.map((f) => ({ seq: f.seq, event: (f as Extract<ChannelFrame, { type: 'message' }>).event })),
        );
      } else {
        await store.appendOutput(
          sessionId,
          frames.map((f) => ({ seq: f.seq, data: (f as Extract<ChannelFrame, { type: 'output' }>).data })),
        );
        // Only terminal scrollback is capped (a chatty process); agent turns
        // are bounded by the budget cap instead. Pruning is a driver concern
        // (outputCap), so it lives in this adapter rather than session-core.
        const rs = sessions.get(sessionId);
        if (rs && rs.seq > outputCap) await store.pruneOutput(sessionId, outputCap);
      }
    },
    async replay(sessionId, afterSeq) {
      const kind = sessions.get(sessionId)?.kind;
      if (kind === 'agent') {
        const { messages, oldestSeq } = await store.loadMessagesSince(sessionId, afterSeq);
        const frames: ChannelFrame[] = messages.map((m) => ({ type: 'message', seq: m.seq, event: m.event }));
        return { frames, oldestSeq };
      }
      const { chunks, oldestSeq } = await store.loadOutputSince(sessionId, afterSeq);
      const frames: ChannelFrame[] = chunks.map((c) => ({ type: 'output', seq: c.seq, data: c.data }));
      return { frames, oldestSeq };
    },
  };

  const channel: Channel<ChannelFrame> = createChannel(channelStore, { schedule: options.schedule });

  function publishOutput(rs: RunningSession, data: string): void {
    channel.publish(rs.id, { type: 'output', seq: ++rs.seq, data });
  }

  function publishMessage(rs: RunningSession, event: AgentEvent): void {
    channel.publish(rs.id, { type: 'message', seq: ++rs.seq, event });
  }

  // Non-terminal transition: flush any pending records first so the client
  // sees the message that caused the transition before the status frame.
  async function transition(rs: RunningSession, status: SessionStatus): Promise<void> {
    await channel.flush(rs.id);
    rs.status = status;
    await store.setStatus(rs.id, status);
    channel.broadcast(rs.id, { type: 'status', status });
  }

  async function finish(
    rs: RunningSession,
    status: SessionStatus,
    exitCode: number | null,
  ): Promise<void> {
    await channel.flush(rs.id);
    rs.status = status;
    rs.exitCode = exitCode;
    await store.finishSession(rs.id, status, exitCode);
    channel.broadcast(rs.id, { type: 'status', status, exitCode });
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
      subscriberDetachers: new Map(),
      costUsd: 0,
      ended: false,
      permissionRows: new Map(),
      scanner: null,
      busy: false,
    };
  }

  function consumeTerminal(rs: RunningSession): void {
    const handle = rs.handle as PtyHandle;
    void (async () => {
      try {
        for await (const data of handle.output) {
          let text = data;
          if (rs.scanner) {
            const { clean, event } = rs.scanner.push(data);
            text = clean;
            if (event) {
              rs.busy = event.busy;
              channel.broadcast(rs.id, { type: 'activity', ...event });
            }
          }
          if (text) publishOutput(rs, text);
        }
        const { exitCode } = await handle.exit;
        await finish(rs, 'exited', exitCode);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        publishOutput(rs, `\r\n[session error] ${message}\r\n`);
        await finish(rs, 'failed', null);
      }
    })();
  }

  function consumeAgent(rs: RunningSession): void {
    const run = rs.handle as AgentRun;
    void (async () => {
      try {
        for await (const event of run.events) {
          publishMessage(rs, event);
          if (event.type === 'permission_request') {
            // Persist the pending request (the parked promise) then block on it.
            const rowId = await store.createPermissionRequest(rs.id, event.toolName, event.input);
            rs.permissionRows.set(event.id, rowId);
            await transition(rs, 'awaiting_input');
          } else if (event.type === 'result') {
            rs.costUsd += event.costUsd;
            await channel.flush(rs.id);
            await store.setCost(rs.id, rs.costUsd);
            await transition(rs, 'idle');
            if (rs.maxBudgetUsd != null && rs.costUsd >= rs.maxBudgetUsd) {
              channel.broadcast(rs.id, {
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
        publishMessage(rs, { type: 'error', message });
        await finish(rs, 'failed', null);
      }
    })();
  }

  return {
    start(spec) {
      const integ = integrationFor(spec.command);
      const sp = integ ? integ.apply({ id: spec.id, command: spec.command, args: spec.args, env: spec.env }) : null;
      let handle: PtyHandle;
      try {
        handle = runner.spawnPty({
          cwd: spec.cwd,
          command: sp?.command ?? spec.command,
          args: sp?.args ?? spec.args ?? [],
          env: sp?.env ?? spec.env ?? {},
          cols: spec.cols ?? 80,
          rows: spec.rows ?? 24,
        });
      } catch {
        // The PTY could not be created — an unresolvable command, or (on Windows
        // ConPTY) no attachable console. Record "Couldn't start" instead of
        // throwing, so createSession never 500s and the row doesn't hang in
        // `starting`.
        void store.finishSession(spec.id, 'failed', null);
        if (spec.onEnd) void Promise.resolve(spec.onEnd()).catch(() => {});
        return;
      }
      const rs = newSession(spec.id, 'terminal', handle);
      rs.status = 'live';
      rs.onEnd = spec.onEnd;
      rs.scanner = integ?.precise ? createActivityScanner() : null;
      sessions.set(spec.id, rs);
      void store.setStatus(spec.id, 'live');
      channel.broadcast(spec.id, { type: 'status', status: 'live' });
      if (integ?.precise) channel.broadcast(spec.id, { type: 'activity', busy: false, integrated: true });
      consumeTerminal(rs);
    },

    startAgent(spec) {
      const rs = newSession(spec.id, 'agent', spec.run);
      rs.maxBudgetUsd = spec.maxBudgetUsd;
      rs.onEnd = spec.onEnd;
      sessions.set(spec.id, rs);
      void store.markRunning(spec.id);
      channel.broadcast(spec.id, { type: 'status', status: 'running' });
      consumeAgent(rs);
    },

    async attach(sessionId, sub, lastSeq) {
      const rs = sessions.get(sessionId);
      if (!rs) {
        sub.send({ type: 'status', status: 'exited' });
        sub.close?.();
        return;
      }
      const send = (frame: unknown) => sub.send(frame as ServerFrame);
      const detach = await channel.attach(sessionId, lastSeq, send);
      // Current status (and integration state) is driver-owned, not part of
      // the replayable seq stream — sent directly, right after the channel
      // has finished replay and gone live, so it lands after replay_done and
      // before any subsequent live frame.
      sub.send({ type: 'status', status: rs.status, exitCode: rs.exitCode });
      // Re-send integration state so a client attaching after start() learns
      // this terminal has precise activity (the start() broadcast had no
      // subscribers yet). Without this the client would stay on the pulse.
      if (rs.scanner) sub.send({ type: 'activity', busy: rs.busy, integrated: true });
      rs.subscriberDetachers.set(sub, detach);
    },

    detach(sessionId, sub) {
      const rs = sessions.get(sessionId);
      if (!rs) return;
      const detach = rs.subscriberDetachers.get(sub);
      if (detach) {
        detach();
        rs.subscriberDetachers.delete(sub);
      }
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
      // Record the human's decision against the persisted request row.
      const rowId = rs.permissionRows.get(requestId);
      if (rowId != null) {
        rs.permissionRows.delete(requestId);
        void store.decidePermissionRequest(rowId, result === 'allow' ? 'allowed' : 'denied', reason);
      }
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
      return sessions.has(sessionId) ? channel.flush(sessionId) : Promise.resolve();
    },
  };
}
