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
import { createTerminalDriver } from './driver';
import { createTerminalStore } from './store';
import type { PtyHandle, Runner, ServerFrame } from './types';

// The crux integration test for the terminal split: a REAL listening server, a
// REAL WebSocket client, the REAL driver + REAL Postgres store — only the OS
// process is faked (a controllable PTY), so output timing is deterministic
// while the seq numbering, DB persistence, WS transport, and
// reconnect-and-replay path are all exercised end to end.
const { host, port, user, password } = environment.postgres;
const dbName = `tozf_terminal_socket_test_${process.pid}_${Date.now()}`;
const adminUrl = `postgres://${user}:${password}@${host}:${port}/postgres`;
const scratchUrl = `postgres://${user}:${password}@${host}:${port}/${dbName}`;

let scratchSql: ReturnType<typeof postgres>;
let db: Db;
let app: FastifyInstance;
let baseUrl: string;

// A controllable PTY: push output, end with an exit code. Same shape the
// driver's own unit tests use.
function makePty() {
  const chunks: string[] = [];
  let notify: (() => void) | null = null;
  let ended = false;
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
  };
}

// Captures each spawned PTY so the test can drive the (single) session's output.
const ptys: ReturnType<typeof makePty>[] = [];
const runner: Runner = {
  spawnPty: () => {
    const p = makePty();
    ptys.push(p);
    return p.handle;
  },
};

// ── ws client helpers (global WebSocket, Node 22+) ───────────────────────────

interface Client {
  ws: WebSocket;
  frames: ServerFrame[];
  closeCode: () => number | undefined;
}

function connect(id: number): Promise<Client> {
  const ws = new WebSocket(`${baseUrl}/api/terminal/sessions/${id}/socket`);
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

const outputs = (frames: ServerFrame[]): { seq: number; data: string }[] =>
  frames.filter((f): f is Extract<ServerFrame, { type: 'output' }> => f.type === 'output');

async function createSession(): Promise<number> {
  const wd = await app.inject({
    method: 'POST',
    url: '/api/workdirs',
    payload: { name: `wd-${Date.now()}`, path: tmpdir() },
  });
  const res = await app.inject({
    method: 'POST',
    url: '/api/terminal/sessions',
    payload: { workdirId: wd.json().id },
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

  const driver = createTerminalDriver({ runner, store: createTerminalStore(db) });
  app = buildApp({ db, terminalDriver: driver });
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

describe('terminal session socket', () => {
  test('reconnect replays exactly the missed output, in order, with no duplicates', async () => {
    const id = await createSession();
    const pty = ptys.at(-1)!;

    // First client attaches from scratch and sees live output.
    const c1 = await connect(id);
    c1.ws.send(JSON.stringify({ type: 'attach', lastSeq: 0 }));
    await waitFor(() => c1.frames.some((f) => f.type === 'replay_done'));

    pty.push('AAA'); // seq 1
    await waitFor(() => outputs(c1.frames).length >= 1);
    pty.push('BBB'); // seq 2
    await waitFor(() => outputs(c1.frames).length >= 2);

    expect(outputs(c1.frames)).toEqual([
      { type: 'output', seq: 1, data: 'AAA' },
      { type: 'output', seq: 2, data: 'BBB' },
    ]);

    // Drop the connection (tab closed) — the process must keep running.
    c1.ws.close();
    await waitFor(() => c1.ws.readyState === c1.ws.CLOSED);

    // Reconnect having seen up to seq 1: expect ONLY seq 2 replayed, exactly once.
    const c2 = await connect(id);
    c2.ws.send(JSON.stringify({ type: 'attach', lastSeq: 1 }));
    await waitFor(() => c2.frames.some((f) => f.type === 'replay_done'));

    expect(outputs(c2.frames)).toEqual([{ type: 'output', seq: 2, data: 'BBB' }]);

    // And live output continues to flow to the reconnected client.
    pty.push('CCC'); // seq 3
    await waitFor(() => outputs(c2.frames).length >= 2);
    expect(outputs(c2.frames)).toEqual([
      { type: 'output', seq: 2, data: 'BBB' },
      { type: 'output', seq: 3, data: 'CCC' },
    ]);

    c2.ws.close();
  }, 20_000);

  test('an unknown session id closes the socket with a distinguishable code', async () => {
    const c = await connect(999_999);
    c.ws.send(JSON.stringify({ type: 'attach', lastSeq: 0 }));
    await waitFor(() => c.ws.readyState === c.ws.CLOSED);
    expect(c.closeCode()).toBe(4404);
  }, 20_000);
});
