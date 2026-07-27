import { useEffect, useState, type ReactNode } from 'react';
import { ANIMATIONS, DURATIONS, EASINGS } from '../spec';
import { DriftView, Sheet, SpecHeader, SpecRow } from '../view';

export const meta = {
  title: 'Motion',
  group: 'Foundation',
  order: 5,
  size: 'full',
  impl: ['./foundation.ts', './foundation-view.tsx'],
};

const DURATION_JOBS: Record<string, string> = {
  'duration-fast': 'hover, press — feedback',
  'duration-base': 'open, close — transitions',
  'duration-slow': 'enter, layout — arrivals',
};

const EASE_JOBS: Record<string, string> = {
  'ease-out': 'things arriving — fast, then settle',
  'ease-in-out': 'things moving between two places',
};

const DEFAULT_EASE = EASINGS.find((e) => e.name === 'ease-out')!.value;

/**
 * Remounts its children on demand. A transition only runs on a change, so a
 * page whose whole subject is timing needs a way to make them happen again —
 * otherwise every specimen is a still frame one second after arrival.
 */
function Replay({ children }: { children: (run: number) => ReactNode }) {
  const [run, setRun] = useState(0);
  return (
    <div className="flex w-full flex-col gap-3">
      <button
        type="button"
        onClick={() => setRun((n) => n + 1)}
        className="self-start rounded-md border border-gray-6 bg-surface-raised px-3 py-1 font-sans text-ui text-gray-12 hover:bg-surface-inset"
      >
        Replay
      </button>
      {children(run)}
    </div>
  );
}

/**
 * A transition rather than a keyframe animation: keyframes would have to be
 * declared in tokens.css, which ships to the app, and a specimen has no
 * business being in the product's stylesheet. Two frames of delay so the
 * browser paints the start position before the end position is set — with one,
 * the change coalesces into the same style recalculation and nothing moves.
 */
function Travel({ run, duration, ease }: { run: number; duration: string; ease: string }) {
  const [arrived, setArrived] = useState(false);
  useEffect(() => {
    setArrived(false);
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setArrived(true));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [run]);
  return (
    <div className="relative h-6 overflow-hidden rounded-md bg-surface-inset">
      <span
        className="absolute inset-y-1 w-10 rounded-sm bg-indigo-9"
        style={{
          left: arrived ? 'calc(100% - 2.75rem)' : '0.25rem',
          transitionProperty: 'left',
          transitionDuration: duration,
          transitionTimingFunction: ease,
        }}
      />
    </div>
  );
}

function Durations() {
  return (
    <Replay>
      {(run) => (
        <Sheet>
          <SpecHeader specimen="the same distance, three speeds" />
          {DURATIONS.map((duration) => (
            <SpecRow
              key={duration.name}
              name={duration.name}
              value={duration.value}
              note={DURATION_JOBS[duration.name]}
            >
              <Travel run={run} duration={duration.value} ease={DEFAULT_EASE} />
            </SpecRow>
          ))}
        </Sheet>
      )}
    </Replay>
  );
}

/** SVG path for a `cubic-bezier(x1, y1, x2, y2)` in a 100×100 box, y up. */
export function curvePath(value: string): string {
  const [x1, y1, x2, y2] = value
    .replace(/^cubic-bezier\(|\)$/g, '')
    .split(',')
    .map((n) => Number.parseFloat(n) * 100);
  return `M0,100 C${x1},${100 - y1!} ${x2},${100 - y2!} 100,0`;
}

function Easings() {
  return (
    <Replay>
      {(run) => (
        <Sheet>
          <SpecHeader specimen="curve · the same move, eased" />
          {EASINGS.map((ease) => (
            <SpecRow
              key={ease.name}
              name={ease.name}
              value={ease.value}
              note={EASE_JOBS[ease.name]}
              align="start"
            >
              <div className="flex items-center gap-4">
                {/* Progress against time. A curve that leaves the box early and
                    flattens is one that arrives fast and settles. */}
                <svg viewBox="-6 -6 112 112" className="size-24 shrink-0" aria-hidden="true">
                  <rect x="0" y="0" width="100" height="100" className="fill-surface-inset" />
                  <path
                    d={curvePath(ease.value)}
                    className="stroke-indigo-9"
                    fill="none"
                    strokeWidth="3"
                  />
                </svg>
                <div className="min-w-0 flex-1">
                  <Travel run={run} duration="900ms" ease={ease.value} />
                </div>
              </div>
            </SpecRow>
          ))}
        </Sheet>
      )}
    </Replay>
  );
}

function Animations() {
  return (
    <Sheet>
      <SpecHeader specimen="looping · still under reduced motion" />
      {ANIMATIONS.map((animation) => (
        <SpecRow key={animation.name} name={animation.name} value={animation.value}>
          <span
            className={`inline-block size-5 rounded-full bg-indigo-9 motion-reduce:animate-none ${
              animation.name === 'animate-ai-spin' ? 'animate-ai-spin' : 'animate-ai-pulse'
            }`}
          />
        </SpecRow>
      ))}
      <p className="font-sans text-meta text-gray-9">
        These two are the only motion tokens the live sheet defines — both keyframes, both for the
        AI session status pill. Durations and easings below them are proposed, not shipped.
      </p>
    </Sheet>
  );
}

export const states = [
  { name: 'Durations', render: () => <Durations /> },
  { name: 'Easings', render: () => <Easings /> },
  { name: 'Animations', render: () => <Animations /> },
  { name: 'Drift', render: () => <DriftView families={['duration', 'ease', 'animate']} /> },
];
