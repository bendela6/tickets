import { describe, expect, it } from 'vitest';
import { createSupervisor } from './supervisor';
import type { OutputChunk, PtyHandle, ServerFrame, SessionStore, Subscriber } from './types';

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

// In-memory store. `log` records append/send interleaving; loadGate lets a test
// hold loadOutputSince open to exercise the reconnect race.
function makeStore(log?: string[]) {
  const out: OutputChunk[] = [];
  const finished: { status: string; exitCode: number | null }[] = [];
  let loadGate: Promise<void> | null = null;
  const store: SessionStore = {
    async appendOutput(_id, chunks) {
      for (const c of chunks) {
        out.push(c);
        log?.push(`append:${c.seq}`);
      }
    },
    async loadOutputSince(_id, afterSeq) {
      if (loadGate) await loadGate;
      return {
        chunks: out.filter((c) => c.seq > afterSeq),
        oldestSeq: out.length ? out[0]!.seq : null,
      };
    },
    async pruneOutput(_id, keep) {
      if (out.length > keep) out.splice(0, out.length - keep);
    },
    async markRunning() {},
    async finishSession(_id, status, exitCode) {
      finished.push({ status, exitCode });
    },
  };
  return {
    store,
    out,
    finished,
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

describe('supervisor', () => {
  it('persists every chunk before broadcasting it', async () => {
    const log: string[] = [];
    const { store } = makeStore(log);
    const pty = makePty();
    const sup = createSupervisor({
      runner: { spawnPty: () => pty.handle },
      store,
      schedule: syncSchedule,
    });
    sup.start({ id: 1, command: 'sh', cwd: '/w' });
    const { sub } = makeSub(log);
    await sup.attach(1, sub, 0);

    pty.push('a');
    pty.push('b');
    await tick();
    await sup.flush(1);
    await tick();

    // Every send is preceded by its append.
    const appendIdx = (seq: number) => log.indexOf(`append:${seq}`);
    const sendIdx = (seq: number) => log.indexOf(`send:${seq}`);
    expect(appendIdx(1)).toBeGreaterThanOrEqual(0);
    expect(sendIdx(1)).toBeGreaterThanOrEqual(0);
    expect(appendIdx(1)).toBeLessThan(sendIdx(1));
    expect(appendIdx(2)).toBeLessThan(sendIdx(2));
  });

  it('assigns monotonic seq and replays missed output in order on reconnect', async () => {
    const { store } = makeStore();
    const pty = makePty();
    const sup = createSupervisor({ runner: { spawnPty: () => pty.handle }, store, schedule: syncSchedule });
    sup.start({ id: 1, command: 'sh', cwd: '/w' });

    const live = makeSub();
    await sup.attach(1, live.sub, 0);
    pty.push('a'); // seq 1
    pty.push('b'); // seq 2
    pty.push('c'); // seq 3
    await tick();
    await sup.flush(1);
    await tick();
    expect(outputs(live.frames)).toEqual([1, 2, 3]);

    // A second client reconnects having seen up to seq 1.
    const rejoin = makeSub();
    await sup.attach(1, rejoin.sub, 1);
    expect(outputs(rejoin.frames)).toEqual([2, 3]); // exactly the missed ones, once, in order
    expect(rejoin.frames.some((f) => f.type === 'replay_done')).toBe(true);
  });

  it('does not drop a live frame that arrives during replay, and never duplicates', async () => {
    const helper = makeStore();
    const pty = makePty();
    const sup = createSupervisor({ runner: { spawnPty: () => pty.handle }, store: helper.store, schedule: syncSchedule });
    sup.start({ id: 1, command: 'sh', cwd: '/w' });
    pty.push('a'); // seq 1
    await tick();
    await sup.flush(1);

    // Hold loadOutputSince open, attach, push a live chunk during the load, then release.
    let release!: () => void;
    helper.setLoadGate(new Promise<void>((r) => (release = r)));
    const late = makeSub();
    const attaching = sup.attach(1, late.sub, 0);
    pty.push('b'); // seq 2 — broadcast while replay is mid-load
    await tick();
    await sup.flush(1);
    helper.setLoadGate(null);
    release();
    await attaching;
    await tick();

    // Sees 1 (replayed) and 2 (buffered live), each exactly once, in order.
    expect(outputs(late.frames)).toEqual([1, 2]);
  });

  it('detach removes the subscriber but does NOT kill the process', async () => {
    const { store } = makeStore();
    const pty = makePty();
    const sup = createSupervisor({ runner: { spawnPty: () => pty.handle }, store, schedule: syncSchedule });
    sup.start({ id: 1, command: 'sh', cwd: '/w' });
    const { sub, frames } = makeSub();
    await sup.attach(1, sub, 0);

    sup.detach(1, sub);
    pty.push('after-detach'); // seq 1
    await tick();
    await sup.flush(1);
    await tick();

    expect(outputs(frames)).toEqual([]); // detached: received nothing new
    expect(pty.killed).toBe(false); // process untouched
    expect(sup.has(1)).toBe(true); // session outlives the socket
  });

  it('on exit sets status + code, and the scrollback stays replayable', async () => {
    const helper = makeStore();
    const pty = makePty();
    const sup = createSupervisor({ runner: { spawnPty: () => pty.handle }, store: helper.store, schedule: syncSchedule });
    sup.start({ id: 1, command: 'sh', cwd: '/w' });
    pty.push('done'); // seq 1
    await tick();
    pty.end(1); // exit code 1
    await tick();
    await sup.flush(1);
    await tick();

    expect(helper.finished).toContainEqual({ status: 'exited', exitCode: 1 });

    // Reopen after exit: replay + final status.
    const reopen = makeSub();
    await sup.attach(1, reopen.sub, 0);
    expect(outputs(reopen.frames)).toEqual([1]);
    const status = reopen.frames.find((f) => f.type === 'status');
    expect(status).toEqual({ type: 'status', status: 'exited', exitCode: 1 });
  });

  it('prunes past the output cap and flags truncated scrollback on replay', async () => {
    const helper = makeStore();
    const pty = makePty();
    const sup = createSupervisor({
      runner: { spawnPty: () => pty.handle },
      store: helper.store,
      schedule: syncSchedule,
      outputCap: 2,
    });
    sup.start({ id: 1, command: 'sh', cwd: '/w' });
    pty.push('a'); // 1
    pty.push('b'); // 2
    pty.push('c'); // 3 → seq 3 > cap 2 → prune oldest
    await tick();
    await sup.flush(1);
    await tick();

    expect(helper.out.map((c) => c.seq)).toEqual([2, 3]); // seq 1 pruned

    const late = makeSub();
    await sup.attach(1, late.sub, 0);
    expect(late.frames.some((f) => f.type === 'notice')).toBe(true); // truncation notice
    expect(outputs(late.frames)).toEqual([2, 3]);
  });
});
