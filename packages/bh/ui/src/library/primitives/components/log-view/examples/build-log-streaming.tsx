import { useEffect, useState } from 'react';
import { Button, LogView, type LogLine, type LogSectionRule } from '@bh/ui';

// A deploy's steps start with `==>`; inside its build, BuildKit's steps
// start with `#13 [stage n/m]`. A constant, so the lines are read once.
const SECTIONS: readonly LogSectionRule[] = [
  { match: /^==> /, level: 0 },
  { match: /^#\d+ \[/, level: 1 },
];

// What the deploy prints, and how long after the line before.
const SCRIPT: [number, string][] = [
  [0, '==> deploy 14: bendela6/gateway d5e2f41, asked by the page'],
  [600, '==> fetched the commit'],
  [700, '==> build'],
  [300, '#1 [internal] load local bake definitions'],
  [100, '#1 reading from stdin 1.82kB done'],
  [100, '#1 DONE 0.0s'],
  [300, '#2 [gateway internal] load build definition from Dockerfile'],
  [100, '#2 transferring dockerfile: 1.45kB done'],
  [100, '#2 DONE 0.1s'],
  [400, '#3 [gateway build 8/9] RUN pnpm install --frozen-lockfile'],
  [400, '#3 0.395 Scope: 8 of 9 workspace projects'],
  [700, '#3 4.710 [WARN] Tarball download average speed 22 KiB/s is below 50 KiB/s'],
  [900, '#3 9.821 Done in 9.6s using pnpm v12.4.2'],
  [200, '#3 DONE 10.0s'],
  [400, '#4 [gateway build 9/9] RUN pnpm --filter @gateway/web build'],
  [500, '#4 0.395 $ tsc --noEmit && vite build'],
  [900, '#4 9.664 vite v8.3.0 building client environment for production...'],
  [600, '#4 10.08 ✓ 2938 modules transformed.'],
  [500, '#4 10.33 ✓ built in 662ms'],
  [200, '#4 DONE 10.6s'],
  [600, '==> starting gateway next to the running one, waiting up to 60 s for running and healthy'],
  [1200, 'Container gateway-gateway-1 Healthy'],
  [600, '==> done: live'],
];

/** The deploy so far: a line every few hundred milliseconds, until it is through. */
function useDeploy(run: number): { lines: LogLine[]; streaming: boolean } {
  const [lines, setLines] = useState<LogLine[]>([]);
  useEffect(() => {
    setLines([]);
    let at = Date.now();
    let next = 0;
    let timer: ReturnType<typeof setTimeout>;
    const print = () => {
      const step = SCRIPT[next];
      if (step === undefined) {
        return;
      }
      at += step[0];
      const line: LogLine = { time: at, text: step[1], id: `${run}-${next}` };
      setLines((before) => [...before, line]);
      next += 1;
      const after = SCRIPT[next];
      if (after !== undefined) {
        timer = setTimeout(print, after[0]);
      }
    };
    timer = setTimeout(print, 300);
    return () => clearTimeout(timer);
  }, [run]);
  return { lines, streaming: lines.length < SCRIPT.length };
}

export function BuildLogStreaming() {
  const [run, setRun] = useState(0);
  const { lines, streaming } = useDeploy(run);
  return (
    <div className="flex w-full flex-col items-start gap-12">
      <Button size="sm" disabled={streaming} onClick={() => setRun((was) => was + 1)}>
        Deploy again
      </Button>
      <LogView
        lines={lines}
        sections={SECTIONS}
        streaming={streaming}
        label="Deploy 14"
        className="w-full"
      />
    </div>
  );
}
