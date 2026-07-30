import { Button } from '@tickets/ui';
import { REST_POSES, type MarkConfig, type RestPose } from '../config';
import { PHASES, rampSpread, ramps, runningHoldSeconds, transitionSeconds } from '../motion';
import type { PhaseChoice } from '../output/motion-preview';
import type { StudioAction } from '../state';
import { SliderRow } from './slider-row';

const CHOICES: readonly PhaseChoice[] = ['auto', ...PHASES];

export function MotionPanel({
  config, choice, playing, dispatch, onChoice, onPlaying,
}: {
  config: MarkConfig;
  choice: PhaseChoice;
  playing: boolean;
  dispatch: (action: StudioAction) => void;
  onChoice: (choice: PhaseChoice) => void;
  onPlaying: (playing: boolean) => void;
}) {
  const { motion } = config;
  const perStick = ramps(config);
  const even = motion.restPose === 'fan';

  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-mono text-11 uppercase tracking-wider text-gray-11">Motion</h2>

      <div className="flex flex-wrap gap-1.5">
        {CHOICES.map((c) => (
          <Button
            key={c}
            variant={c === choice ? 'solid' : 'outline'}
            size="sm"
            onClick={() => onChoice(c)}
          >
            {c}
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Button variant="outline" size="sm" onClick={() => onPlaying(!playing)}>
          {playing ? 'Pause' : 'Play'}
        </Button>
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
        All three start together; these are what differ. The ramps are derived,
        never dialled — each is exactly long enough for that stick to fall its
        share of 60° behind the leader. `ramp` above sets the leading stick's,
        and on the even `fan` pose the step between them is twice the spec's
        derived Δd, which is worth being able to check.
      */}
      <p className="font-mono text-11 text-gray-11">
        ramps {perStick.map((r: number) => r.toFixed(3)).join(' · ')}s
        {even ? ` · step ${rampSpread(motion).toFixed(3)}s` : ' · uneven pose'}
      </p>
      <p className="font-mono text-11 text-gray-11">
        transition {transitionSeconds(config).toFixed(2)}s · running{' '}
        {runningHoldSeconds(config).toFixed(2)}s
      </p>

      <div>
        <Button variant="outline" size="sm" onClick={() => dispatch({ type: 'resetMotion' })}>
          Reset motion
        </Button>
      </div>
    </section>
  );
}
