import { captureError } from '@bendela6/signals-node';
import { createChannel } from '../session-core/channel';
import type { Channel, SessionStore as CoreSessionStore } from '../session-core/types';
import type { AgentRun } from './agent-types';
import type { MessageFrame, AgentStore } from './store';
import type { AgentEvent, ServerFrame, SessionId, SessionStatus, Subscriber } from './types';

// The one stateful thing in an otherwise stateless API: a singleton holding a
// Map of live agent runs. It owns every child agent process and is NOT
// coupled to any browser connection — sockets attach and detach from a
// session that outlives them, so closing the tab does not kill the run.
//
// The load-bearing invariant — a record is persisted BEFORE it is broadcast,
// `seq` is the single source of truth shared by the stored rows and the wire
// frames, and a reconnecting client is replayed exactly the frames it missed
// — lives in session-core's `Channel`. This module is the agent-specific
// adapter around it: an AgentRun, cost tracking, a budget cap, permission
// round-trips. It has no notion of a PTY, a shell, or terminal output — see
// the terminal/agent independence rule in the split plan.

export interface StartAgentSpec {
  id: SessionId;
  run: AgentRun;
  maxBudgetUsd?: number;
  // Called once when the run reaches a terminal state (exit/failure) — used
  // to tear down a dispatched run's git worktree.
  onEnd?: () => void | Promise<void>;
}

export interface AgentDriver {
  start(spec: StartAgentSpec): void;
  attach(sessionId: SessionId, sub: Subscriber, lastSeq: number): Promise<void>;
  detach(sessionId: SessionId, sub: Subscriber): void;
  // Start a follow-up turn.
  prompt(sessionId: SessionId, text: string): void;
  interrupt(sessionId: SessionId): void;
  // Resolve a parked permission request.
  respondToPermission(sessionId: SessionId, requestId: string, result: 'allow' | 'deny', reason?: string): void;
  stop(sessionId: SessionId): void;
  has(sessionId: SessionId): boolean;
  flush(sessionId: SessionId): Promise<void>;
}

export interface AgentDriverOptions {
  store: AgentStore;
  schedule?: (fn: () => void) => void;
}

interface RunningSession {
  id: SessionId;
  status: SessionStatus;
  run: AgentRun;
  seq: number;
  subscriberDetachers: Map<Subscriber, () => void>;
  costUsd: number;
  maxBudgetUsd?: number;
  onEnd?: () => void | Promise<void>;
  ended: boolean;
  // Maps a provider permission id -> the agent.permission_requests row awaiting
  // a human decision.
  permissionRows: Map<string, number>;
}

export function createAgentDriver(options: AgentDriverOptions): AgentDriver {
  const { store } = options;
  const sessions = new Map<SessionId, RunningSession>();

  // The session-core adapter: the store already implements append/replay
  // directly (there is only one frame kind — a normalized message), wrapped
  // once here so session-core never learns the agent shape.
  const channelStore: CoreSessionStore<MessageFrame> = {
    append(sessionId, frames) {
      return store.append(sessionId, frames);
    },
    replay(sessionId, afterSeq) {
      return store.replay(sessionId, afterSeq);
    },
  };

  const channel: Channel<MessageFrame> = createChannel(channelStore, { schedule: options.schedule });

  function publishMessage(rs: RunningSession, event: AgentEvent): void {
    channel.publish(rs.id, { type: 'message', seq: ++rs.seq, event });
  }

  // Non-terminal transition: flush any pending records first so the client
  // sees the message that caused the transition before the status frame.
  async function transition(rs: RunningSession, status: SessionStatus): Promise<void> {
    await channel.flush(rs.id);
    rs.status = status;
    await store.setStatus(rs.id, status);
    channel.notify(rs.id, { type: 'status', status });
  }

  async function finish(rs: RunningSession, status: SessionStatus): Promise<void> {
    await channel.flush(rs.id);
    rs.status = status;
    await store.finishSession(rs.id, status);
    channel.notify(rs.id, { type: 'status', status });
    // Fire the teardown hook exactly once (worktree cleanup for a dispatch).
    if (!rs.ended) {
      rs.ended = true;
      if (rs.onEnd) await Promise.resolve(rs.onEnd()).catch(() => {});
    }
  }

  function newSession(id: SessionId, run: AgentRun): RunningSession {
    return {
      id,
      status: 'running',
      run,
      seq: 0,
      subscriberDetachers: new Map(),
      costUsd: 0,
      ended: false,
      permissionRows: new Map(),
    };
  }

  function consume(rs: RunningSession): void {
    void (async () => {
      try {
        for await (const event of rs.run.events) {
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
            if (event.isError) {
              captureError(new Error('agent turn ended in error'), {
                level: 'error',
                mechanism: 'manual',
                contexts: { agent: { sessionId: rs.id } },
              });
              await transition(rs, 'failed');
            } else {
              await transition(rs, 'idle');
              if (rs.maxBudgetUsd != null && rs.costUsd >= rs.maxBudgetUsd) {
                channel.notify(rs.id, {
                  type: 'notice',
                  message: `budget cap reached — $${rs.costUsd.toFixed(2)} of $${rs.maxBudgetUsd.toFixed(2)}`,
                });
                rs.run.interrupt().catch((err) =>
                  captureError(err, {
                    level: 'error',
                    contexts: { agent: { sessionId: rs.id, phase: 'budget-interrupt' } },
                  }),
                );
              }
            }
          } else if (event.type === 'error') {
            captureError(new Error(event.message ?? 'agent run failed'), {
              level: 'error',
              mechanism: 'manual',
              contexts: { agent: { sessionId: rs.id } },
            });
            await transition(rs, 'failed');
          }
        }
        await finish(rs, rs.status === 'failed' ? 'failed' : 'exited');
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        captureError(err, { level: 'error', contexts: { agent: { sessionId: rs.id } } });
        publishMessage(rs, { type: 'error', message });
        await finish(rs, 'failed');
      }
    })();
  }

  return {
    start(spec) {
      const rs = newSession(spec.id, spec.run);
      rs.maxBudgetUsd = spec.maxBudgetUsd;
      rs.onEnd = spec.onEnd;
      sessions.set(spec.id, rs);
      void store.markRunning(spec.id).catch((err) =>
        captureError(err, { level: 'error', contexts: { agent: { sessionId: spec.id, phase: 'markRunning' } } }),
      );
      channel.notify(spec.id, { type: 'status', status: 'running' });
      consume(rs);
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
      // Current status is driver-owned, not part of the replayable seq
      // stream — sent directly, once channel.attach's replay has resolved.
      // Not guaranteed to land immediately after replay_done and before any
      // subsequent live frame, but last-write-wins converges regardless: this
      // reads rs.status at send time, and transition()/finish() always set it
      // synchronously before their own notify() of the same status.
      sub.send({ type: 'status', status: rs.status });
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

    prompt(sessionId, text) {
      const rs = sessions.get(sessionId);
      if (!rs) return;
      void rs.run
        .send(text)
        .then(() => transition(rs, 'running'))
        .catch((err) =>
          captureError(err, { level: 'error', contexts: { agent: { sessionId, phase: 'prompt' } } }),
        );
    },

    interrupt(sessionId) {
      const rs = sessions.get(sessionId);
      if (!rs) return;
      void rs.run
        .interrupt()
        .catch((err) =>
          captureError(err, { level: 'error', contexts: { agent: { sessionId, phase: 'interrupt' } } }),
        );
    },

    respondToPermission(sessionId, requestId, result, reason) {
      const rs = sessions.get(sessionId);
      if (!rs) return;
      // Record the human's decision against the persisted request row.
      const rowId = rs.permissionRows.get(requestId);
      if (rowId != null) {
        rs.permissionRows.delete(requestId);
        void store
          .decidePermissionRequest(rowId, result === 'allow' ? 'allowed' : 'denied', reason)
          .catch((err) =>
            captureError(err, {
              level: 'error',
              contexts: { agent: { sessionId, phase: 'decidePermission' } },
            }),
          );
      }
      void rs.run
        .respondToPermission(requestId, result, reason)
        .then(() => transition(rs, 'running'))
        .catch((err) =>
          captureError(err, {
            level: 'error',
            contexts: { agent: { sessionId, phase: 'respondToPermission' } },
          }),
        );
    },

    stop(sessionId) {
      sessions.get(sessionId)?.run.close();
    },

    has(sessionId) {
      return sessions.has(sessionId);
    },

    flush(sessionId) {
      return sessions.has(sessionId) ? channel.flush(sessionId) : Promise.resolve();
    },
  };
}
