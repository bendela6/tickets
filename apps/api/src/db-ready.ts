import { sql } from 'drizzle-orm';
import type { Db } from '@tickets/db';

// The API is useless without postgres — every route, the outbox worker, and
// automations all hit it. Rather than boot into a broken state and emit an
// error per poll cycle forever (which is what used to happen, and which also
// flooded Signals with duplicate issues), we refuse to start.
//
// The wait matters as much as the exit: in the container supervisord restarts
// the api process but gives up permanently after a few tries, so exiting on
// the FIRST failed connection would turn a ten-second postgres blip into a
// dead API until someone noticed. Waiting rides out restarts and blips; the
// exit only fires when the database is genuinely not coming back.
export const DB_READY_TIMEOUT_MS = 30_000;
export const DB_READY_INTERVAL_MS = 1_000;

export interface WaitForDbOptions {
  timeoutMs?: number;
  intervalMs?: number;
  /** Injectable for tests; defaults to a real `select 1`. */
  probe?: (db: Db) => Promise<unknown>;
  /** Injectable for tests; defaults to setTimeout. */
  sleep?: (ms: number) => Promise<void>;
  log?: (message: string) => void;
}

const defaultProbe = (db: Db) => db.execute(sql`select 1`);
const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export interface WaitForDbResult {
  ok: boolean;
  attempts: number;
  lastError?: unknown;
}

/**
 * Deepest `cause` message. drizzle wraps the socket failure, so the outer
 * error only says "Failed query: select 1" — the useful part ("connect
 * ECONNREFUSED 127.0.0.1:5532") is further down the chain.
 */
export function rootCauseMessage(err: unknown): string {
  let current: unknown = err;
  for (let depth = 0; depth < 5; depth += 1) {
    const cause = (current as { cause?: unknown } | null)?.cause;
    if (cause == null || cause === current) break;
    current = cause;
  }
  if (current instanceof Error) return current.message;
  return String(current);
}

/**
 * Polls the database until it answers or the timeout elapses. Never throws —
 * the caller decides what an unreachable database means (server.ts exits).
 * Logs at most twice: once when the first probe fails (so a slow start isn't
 * silent), and nothing further until it either succeeds or the caller gives up.
 */
export async function waitForDb(db: Db, options: WaitForDbOptions = {}): Promise<WaitForDbResult> {
  const {
    timeoutMs = DB_READY_TIMEOUT_MS,
    intervalMs = DB_READY_INTERVAL_MS,
    probe = defaultProbe,
    sleep = defaultSleep,
    log = console.warn,
  } = options;

  // An attempt budget rather than a wall-clock deadline: the number of probes
  // is then a pure function of the options, so behaviour is identical whether
  // `sleep` really waits (production) or resolves immediately (tests).
  const maxAttempts = Math.max(1, Math.ceil(timeoutMs / intervalMs));
  let lastError: unknown;
  let warned = false;

  for (let attempts = 1; attempts <= maxAttempts; attempts += 1) {
    try {
      await probe(db);
      return { ok: true, attempts };
    } catch (err) {
      lastError = err;
      if (!warned) {
        warned = true;
        log(`[db] not reachable yet — waiting up to ${Math.round(timeoutMs / 1000)}s…`);
      }
      if (attempts < maxAttempts) await sleep(intervalMs);
    }
  }

  return { ok: false, attempts: maxAttempts, lastError };
}
