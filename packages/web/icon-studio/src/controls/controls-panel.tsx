import { Button } from '@tickets/ui';
import { GROUND } from '../color';
import { PRESETS, RATIO, STICKS, type MarkConfig, type PresetName } from '../config';
import type { StudioAction, StudioState } from '../state';
import { SliderRow } from './slider-row';
import { SwatchRow } from './swatch-row';

const signed = (v: number) => (v === 0 ? '0' : `${v > 0 ? '+' : ''}${v.toFixed(2)}`);

/**
 * Degrees apart on the circle every stick actually lives on. Sticks are full
 * diameters — 180°-symmetric, identical at θ and θ+180 — so the distance
 * between two angles wraps at 180, not 360.
 */
function pairGap(a: number, b: number): number {
  const d = Math.abs(a - b) % 180;
  return Math.min(d, 180 - d);
}

/** The smallest of the three pairwise gaps — the pair closest to occluding each other. */
export function tightestGap([a, b, c]: [number, number, number]): number {
  return Math.min(pairGap(a, b), pairGap(b, c), pairGap(a, c));
}

/** Below this, two sticks start reading as a single thicker stroke rather than two. */
export const GAP_WARNING_DEGREES = 12;

export function ControlsPanel({
  state, config, dispatch,
}: {
  state: StudioState;
  config: MarkConfig;
  dispatch: (action: StudioAction) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      {(['light', 'dark'] as const).map((mode) => (
        <section key={mode} className="flex flex-col gap-2">
          <h2 className="font-mono text-11 uppercase tracking-wider text-gray-11">{mode} theme</h2>
          {([0, 1, 2] as const).map((i) => (
            <SwatchRow
              key={STICKS[i]}
              label={`${mode} ${STICKS[i]}`}
              base={state.base[mode][i]}
              derived={config[mode][i]}
              ground={GROUND[mode]}
              onChange={(hex) => dispatch({ type: 'setBase', mode, index: i, hex })}
            />
          ))}
        </section>
      ))}

      <section className="flex flex-col gap-2">
        <h2 className="font-mono text-11 uppercase tracking-wider text-gray-11">Chip field</h2>
        <SwatchRow
          label="chip field"
          base={state.chip}
          derived={config.chip}
          ground={config.dark[0]}
          onChange={(hex) => dispatch({ type: 'setChip', hex })}
        />
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(PRESETS) as PresetName[]).map((name) => (
            <Button key={name} variant="outline" size="sm" onClick={() => dispatch({ type: 'applyPreset', name })}>
              {name}
            </Button>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-mono text-11 uppercase tracking-wider text-gray-11">Vividness &amp; brightness</h2>
        {(['light', 'dark'] as const).map((mode) => (
          <div key={mode} className="flex flex-col gap-2">
            <SliderRow
              label={`${mode} vivid`} min={0.3} max={1.8} step={0.02}
              value={mode === 'light' ? state.adjLight.sat : state.adjDark.sat}
              format={(v) => v.toFixed(2)}
              onChange={(sat) => dispatch({ type: 'setAdjust', mode, patch: { sat } })}
            />
            <SliderRow
              label={`${mode} bright`} min={-0.2} max={0.2} step={0.01}
              value={mode === 'light' ? state.adjLight.lit : state.adjDark.lit}
              format={signed}
              onChange={(lit) => dispatch({ type: 'setAdjust', mode, patch: { lit } })}
            />
          </div>
        ))}
        <SliderRow
          label="hue shift" min={-90} max={90}
          value={state.adjLight.hue}
          format={(v) => `${v}°`}
          onChange={(hue) => {
            dispatch({ type: 'setAdjust', mode: 'light', patch: { hue } });
            dispatch({ type: 'setAdjust', mode: 'dark', patch: { hue } });
          }}
        />
        <div>
          <Button variant="outline" size="sm" onClick={() => dispatch({ type: 'resetAdjust' })}>
            Reset adjustments
          </Button>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-mono text-11 uppercase tracking-wider text-gray-11">Angles &amp; weight</h2>
        {([0, 1, 2] as const).map((i) => (
          <SliderRow
            key={STICKS[i]}
            label={`${STICKS[i]} angle`} min={0} max={180}
            value={state.angles[i]}
            format={(v) => `${v}°`}
            onChange={(degrees) => dispatch({ type: 'setAngle', index: i, degrees })}
          />
        ))}
        {(() => {
          const gap = tightestGap(config.angles);
          const tight = gap < GAP_WARNING_DEGREES;
          return (
            <p className={`font-mono text-11 ${tight ? 'text-orange-11' : 'text-gray-11'}`}>
              tightest gap {gap.toFixed(0)}°{tight ? ' — sticks may hide each other' : ''}
            </p>
          );
        })()}
        <SliderRow
          label="bare stroke" min={3} max={8} step={0.25} value={state.bareWeight}
          onChange={(value) => dispatch({ type: 'setNumber', key: 'bareWeight', value })}
        />
        <SliderRow
          label="chip reach" min={9} max={18} step={0.5} value={state.chipReach}
          onChange={(value) => dispatch({ type: 'setNumber', key: 'chipReach', value })}
        />
        <SliderRow
          label="chip stroke" min={2} max={8} step={0.1} value={state.chipWeight}
          onChange={(value) => dispatch({ type: 'setNumber', key: 'chipWeight', value })}
        />
        <p className="font-mono text-11 text-gray-11">
          chip ratio {(config.chipWeight / config.chipReach).toFixed(2)} · bare mark 1/3 = {RATIO.toFixed(2)}
        </p>
        <div>
          <Button variant="outline" size="sm" onClick={() => dispatch({ type: 'matchRatio' })}>
            Match the favicon ratio
          </Button>
        </div>
      </section>
    </div>
  );
}
