import { useEffect, useRef, useState } from 'react';
import type { IconDoc } from '../doc';
import { resolveInk } from '../generate/render';
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
  doc, state, size = 132,
}: {
  doc: IconDoc;
  state: MarkState;
  size?: number;
}) {
  const reduced = useReducedMotion();
  // One ref slot per document index, populated only for `stick` elements —
  // a ring or dot never carries a rotate transform (see the render loop
  // below), so the animation loop below simply has nothing to write there.
  // Sized and indexed by `doc.elements`, not a fixed three, so it tracks
  // however many elements the document actually holds.
  const sticks = useRef<(SVGPathElement | null)[]>([]);

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
  }, [doc, state, reduced]);

  const [first, second] = separations(readout.pose);

  // Painted in reverse document order, exactly like `render.ts`:
  // `elements[0]` is frontmost and the leader a running formation follows,
  // and SVG has no z-index, so the frontmost element must be the *last*
  // markup emitted. Each entry keeps its own document index `i` — that is
  // what both the ref array and `live.current.pose` are keyed to, never the
  // position an element happens to paint in.
  const painted = [...doc.elements.entries()].reverse();

  return (
    <div className="flex items-center gap-16">
      <svg
        viewBox={`0 0 ${CENTRE * 2} ${CENTRE * 2}`}
        width={size}
        height={size}
        role="img"
        aria-label={`Loader, ${state}`}
        className="rounded-lg bg-gray-2"
      >
        <g fill="none">
          {painted.map(([i, element]) => {
            // Light-theme only: this preview never re-renders for a theme
            // change, so there is no "current theme" to resolve `theme`
            // against — same posture as the single hardcoded stroke it
            // replaces. `resolveInk` (not a raw `doc.inks[...]` read) is
            // what keeps this own-key-safe against a document built by
            // `structuredClone`ing parsed JSON (see render.ts).
            const color = resolveInk(doc, element.ink, 'light').light;
            switch (element.type) {
              case 'stick':
                return (
                  <path
                    key={element.id}
                    ref={(node) => {
                      sticks.current[i] = node;
                    }}
                    d={`M${CENTRE} ${CENTRE - element.reach}L${CENTRE} ${CENTRE + element.reach}`}
                    stroke={color}
                    strokeWidth={element.weight}
                    strokeLinecap="round"
                    transform={`rotate(${live.current.pose[i] ?? 0} ${CENTRE} ${CENTRE})`}
                  />
                );
              case 'ring':
                // Rotationally symmetric about the centre, so — like
                // render.ts — it never needs a rotate transform, spinning or
                // not: there would be nothing visibly different to animate.
                return (
                  <circle
                    key={element.id}
                    cx={CENTRE}
                    cy={CENTRE}
                    r={element.radius}
                    stroke={color}
                    strokeWidth={element.weight}
                  />
                );
              case 'dot':
                // Same posture as render.ts: a dot is drawn at its own fixed
                // point and never rotated, spinning or not.
                return (
                  <circle key={element.id} cx={element.at[0]} cy={element.at[1]} r={element.radius} fill={color} />
                );
            }
          })}
        </g>
      </svg>

      <dl className="flex flex-col gap-2 font-mono text-11 text-gray-11">
        <div className="flex gap-8">
          <dt className="w-56">state</dt>
          <dd className="tabular-nums text-gray-12">{state}</dd>
        </div>
        <div className="flex gap-8">
          <dt className="w-56">gaps</dt>
          <dd className="tabular-nums text-gray-12">
            {first.toFixed(1)}° · {second.toFixed(1)}°
          </dd>
        </div>
        <div className="flex gap-8">
          <dt className="w-56">turning</dt>
          <dd className="tabular-nums text-gray-12">{readout.spinning ? 'yes' : 'no'}</dd>
        </div>
        {reduced ? (
          <div className="flex gap-8">
            <dt className="w-56">motion</dt>
            <dd className="text-orange-11">cut — reduced-motion</dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}
