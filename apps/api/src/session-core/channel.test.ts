import { describe, expect, it, vi } from 'vitest';
import { createChannel, defaultControlFrames } from './channel';
import type { SessionStore } from './types';

// A fake store with no DB — session-core must be unit-testable without
// Postgres. Frames here are terminal-output-shaped, but the store/channel
// never inspect anything beyond `seq`; a driver could just as easily store
// agent-message-shaped frames through the exact same interface.
interface Frame {
  seq: number;
  data: string;
}

const fakeStore = (): SessionStore<Frame> & { rows: Frame[] } => {
  const rows: Frame[] = [];
  return {
    rows,
    append: async (_id, frames) => {
      rows.push(...frames);
    },
    replay: async (_id, afterSeq) => ({
      frames: rows.filter((r) => r.seq > afterSeq),
      oldestSeq: rows.length ? rows[0]!.seq : null,
    }),
  };
};

// A synchronous schedule makes flush timing deterministic under test — the
// same technique apps/api/src/agent/driver.test.ts and
// apps/api/src/terminal/driver.test.ts use (`syncSchedule`).
const syncSchedule = (fn: () => void) => fn();

const tick = async (n = 12) => {
  for (let i = 0; i < n; i++) await Promise.resolve();
};

const isDataFrame = (f: unknown): f is Frame =>
  typeof f === 'object' && f !== null && 'data' in f;

describe('channel', () => {
  it('replays only frames after the client last seq', async () => {
    const store = fakeStore();
    await store.append(1, [
      { seq: 1, data: 'a' },
      { seq: 2, data: 'b' },
      { seq: 3, data: 'c' },
    ]);
    const ch = createChannel(store);
    const sent: unknown[] = [];
    await ch.attach(1, 2, (f) => sent.push(f));
    expect(sent).toEqual([{ seq: 3, data: 'c' }, { type: 'replay_done' }]);
  });

  it('persists before broadcasting', async () => {
    const store = fakeStore();
    const order: string[] = [];
    // Same caveat the brief calls out: vi.spyOn(...).mockImplementation(...)
    // only works on a writable property, which a plain object literal's
    // methods are — fine here.
    const spy = vi.spyOn(store, 'append').mockImplementation(async (_id, frames) => {
      order.push('persist');
      store.rows.push(...frames);
    });
    const ch = createChannel(store);
    // Ignore replay_done — this test is about the publish() path, not attach's
    // own bookkeeping frame.
    await ch.attach(1, 0, (f) => {
      if (f && typeof f === 'object' && 'data' in f) order.push('broadcast');
    });
    ch.publish(1, { seq: 1, data: 'x' });
    await vi.waitFor(() => expect(order).toEqual(['persist', 'broadcast']));
    spy.mockRestore();
  });

  // ── Control frames are injectable (session-core must not mint wire-protocol
  // frames its callers have no type-level link to) ───────────────────────────

  it('defaults reproduce the historical replay_done / notice literals byte-for-byte', async () => {
    expect(defaultControlFrames.replayDone()).toEqual({ type: 'replay_done' });
    expect(defaultControlFrames.truncated(5)).toEqual({
      type: 'notice',
      message: 'history truncated — earlier records pruned (resumes at 5)',
    });
  });

  it('lets a caller override the control frames to match its own wire union', async () => {
    const store = fakeStore();
    await store.append(1, [{ seq: 5, data: 'e' }]); // oldest stored is 5
    const ch = createChannel(store, {
      controlFrames: {
        replayDone: () => ({ kind: 'REPLAY_DONE' }),
        truncated: (oldestSeq) => ({ kind: 'TRUNCATED', oldestSeq }),
      },
    });
    const sent: unknown[] = [];
    await ch.attach(1, 0, (f) => sent.push(f)); // lastSeq=0, oldestSeq=5 → truncated
    expect(sent).toEqual([
      { kind: 'TRUNCATED', oldestSeq: 5 },
      { seq: 5, data: 'e' },
      { kind: 'REPLAY_DONE' },
    ]);
  });

  // ── close() gives the contract a lifecycle hook (nothing deleted per-session
  // state before) ─────────────────────────────────────────────────────────────

  it('close(sessionId) drops per-session state — a previously-attached subscriber gets nothing further', async () => {
    const store = fakeStore();
    const ch = createChannel(store, { schedule: syncSchedule });
    const sent: unknown[] = [];
    await ch.attach(1, 0, (f) => sent.push(f));
    sent.length = 0; // discard replay_done from the tally

    ch.close(1);
    ch.publish(1, { seq: 1, data: 'x' }); // starts fresh per-session state
    await ch.flush(1);

    expect(sent).toEqual([]); // the old subscriber was dropped along with the state
  });

  // ── Publish racing an in-flight attach: exactly once, both orderings ───────

  it('a publish whose append lands BEFORE replay reads the store is not double-delivered', async () => {
    const rows: Frame[] = [];
    let releaseReplay!: () => void;
    const store: SessionStore<Frame> = {
      async append(_id, frames) {
        rows.push(...frames);
      },
      async replay(_id, afterSeq) {
        // The read (`rows.filter`) happens only once the test releases this
        // gate — by which point the racing publish below has already landed.
        await new Promise<void>((r) => (releaseReplay = r));
        return { frames: rows.filter((r) => r.seq > afterSeq), oldestSeq: rows.length ? rows[0]!.seq : null };
      },
    };
    const ch = createChannel(store, { schedule: syncSchedule });
    const sent: unknown[] = [];
    const attaching = ch.attach(1, 0, (f) => sent.push(f));

    ch.publish(1, { seq: 1, data: 'x' });
    await vi.waitFor(() => expect(rows).toEqual([{ seq: 1, data: 'x' }])); // append landed first
    releaseReplay();
    await attaching;

    // Without the maxReplayed dedupe check, this frame would arrive twice:
    // once from replay's `frames` (now including it) and once from the
    // pending buffer deliver() populated while attach awaited replay.
    expect(sent.filter(isDataFrame)).toEqual([{ seq: 1, data: 'x' }]);
  });

  it('a publish whose append lands AFTER replay reads the store is still delivered exactly once', async () => {
    const rows: Frame[] = [];
    let releaseReplay!: () => void;
    const store: SessionStore<Frame> = {
      async append(_id, frames) {
        rows.push(...frames);
      },
      async replay(_id, afterSeq) {
        // Snapshot immediately — models the read completing before the
        // racing publish's append lands — then hold the response open.
        const snapshot = { frames: rows.filter((r) => r.seq > afterSeq), oldestSeq: rows.length ? rows[0]!.seq : null };
        await new Promise<void>((r) => (releaseReplay = r));
        return snapshot;
      },
    };
    const ch = createChannel(store, { schedule: syncSchedule });
    const sent: unknown[] = [];
    const attaching = ch.attach(1, 0, (f) => sent.push(f));

    ch.publish(1, { seq: 1, data: 'x' }); // append lands only after the snapshot above was taken
    await tick();
    await ch.flush(1);
    releaseReplay();
    await attaching;

    // Without the pending-buffer delivery, this frame — absent from replay's
    // (stale) snapshot — would be silently dropped.
    expect(sent.filter(isDataFrame)).toEqual([{ seq: 1, data: 'x' }]);
  });

  // ── No reorder across flush boundaries ──────────────────────────────────────

  it('never lets a later frame overtake an earlier one, even when the store is slower for the earlier batch', async () => {
    const rows: Frame[] = [];
    let releaseFirstAppend!: () => void;
    let firstAppendGated = false;
    const store: SessionStore<Frame> = {
      async append(_id, frames) {
        if (!firstAppendGated) {
          firstAppendGated = true;
          await new Promise<void>((r) => (releaseFirstAppend = r));
        }
        rows.push(...frames);
      },
      async replay(_id, afterSeq) {
        return { frames: rows.filter((r) => r.seq > afterSeq), oldestSeq: rows.length ? rows[0]!.seq : null };
      },
    };
    const ch = createChannel(store, { schedule: syncSchedule });
    const sent: Frame[] = [];
    await ch.attach(1, 0, (f) => {
      if (isDataFrame(f)) sent.push(f);
    });

    ch.publish(1, { seq: 1, data: 'a' }); // triggers the slow, gated first append
    await tick();
    ch.publish(1, { seq: 2, data: 'b' }); // queued behind the still-in-flight first flush
    const settled = ch.flush(1);
    await tick();
    expect(sent).toEqual([]); // neither delivered yet — first append is still gated

    releaseFirstAppend();
    await settled;

    expect(sent).toEqual([
      { seq: 1, data: 'a' },
      { seq: 2, data: 'b' },
    ]); // always in order, never 2-before-1
  });

  // ── append rejects → the frame is not delivered to anyone ──────────────────

  it('a rejected append delivers the frame to no subscriber', async () => {
    const store: SessionStore<Frame> = {
      append: async () => {
        throw new Error('boom');
      },
      replay: async () => ({ frames: [], oldestSeq: null }),
    };
    // No auto-flush here — we drive flush() ourselves so we observe (and
    // catch) the exact rejection, rather than racing an unhandled one from
    // scheduleFlush's internal fire-and-forget `void flush(...)`.
    const ch = createChannel(store, { schedule: () => {} });
    const sent: unknown[] = [];
    await ch.attach(1, 0, (f) => sent.push(f));
    ch.publish(1, { seq: 1, data: 'x' });

    await expect(ch.flush(1)).rejects.toThrow('boom');

    expect(sent.filter(isDataFrame)).toEqual([]);
  });

  // ── detach during an in-flight append → send is never invoked afterwards ───

  it('detaching while an append is in flight prevents any further delivery to that subscriber', async () => {
    const rows: Frame[] = [];
    let releaseAppend!: () => void;
    const store: SessionStore<Frame> = {
      async append(_id, frames) {
        await new Promise<void>((r) => (releaseAppend = r));
        rows.push(...frames);
      },
      async replay(_id, afterSeq) {
        return { frames: rows.filter((r) => r.seq > afterSeq), oldestSeq: rows.length ? rows[0]!.seq : null };
      },
    };
    const ch = createChannel(store, { schedule: syncSchedule });
    const sent: unknown[] = [];
    const detach = await ch.attach(1, 0, (f) => sent.push(f));
    sent.length = 0; // discard replay_done

    ch.publish(1, { seq: 1, data: 'x' }); // triggers append, gated open
    await tick();
    detach(); // unsubscribe while the append is still in flight
    releaseAppend();
    await tick();

    expect(sent).toEqual([]); // never called again, even once the append settles
  });

  // ── Truncation notice fires exactly when oldestSeq > lastSeq + 1 ───────────

  it('sends a truncation notice when history has been pruned past the client last-seen seq', async () => {
    const store = fakeStore();
    await store.append(1, [
      { seq: 5, data: 'e' },
      { seq: 6, data: 'f' },
    ]); // oldest stored is 5
    const ch = createChannel(store);
    const sent: unknown[] = [];
    await ch.attach(1, 2, (f) => sent.push(f)); // client last saw seq 2; 5 > 2+1 → truncated
    expect(sent[0]).toEqual({
      type: 'notice',
      message: 'history truncated — earlier records pruned (resumes at 5)',
    });
  });

  it('does not send a truncation notice when nothing was pruned past the client last-seen seq', async () => {
    const store = fakeStore();
    await store.append(1, [{ seq: 1, data: 'a' }]); // oldest stored is 1
    const ch = createChannel(store);
    const sent: unknown[] = [];
    await ch.attach(1, 0, (f) => sent.push(f)); // oldestSeq=1, lastSeq=0 → 1 is not > 0+1
    expect(sent.some((f) => typeof f === 'object' && f !== null && (f as { type?: unknown }).type === 'notice')).toBe(
      false,
    );
  });
});
