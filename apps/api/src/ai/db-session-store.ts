import { and, asc, desc, eq, gt, lt, sql } from 'drizzle-orm';
import type { Db } from '@tickets/db';
import { aiSessionOutput, aiSessions } from '@tickets/db';
import type { OutputChunk, SessionId, SessionStatus, SessionStore } from './types';

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

    async markRunning(sessionId: SessionId): Promise<void> {
      await db
        .update(aiSessions)
        .set({ status: 'running', updatedAt: sql`now()` })
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
