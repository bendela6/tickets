// What the tasks-*.test.mjs tests share (`pnpm test:tasks`, node's own runner): a tasks folder of
// their own in the system's temp folder, a port nothing listens on, and running a script or a
// bit of code in a process of its own. The scripts are pointed at the folder with TASKS_DIR and
// at the port with PORT, so a test never reads or writes the real tasks/ or reaches the viewer
// that serves it.
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const SCRIPTS = fileURLToPath(new URL('.', import.meta.url));
export const LIB = pathToFileURL(join(SCRIPTS, 'tasks-lib.mjs')).href;
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** A port free a moment ago, never the real viewer's. */
export async function freePort() {
  for (;;) {
    const server = createServer();
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();
    await new Promise((resolve) => server.close(resolve));
    if (port !== 4741) return port;
  }
}

/**
 * A tasks folder of the test's own, set as TASKS_DIR (and a free PORT) for this process, so
 * import tasks-lib.mjs after it. Removed when the test file ends.
 */
export async function tasksDir(after) {
  const dir = await mkdtemp(join(tmpdir(), 'tasks-test-'));
  process.env.TASKS_DIR = dir;
  process.env.PORT = String(await freePort());
  after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

/** A plan file with one epic, one feature (TT-1) and one ticket (TT-1.1). */
export const plan = (extra = {}) => ({
  repo: 'test',
  prefix: 'TT',
  epics: [
    {
      id: 'E1',
      title: 'Test the scripts',
      features: [
        {
          id: 'TT-1',
          title: 'Test a feature',
          status: 'Planned',
          plan: [{ id: 'TT-1.1', title: 'Test a ticket', done: false, ...extra }],
        },
      ],
    },
  ],
});

export const put = (dir, file, doc) =>
  writeFile(join(dir, file), JSON.stringify(doc, null, 2) + '\n');

/**
 * Runs `node <args>` with the test's TASKS_DIR and PORT (and `env`); resolves with its exit code
 * and output when it ends. `started` gets the child, to talk to or stop it.
 */
export function node(args, { env = {}, started } = {}) {
  const child = spawn(process.execPath, args, {
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => (stdout += chunk));
  child.stderr.on('data', (chunk) => (stderr += chunk));
  started?.(child);
  return new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

/** Runs ES module code in a process of its own (import the lib from LIB). */
export const code = (source, options) => node(['--input-type=module', '-e', source], options);

/** Starts the viewer (tasks-view.mjs) on the test's PORT; resolves once it listens. */
export async function viewer(after) {
  let child;
  const ended = node([join(SCRIPTS, 'tasks-view.mjs')], { started: (c) => (child = c) });
  after(async () => {
    child.kill();
    await ended;
  });
  await new Promise((resolve, reject) => {
    child.stdout.on('data', (chunk) => String(chunk).includes('tasks: http') && resolve());
    ended.then(({ stderr }) => reject(new Error(`The viewer ended: ${stderr}`)));
  });
  return `http://127.0.0.1:${process.env.PORT}`;
}
