import { describe, expect, it, vi } from 'vitest';
import { createChannel } from './channel';
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
});
