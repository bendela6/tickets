import { and, asc, desc, eq, gt, inArray, isNull, lt, sql } from 'drizzle-orm';
import type { Db } from '@tickets/db';
import { terminalOutput, terminalSessions } from '@tickets/db';
import type { SessionStore as CoreSessionStore } from '../session-core/types';
import type { SessionId, SessionStatus } from './types';

// The one frame shape a terminal session ever publishes — session-core treats
// it as an opaque `F`; this is the only module that knows its shape.
export interface OutputFrame {
  type: 'output';
  seq: number;
  data: string;
}

// The store the terminal driver depends on: session-core's persist/replay
// contract (append/replay) PLUS the lifecycle bookkeeping session-core
// deliberately does not know about (status, exit code, pruning, orphan
// reconcile) — a driver concern, not a session-core one.
export interface TerminalStore extends CoreSessionStore<OutputFrame> {
  // Drop all but the newest `keep` rows for a session.
  pruneOutput(sessionId: SessionId, keep: number): Promise<void>;
  // Non-terminal status transition (e.g. starting -> live) without touching
  // ended_at.
  setStatus(sessionId: SessionId, status: SessionStatus): Promise<void>;
  // Terminal transition: status + exit code + ended_at (process exit/failure).
  finishSession(sessionId: SessionId, status: SessionStatus, exitCode: number | null): Promise<void>;
  // Flip any session left starting/live with no ended_at to 'disconnected' and
  // stamp ended_at — called once at boot to clean up sessions orphaned by an
  // API restart. Returns the number of rows affected.
  reconcileOrphaned(): Promise<number>;
}

// The production TerminalStore: the driver's persist/replay/lifecycle calls
// backed by drizzle, over terminal.sessions / terminal.output. Behaviour is
// verified against a real Postgres in store.test.ts; the driver's own logic
// is covered separately against an in-memory fake, so this adapter only has
// to be a faithful mapping.
export function createTerminalStore(db: Db): TerminalStore {
  return {
    async append(sessionId: SessionId, frames: OutputFrame[]): Promise<void> {
      if (frames.length === 0) return;
      await db.insert(terminalOutput).values(
        frames.map((f) => ({ sessionId, seq: f.seq, data: f.data })),
      );
    },

    async replay(sessionId: SessionId, afterSeq: number) {
      const rows = await db
        .select({ seq: terminalOutput.seq, data: terminalOutput.data })
        .from(terminalOutput)
        .where(and(eq(terminalOutput.sessionId, sessionId), gt(terminalOutput.seq, afterSeq)))
        .orderBy(asc(terminalOutput.seq));

      const [oldest] = await db
        .select({ seq: sql<number | null>`min(${terminalOutput.seq})` })
        .from(terminalOutput)
        .where(eq(terminalOutput.sessionId, sessionId));

      const oldestSeq = oldest?.seq == null ? null : Number(oldest.seq);
      const frames: OutputFrame[] = rows.map((r) => ({ type: 'output', seq: r.seq, data: r.data }));
      return { frames, oldestSeq };
    },

    async pruneOutput(sessionId: SessionId, keep: number): Promise<void> {
      // Keep the newest `keep` rows; delete anything older than the oldest kept.
      const kept = await db
        .select({ seq: terminalOutput.seq })
        .from(terminalOutput)
        .where(eq(terminalOutput.sessionId, sessionId))
        .orderBy(desc(terminalOutput.seq))
        .limit(keep);
      if (kept.length < keep) return; // fewer than `keep` rows — nothing to prune
      const oldestKept = kept[kept.length - 1]!.seq;
      await db
        .delete(terminalOutput)
        .where(and(eq(terminalOutput.sessionId, sessionId), lt(terminalOutput.seq, oldestKept)));
    },

    async setStatus(sessionId: SessionId, status: SessionStatus): Promise<void> {
      await db
        .update(terminalSessions)
        .set({ status, updatedAt: sql`now()` })
        .where(eq(terminalSessions.id, sessionId));
    },

    async finishSession(
      sessionId: SessionId,
      status: SessionStatus,
      exitCode: number | null,
    ): Promise<void> {
      await db
        .update(terminalSessions)
        .set({ status, exitCode, endedAt: sql`now()`, updatedAt: sql`now()` })
        .where(eq(terminalSessions.id, sessionId));
    },

    async reconcileOrphaned(): Promise<number> {
      // starting/live are the only "left running" statuses in the 5-value
      // terminal enum — no running/idle/awaiting_input/interrupted here.
      const rows = await db
        .update(terminalSessions)
        .set({ status: 'disconnected', endedAt: sql`now()`, updatedAt: sql`now()` })
        .where(and(isNull(terminalSessions.endedAt), inArray(terminalSessions.status, ['starting', 'live'])))
        .returning({ id: terminalSessions.id });
      return rows.length;
    },
  };
}
