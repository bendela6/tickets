import { useEffect, useRef, useState } from 'react';
import type { MarkConfig } from '../config';
import { BARE_REACH } from '../config';
import {
  cyclePhaseAt, cyclePose, poseAt, restAngles, separations, type Phase,
} from '../motion';

const CENTRE = 24;

/** `auto` walks the four phases in order; the rest hold one phase. */
export type PhaseChoice = Phase | 'auto';

/**
 * Honours `prefers-reduced-motion` by holding the idle pose. The phases differ
 * in *shape*, not only in movement, so a held pose still says something — which
 * is the test a status indicator has to pass.
 */
function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
  );
  useEffect(() => {
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!query) return;
    const onChange = () => setReduced(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

/**
 * A clock, not a pose. The animation is closed-form, so the frame loop only has
 * to report elapsed seconds — nothing accumulates, so nothing drifts and there
 * is no need to snap the formation straight at the end of a transition.
 */
function useElapsed(running: boolean): number {
  const [elapsed, setElapsed] = useState(0);
  const startedAt = useRef<number | null>(null);

  useEffect(() => {
    if (!running) {
      startedAt.current = null;
      return;
    }
    let frame = 0;
    const tick = (now: number) => {
      startedAt.current ??= now;
      setElapsed((now - startedAt.current) / 1000);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [running]);

  // Restarting a held phase from zero is what makes the phase buttons legible:
  // pick `spin-up` and you watch it open, not join it half-way.
  return running ? elapsed : 0;
}

export function MotionPreview({
  config, choice, playing, size = 132,
}: {
  config: MarkConfig;
  choice: PhaseChoice;
  playing: boolean;
  size?: number;
}) {
  const reduced = useReducedMotion();
  const animating = playing && !reduced;
  const elapsed = useElapsed(animating);

  const pose = reduced
    ? restAngles(config)
    : choice === 'auto'
      ? cyclePose(config, elapsed)
      : poseAt(config, choice, elapsed);

  const phase: Phase = reduced
    ? 'idle'
    : choice === 'auto'
      ? cyclePhaseAt(config, elapsed).phase
      : choice;

  const [first, second] = separations(pose);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-4">
        <svg
          viewBox={`0 0 ${CENTRE * 2} ${CENTRE * 2}`}
          width={size}
          height={size}
          role="img"
          aria-label={`Loader, ${phase}`}
          className="rounded-lg bg-gray-2"
        >
          <g fill="none">
            {/* Painted low, mid, top so the leading stick stays frontmost. */}
            {[2, 1, 0].map((i) => (
              <path
                key={i}
                d={`M${CENTRE} ${CENTRE - BARE_REACH}L${CENTRE} ${CENTRE + BARE_REACH}`}
                stroke={config.light[i]}
                strokeWidth={config.bareWeight}
                strokeLinecap="round"
                transform={`rotate(${pose[i] ?? 0} ${CENTRE} ${CENTRE})`}
              />
            ))}
          </g>
        </svg>

        <dl className="flex flex-col gap-0.5 font-mono text-11 text-gray-11">
          <div className="flex gap-2">
            <dt className="w-14">phase</dt>
            <dd className="tabular-nums text-gray-12">{phase}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-14">gaps</dt>
            <dd className="tabular-nums text-gray-12">
              {first.toFixed(1)}° · {second.toFixed(1)}°
            </dd>
          </div>
          {reduced ? (
            <div className="flex gap-2">
              <dt className="w-14">motion</dt>
              <dd className="text-orange-11">held — reduced-motion</dd>
            </div>
          ) : null}
        </dl>
      </div>
    </div>
  );
}
