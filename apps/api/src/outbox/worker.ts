import { captureError, captureEvent } from '@bendela6/signals-node';
import { eq, sql } from 'drizzle-orm';
import type { Db } from '@tickets/db';
import { ensureUser } from '@tickets/db';
import { events, outbox } from '@tickets/db';
import { DEPTH_CAP } from '../automation/constants';
import type { AutomationDef } from '../automation/registry';
import { runAutomations } from '../automation/run-automations';
import { projectEvent } from '../projection/item-activity';
import { clearOutboxNotify, onOutboxNotify } from './notify';

const BATCH = 50;
const LEASE = '30 seconds';
const MAX_ATTEMPTS = 5;
// While the database is unreachable there is nothing to drain, so back off from
// the normal sub-second poll to avoid spinning on a dead socket.
const DB_DOWN_POLL_MS = 5_000;

// Connection-level failures, as opposed to a bad row or a broken automation.
// postgres-js surfaces the socket error either directly or wrapped by drizzle
// (DrizzleQueryError -> cause), so walk the cause chain.
const CONNECTION_ERROR_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ENOTFOUND',
  'EHOSTUNREACH',
  'ETIMEDOUT',
  'EPIPE',
  'CONNECTION_ENDED',
  'CONNECTION_CLOSED',
  'CONNECTION_DESTROYED',
  'CONNECT_TIMEOUT',
]);

export function isDatabaseUnreachable(err: unknown): boolean {
  for (let current: unknown = err, depth = 0; current != null && depth < 5; depth += 1) {
    const code = (current as { code?: unknown }).code;
    if (typeof code === 'string' && CONNECTION_ERROR_CODES.has(code)) return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

export interface OutboxWorker {
  start(): void;
  stop(): Promise<void>;
  drainOnce(): Promise<number>;
}

export function createOutboxWorker(
  db: Db,
  opts: { rules?: AutomationDef[]; pollMs?: number } = {},
): OutboxWorker {
  let systemActorId: number | null = null;
  let running = false;
  let timer: NodeJS.Timeout | null = null;
  // Latches while postgres is unreachable so an outage reports once instead of
  // once per poll. Previously a single postgres restart produced a stack trace
  // every 500ms — and, since these are captured, hundreds of duplicate signals.
  let dbDown = false;

  function noteFailure(err: unknown, phase: 'drain' | 'notify'): void {
    if (isDatabaseUnreachable(err)) {
      if (!dbDown) {
        dbDown = true;
        // One line on the way down, then silence until it recovers.
        console.error(
          `outbox worker: database unreachable — retrying every ${DB_DOWN_POLL_MS / 1000}s, further errors suppressed until it returns`,
        );
        captureError(err, { level: 'error', contexts: { outbox: { phase, dbDown: true } } });
      }
      return;
    }
    // A real processing failure — always surfaced.
    console.error(`outbox worker ${phase} failed`, err);
    captureError(err, { level: 'error', contexts: { outbox: { phase } } });
  }

  function noteReachable(): void {
    if (dbDown) {
      dbDown = false;
      console.log('outbox worker: database reachable again — resuming');
      captureEvent('outbox.db-recovered');
    }
  }

  async function getSystemActorId(): Promise<number> {
    if (systemActorId === null) {
      systemActorId = await ensureUser(db, { name: 'automation', kind: 'agent' });
    }
    return systemActorId;
  }

  async function claim(): Promise<number[]> {
    // Lease-based claim: atomically stamp picked_at + bump attempts for a batch of
    // pending, non-poison, unleased rows, in event_id order. SKIP LOCKED keeps
    // concurrent drainers from fighting over the same rows. The subquery holds its
    // FOR UPDATE locks only for the duration of this single statement, which commits
    // on its own — so we never hold row locks across projection/automation work.
    const claimed = await db.execute<{ event_id: number }>(sql`
      UPDATE outbox
         SET picked_at = now(), attempts = attempts + 1
       WHERE event_id IN (
         SELECT event_id FROM outbox
          WHERE done_at IS NULL
            AND attempts < ${MAX_ATTEMPTS}
            AND (picked_at IS NULL OR picked_at < now() - interval '${sql.raw(LEASE)}')
          ORDER BY event_id
          FOR UPDATE SKIP LOCKED
          LIMIT ${BATCH})
      RETURNING event_id`);
    // postgres-js returns a RowList (Array-like); bigint event_id arrives as a
    // string from raw RETURNING, so coerce to number.
    return [...claimed].map((r) => Number(r.event_id));
  }

  async function processOne(
    eventId: number,
    actorId: number,
    rules?: AutomationDef[],
  ): Promise<boolean> {
    const eventRow = (await db.select().from(events).where(eq(events.id, eventId)))[0];
    if (!eventRow) {
      await db.update(outbox).set({ doneAt: sql`now()` }).where(eq(outbox.eventId, eventId));
      return true;
    }
    try {
      await projectEvent(db, eventRow);
      if (eventRow.depth < DEPTH_CAP) {
        await runAutomations(db, eventRow, { systemActorId: actorId, rules });
      }
      await db.update(outbox).set({ doneAt: sql`now()` }).where(eq(outbox.eventId, eventId));
      return true;
    } catch (err) {
      // Record the failure but leave done_at null. attempts was already bumped at
      // claim time, so a poison row climbs to MAX_ATTEMPTS and is then excluded
      // from future claims — visible (last_error) but non-blocking.
      captureError(err, { level: 'error', contexts: { outbox: { phase: 'drain' } } });
      await db
        .update(outbox)
        .set({ lastError: err instanceof Error ? err.message : String(err) })
        .where(eq(outbox.eventId, eventId));
      return false;
    }
  }

  async function drainOnce(): Promise<number> {
    const actorId = await getSystemActorId();
    const ids = await claim();
    if (ids.length === 0) return 0;
    // preserve event_id order for per-stream determinism
    ids.sort((a, b) => a - b);
    let ok = 0;
    for (const id of ids) {
      if (await processOne(id, actorId, opts.rules)) ok++;
    }
    captureEvent('outbox.flush', { count: ok });
    return ok;
  }

  async function loop(): Promise<void> {
    if (!running) return;
    try {
      let n = 0;
      do {
        n = await drainOnce();
      } while (n > 0 && running);
      // A completed pass means the connection is healthy again.
      noteReachable();
    } catch (err) {
      noteFailure(err, 'drain');
    }
    if (running) {
      timer = setTimeout(() => void loop(), dbDown ? DB_DOWN_POLL_MS : (opts.pollMs ?? 500));
    }
  }

  return {
    start() {
      if (running) return;
      running = true;
      onOutboxNotify(() => {
        drainOnce().then(noteReachable).catch((err) => noteFailure(err, 'notify'));
      });
      void loop();
    },
    async stop() {
      running = false;
      clearOutboxNotify();
      if (timer) clearTimeout(timer);
    },
    drainOnce,
  };
}
