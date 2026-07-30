import { useEffect, useRef, useState } from 'react';
import { BARE_REACH, type MarkConfig } from '../config';
import { toDoc } from '../migrate';
import {
  isSpinning, planMove, separations, statePose, type Formation, type MarkState,
} from '../motion';

const CENTRE = 24;

/** How often the numeric readout refreshes. The mark itself moves every frame. */
const READOUT_MS = 120;

/**
 * Honours `prefers-reduced-motion` by cutting straight to each state's pose.
 * The states differ in *shape*, not only in movement, so the mark still says
 * which one it is with the motion stripped out — the test a status indicator has
 * to pass.
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

export function MotionPreview({
  config, state, size = 132,
}: {
  config: MarkConfig;
  state: MarkState;
  size?: number;
}) {
  const reduced = useReducedMotion();
  const sticks = useRef<(SVGPathElement | null)[]>([null, null, null]);

  // motion.ts now operates on an IconDoc rather than the old MarkConfig — the
  // preview still only ever renders the mark's three sticks, so migrating the
  // config on the fly here reuses the real motion maths without pulling this
  // control into the document/state rewrite that owns the rest of the studio.
  const doc = toDoc(config);

  /**
   * The live formation is a ref, not React state: the frame loop writes each
   * stick's transform straight to the DOM. Re-rendering three paths sixty times
   * a second would be wasted work, and driving the loop through state made the
   * animation's continuation depend on React's scheduling — which is how an
   * earlier version came to stop after two frames.
   */
  const live = useRef<Formation>({
    pose: statePose(doc, state),
    spinning: isSpinning(state),
  });

  // Only the readout goes through React, a few times a second.
  const [readout, setReadout] = useState<Formation>(live.current);

  useEffect(() => {
    const paint = (formation: Formation) => {
      live.current = formation;
      formation.pose.forEach((angle, i) => {
        sticks.current[i]?.setAttribute('transform', `rotate(${angle} ${CENTRE} ${CENTRE})`);
      });
    };

    if (reduced) {
      paint({ pose: statePose(doc, state), spinning: isSpinning(state) });
      setReadout(live.current);
      return;
    }

    // Planned once, from wherever the mark actually is — so clicking a second
    // state mid-flight continues from the current pose rather than snapping.
    const move = planMove(doc, live.current, state);
    let frame = 0;
    let startedAt: number | null = null;
    let lastReadout = 0;

    const tick = (now: number) => {
      startedAt ??= now;
      const elapsed = (now - startedAt) / 1000;
      const done = elapsed >= move.duration;

      paint({
        pose: move.pose(move.spinning ? elapsed : Math.min(elapsed, move.duration)),
        spinning: move.spinning,
      });

      if (now - lastReadout > READOUT_MS) {
        lastReadout = now;
        setReadout(live.current);
      }

      // A move onto a still state is finished; a running state keeps turning.
      if (done && !move.spinning) {
        setReadout(live.current);
        return;
      }
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [config, state, reduced]);

  const [first, second] = separations(readout.pose);

  return (
    <div className="flex items-center gap-4">
      <svg
        viewBox={`0 0 ${CENTRE * 2} ${CENTRE * 2}`}
        width={size}
        height={size}
        role="img"
        aria-label={`Loader, ${state}`}
        className="rounded-lg bg-gray-2"
      >
        <g fill="none">
          {/* Painted low, mid, top so the leading stick stays frontmost. */}
          {[2, 1, 0].map((i) => (
            <path
              key={i}
              ref={(node) => {
                sticks.current[i] = node;
              }}
              d={`M${CENTRE} ${CENTRE - BARE_REACH}L${CENTRE} ${CENTRE + BARE_REACH}`}
              stroke={config.light[i]}
              strokeWidth={config.bareWeight}
              strokeLinecap="round"
              transform={`rotate(${live.current.pose[i] ?? 0} ${CENTRE} ${CENTRE})`}
            />
          ))}
        </g>
      </svg>

      <dl className="flex flex-col gap-0.5 font-mono text-11 text-gray-11">
        <div className="flex gap-2">
          <dt className="w-14">state</dt>
          <dd className="tabular-nums text-gray-12">{state}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-14">gaps</dt>
          <dd className="tabular-nums text-gray-12">
            {first.toFixed(1)}° · {second.toFixed(1)}°
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-14">turning</dt>
          <dd className="tabular-nums text-gray-12">{readout.spinning ? 'yes' : 'no'}</dd>
        </div>
        {reduced ? (
          <div className="flex gap-2">
            <dt className="w-14">motion</dt>
            <dd className="text-orange-11">cut — reduced-motion</dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}
