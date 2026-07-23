import { randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { initSignals, type CaptureOptions, type SignalsClient } from '@bendela6/signals-node';
import type { Db } from './db/client';
import { apps } from './db/schema';
import { environment } from './environment';

// The collector's own app slug in its own `apps` table. Used both to name
// the self-registered row and — critically — by the ingest route to
// recognize the self-client's own inbound POSTs so a failure ingesting
// *those* signals is never itself captured. Capturing a self-report's own
// ingest failure would create an infinite loop: a failed self-report is
// itself a thing that could try to get self-reported. See the ingest route
// (`ingest.routes.ts`) for the call site that checks this.
export const SELF_APP_SLUG = 'signals-collector';
const SELF_APP_NAME = 'Signals Collector';

let selfClient: SignalsClient | null = null;

// Synchronous re-entrancy guard: if handling a capture somehow triggers
// another capture call within the same call stack (e.g. a bug in a future
// beforeSend hook, or a captureError call nested inside another), the inner
// call is dropped rather than recursing. This is defense-in-depth, not the
// primary anti-recursion mechanism — the SDK's own capture methods already
// catch-and-swallow internal errors, and its transport never calls back into
// application code (a failed send just logs and returns). The real
// production hazard — the self-client's own POST to /ingest failing and
// that failure trying to get self-reported — is broken structurally at the
// ingest route by skipping capture for the SELF_APP_SLUG app (see
// ingest.routes.ts), not by this flag, because that hazard is async (the
// failing POST happens on a later tick, after this flag has already been
// released).
let reporting = false;

function composeSelfDsn(ingestKey: string, appId: number): string {
  // Deliberately not `composeDsn` (dsn.ts): that helper bakes in
  // `environment.publicAddress`, the host external SDKs are told to reach
  // the collector at (may be behind nginx, a different docker network name,
  // etc. — even unreachable from inside the collector's own process). Self
  // reporting must never depend on external routing: always the loopback
  // address the server itself is listening behind.
  return `sgl://${ingestKey}@127.0.0.1:${environment.port}/${appId}`;
}

/**
 * Registers (idempotently) the collector as its own app in its own database
 * and initializes a node SDK client pointed at its own loopback port.
 *
 * Never throws: any failure (DB down, insert error, etc.) logs a single
 * console.warn and resolves `null`. The collector boots and serves normally
 * either way.
 */
export async function initSelfSignals(db: Db): Promise<SignalsClient | null> {
  if (process.env.SIGNALS_SELF_DISABLED === '1') return null;

  try {
    const ingestKey = `pub_${randomBytes(6).toString('hex')}`;
    const inserted = await db
      .insert(apps)
      .values({ name: SELF_APP_NAME, slug: SELF_APP_SLUG, ingestKey })
      .onConflictDoNothing({ target: apps.slug })
      .returning();
    let row = inserted[0];
    if (!row) {
      [row] = await db.select().from(apps).where(eq(apps.slug, SELF_APP_SLUG));
    }
    if (!row) {
      console.warn('[signals] self-monitoring: could not register or find the self app row');
      return null;
    }

    const client = initSignals({
      dsn: composeSelfDsn(row.ingestKey, row.id),
      environment: process.env.NODE_ENV ?? 'development',
      // The collector IS the ingest endpoint. Registering uncaughtException /
      // unhandledRejection handlers here risks firing mid-shutdown or
      // mid-request in ways that are hard to reason about for the one
      // process whose job is to stay up and keep accepting everyone else's
      // errors. Explicit capture calls at known failure sites (ingest
      // DB-write, symbolicate, migration runner) plus boot/shutdown events
      // give useful self-monitoring without that risk.
      registerProcessHandlers: false,
    });
    selfClient = client;
    return client;
  } catch (err) {
    console.warn('[signals] self-monitoring: init failed —', err);
    return null;
  }
}

export function getSelfSignals(): SignalsClient | null {
  return selfClient;
}

export function captureSelfError(error: unknown, options?: CaptureOptions): void {
  if (!selfClient || reporting) return;
  reporting = true;
  try {
    selfClient.captureError(error, options);
  } catch {
    // never throw — self-monitoring must never break the collector
  } finally {
    reporting = false;
  }
}

export function captureSelfEvent(name: string, data?: Record<string, unknown>): void {
  if (!selfClient || reporting) return;
  reporting = true;
  try {
    selfClient.captureEvent(name, data);
  } catch {
    // never throw
  } finally {
    reporting = false;
  }
}

export function reportBoot(port: number, env: string): void {
  captureSelfEvent('collector.boot', { port, environment: env });
}

export function reportShutdown(): void {
  captureSelfEvent('collector.shutdown');
}

// Test-only: inject a fake/spy client directly, bypassing DB registration.
export function setSelfSignalsForTest(client: SignalsClient | null): void {
  selfClient = client;
  reporting = false;
}
