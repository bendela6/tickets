import { describe, expect, it, vi } from 'vitest';
import { createTerminalDriver } from './driver';
import type { OutputFrame, TerminalStore } from './store';
import type { PtyHandle, ServerFrame, Subscriber } from './types';

const captureError = vi.fn();
vi.mock('@bendela6/signals-node', () => ({ getClient: () => ({ captureError }) }));

// ── Fakes ────────────────────────────────────────────────────────────────────

// A controllable PTY: push output, end with an exit code, observe kill().
function makePty() {
  const chunks: string[] = [];
  let notify: (() => void) | null = null;
  let ended = false;
  let killed = false;
  let resolveExit!: (v: { exitCode: number | null }) => void;
  const exit = new Promise<{ exitCode: number | null }>((r) => (resolveExit = r));

  const wake = () => {
    const n = notify;
    notify = null;
    n?.();
  };

  const output = (async function* () {
    let i = 0;
    for (;;) {
      if (i < chunks.length) {
        yield chunks[i++]!;
        continue;
      }
      if (ended) return;
      await new Promise<void>((r) => (notify = r));
    }
  })();

  const handle: PtyHandle = {
    output,
    exit,
    write: () => {},
    resize: () => {},
    kill: () => {
      killed = true;
      ended = true;
      wake();
      resolveExit({ exitCode: 130 });
    },
  };

  return {
    handle,
    push: (d: string) => {
      chunks.push(d);
      wake();
    },
    end: (code: number | null = 0) => {
      ended = true;
      wake();
      resolveExit({ exitCode: code });
    },
    get killed() {
      return killed;
    },
  };
}

// In-memory store. `log` records append/send interleaving; loadGate lets a
// test hold replay() open to exercise the reconnect race.
function makeStore(log?: string[]) {
  const out: OutputFrame[] = [];
  const finished: { status: string; exitCode: number | null }[] = [];
  const statuses: string[] = [];
  let loadGate: Promise<void> | null = null;
  const store: TerminalStore = {
    async append(_id, frames) {
      for (const f of frames) {
        out.push(f);
        log?.push(`append:${f.seq}`);
      }
    },
    async replay(_id, afterSeq) {
      if (loadGate) await loadGate;
      return {
        frames: out.filter((f) => f.seq > afterSeq),
        oldestSeq: out.length ? out[0]!.seq : null,
      };
    },
    async pruneOutput(_id, keep) {
      if (out.length > keep) out.splice(0, out.length - keep);
    },
    async lastSeq(_id) {
      return out.length ? Math.max(...out.map((f) => f.seq)) : 0;
    },
    async setStatus(_id, status) {
      statuses.push(status);
    },
    async markRestarted(_id) {
      statuses.push('restarted');
    },
    async finishSession(_id, status, exitCode) {
      finished.push({ status, exitCode });
    },
    async reconcileOrphaned() {
      return 0;
    },
  };
  return {
    store,
    out,
    finished,
    statuses,
    setLoadGate: (p: Promise<void> | null) => (loadGate = p),
  };
}

function makeSub(log?: string[]) {
  const frames: ServerFrame[] = [];
  const sub: Subscriber = {
    send: (f) => {
      frames.push(f);
      if (log && f.type === 'output') log.push(`send:${f.seq}`);
    },
    close: () => {},
  };
  return { sub, frames };
}

const tick = async (n = 12) => {
  for (let i = 0; i < n; i++) await Promise.resolve();
};

// Run flushes synchronously so a single settle() drains the pipeline.
const syncSchedule = (fn: () => void) => fn();

function outputs(frames: ServerFrame[]): number[] {
  return frames.filter((f): f is Extract<ServerFrame, { type: 'output' }> => f.type === 'output').map((f) => f.seq);
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('terminal driver', () => {
  it('persists every chunk before broadcasting it', async () => {
    const log: string[] = [];
    const { store } = makeStore(log);
    const pty = makePty();
    const drv = createTerminalDriver({
      runner: { spawnPty: () => pty.handle },
      store,
      schedule: syncSchedule,
    });
    drv.start({ id: 1, command: 'sh', cwd: '/w' });
    const { sub } = makeSub(log);
    await drv.attach(1, sub, 0);

    pty.push('a');
    pty.push('b');
    await tick();
    await drv.flush(1);
    await tick();

    // Every send is preceded by its append.
    const appendIdx = (seq: number) => log.indexOf(`append:${seq}`);
    const sendIdx = (seq: number) => log.indexOf(`send:${seq}`);
    expect(appendIdx(1)).toBeGreaterThanOrEqual(0);
    expect(sendIdx(1)).toBeGreaterThanOrEqual(0);
    expect(appendIdx(1)).toBeLessThan(sendIdx(1));
    expect(appendIdx(2)).toBeLessThan(sendIdx(2));
  });

  it('re-sends integrated activity to a client that attaches after start', async () => {
    const { store } = makeStore();
    const pty = makePty();
    const drv = createTerminalDriver({ runner: { spawnPty: () => pty.handle }, store, schedule: syncSchedule });
    drv.start({ id: 1, command: 'powershell.exe', cwd: '/w' }); // pwsh → precise integration
    const { sub, frames } = makeSub();
    await drv.attach(1, sub, 0);
    expect(frames).toContainEqual(expect.objectContaining({ type: 'activity', integrated: true }));
  });

  it('marks a terminal failed instead of throwing when the PTY cannot spawn, and captures it to Signals', async () => {
    captureError.mockClear();
    const { store, finished } = makeStore();
    const drv = createTerminalDriver({
      runner: {
        spawnPty: () => {
          throw new Error('Cannot create process, error code: 87');
        },
      },
      store,
      schedule: syncSchedule,
    });
    // A spawn failure must not bubble out of start() (createSession would 500).
    expect(() => drv.start({ id: 1, command: 'nope', cwd: '/w' })).not.toThrow();
    await tick();
    expect(finished).toContainEqual({ status: 'failed', exitCode: null });
    expect(captureError).toHaveBeenCalledWith(
      expect.any(Error),
      { level: 'error', contexts: { terminal: { sessionId: 1 } } },
    );
  });

  it('spawns the PTY with the api process environment inherited (never an empty env)', () => {
    const { store } = makeStore();
    const pty = makePty();
    let seenEnv: Record<string, string> | undefined;
    const drv = createTerminalDriver({
      runner: {
        spawnPty: (spec) => {
          seenEnv = spec.env;
          return pty.handle;
        },
      },
      store,
      schedule: syncSchedule,
    });

    // powershell.exe routes through the pwsh integration — the path that used
    // to collapse env to {} and make Windows ConPTY CreateProcess fail (87).
    drv.start({ id: 1, command: 'powershell.exe', cwd: '/w' });
    expect(seenEnv).toBeDefined();
    const keys = Object.keys(seenEnv!).map((k) => k.toUpperCase());
    expect(keys).toContain('PATH');

    // A shell with no integration must inherit too.
    seenEnv = undefined;
    drv.start({ id: 2, command: 'unintegrated-shell', cwd: '/w' });
    expect(Object.keys(seenEnv ?? {}).map((k) => k.toUpperCase())).toContain('PATH');
  });

  it('restart respawns on the same id, resumes seq after the old scrollback, and marks the row live again', async () => {
    const { store, out, statuses } = makeStore();
    let spawnCount = 0;
    const drv = createTerminalDriver({
      runner: {
        spawnPty: () => {
          spawnCount++;
          return makePty().handle;
        },
      },
      store,
      schedule: syncSchedule,
    });

    // First run produces some scrollback, then ends.
    drv.start({ id: 1, command: 'sh', cwd: '/w' });
    const sub = makeSub();
    await drv.attach(1, sub.sub, 0);
    // Manually seed two persisted frames as the prior run's scrollback.
    out.push({ type: 'output', seq: 1, data: 'old-1' }, { type: 'output', seq: 2, data: 'old-2' });

    await drv.restart({ id: 1, command: 'sh', cwd: '/w' });
    await tick();
    await drv.flush(1);
    await tick();

    // A second PTY was spawned for the same id.
    expect(spawnCount).toBe(2);
    // The divider was appended AFTER the old scrollback (seq 3, not a collision).
    const dividerFrame = out.find((f) => f.data.includes('restarted'));
    expect(dividerFrame?.seq).toBe(3);
    // The row was flipped back to live via markRestarted (not a fresh setStatus only).
    expect(statuses).toContain('restarted');
  });

  it('assigns monotonic seq and replays missed output in order on reconnect', async () => {
    const { store } = makeStore();
    const pty = makePty();
    const drv = createTerminalDriver({ runner: { spawnPty: () => pty.handle }, store, schedule: syncSchedule });
    drv.start({ id: 1, command: 'sh', cwd: '/w' });

    const live = makeSub();
    await drv.attach(1, live.sub, 0);
    pty.push('a'); // seq 1
    pty.push('b'); // seq 2
    pty.push('c'); // seq 3
    await tick();
    await drv.flush(1);
    await tick();
    expect(outputs(live.frames)).toEqual([1, 2, 3]);

    // A second client reconnects having seen up to seq 1.
    const rejoin = makeSub();
    await drv.attach(1, rejoin.sub, 1);
    expect(outputs(rejoin.frames)).toEqual([2, 3]); // exactly the missed ones, once, in order
    expect(rejoin.frames.some((f) => f.type === 'replay_done')).toBe(true);
  });

  it('does not drop a live frame that arrives during replay, and never duplicates', async () => {
    const helper = makeStore();
    const pty = makePty();
    const drv = createTerminalDriver({ runner: { spawnPty: () => pty.handle }, store: helper.store, schedule: syncSchedule });
    drv.start({ id: 1, command: 'sh', cwd: '/w' });
    pty.push('a'); // seq 1
    await tick();
    await drv.flush(1);

    // Hold replay() open, attach, push a live chunk during the load, then release.
    let release!: () => void;
    helper.setLoadGate(new Promise<void>((r) => (release = r)));
    const late = makeSub();
    const attaching = drv.attach(1, late.sub, 0);
    pty.push('b'); // seq 2 — broadcast while replay is mid-load
    await tick();
    await drv.flush(1);
    helper.setLoadGate(null);
    release();
    await attaching;
    await tick();

    // Sees 1 (replayed) and 2 (buffered live), each exactly once, in order.
    expect(outputs(late.frames)).toEqual([1, 2]);
  });

  it('a started terminal persists and broadcasts live (never running/idle)', async () => {
    const helper = makeStore();
    const pty = makePty();
    const drv = createTerminalDriver({ runner: { spawnPty: () => pty.handle }, store: helper.store, schedule: syncSchedule });
    drv.start({ id: 1, command: 'sh', cwd: '/w' });

    expect(helper.statuses).toContain('live');
    expect(helper.statuses).not.toContain('running');

    const { sub, frames } = makeSub();
    await drv.attach(1, sub, 0);
    const status = frames.find((f) => f.type === 'status');
    expect(status).toEqual({ type: 'status', status: 'live', exitCode: null });
  });

  it('detach removes the subscriber but does NOT kill the process', async () => {
    const { store } = makeStore();
    const pty = makePty();
    const drv = createTerminalDriver({ runner: { spawnPty: () => pty.handle }, store, schedule: syncSchedule });
    drv.start({ id: 1, command: 'sh', cwd: '/w' });
    const { sub, frames } = makeSub();
    await drv.attach(1, sub, 0);

    drv.detach(1, sub);
    pty.push('after-detach'); // seq 1
    await tick();
    await drv.flush(1);
    await tick();

    expect(outputs(frames)).toEqual([]); // detached: received nothing new
    expect(pty.killed).toBe(false); // process untouched
    expect(drv.has(1)).toBe(true); // session outlives the socket
  });

  it('on exit sets status + code, and the scrollback stays replayable', async () => {
    const helper = makeStore();
    const pty = makePty();
    const drv = createTerminalDriver({ runner: { spawnPty: () => pty.handle }, store: helper.store, schedule: syncSchedule });
    drv.start({ id: 1, command: 'sh', cwd: '/w' });
    pty.push('done'); // seq 1
    await tick();
    pty.end(1); // exit code 1
    await tick();
    await drv.flush(1);
    await tick();

    expect(helper.finished).toContainEqual({ status: 'exited', exitCode: 1 });

    // Reopen after exit: replay + final status.
    const reopen = makeSub();
    await drv.attach(1, reopen.sub, 0);
    expect(outputs(reopen.frames)).toEqual([1]);
    const status = reopen.frames.find((f) => f.type === 'status');
    expect(status).toEqual({ type: 'status', status: 'exited', exitCode: 1 });
  });

  it('killing a session (stop) reports exited via the same exit path', async () => {
    const helper = makeStore();
    const pty = makePty();
    const drv = createTerminalDriver({ runner: { spawnPty: () => pty.handle }, store: helper.store, schedule: syncSchedule });
    drv.start({ id: 1, command: 'sh', cwd: '/w' });
    drv.stop(1);
    await tick();
    await drv.flush(1);
    await tick();
    expect(pty.killed).toBe(true);
    expect(helper.finished).toContainEqual({ status: 'exited', exitCode: 130 });
  });

  it('prunes past the output cap and flags truncated scrollback on replay', async () => {
    const helper = makeStore();
    const pty = makePty();
    const drv = createTerminalDriver({
      runner: { spawnPty: () => pty.handle },
      store: helper.store,
      schedule: syncSchedule,
      outputCap: 2,
    });
    drv.start({ id: 1, command: 'sh', cwd: '/w' });
    pty.push('a'); // 1
    pty.push('b'); // 2
    pty.push('c'); // 3 → seq 3 > cap 2 → prune oldest
    await tick();
    await drv.flush(1);
    await tick();

    expect(helper.out.map((c) => c.seq)).toEqual([2, 3]); // seq 1 pruned

    const late = makeSub();
    await drv.attach(1, late.sub, 0);
    expect(late.frames.some((f) => f.type === 'notice')).toBe(true); // truncation notice
    expect(outputs(late.frames)).toEqual([2, 3]);
  });

  it('emits activity (busy+command+exit) from OSC 133 and strips markers', async () => {
    const { store } = makeStore();
    const pty = makePty();
    const drv = createTerminalDriver({ runner: { spawnPty: () => pty.handle }, store, schedule: syncSchedule });
    drv.start({ id: 1, command: 'powershell.exe', cwd: '/w' });
    const { sub, frames } = makeSub();
    await drv.attach(1, sub, 0);
    pty.push('o\x1b]133;C;npm test\x1b\\');
    pty.push('\x1b]133;D;2\x1b\\p');
    await tick();
    await drv.flush(1);
    await tick();
    const acts = frames.filter((f) => f.type === 'activity');
    expect(acts).toEqual(expect.arrayContaining([
      expect.objectContaining({ busy: true, command: 'npm test' }),
      expect.objectContaining({ busy: false, exitCode: 2 }),
    ]));
    const out = frames.filter((f) => f.type === 'output').map((f) => f.data).join('');
    expect(out).not.toMatch(/133/);
    expect(out).toContain('o');
    expect(out).toContain('p');
  });

  it('emits no output frame (and does not bump seq) for a chunk that is entirely a marker', async () => {
    const { store } = makeStore();
    const pty = makePty();
    const drv = createTerminalDriver({ runner: { spawnPty: () => pty.handle }, store, schedule: syncSchedule });
    drv.start({ id: 1, command: 'powershell.exe', cwd: '/w' });
    const { sub, frames } = makeSub();
    await drv.attach(1, sub, 0);
    pty.push('\x1b]133;C\x1b\\');
    await tick();
    await drv.flush(1);
    await tick();
    const acts = frames.filter((f) => f.type === 'activity');
    expect(acts).toEqual(expect.arrayContaining([expect.objectContaining({ busy: true })]));
    expect(outputs(frames)).toEqual([]);
  });
});
