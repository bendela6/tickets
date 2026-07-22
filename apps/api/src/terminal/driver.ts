import { captureError } from '@bendela6/signals-node';
import { createChannel } from '../session-core/channel';
import type { Channel, SessionStore as CoreSessionStore } from '../session-core/types';
import { createActivityScanner } from './activity-scanner';
import { integrationFor } from './shell-integration';
import type { OutputFrame, TerminalStore } from './store';
import type { PtyHandle, Runner, ServerFrame, SessionId, SessionStatus, Subscriber } from './types';

// The one stateful thing in an otherwise stateless API: a singleton holding a
// Map of live terminal sessions. It owns every child PTY process and is NOT
// coupled to any browser connection — sockets attach and detach from a
// session that outlives them, so closing the tab does not kill the process.
//
// The load-bearing invariant — a record is persisted BEFORE it is broadcast,
// `seq` is the single source of truth shared by the stored rows and the wire
// frames, and a reconnecting client is replayed exactly the frames it missed
// — lives in session-core's `Channel`. This module is the terminal-specific
// adapter around it: a PTY, a shell-integration scanner, an output cap. It
// has no notion of an agent, a provider, a message, a permission, cost, or
// dispatch — see the terminal/agent independence rule in the split plan.

export interface StartSpec {
  id: SessionId;
  command: string;
  args?: string[];
  cwd: string;
  env?: Record<string, string>;
  cols?: number;
  rows?: number;
}

export interface TerminalDriver {
  start(spec: StartSpec): void;
  // Respawn a PTY on an EXISTING (ended) session id — same record, scrollback
  // continued below a divider. Async because it resumes the output seq from the
  // persisted max before publishing.
  restart(spec: StartSpec): Promise<void>;
  attach(sessionId: SessionId, sub: Subscriber, lastSeq: number): Promise<void>;
  detach(sessionId: SessionId, sub: Subscriber): void;
  write(sessionId: SessionId, data: string): void;
  resize(sessionId: SessionId, cols: number, rows: number): void;
  interrupt(sessionId: SessionId): void; // Ctrl-C to the foreground process
  stop(sessionId: SessionId): void;
  has(sessionId: SessionId): boolean;
  flush(sessionId: SessionId): Promise<void>;
}

export interface TerminalDriverOptions {
  runner: Runner;
  store: TerminalStore;
  outputCap?: number;
  schedule?: (fn: () => void) => void;
}

interface RunningSession {
  id: SessionId;
  status: SessionStatus;
  exitCode: number | null;
  handle: PtyHandle;
  seq: number;
  subscriberDetachers: Map<Subscriber, () => void>;
  // Strips OSC 133 shell-integration markers from terminal output and turns
  // them into activity events; null when the shell has no registered
  // integration (coarse activity is not tracked in that case).
  scanner?: ReturnType<typeof createActivityScanner> | null;
  // Last known activity busy state (integrated terminals only), re-sent to a
  // client that attaches after start() so it learns the session is integrated.
  busy: boolean;
}

export function createTerminalDriver(options: TerminalDriverOptions): TerminalDriver {
  const { runner, store } = options;
  const outputCap = options.outputCap ?? 20_000;
  const sessions = new Map<SessionId, RunningSession>();

  // The session-core adapter: the store already implements append/replay
  // directly (there is only one frame kind now, so no kind-branch is
  // needed), wrapped once here to fold in output-cap pruning after each
  // flush — a driver concern (outputCap), not a session-core one.
  const channelStore: CoreSessionStore<OutputFrame> = {
    async append(sessionId, frames) {
      await store.append(sessionId, frames);
      const rs = sessions.get(sessionId);
      if (rs && rs.seq > outputCap) await store.pruneOutput(sessionId, outputCap);
    },
    replay(sessionId, afterSeq) {
      return store.replay(sessionId, afterSeq);
    },
  };

  const channel: Channel<OutputFrame> = createChannel(channelStore, { schedule: options.schedule });

  function publishOutput(rs: RunningSession, data: string): void {
    channel.publish(rs.id, { type: 'output', seq: ++rs.seq, data });
  }

  async function finish(rs: RunningSession, status: SessionStatus, exitCode: number | null): Promise<void> {
    await channel.flush(rs.id);
    rs.status = status;
    rs.exitCode = exitCode;
    await store.finishSession(rs.id, status, exitCode);
    channel.notify(rs.id, { type: 'status', status, exitCode });
  }

  function newSession(id: SessionId, handle: PtyHandle): RunningSession {
    return {
      id,
      status: 'starting',
      exitCode: null,
      handle,
      seq: 0,
      subscriberDetachers: new Map(),
      scanner: null,
      busy: false,
    };
  }

  function consume(rs: RunningSession): void {
    void (async () => {
      try {
        for await (const data of rs.handle.output) {
          let text = data;
          if (rs.scanner) {
            const { clean, event } = rs.scanner.push(data);
            text = clean;
            if (event) {
              rs.busy = event.busy;
              channel.notify(rs.id, { type: 'activity', ...event });
            }
          }
          if (text) publishOutput(rs, text);
        }
        const { exitCode } = await rs.handle.exit;
        await finish(rs, 'exited', exitCode);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        captureError(err, { level: 'error', contexts: { terminal: { sessionId: rs.id } } });
        publishOutput(rs, `\r\n[session error] ${message}\r\n`);
        await finish(rs, 'failed', null);
      }
    })();
  }

  // Spawn a PTY for `spec`, returning the handle + its shell integration, or
  // null after recording `failed` (an unresolvable command, or Windows ConPTY
  // with no attachable console). The child always inherits the api's own
  // environment (spec/integration entries override): an empty env block leaves
  // the shell without PATH/SystemRoot and makes ConPTY's CreateProcess fail
  // outright (error 87), so a bare {} must never reach the runner.
  function spawnFor(
    spec: StartSpec,
  ): { handle: PtyHandle; integ: ReturnType<typeof integrationFor> } | null {
    const integ = integrationFor(spec.command);
    const sp = integ ? integ.apply({ id: spec.id, command: spec.command, args: spec.args, env: spec.env }) : null;
    const inherited = Object.fromEntries(
      Object.entries(process.env).filter((e): e is [string, string] => e[1] !== undefined),
    );
    try {
      const handle = runner.spawnPty({
        cwd: spec.cwd,
        command: sp?.command ?? spec.command,
        args: sp?.args ?? spec.args ?? [],
        env: { ...inherited, ...(sp?.env ?? spec.env ?? {}) },
        cols: spec.cols ?? 80,
        rows: spec.rows ?? 24,
      });
      return { handle, integ };
    } catch (err) {
      // Log it — a swallowed spawn error is undebuggable — and record `failed`
      // so createSession never 500s and the row doesn't hang in `starting`.
      console.error(`terminal ${spec.id}: PTY spawn failed:`, err);
      captureError(err, { level: 'error', contexts: { terminal: { sessionId: spec.id } } });
      void store.finishSession(spec.id, 'failed', null);
      return null;
    }
  }

  // Divider written between a session's runs so restarted output reads as a
  // continuation, not a jumbled overwrite. Dim, on its own lines.
  function restartDivider(): string {
    return `\r\n\x1b[2m─── restarted ───\x1b[0m\r\n`;
  }

  return {
    start(spec) {
      const spawned = spawnFor(spec);
      if (!spawned) return;
      const rs = newSession(spec.id, spawned.handle);
      rs.status = 'live';
      rs.scanner = spawned.integ?.precise ? createActivityScanner() : null;
      sessions.set(spec.id, rs);
      void store.setStatus(spec.id, 'live');
      channel.notify(spec.id, { type: 'status', status: 'live' });
      if (spawned.integ?.precise) channel.notify(spec.id, { type: 'activity', busy: false, integrated: true });
      consume(rs);
    },

    async restart(spec) {
      // Resume seq from the persisted max so the divider + new output land
      // BELOW the existing scrollback (works whether or not the ended session
      // is still in memory — e.g. after an API restart it is not).
      const base = await store.lastSeq(spec.id);
      const prev = sessions.get(spec.id);
      const spawned = spawnFor(spec);
      if (!spawned) return;
      const rs = newSession(spec.id, spawned.handle);
      rs.seq = base;
      rs.status = 'live';
      rs.scanner = spawned.integ?.precise ? createActivityScanner() : null;
      // Carry over any still-attached subscribers so an open socket keeps
      // flowing (the client also re-attaches, so this is belt-and-suspenders).
      if (prev) rs.subscriberDetachers = prev.subscriberDetachers;
      sessions.set(spec.id, rs);
      publishOutput(rs, restartDivider());
      await store.markRestarted(spec.id);
      channel.notify(spec.id, { type: 'status', status: 'live' });
      if (spawned.integ?.precise) channel.notify(spec.id, { type: 'activity', busy: false, integrated: true });
      consume(rs);
    },

    async attach(sessionId, sub, lastSeq) {
      const rs = sessions.get(sessionId);
      if (!rs) {
        sub.send({ type: 'status', status: 'exited' });
        sub.close?.();
        return;
      }
      const send = (frame: unknown) => sub.send(frame as ServerFrame);
      const detach = await channel.attach(sessionId, lastSeq, send);
      // Current status (and integration state) is driver-owned, not part of
      // the replayable seq stream — sent directly, once channel.attach's
      // replay has resolved. See supervisor.ts's identical comment for why
      // last-write-wins converges regardless of interleaving.
      sub.send({ type: 'status', status: rs.status, exitCode: rs.exitCode });
      if (rs.scanner) sub.send({ type: 'activity', busy: rs.busy, integrated: true });
      rs.subscriberDetachers.set(sub, detach);
    },

    detach(sessionId, sub) {
      const rs = sessions.get(sessionId);
      if (!rs) return;
      const detach = rs.subscriberDetachers.get(sub);
      if (detach) {
        detach();
        rs.subscriberDetachers.delete(sub);
      }
    },

    write(sessionId, data) {
      sessions.get(sessionId)?.handle.write(data);
    },

    resize(sessionId, cols, rows) {
      sessions.get(sessionId)?.handle.resize(cols, rows);
    },

    interrupt(sessionId) {
      sessions.get(sessionId)?.handle.write('\x03');
    },

    stop(sessionId) {
      sessions.get(sessionId)?.handle.kill();
    },

    has(sessionId) {
      return sessions.has(sessionId);
    },

    flush(sessionId) {
      return sessions.has(sessionId) ? channel.flush(sessionId) : Promise.resolve();
    },
  };
}
