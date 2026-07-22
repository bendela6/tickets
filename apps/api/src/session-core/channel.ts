import { captureError } from '@bendela6/signals-node';
import type { Channel, ControlFrames, CreateChannelOptions, SeqFrame, SessionId, SessionStore } from './types';

export type { Channel, ControlFrames, CreateChannelOptions, SeqFrame, SessionId, SessionStore, Send } from './types';

// Byte-identical to what this module emitted before `controlFrames` became
// injectable (finding: session-core must not mint wire-protocol frames with
// no type-level link to a caller's own union). A caller with its own
// `ServerFrame`-shaped union overrides this via `CreateChannelOptions`.
export const defaultControlFrames: ControlFrames = {
  replayDone: () => ({ type: 'replay_done' }),
  truncated: (oldestSeq: number) => ({
    type: 'notice',
    message: `history truncated — earlier records pruned (resumes at ${oldestSeq})`,
  }),
};

// Per-session bookkeeping a channel keeps privately. None of it is driver
// state (no handle, no kind, no status) — just what's needed to buffer,
// persist-before-broadcast, and replay-with-dedupe.
interface ChannelSession<F extends SeqFrame> {
  buffer: F[];
  flushing: Promise<void> | null;
  flushScheduled: boolean;
  subscribers: Set<(frame: unknown) => void>;
  // A subscriber mid-attach: frames broadcast while its replay is still
  // loading are buffered here so nothing published during the race is lost,
  // and nothing already covered by the replay is re-sent (see `attach`).
  pending: Map<(frame: unknown) => void, unknown[]>;
}

function hasSeq(frame: unknown): frame is { seq: number } {
  return typeof frame === 'object' && frame !== null && typeof (frame as { seq?: unknown }).seq === 'number';
}

export function createChannel<F extends SeqFrame = SeqFrame>(
  store: SessionStore<F>,
  options: CreateChannelOptions = {},
): Channel<F> {
  const schedule = options.schedule ?? ((fn: () => void) => setTimeout(fn, 8));
  const controlFrames = options.controlFrames ?? defaultControlFrames;
  const sessions = new Map<SessionId, ChannelSession<F>>();

  function stateFor(sessionId: SessionId): ChannelSession<F> {
    let s = sessions.get(sessionId);
    if (!s) {
      s = { buffer: [], flushing: null, flushScheduled: false, subscribers: new Set(), pending: new Map() };
      sessions.set(sessionId, s);
    }
    return s;
  }

  function deliver(s: ChannelSession<F>, frame: unknown): void {
    for (const send of s.subscribers) send(frame);
    for (const buf of s.pending.values()) buf.push(frame);
  }

  async function flushSession(sessionId: SessionId, s: ChannelSession<F>): Promise<void> {
    s.flushScheduled = false;
    const pending = s.buffer.splice(0);
    if (pending.length === 0) return;
    // Persist BEFORE broadcast — the load-bearing invariant this module
    // exists to hold, identically for every caller.
    await store.append(sessionId, pending);
    for (const frame of pending) deliver(s, frame);
  }

  function flush(sessionId: SessionId): Promise<void> {
    const s = stateFor(sessionId);
    const run = (s.flushing ?? Promise.resolve()).then(() => flushSession(sessionId, s));
    // The stored/chained promise's catch is a SILENT guard against an
    // unhandled rejection — it does NOT capture. Capture is the caller's job:
    // an awaited driver flush reports through the driver's own try/catch (with
    // agent/terminal context); the fire-and-forget scheduled flush reports in
    // scheduleFlush below. Capturing here too would double-count every failure.
    s.flushing = run.catch(() => {});
    return run;
  }

  function scheduleFlush(sessionId: SessionId, s: ChannelSession<F>): void {
    if (s.flushScheduled) return;
    s.flushScheduled = true;
    schedule(() => {
      flush(sessionId).catch((err) =>
        captureError(err, { level: 'error', contexts: { session: { id: sessionId, phase: 'scheduled-flush' } } }),
      );
    });
  }

  return {
    publish(sessionId, frame) {
      const s = stateFor(sessionId);
      s.buffer.push(frame);
      scheduleFlush(sessionId, s);
    },

    notify(sessionId, frame) {
      deliver(stateFor(sessionId), frame);
    },

    async attach(sessionId, lastSeq, send) {
      const s = stateFor(sessionId);
      const buffered: unknown[] = [];
      s.pending.set(send, buffered);
      try {
        const { frames, oldestSeq } = await store.replay(sessionId, lastSeq);
        if (oldestSeq !== null && oldestSeq > lastSeq + 1) {
          send(controlFrames.truncated(oldestSeq));
        }
        let maxReplayed = lastSeq;
        for (const frame of frames) {
          send(frame);
          if (frame.seq > maxReplayed) maxReplayed = frame.seq;
        }
        send(controlFrames.replayDone());
        s.pending.delete(send);
        // Frames that arrived (via publish or notify) while the replay
        // above was in flight. Anything with a seq already covered by the
        // replay is a duplicate — skip it; everything else (a later seq, or
        // a seq-less out-of-band frame) is delivered exactly once, in order.
        for (const frame of buffered) {
          if (hasSeq(frame) && frame.seq <= maxReplayed) continue;
          send(frame);
        }
        s.subscribers.add(send);
      } catch (err) {
        s.pending.delete(send);
        throw err;
      }
      return () => {
        s.subscribers.delete(send);
        s.pending.delete(send);
      };
    },

    flush(sessionId) {
      return flush(sessionId);
    },

    close(sessionId) {
      sessions.delete(sessionId);
    },
  };
}
