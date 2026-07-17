// Generic session-channel machinery: persist-before-broadcast, seq as the
// single source of truth for ordering, and reconnect replay with dedupe.
//
// Both the terminal and agent subsystems depend on this module; it must never
// depend on either of them (nor on anything under apps/api/src/ai,
// apps/api/src/terminal, or apps/api/src/agent). session-core has no notion
// of a PTY, an agent run, a provider, or a table — a "frame" is whatever a
// caller wants delivered to an attached subscriber, and the only thing
// session-core ever reads off one is its `seq`.

export type SessionId = number;

// Anything session-core persists/replays must carry a seq — the load-bearing
// ordering key shared between the store and the wire. Beyond that, the frame
// shape is entirely up to the caller (terminal output, a normalized agent
// event, anything).
export interface SeqFrame {
  seq: number;
}

// Persistence a channel needs for its sequenced stream. One implementation
// per driver (terminal, agent), each over its own table — the channel itself
// never touches a table. Session lifecycle (status, cost, permissions, …) is
// deliberately NOT part of this interface: it is a driver concern, not a
// session-core one, so the driver persists it directly and uses
// `Channel.flush`/`Channel.broadcast` only for ordering and delivery.
export interface SessionStore<F extends SeqFrame = SeqFrame> {
  // Persist a batch of already-sequenced frames. Resolves once durable — a
  // channel always awaits this before broadcasting a single one of them.
  append(sessionId: SessionId, frames: F[]): Promise<void>;
  // Frames with seq > afterSeq, ascending, plus the oldest seq still stored
  // (so the channel can flag a truncated replay on reconnect) — oldestSeq is
  // null when nothing is stored for this session.
  replay(sessionId: SessionId, afterSeq: number): Promise<{ frames: F[]; oldestSeq: number | null }>;
}

// A subscriber never sees only F — it also sees the control frames the
// channel produces itself (replay_done, a truncation notice) and whatever a
// driver pushes out-of-band via `broadcast` (e.g. a status transition, which
// is an opaque string as far as session-core is concerned). Kept as
// `unknown` rather than a closed union so session-core never has to learn a
// new frame shape as drivers evolve.
export type Send = (frame: unknown) => void;

export interface Channel<F extends SeqFrame = SeqFrame> {
  // Register a subscriber for a session: replay every persisted frame after
  // lastSeq (deduped against anything broadcast mid-replay), emit a
  // truncation notice if history was pruned, send replay_done, then stream
  // subsequent publish()/broadcast() calls live. Resolves to a detach
  // function — calling it removes the subscriber and nothing else.
  attach(sessionId: SessionId, lastSeq: number, send: Send): Promise<() => void>;
  // Enqueue a frame for a session: persisted (via the store) before it
  // reaches a single subscriber, in seq order. Batched and flushed on the
  // configured schedule, or immediately via `flush`.
  publish(sessionId: SessionId, frame: F): void;
  // Deliver a frame to every currently-attached (or attaching) subscriber
  // immediately, with NO persistence and no seq bookkeeping. For frames that
  // are not part of the replayable history — a status transition, a
  // one-off notice — but that still must not be dropped for a subscriber
  // that is mid-attach (the same race `publish` protects against).
  broadcast(sessionId: SessionId, frame: unknown): void;
  // Force the pending publish() buffer to persist+broadcast now, bypassing
  // the schedule debounce. Resolves once durable and delivered.
  flush(sessionId: SessionId): Promise<void>;
}

export interface CreateChannelOptions {
  // How a scheduled flush is invoked; defaults to a short setTimeout. Tests
  // pass a synchronous function to make batching deterministic.
  schedule?: (fn: () => void) => void;
}
