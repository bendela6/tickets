import { describe, expect, it } from 'vitest';
import { createLocalRunner } from './local-runner';

// The one test that drives a REAL process through node-pty — proving spawn,
// output streaming, and exit-code reporting end to end before anything is built
// on top of it. Uses the running node binary so it's cross-platform and needs
// nothing on PATH.
describe('LocalRunner', () => {
  it('spawns a process, streams its output, and reports the exit code', async () => {
    const runner = createLocalRunner();

    // node-pty's env is Record<string,string>; process.env has optional values.
    const env: Record<string, string> = {};
    for (const [k, v] of Object.entries(process.env)) if (v !== undefined) env[k] = v;

    const handle = runner.spawnPty({
      command: process.execPath,
      args: ['-e', "process.stdout.write('hello-pty'); process.exit(3)"],
      cwd: process.cwd(),
      env,
      cols: 80,
      rows: 24,
    });

    let out = '';
    for await (const chunk of handle.output) out += chunk;
    const { exitCode } = await handle.exit;

    expect(out).toContain('hello-pty');
    expect(exitCode).toBe(3);
  }, 20000);
});
