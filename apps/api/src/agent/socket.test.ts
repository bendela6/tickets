import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import type { AddressInfo } from 'node:net';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { Db } from '@tickets/db';
import { environment } from '@tickets/db';
import { buildApp } from '../app';
import { createAgentDriver } from './driver';
import { createAgentStore } from './store';
import { createProviderRegistry } from './provider-registry';
import type { AgentEvent, ServerFrame } from './types';
import type { AgentRun } from './agent-types';

// The crux integration test for the agent split: a REAL listening server, a
// REAL WebSocket client, the REAL driver + REAL Postgres store — only the
// provider is faked (a controllable AgentRun), so message seq numbering, DB
// persistence, WS transport, and reconnect-and-replay are all exercised end
// to end without an API key or a spawned subprocess.
const { host, port, user, password } = environment.postgres;
const dbName = `tozf_agent_socket_test_${process.pid}_${Date.now()}`;
const adminUrl = `postgres://${user}:${password}@${host}:${port}/postgres`;
const scratchUrl = `postgres://${user}:${password}@${host}:${port}/${dbName}`;

let scratchSql: ReturnType<typeof postgres>;
let db: Db;
let app: FastifyInstance;
let baseUrl: string;

// A controllable AgentRun: push events, observe close.
function makeAgentRun() {
  const events: AgentEvent[] = [];
  let notify: (() => void) | null = null;
  let ended = false;
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
    send: async () => {},
    respondToPermission: async () => {},
    interrupt: async () => {
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
    push: (e: AgentEvent) => {
      events.push(e);
      wake();
    },
  };
}

// Captures each started run so the test can drive the (single) session's events.
const runs: ReturnType<typeof makeAgentRun>[] = [];
const providers = createProviderRegistry([
  {
    key: 'claude',
    models: () => [{ id: 'claude-opus-4-8', label: 'Opus', contextWindow: 1_000_000 }],
    capabilities: { permissions: true, resume: true, mcp: true, subagents: true },
    start: () => {
      const r = makeAgentRun();
      runs.push(r);
      return r.run;
    },
  },
]);

// ── ws client helpers (global WebSocket, Node 22+) ───────────────────────────

interface Client {
  ws: WebSocket;
  frames: ServerFrame[];
  closeCode: () => number | undefined;
}

function connect(id: number): Promise<Client> {
  const ws = new WebSocket(`${baseUrl}/api/agent/sessions/${id}/socket`);
  const frames: ServerFrame[] = [];
  let code: number | undefined;
  ws.addEventListener('message', (ev) => frames.push(JSON.parse(String(ev.data)) as ServerFrame));
  ws.addEventListener('close', (ev) => (code = ev.code));
  return new Promise((res, rej) => {
    ws.addEventListener('open', () => res({ ws, frames, closeCode: () => code }));
    ws.addEventListener('error', () => rej(new Error('ws connection failed')));
  });
}

function waitFor(check: () => boolean, timeoutMs = 3000): Promise<void> {
  const started = Date.now();
  return new Promise((res, rej) => {
    const tick = () => {
      if (check()) return res();
      if (Date.now() - started > timeoutMs) return rej(new Error('waitFor timed out'));
      setTimeout(tick, 10);
    };
    tick();
  });
}

const msgs = (frames: ServerFrame[]) =>
  frames.filter((f): f is Extract<ServerFrame, { type: 'message' }> => f.type === 'message');

async function createSession(): Promise<number> {
  const wd = await app.inject({
    method: 'POST',
    url: '/api/workdirs',
    payload: { name: `wd-${Date.now()}-${Math.random()}`, path: tmpdir() },
  });
  const agent = await app.inject({
    method: 'POST',
    url: '/api/agent/agents',
    payload: {
      key: `agent-${Date.now()}-${Math.random()}`,
      name: 'Socket Test Agent',
      providerKey: 'claude',
      model: 'claude-opus-4-8',
      defaultWorkdirId: wd.json().id,
    },
  });
  const res = await app.inject({
    method: 'POST',
    url: '/api/agent/sessions',
    payload: { agentId: agent.json().id },
  });
  return res.json().id;
}

beforeAll(async () => {
  const admin = postgres(adminUrl, { max: 1 });
  await admin.unsafe(`DROP DATABASE IF EXISTS "${dbName}"`);
  await admin.unsafe(`CREATE DATABASE "${dbName}"`);
  await admin.end();

  scratchSql = postgres(scratchUrl, { max: 1 });
  db = drizzle(scratchSql) as unknown as Db;
  await migrate(db, {
    migrationsFolder: resolve(import.meta.dirname, '../../../../packages/db/drizzle'),
  });

  const driver = createAgentDriver({ store: createAgentStore(db) });
  app = buildApp({ db, agentDriver: driver, providers });
  await app.listen({ port: 0, host: '127.0.0.1' });
  const addr = app.server.address() as AddressInfo;
  baseUrl = `ws://127.0.0.1:${addr.port}`;
}, 30_000);

afterAll(async () => {
  await app?.close();
  await scratchSql?.end();
  const admin = postgres(adminUrl, { max: 1 });
  await admin.unsafe(`DROP DATABASE IF EXISTS "${dbName}"`);
  await admin.end();
});

describe('agent session socket', () => {
  test('reconnect replays exactly the missed messages, in order, with no duplicates', async () => {
    const id = await createSession();
    const run = runs.at(-1)!;

    const c1 = await connect(id);
    c1.ws.send(JSON.stringify({ type: 'attach', lastSeq: 0 }));
    await waitFor(() => c1.frames.some((f) => f.type === 'replay_done'));

    run.push({ type: 'assistant_text', text: 'AAA' }); // seq 1
    await waitFor(() => msgs(c1.frames).length >= 1);
    run.push({ type: 'assistant_text', text: 'BBB' }); // seq 2
    await waitFor(() => msgs(c1.frames).length >= 2);

    expect(msgs(c1.frames).map((f) => f.seq)).toEqual([1, 2]);

    // Drop the connection (tab closed) — the run must keep going.
    c1.ws.close();
    await waitFor(() => c1.ws.readyState === c1.ws.CLOSED);

    // Reconnect having seen up to seq 1: expect ONLY seq 2 replayed, exactly once.
    const c2 = await connect(id);
    c2.ws.send(JSON.stringify({ type: 'attach', lastSeq: 1 }));
    await waitFor(() => c2.frames.some((f) => f.type === 'replay_done'));

    expect(msgs(c2.frames).map((f) => f.seq)).toEqual([2]);

    // And live messages continue to flow to the reconnected client.
    run.push({ type: 'assistant_text', text: 'CCC' }); // seq 3
    await waitFor(() => msgs(c2.frames).length >= 2);
    expect(msgs(c2.frames).map((f) => f.seq)).toEqual([2, 3]);

    c2.ws.close();
  }, 20_000);

  test('an unknown session id closes the socket with a distinguishable code', async () => {
    const c = await connect(999_999);
    c.ws.send(JSON.stringify({ type: 'attach', lastSeq: 0 }));
    await waitFor(() => c.ws.readyState === c.ws.CLOSED);
    expect(c.closeCode()).toBe(4404);
  }, 20_000);
});
