import { describe, expect, it, vi } from 'vitest';
import type { Db } from '@tickets/db';
import { waitForDb } from './db-ready';

const db = {} as Db;
// The real sleep would make these tests take as long as the timeout.
const noSleep = () => Promise.resolve();

describe('waitForDb', () => {
  it('returns ok on the first successful probe', async () => {
    const probe = vi.fn().mockResolvedValue(undefined);
    const result = await waitForDb(db, { probe, sleep: noSleep, log: () => {} });

    expect(result.ok).toBe(true);
    expect(result.attempts).toBe(1);
    expect(probe).toHaveBeenCalledTimes(1);
  });

  it('rides out a transient outage and succeeds once the database returns', async () => {
    // The case that makes fail-fast safe: postgres is briefly restarting.
    const probe = vi
      .fn()
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockResolvedValue(undefined);

    const result = await waitForDb(db, {
      probe,
      sleep: noSleep,
      log: () => {},
      timeoutMs: 30_000,
      intervalMs: 1_000,
    });

    expect(result.ok).toBe(true);
    expect(result.attempts).toBe(3);
  });

  it('gives up (without throwing) when the database never comes back', async () => {
    const boom = new Error('connect ECONNREFUSED 127.0.0.1:5532');
    const probe = vi.fn().mockRejectedValue(boom);

    const result = await waitForDb(db, {
      probe,
      sleep: noSleep,
      log: () => {},
      timeoutMs: 3_000,
      intervalMs: 1_000,
    });

    expect(result.ok).toBe(false);
    expect(result.lastError).toBe(boom);
    // Bounded by the timeout rather than looping forever.
    expect(probe.mock.calls.length).toBeGreaterThan(1);
    expect(probe.mock.calls.length).toBeLessThanOrEqual(4);
  });

  it('warns only once while waiting, however many probes fail', async () => {
    const log = vi.fn();
    const probe = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));

    await waitForDb(db, { probe, sleep: noSleep, log, timeoutMs: 5_000, intervalMs: 1_000 });

    expect(log).toHaveBeenCalledTimes(1);
  });
});
