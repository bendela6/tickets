import { spawn, type IPty } from 'node-pty';
import type { PtyHandle, PtySpec, Runner } from './types';

// The only E1 file that touches the OS. Bridges node-pty's event API
// (onData/onExit) to our PtyHandle (an AsyncIterable of output + an exit
// promise), so the supervisor never sees node-pty. ContainerRunner will sit
// beside this in E2 and the supervisor will not change.
//
// node-pty is a native module; on Windows it ships prebuilt binaries + conpty,
// so no build toolchain is required at install time.
export function createLocalRunner(): Runner {
  return {
    spawnPty(spec: PtySpec): PtyHandle {
      const proc = spawn(spec.command, spec.args, {
        name: 'xterm-color',
        cwd: spec.cwd,
        env: spec.env,
        cols: spec.cols,
        rows: spec.rows,
      });
      return adaptPty(proc);
    },
  };
}

function adaptPty(proc: IPty): PtyHandle {
  const queue: string[] = [];
  let waiting: ((r: IteratorResult<string>) => void) | null = null;
  let ended = false;
  let resolveExit!: (v: { exitCode: number | null }) => void;
  const exit = new Promise<{ exitCode: number | null }>((r) => (resolveExit = r));

  proc.onData((data) => {
    if (waiting) {
      const w = waiting;
      waiting = null;
      w({ value: data, done: false });
    } else {
      queue.push(data);
    }
  });

  proc.onExit(({ exitCode }) => {
    ended = true;
    resolveExit({ exitCode });
    // Only wake a waiter if there's nothing buffered — queued data must drain
    // first (the iterator checks the queue before reporting done).
    if (waiting && queue.length === 0) {
      const w = waiting;
      waiting = null;
      w({ value: undefined as unknown as string, done: true });
    }
  });

  const output: AsyncIterable<string> = {
    [Symbol.asyncIterator]() {
      return {
        next(): Promise<IteratorResult<string>> {
          if (queue.length > 0) {
            return Promise.resolve({ value: queue.shift()!, done: false });
          }
          if (ended) {
            return Promise.resolve({ value: undefined as unknown as string, done: true });
          }
          return new Promise((resolve) => {
            waiting = resolve;
          });
        },
      };
    },
  };

  return {
    output,
    exit,
    write: (data) => proc.write(data),
    resize: (cols, rows) => proc.resize(cols, rows),
    kill: () => proc.kill(),
  };
}
