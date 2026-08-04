import { Button } from '@tickets/ui';
import { REST_POSES, type RestPose } from '../config';
import type { IconDoc } from '../doc';
import {
  isSpinning, MARK_STATES, planMove, rampSpread, statePose, type MarkState,
} from '../motion';
import type { StudioAction } from '../state';
import { SliderRow } from './slider-row';

export function MotionPanel({
  doc, state, dispatch, onState,
}: {
  doc: IconDoc;
  state: MarkState;
  dispatch: (action: StudioAction) => void;
  onState: (state: MarkState) => void;
}) {
  const { motion } = doc;
  const even = motion.restPose === 'fan';

  return (
    <section className="flex flex-col gap-8">
      <h2 className="font-mono text-11 uppercase tracking-wider text-gray-11">Motion</h2>

      {/* Clicking a state animates to it from wherever the mark is now. */}
      <div className="flex flex-wrap gap-6">
        {MARK_STATES.map((s) => (
          <Button
            key={s}
            variant={s === state ? 'solid' : 'outline'}
            size="sm"
            onClick={() => onState(s)}
          >
            {s}
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap gap-6">
        {REST_POSES.map((pose: RestPose) => (
          <Button
            key={pose}
            variant={motion.restPose === pose ? 'solid' : 'outline'}
            size="sm"
            onClick={() => dispatch({ type: 'setMotion', patch: { restPose: pose } })}
          >
            rest: {pose}
          </Button>
        ))}
      </div>

      <SliderRow
        label="speed" min={20} max={320} step={5} value={motion.speed}
        format={(v) => `${v}°/s`}
        onChange={(speed) => dispatch({ type: 'setMotion', patch: { speed } })}
      />
      <SliderRow
        label="rest spread" min={0} max={30} value={motion.restSpread}
        format={(v) => `${v}°`}
        onChange={(restSpread) => dispatch({ type: 'setMotion', patch: { restSpread } })}
      />
      <SliderRow
        label="ramp" min={0} max={2.5} step={0.05} value={motion.ramp}
        format={(v) => `${v.toFixed(2)}s`}
        onChange={(ramp) => dispatch({ type: 'setMotion', patch: { ramp } })}
      />

      {/*
        Every move is planned, not dialled: all three sticks start together and
        each gets exactly the ramp it needs to reach its place in the target
        formation. Listing the move times makes that visible instead of magic —
        and on the even `fan` pose the ramp step is twice the mark spec's derived
        Δd, which is worth being able to check.
      */}
      <div className="flex flex-col gap-2 font-mono text-11 text-gray-11">
        {MARK_STATES.filter((s) => s !== state).map((s) => (
          <p key={s}>
            → {s} {planMove(doc, { pose: statePose(doc, state), spinning: isSpinning(state) }, s).duration.toFixed(2)}s
          </p>
        ))}
        <p>{even ? `ramp step ${rampSpread(motion).toFixed(3)}s` : 'uneven rest pose'}</p>
      </div>

      <div>
        <Button variant="outline" size="sm" onClick={() => dispatch({ type: 'resetMotion' })}>
          Reset motion
        </Button>
      </div>
    </section>
  );
}
