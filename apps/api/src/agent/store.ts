import { and, asc, eq, gt, inArray, isNull, sql } from 'drizzle-orm';
import type { Db } from '@tickets/db';
import { agentMessages, agentPermissionRequests, agentSessions } from '@tickets/db';
import type { SessionStore as CoreSessionStore } from '../session-core/types';
import type { AgentEvent } from './types';
import type { SessionId, SessionStatus } from './types';

// The one frame shape an agent session ever publishes — session-core treats
// it as an opaque `F`; this is the only module that knows its shape.
export interface MessageFrame {
  type: 'message';
  seq: number;
  event: AgentEvent;
}

// Derive the queryable agent.messages columns from an AgentEvent. The full
// event is stored in `content` (jsonb) and reconstructed verbatim on replay;
// role/kind/tool ids are projected out for filtering and subagent attribution.
function messageRow(event: AgentEvent) {
  const role =
    event.type === 'tool_result'
      ? 'tool'
      : event.type === 'assistant_text' || event.type === 'thinking' || event.type === 'tool_use'
        ? 'assistant'
        : 'system';
  const toolUseId =
    event.type === 'tool_use' ? event.id : event.type === 'tool_result' ? event.toolUseId : null;
  const parentToolUseId =
    event.type === 'assistant_text' || event.type === 'tool_use'
      ? (event.parentToolUseId ?? null)
      : null;
  return { role, kind: event.type, toolUseId, parentToolUseId, content: event };
}

// The store the agent driver depends on: session-core's persist/replay
// contract (append/replay) PLUS the lifecycle bookkeeping session-core
// deliberately does not know about (status, cost, permission requests) — a
// driver concern, not a session-core one.
export interface AgentStore extends CoreSessionStore<MessageFrame> {
  // Surface accumulated spend on the session row (agent runs cost real money).
  setCost(sessionId: SessionId, costUsd: number): Promise<void>;
  // A pending agent.permission_requests row IS a parked canUseTool promise.
  // Returns the row id so the decision can be recorded against it.
  createPermissionRequest(sessionId: SessionId, toolName: string, input: unknown): Promise<number>;
  decidePermissionRequest(
    id: number,
    status: 'allowed' | 'denied',
    reason?: string,
    decidedBy?: number,
  ): Promise<void>;
  // Mark a session running (on start).
  markRunning(sessionId: SessionId): Promise<void>;
  // Non-terminal status transition (running<->idle<->awaiting_input) without
  // touching ended_at.
  setStatus(sessionId: SessionId, status: SessionStatus): Promise<void>;
  // Terminal transition: status + ended_at (on turn stream exit/failure). No
  // exit code — agent.sessions has none; that is a PTY fact.
  finishSession(sessionId: SessionId, status: SessionStatus): Promise<void>;
  // Flip any session left starting/running/idle/awaiting_input/interrupted
  // with no ended_at to 'interrupted' and stamp ended_at — called once at
  // boot to clean up sessions orphaned by an API restart. Returns the number
  // of rows affected. 'interrupted' (not a terminal-style 'disconnected') is
  // the correct target: agent.session_status has no disconnected value, and
  // interrupted already means exactly this case ("API restarted underneath
  // it; may be resumable").
  reconcileOrphaned(): Promise<number>;
}

// The production AgentStore: the driver's persist/replay/lifecycle calls
// backed by drizzle, over agent.sessions / agent.messages / agent.permission_requests.
// Behaviour is verified against a real Postgres in store.test.ts; the driver's
// own logic is covered separately against an in-memory fake, so this adapter
// only has to be a faithful mapping.
export function createAgentStore(db: Db): AgentStore {
  return {
    async append(sessionId: SessionId, frames: MessageFrame[]): Promise<void> {
      if (frames.length === 0) return;
      await db.insert(agentMessages).values(
        frames.map((f) => ({ sessionId, seq: f.seq, ...messageRow(f.event) })),
      );
    },

    async replay(sessionId: SessionId, afterSeq: number) {
      const rows = await db
        .select({ seq: agentMessages.seq, content: agentMessages.content })
        .from(agentMessages)
        .where(and(eq(agentMessages.sessionId, sessionId), gt(agentMessages.seq, afterSeq)))
        .orderBy(asc(agentMessages.seq));

      const [oldest] = await db
        .select({ seq: sql<number | null>`min(${agentMessages.seq})` })
        .from(agentMessages)
        .where(eq(agentMessages.sessionId, sessionId));

      const oldestSeq = oldest?.seq == null ? null : Number(oldest.seq);
      const frames: MessageFrame[] = rows.map((r) => ({
        type: 'message',
        seq: r.seq,
        event: r.content as AgentEvent,
      }));
      return { frames, oldestSeq };
    },

    async setCost(sessionId: SessionId, costUsd: number): Promise<void> {
      await db
        .update(agentSessions)
        .set({ costUsd: costUsd.toFixed(4), updatedAt: sql`now()` })
        .where(eq(agentSessions.id, sessionId));
    },

    async createPermissionRequest(sessionId, toolName, input) {
      const [row] = await db
        .insert(agentPermissionRequests)
        .values({ sessionId, toolName, input: input as object })
        .returning({ id: agentPermissionRequests.id });
      return row!.id;
    },

    async decidePermissionRequest(id, status, reason, decidedBy) {
      await db
        .update(agentPermissionRequests)
        .set({
          status,
          decisionReason: reason ?? null,
          decidedBy: decidedBy ?? null,
          decidedAt: sql`now()`,
        })
        .where(eq(agentPermissionRequests.id, id));
    },

    async markRunning(sessionId: SessionId): Promise<void> {
      await db
        .update(agentSessions)
        .set({ status: 'running', updatedAt: sql`now()` })
        .where(eq(agentSessions.id, sessionId));
    },

    async setStatus(sessionId: SessionId, status: SessionStatus): Promise<void> {
      await db
        .update(agentSessions)
        .set({ status, updatedAt: sql`now()` })
        .where(eq(agentSessions.id, sessionId));
    },

    async finishSession(sessionId: SessionId, status: SessionStatus): Promise<void> {
      await db
        .update(agentSessions)
        .set({ status, endedAt: sql`now()`, updatedAt: sql`now()` })
        .where(eq(agentSessions.id, sessionId));
    },

    async reconcileOrphaned(): Promise<number> {
      const rows = await db
        .update(agentSessions)
        .set({ status: 'interrupted', endedAt: sql`now()`, updatedAt: sql`now()` })
        .where(
          and(
            isNull(agentSessions.endedAt),
            inArray(agentSessions.status, ['starting', 'running', 'idle', 'awaiting_input', 'interrupted']),
          ),
        )
        .returning({ id: agentSessions.id });
      return rows.length;
    },
  };
}
