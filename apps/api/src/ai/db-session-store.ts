import { and, asc, desc, eq, gt, lt, sql } from 'drizzle-orm';
import type { Db } from '@tickets/db';
import { aiMessages, aiPermissionRequests, aiSessionOutput, aiSessions } from '@tickets/db';
import type { AgentEvent } from './types';
import type { OutputChunk, PersistedMessage, SessionId, SessionStatus, SessionStore } from './types';

// Derive the queryable ai_messages columns from an AgentEvent. The full event is
// stored in `content` (jsonb) and reconstructed verbatim on replay; role/kind/
// tool ids are projected out for filtering and subagent attribution.
function messageRow(event: AgentEvent) {
  const role =
    event.type === 'tool_result'
      ? 'tool'
      : event.type === 'assistant_text' || event.type === 'thinking' || event.type === 'tool_use'
        ? 'assistant'
        : 'system';
  const toolUseId =
    event.type === 'tool_use'
      ? event.id
      : event.type === 'tool_result'
        ? event.toolUseId
        : null;
  const parentToolUseId =
    event.type === 'assistant_text' || event.type === 'tool_use'
      ? (event.parentToolUseId ?? null)
      : null;
  return { role, kind: event.type, toolUseId, parentToolUseId, content: event };
}

// The production SessionStore: the supervisor's persist/replay/lifecycle calls
// backed by drizzle. Behaviour is verified against a real Postgres in
// db-session-store.test.ts; the supervisor's own logic is covered separately
// against an in-memory fake, so this adapter only has to be a faithful mapping.
export function createDbSessionStore(db: Db): SessionStore {
  return {
    async appendOutput(sessionId: SessionId, chunks: OutputChunk[]): Promise<void> {
      if (chunks.length === 0) return;
      await db.insert(aiSessionOutput).values(
        chunks.map((c) => ({ sessionId, seq: c.seq, data: c.data })),
      );
    },

    async loadOutputSince(sessionId: SessionId, afterSeq: number) {
      const chunks = await db
        .select({ seq: aiSessionOutput.seq, data: aiSessionOutput.data })
        .from(aiSessionOutput)
        .where(and(eq(aiSessionOutput.sessionId, sessionId), gt(aiSessionOutput.seq, afterSeq)))
        .orderBy(asc(aiSessionOutput.seq));

      const [oldest] = await db
        .select({ seq: sql<number | null>`min(${aiSessionOutput.seq})` })
        .from(aiSessionOutput)
        .where(eq(aiSessionOutput.sessionId, sessionId));

      const oldestSeq = oldest?.seq == null ? null : Number(oldest.seq);
      return { chunks, oldestSeq };
    },

    async pruneOutput(sessionId: SessionId, keep: number): Promise<void> {
      // Keep the newest `keep` rows; delete anything older than the oldest kept.
      const kept = await db
        .select({ seq: aiSessionOutput.seq })
        .from(aiSessionOutput)
        .where(eq(aiSessionOutput.sessionId, sessionId))
        .orderBy(desc(aiSessionOutput.seq))
        .limit(keep);
      if (kept.length < keep) return; // fewer than `keep` rows — nothing to prune
      const oldestKept = kept[kept.length - 1]!.seq;
      await db
        .delete(aiSessionOutput)
        .where(and(eq(aiSessionOutput.sessionId, sessionId), lt(aiSessionOutput.seq, oldestKept)));
    },

    async appendMessages(sessionId: SessionId, messages: PersistedMessage[]): Promise<void> {
      if (messages.length === 0) return;
      await db.insert(aiMessages).values(
        messages.map((m) => ({ sessionId, seq: m.seq, ...messageRow(m.event) })),
      );
    },

    async loadMessagesSince(sessionId: SessionId, afterSeq: number) {
      const rows = await db
        .select({ seq: aiMessages.seq, content: aiMessages.content })
        .from(aiMessages)
        .where(and(eq(aiMessages.sessionId, sessionId), gt(aiMessages.seq, afterSeq)))
        .orderBy(asc(aiMessages.seq));

      const [oldest] = await db
        .select({ seq: sql<number | null>`min(${aiMessages.seq})` })
        .from(aiMessages)
        .where(eq(aiMessages.sessionId, sessionId));

      const messages: PersistedMessage[] = rows.map((r) => ({
        seq: r.seq,
        event: r.content as AgentEvent,
      }));
      const oldestSeq = oldest?.seq == null ? null : Number(oldest.seq);
      return { messages, oldestSeq };
    },

    async setCost(sessionId: SessionId, costUsd: number): Promise<void> {
      await db
        .update(aiSessions)
        .set({ costUsd: costUsd.toFixed(4), updatedAt: sql`now()` })
        .where(eq(aiSessions.id, sessionId));
    },

    async createPermissionRequest(sessionId, toolName, input) {
      const [row] = await db
        .insert(aiPermissionRequests)
        .values({ sessionId, toolName, input: input as object })
        .returning({ id: aiPermissionRequests.id });
      return row!.id;
    },

    async decidePermissionRequest(id, status, reason, decidedBy) {
      await db
        .update(aiPermissionRequests)
        .set({
          status,
          decisionReason: reason ?? null,
          decidedBy: decidedBy ?? null,
          decidedAt: sql`now()`,
        })
        .where(eq(aiPermissionRequests.id, id));
    },

    async markRunning(sessionId: SessionId): Promise<void> {
      await db
        .update(aiSessions)
        .set({ status: 'running', updatedAt: sql`now()` })
        .where(eq(aiSessions.id, sessionId));
    },

    async setStatus(sessionId: SessionId, status: SessionStatus): Promise<void> {
      await db
        .update(aiSessions)
        .set({ status, updatedAt: sql`now()` })
        .where(eq(aiSessions.id, sessionId));
    },

    async finishSession(
      sessionId: SessionId,
      status: SessionStatus,
      exitCode: number | null,
    ): Promise<void> {
      await db
        .update(aiSessions)
        .set({ status, exitCode, endedAt: sql`now()`, updatedAt: sql`now()` })
        .where(eq(aiSessions.id, sessionId));
    },
  };
}
