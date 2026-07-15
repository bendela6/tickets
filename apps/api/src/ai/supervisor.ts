import type {
  OutputChunk,
  PtyHandle,
  Runner,
  ServerFrame,
  SessionId,
  SessionStatus,
  SessionStore,
  Subscriber,
} from './types';

// The one stateful thing in an otherwise stateless API: a singleton holding a
// Map of live sessions. It owns every child process and is NOT coupled to any
// browser connection — sockets attach and detach from a session that outlives
// them, so closing the tab does not kill the process.
//
// The load-bearing invariant: output is persisted BEFORE it is broadcast. `seq`
// is the single source of truth shared by the stored rows and the wire frames,
// so a client that has seen seq=N can always be brought current from the store
// alone. Getting this backwards makes reconnect lossy in a way that is very
// hard to see in testing — hence the dedicated unit tests.

export interface StartSpec {
  id: SessionId;
  command: string;
  args?: string[];
  cwd: string;
  env?: Record<string, string>;
  cols?: number;
  rows?: number;
}

export interface Supervisor {
  start(spec: StartSpec): void;
  attach(sessionId: SessionId, sub: Subscriber, lastSeq: number): Promise<void>;
  detach(sessionId: SessionId, sub: Subscriber): void;
  write(sessionId: SessionId, data: string): void;
  resize(sessionId: SessionId, cols: number, rows: number): void;
  stop(sessionId: SessionId): void;
  has(sessionId: SessionId): boolean;
  // Force-flush pending output (used by the exit path and integration tests).
  flush(sessionId: SessionId): Promise<void>;
}

export interface SupervisorOptions {
  runner: Runner;
  store: SessionStore;
  // Keep at most this many output chunks per session before pruning the oldest.
  outputCap?: number;
  // Batch window for coalescing PTY chunks into one persist. Injectable so tests
  // can flush deterministically (schedule that runs the callback synchronously).
  schedule?: (fn: () => void) => void;
}

interface RunningSession {
  id: SessionId;
  status: SessionStatus;
  exitCode: number | null;
  handle: PtyHandle;
  seq: number; // highest seq assigned so far
  buffer: OutputChunk[]; // sequenced-but-not-yet-persisted
  flushing: Promise<void> | null;
  flushScheduled: boolean;
  subscribers: Set<Subscriber>;
  // Attaching subscribers buffer live frames here until they've caught up on
  // replay, so no live frame is dropped during the async load.
  pending: Map<Subscriber, ServerFrame[]>;
}

export function createSupervisor(options: SupervisorOptions): Supervisor {
  const { runner, store } = options;
  const outputCap = options.outputCap ?? 20_000;
  const schedule = options.schedule ?? ((fn) => setTimeout(fn, 8));
  const sessions = new Map<SessionId, RunningSession>();

  function broadcast(rs: RunningSession, frame: ServerFrame): void {
    for (const sub of rs.subscribers) sub.send(frame);
    for (const buf of rs.pending.values()) buf.push(frame);
  }

  async function flushSession(rs: RunningSession): Promise<void> {
    rs.flushScheduled = false;
    const pending = rs.buffer.splice(0);
    if (pending.length === 0) return;
    // Persist BEFORE broadcast.
    await store.appendOutput(rs.id, pending);
    for (const chunk of pending) {
      broadcast(rs, { type: 'output', seq: chunk.seq, data: chunk.data });
    }
    if (rs.seq > outputCap) {
      await store.pruneOutput(rs.id, outputCap);
    }
  }

  // Serialize flushes so appends stay ordered and persist-before-broadcast holds.
  function flush(rs: RunningSession): Promise<void> {
    const run = (rs.flushing ?? Promise.resolve()).then(() => flushSession(rs));
    rs.flushing = run.catch(() => {});
    return run;
  }

  function scheduleFlush(rs: RunningSession): void {
    if (rs.flushScheduled) return;
    rs.flushScheduled = true;
    schedule(() => {
      void flush(rs);
    });
  }

  async function finish(
    rs: RunningSession,
    status: SessionStatus,
    exitCode: number | null,
  ): Promise<void> {
    await flush(rs); // drain any remaining output first
    rs.status = status;
    rs.exitCode = exitCode;
    await store.finishSession(rs.id, status, exitCode);
    broadcast(rs, { type: 'status', status, exitCode });
  }

  function consume(rs: RunningSession): void {
    void (async () => {
      try {
        for await (const data of rs.handle.output) {
          rs.buffer.push({ seq: ++rs.seq, data });
          scheduleFlush(rs);
        }
        const { exitCode } = await rs.handle.exit;
        await finish(rs, 'exited', exitCode);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        // Surface the failure as an output chunk so the user can read it.
        rs.buffer.push({ seq: ++rs.seq, data: `\r\n[session error] ${message}\r\n` });
        await finish(rs, 'failed', null);
      }
    })();
  }

  return {
    start(spec) {
      const handle = runner.spawnPty({
        cwd: spec.cwd,
        command: spec.command,
        args: spec.args ?? [],
        env: spec.env ?? {},
        cols: spec.cols ?? 80,
        rows: spec.rows ?? 24,
      });
      const rs: RunningSession = {
        id: spec.id,
        status: 'running',
        exitCode: null,
        handle,
        seq: 0,
        buffer: [],
        flushing: null,
        flushScheduled: false,
        subscribers: new Set(),
        pending: new Map(),
      };
      sessions.set(spec.id, rs);
      void store.markRunning(spec.id);
      broadcast(rs, { type: 'status', status: 'running' });
      consume(rs);
    },

    async attach(sessionId, sub, lastSeq) {
      const rs = sessions.get(sessionId);
      if (!rs) {
        // Unknown or evicted session: tell the client it's over, don't hang.
        sub.send({ type: 'status', status: 'exited' });
        sub.close?.();
        return;
      }
      // Buffer live frames for this subscriber during the async replay load.
      const buffered: ServerFrame[] = [];
      rs.pending.set(sub, buffered);
      try {
        const { chunks, oldestSeq } = await store.loadOutputSince(sessionId, lastSeq);
        if (oldestSeq !== null && oldestSeq > lastSeq + 1) {
          sub.send({
            type: 'notice',
            message: `scrollback truncated — earlier output pruned (resumes at ${oldestSeq})`,
          });
        }
        let maxReplayed = lastSeq;
        for (const chunk of chunks) {
          sub.send({ type: 'output', seq: chunk.seq, data: chunk.data });
          if (chunk.seq > maxReplayed) maxReplayed = chunk.seq;
        }
        sub.send({ type: 'replay_done' });
        sub.send({ type: 'status', status: rs.status, exitCode: rs.exitCode });
        // Promote to live, replaying buffered frames not already covered.
        // No await between here and subscribers.add, so no frame can slip past.
        rs.pending.delete(sub);
        for (const frame of buffered) {
          if (frame.type === 'output' && frame.seq <= maxReplayed) continue;
          sub.send(frame);
        }
        rs.subscribers.add(sub);
      } catch (err) {
        rs.pending.delete(sub);
        throw err;
      }
    },

    detach(sessionId, sub) {
      const rs = sessions.get(sessionId);
      if (!rs) return;
      rs.subscribers.delete(sub);
      rs.pending.delete(sub);
      // Deliberately does NOT kill the process — the session outlives the socket.
    },

    write(sessionId, data) {
      sessions.get(sessionId)?.handle.write(data);
    },

    resize(sessionId, cols, rows) {
      sessions.get(sessionId)?.handle.resize(cols, rows);
    },

    stop(sessionId) {
      sessions.get(sessionId)?.handle.kill();
      // The consume loop's exit handler finalizes status.
    },

    has(sessionId) {
      return sessions.has(sessionId);
    },

    flush(sessionId) {
      const rs = sessions.get(sessionId);
      return rs ? flush(rs) : Promise.resolve();
    },
  };
}
