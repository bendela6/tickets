import { describe, expect, it } from 'vitest';
import * as v from 'valibot';
import { createClient } from '@bendela6/signals-core';
import type { Signal, Transport } from '@bendela6/signals-core';
// dev-only cross-package import: pulls the collector's own ingest schema into the
// node SDK's test run so every signal shape the SDK can emit is checked against
// the exact validator the collector runs at the /ingest/:key boundary. Not part
// of the published package (see src/index.ts) — test-time only, same pattern as
// e2e.test.ts's import of apps/signals/src/app.
// apps/signals is a sibling workspace package, not a dependency of signals-node,
// but the relative import resolves fine under this package's tsconfig (bundler
// module resolution) — no @ts-expect-error needed here, unlike a dynamic import.
import { IngestSignalSchema } from '../../../../apps/signals/src/routes/ingest.schema';

function capturingTransport() {
  const sent: Signal[] = [];
  const transport: Transport = {
    enqueue: (s) => { sent.push(s); },
    flush: async () => {},
    takeAll: () => sent.splice(0),
    queuedCount: () => sent.length,
    dispose: () => {},
  };
  return { transport, sent };
}

const base = {
  dsn: 'sgl://k@127.0.0.1:4640/1',
  platform: { runtime: 'node' as const, nodeVersion: process.version, hostname: 'h', pid: 1 },
  sdk: { name: '@bendela6/signals-node', version: '0.1.0' },
};

describe('wire conformance: every capture path validates against the collector IngestSignalSchema', () => {
  it('captureError with maximally-sized/edge fields', () => {
    const { transport, sent } = capturingTransport();
    const client = createClient({
      ...base,
      transport,
      release: 'r'.repeat(150),
      environment: 'e'.repeat(80),
    });
    const err = new Error('x'.repeat(6000));
    err.name = 'N'.repeat(400);
    client.setUser({ id: 'u1', email: 'a@example.com', name: 'A' });
    client.setTag('checkout', 'v2');
    client.setContext('cart', { items: 3 });
    client.addBreadcrumb({ type: 'console', timestamp: new Date().toISOString(), message: 'hi' });
    client.captureError(err, { fingerprint: 'f'.repeat(250) });

    expect(sent).toHaveLength(1);
    const result = v.safeParse(IngestSignalSchema, sent[0]);
    expect(result.success, JSON.stringify(!result.success && result.issues, null, 2)).toBe(true);
  });

  it('captureEvent with data payload', () => {
    const { transport, sent } = capturingTransport();
    const client = createClient({ ...base, transport });
    client.captureEvent('checkout.started', { items: 3, total: 42.5 });

    expect(sent).toHaveLength(1);
    const result = v.safeParse(IngestSignalSchema, sent[0]);
    expect(result.success, JSON.stringify(!result.success && result.issues, null, 2)).toBe(true);
  });

  it('captureLog', () => {
    const { transport, sent } = capturingTransport();
    const client = createClient({ ...base, transport });
    client.captureLog('cart mismatch', 'warning');

    expect(sent).toHaveLength(1);
    const result = v.safeParse(IngestSignalSchema, sent[0]);
    expect(result.success, JSON.stringify(!result.success && result.issues, null, 2)).toBe(true);
  });
});
