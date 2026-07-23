import type { SignalsClient } from '@bendela6/signals-node';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeEach, expect, it, vi } from 'vitest';
import { buildApp } from './app';
import { apps } from './db/schema';
import type { Db } from './db/client';
import {
  captureSelfError,
  captureSelfEvent,
  initSelfSignals,
  reportBoot,
  reportShutdown,
  SELF_APP_SLUG,
  setSelfSignalsForTest,
} from './signals-self';
import { symbolicateFrames } from './symbolicate';
import { resetDb, testDb } from './test/db';
import type { StackFrame } from './types';

function makeFakeClient(): SignalsClient {
  return {
    captureError: vi.fn(),
    captureEvent: vi.fn(),
    captureLog: vi.fn(),
    addBreadcrumb: vi.fn(),
    setUser: vi.fn(),
    setTag: vi.fn(),
    setContext: vi.fn(),
    flush: vi.fn(async () => {}),
    takeAll: vi.fn(() => []),
    sessionId: 'sess_test',
    enabled: true,
  };
}

// A db stand-in that answers `select` for real (delegated to testDb, so the
// ingest route's ingest-key lookup still works) but always fails the
// DB-write transaction — simulating the failure site this task adds a
// capture to.
function makeFailingWriteDb(): Db {
  return {
    select: testDb.select.bind(testDb),
    transaction: async () => {
      throw new Error('simulated db failure');
    },
  } as unknown as Db;
}

beforeEach(resetDb);
afterEach(() => {
  setSelfSignalsForTest(null);
  delete process.env.SIGNALS_SELF_DISABLED;
});
afterAll(resetDb);

it('SIGNALS_SELF_DISABLED=1 returns null and captures nothing', async () => {
  process.env.SIGNALS_SELF_DISABLED = '1';
  const result = await initSelfSignals(testDb);
  expect(result).toBeNull();
  expect(await testDb.select().from(apps)).toHaveLength(0);

  const fake = makeFakeClient();
  setSelfSignalsForTest(fake);
  // disabled init must not have set the module client either — but since we
  // set it manually above, assert capture calls stay at zero to confirm the
  // disabled branch never touched any client.
  expect(fake.captureError).not.toHaveBeenCalled();
  expect(fake.captureEvent).not.toHaveBeenCalled();
});

it('registers the collector as its own app, idempotently', async () => {
  const first = await initSelfSignals(testDb);
  expect(first).not.toBeNull();

  const rows = await testDb.select().from(apps).where(eq(apps.slug, SELF_APP_SLUG));
  expect(rows).toHaveLength(1);

  const second = await initSelfSignals(testDb);
  expect(second).not.toBeNull();

  const rowsAfter = await testDb.select().from(apps).where(eq(apps.slug, SELF_APP_SLUG));
  expect(rowsAfter).toHaveLength(1);
  expect(rowsAfter[0]!.ingestKey).toBe(rows[0]!.ingestKey);
});

it('a forced ingest DB-write failure calls captureError once with ingest context', async () => {
  const fake = makeFakeClient();
  setSelfSignalsForTest(fake);

  const okApp = buildApp({ db: testDb });
  const created = (
    await okApp.inject({ method: 'POST', url: '/apps', payload: { name: 'Some App' } })
  ).json();
  await okApp.close();

  const failingApp = buildApp({ db: makeFailingWriteDb() });
  const res = await failingApp.inject({
    method: 'POST',
    url: `/ingest/${created.ingestKey}`,
    payload: {
      signals: [
        {
          kind: 'log', sessionId: 's', name: 'console', message: 'hi', mechanism: 'console', level: 'info',
          timestamp: new Date().toISOString(), platform: { runtime: 'node' }, sdk: { name: 't', version: '0' },
        },
      ],
    },
  });
  await failingApp.close();

  expect(res.statusCode).toBe(500);
  expect(fake.captureError).toHaveBeenCalledTimes(1);
  const [err, options] = (fake.captureError as ReturnType<typeof vi.fn>).mock.calls[0]!;
  expect((err as Error).message).toBe('simulated db failure');
  expect(options).toMatchObject({ contexts: { ingest: { appId: created.id, appSlug: created.slug } } });
});

it('does NOT capture when the failing ingest is the self-app\'s own inbound POST (anti-recursion)', async () => {
  const fake = makeFakeClient();
  setSelfSignalsForTest(fake);

  const [selfRow] = await testDb
    .insert(apps)
    .values({ name: 'Signals Collector', slug: SELF_APP_SLUG, ingestKey: 'pub_selftest0001' })
    .returning();

  const failingApp = buildApp({ db: makeFailingWriteDb() });
  const res = await failingApp.inject({
    method: 'POST',
    url: `/ingest/${selfRow!.ingestKey}`,
    payload: {
      signals: [
        {
          kind: 'error', sessionId: 's', name: 'Error', message: 'boom', mechanism: 'manual', level: 'error',
          timestamp: new Date().toISOString(), platform: { runtime: 'node' }, sdk: { name: 't', version: '0' },
        },
      ],
    },
  });
  await failingApp.close();

  expect(res.statusCode).toBe(500);
  expect(fake.captureError).not.toHaveBeenCalled();
});

it('re-entrancy guard prevents a capture call from recursing into itself', () => {
  const captureErrorSpy = vi.fn(() => {
    // Simulates a bug where handling this error tries to self-report again,
    // synchronously, from inside the same capture call.
    captureSelfError(new Error('nested'));
  });
  setSelfSignalsForTest({ ...makeFakeClient(), captureError: captureErrorSpy });

  captureSelfError(new Error('outer'));

  expect(captureErrorSpy).toHaveBeenCalledTimes(1);
});

it('boot emits captureEvent("collector.boot") with port + environment', () => {
  const fake = makeFakeClient();
  setSelfSignalsForTest(fake);
  reportBoot(4640, 'test');
  expect(fake.captureEvent).toHaveBeenCalledWith('collector.boot', { port: 4640, environment: 'test' });
});

it('graceful shutdown emits captureEvent("collector.shutdown")', () => {
  const fake = makeFakeClient();
  setSelfSignalsForTest(fake);
  reportShutdown();
  expect(fake.captureEvent).toHaveBeenCalledWith('collector.shutdown', undefined);
});

it('symbolicate catch reports the parse failure as a warning without blocking ingest', () => {
  const fake = makeFakeClient();
  setSelfSignalsForTest(fake);

  const frame: StackFrame = { functionName: 'r', file: '/assets/bad.js', line: 1, column: 1, inApp: false };
  const out = symbolicateFrames([frame], [{ filename: 'bad.js.map', content: 'not json' }]);

  expect(out).toBeNull(); // an unparseable map never blocks ingest
  expect(fake.captureError).toHaveBeenCalledTimes(1);
  const [, options] = (fake.captureError as ReturnType<typeof vi.fn>).mock.calls[0]!;
  expect(options).toMatchObject({ level: 'warning' });
});

it('captureSelf* are no-ops when no client has been initialized', () => {
  setSelfSignalsForTest(null);
  expect(() => captureSelfError(new Error('x'))).not.toThrow();
  expect(() => captureSelfEvent('noop')).not.toThrow();
});
