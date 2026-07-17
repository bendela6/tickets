import { describe, expect, it } from 'vitest';
import type { AgentRun } from './agent-types';
import { createSupervisor } from './supervisor';
import type {
  AgentEvent,
  PersistedMessage,
  Runner,
  ServerFrame,
  SessionStatus,
  SessionStore,
  Subscriber,
} from './types';

// A controllable AgentRun: push events, observe send/interrupt/permission.
function makeAgentRun() {
  const events: AgentEvent[] = [];
  let notify: (() => void) | null = null;
  let ended = false;
  let interrupted = false;
  const sent: string[] = [];
  const permissionResponses: { id: string; result: string; reason?: string }[] = [];
  const wake = () => {
    const n = notify;
    notify = null;
    n?.();
  };
  const iterable = (async function* () {
    let i = 0;
    for (;;) {
      if (i < events.length) {
        yield events[i++]!;
        continue;
      }
      if (ended) return;
      await new Promise<void>((r) => (notify = r));
    }
  })();
  const run: AgentRun = {
    events: iterable,
    send: async (t) => {
      sent.push(t);
    },
    respondToPermission: async (id, result, reason) => {
      permissionResponses.push({ id, result, reason });
    },
    interrupt: async () => {
      interrupted = true;
      ended = true;
      wake();
    },
    close: () => {
      ended = true;
      wake();
    },
  };
  return {
    run,
    emit: (e: AgentEvent) => {
      events.push(e);
      wake();
    },
    end: () => {
      ended = true;
      wake();
    },
    sent,
    permissionResponses,
    get interrupted() {
      return interrupted;
    },
  };
}

function makeStore(log?: string[]) {
  const messages: PersistedMessage[] = [];
  const statuses: SessionStatus[] = [];
  const permissions: { id: number; toolName: string }[] = [];
  const decisions: { id: number; status: string; reason?: string }[] = [];
  let permId = 0;
  let cost = 0;
  const store: SessionStore = {
    async appendOutput() {},
    async loadOutputSince() {
      return { chunks: [], oldestSeq: null };
    },
    async pruneOutput() {},
    async appendMessages(_id, msgs) {
      for (const m of msgs) {
        messages.push(m);
        log?.push(`append:${m.seq}`);
      }
    },
    async loadMessagesSince(_id, afterSeq) {
      return {
        messages: messages.filter((m) => m.seq > afterSeq),
        oldestSeq: messages.length ? messages[0]!.seq : null,
      };
    },
    async setCost(_id, c) {
      cost = c;
    },
    async createPermissionRequest(_id, toolName) {
      const id = ++permId;
      permissions.push({ id, toolName });
      return id;
    },
    async decidePermissionRequest(id, status, reason) {
      decisions.push({ id, status, reason });
    },
    async markRunning() {},
    async setStatus(_id, s) {
      statuses.push(s);
    },
    async finishSession(_id, s) {
      statuses.push(s);
    },
    async reconcileOrphaned() {
      return 0;
    },
  };
  return { store, messages, statuses, permissions, decisions, getCost: () => cost };
}

const deadRunner: Runner = {
  spawnPty: () => {
    throw new Error('agent tests do not spawn a PTY');
  },
};

function makeSub(log?: string[]) {
  const frames: ServerFrame[] = [];
  const sub: Subscriber = {
    send: (f) => {
      frames.push(f);
      if (log && f.type === 'message') log.push(`send:${f.seq}`);
    },
    close: () => {},
  };
  return { sub, frames };
}

const tick = async (n = 12) => {
  for (let i = 0; i < n; i++) await Promise.resolve();
};
const syncSchedule = (fn: () => void) => fn();

const msgs = (frames: ServerFrame[]) =>
  frames.filter((f): f is Extract<ServerFrame, { type: 'message' }> => f.type === 'message');
const statusFrames = (frames: ServerFrame[]) =>
  frames.filter((f): f is Extract<ServerFrame, { type: 'status' }> => f.type === 'status');

describe('supervisor — agent sessions', () => {
  it('persists each event before broadcasting it as a message frame', async () => {
    const log: string[] = [];
    const { store } = makeStore(log);
    const agent = makeAgentRun();
    const sup = createSupervisor({ runner: deadRunner, store, schedule: syncSchedule });
    sup.startAgent({ id: 1, run: agent.run });
    const { sub } = makeSub(log);
    await sup.attach(1, sub, 0);

    agent.emit({ type: 'assistant_text', text: 'hello' });
    await tick();
    await sup.flush(1);
    await tick();

    expect(log.indexOf('append:1')).toBeGreaterThanOrEqual(0);
    expect(log.indexOf('append:1')).toBeLessThan(log.indexOf('send:1'));
  });

  it('normalizes seq and delivers message frames in order to a live client', async () => {
    const { store } = makeStore();
    const agent = makeAgentRun();
    const sup = createSupervisor({ runner: deadRunner, store, schedule: syncSchedule });
    sup.startAgent({ id: 1, run: agent.run });
    const live = makeSub();
    await sup.attach(1, live.sub, 0);

    agent.emit({ type: 'session_started', providerSessionId: 'sess_1' });
    agent.emit({ type: 'assistant_text', text: 'a' });
    agent.emit({ type: 'tool_use', id: 'tu1', name: 'Read', input: {} });
    await tick();
    await sup.flush(1);
    await tick();

    expect(msgs(live.frames).map((f) => [f.seq, f.event.type])).toEqual([
      [1, 'session_started'],
      [2, 'assistant_text'],
      [3, 'tool_use'],
    ]);
  });

  it('transitions running→idle on result and running→awaiting_input on a permission_request', async () => {
    const { store, statuses, getCost } = makeStore();
    const agent = makeAgentRun();
    const sup = createSupervisor({ runner: deadRunner, store, schedule: syncSchedule });
    sup.startAgent({ id: 1, run: agent.run });
    const { sub, frames } = makeSub();
    await sup.attach(1, sub, 0);

    agent.emit({ type: 'permission_request', id: 'p1', toolName: 'Bash', input: {} });
    await tick();
    agent.emit({ type: 'result', costUsd: 0.5, durationMs: 10, isError: false });
    await tick();
    await sup.flush(1);
    await tick();

    expect(statuses).toContain('awaiting_input');
    expect(statuses).toContain('idle');
    expect(getCost()).toBe(0.5);
    // The client saw both status frames.
    const seen = statusFrames(frames).map((f) => f.status);
    expect(seen).toContain('awaiting_input');
    expect(seen).toContain('idle');
  });

  it('enforces the budget cap: notice + interrupt once spend crosses it', async () => {
    const { store } = makeStore();
    const agent = makeAgentRun();
    const sup = createSupervisor({ runner: deadRunner, store, schedule: syncSchedule });
    sup.startAgent({ id: 1, run: agent.run, maxBudgetUsd: 1 });
    const { sub, frames } = makeSub();
    await sup.attach(1, sub, 0);

    agent.emit({ type: 'result', costUsd: 1.5, durationMs: 10, isError: false });
    await tick();
    await sup.flush(1);
    await tick();

    expect(frames.some((f) => f.type === 'notice')).toBe(true);
    expect(agent.interrupted).toBe(true);
  });

  it('prompt() sends a follow-up turn and flips the session back to running', async () => {
    const { store, statuses } = makeStore();
    const agent = makeAgentRun();
    const sup = createSupervisor({ runner: deadRunner, store, schedule: syncSchedule });
    sup.startAgent({ id: 1, run: agent.run });
    const { sub } = makeSub();
    await sup.attach(1, sub, 0);

    sup.prompt(1, 'do more');
    await tick();

    expect(agent.sent).toEqual(['do more']);
    expect(statuses).toContain('running');
  });

  it('persists a permission request and records the decision on respond (TIX-209)', async () => {
    const helper = makeStore();
    const agent = makeAgentRun();
    const sup = createSupervisor({ runner: deadRunner, store: helper.store, schedule: syncSchedule });
    sup.startAgent({ id: 1, run: agent.run });
    const { sub } = makeSub();
    await sup.attach(1, sub, 0);

    agent.emit({ type: 'permission_request', id: 'perm_1', toolName: 'Bash', input: { command: 'ls' } });
    await tick();
    await sup.flush(1);
    await tick();

    // A pending request row was created; the session is awaiting a human.
    expect(helper.permissions).toEqual([{ id: 1, toolName: 'Bash' }]);
    expect(helper.statuses).toContain('awaiting_input');

    // Approving resolves the AgentRun promise and records the decision.
    sup.respondToPermission(1, 'perm_1', 'allow', 'looks safe');
    await tick();
    expect(agent.permissionResponses).toEqual([
      { id: 'perm_1', result: 'allow', reason: 'looks safe' },
    ]);
    expect(helper.decisions).toEqual([{ id: 1, status: 'allowed', reason: 'looks safe' }]);
    expect(helper.statuses).toContain('running');
  });

  it('calls onEnd exactly once when the run finishes (worktree teardown)', async () => {
    const { store } = makeStore();
    const agent = makeAgentRun();
    const sup = createSupervisor({ runner: deadRunner, store, schedule: syncSchedule });
    let cleanups = 0;
    sup.startAgent({ id: 1, run: agent.run, onEnd: () => void cleanups++ });
    const { sub } = makeSub();
    await sup.attach(1, sub, 0);

    agent.emit({ type: 'assistant_text', text: 'done' });
    await tick();
    agent.end();
    await tick();
    await sup.flush(1);
    await tick();

    expect(cleanups).toBe(1);
  });

  it('replays exactly the missed messages, once, on reconnect', async () => {
    const { store } = makeStore();
    const agent = makeAgentRun();
    const sup = createSupervisor({ runner: deadRunner, store, schedule: syncSchedule });
    sup.startAgent({ id: 1, run: agent.run });
    const live = makeSub();
    await sup.attach(1, live.sub, 0);

    agent.emit({ type: 'assistant_text', text: 'one' }); // seq 1
    agent.emit({ type: 'assistant_text', text: 'two' }); // seq 2
    await tick();
    await sup.flush(1);
    await tick();

    const rejoin = makeSub();
    await sup.attach(1, rejoin.sub, 1);
    expect(msgs(rejoin.frames).map((f) => f.seq)).toEqual([2]);
    expect(rejoin.frames.some((f) => f.type === 'replay_done')).toBe(true);
  });
});
