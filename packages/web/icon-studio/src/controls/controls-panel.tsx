import { Button } from '@tickets/ui';
import type { Adjust } from '../color';
import { GROUND } from '../color';
import { PRESETS, type PresetName } from '../config';
import type { IconDoc, Stick } from '../doc';
import type { StudioAction } from '../state';
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

/** The smallest pairwise gap among any number of stick angles on the 180° circle. */
export function tightestGap(angles: number[]): number {
  let min = 180;
  for (let i = 0; i < angles.length; i++) {
    for (let j = i + 1; j < angles.length; j++) {
      min = Math.min(min, pairGap(angles[i] ?? 0, angles[j] ?? 0));
    }
  }
  return min;
}

/** Below this, two sticks start reading as a single thicker stroke rather than two. */
export const GAP_WARNING_DEGREES = 12;

function isStick(element: IconDoc['elements'][number]): element is Stick {
  return element.type === 'stick';
}

export function ControlsPanel({
  doc, adjLight, adjDark, dispatch, onAdjustChange, onResetAdjust, onApplyPreset,
}: {
  doc: IconDoc;
  adjLight: Adjust;
  adjDark: Adjust;
  dispatch: (action: StudioAction) => void;
  onAdjustChange: (mode: 'light' | 'dark', patch: Partial<Adjust>) => void;
  onResetAdjust: () => void;
  onApplyPreset: (name: PresetName) => void;
}) {
  const sticks = doc.elements.filter(isStick);
  const gap = tightestGap(sticks.map((s) => s.angle));
  const tight = gap < GAP_WARNING_DEGREES;
  const chip = doc.variants.chip;

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-2">
        <h2 className="font-mono text-11 uppercase tracking-wider text-gray-11">Chip field</h2>
        <SwatchRow
          label="chip field"
          base={doc.inks.field?.light ?? '#000000'}
          derived={doc.inks.field?.light ?? '#000000'}
          ground={doc.inks.top?.dark ?? GROUND.dark}
          onChange={(hex) => dispatch({ type: 'setInk', name: 'field', patch: { light: hex, dark: hex } })}
        />
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(PRESETS) as PresetName[]).map((name) => (
            <Button key={name} variant="outline" size="sm" onClick={() => onApplyPreset(name)}>
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
              value={mode === 'light' ? adjLight.sat : adjDark.sat}
              format={(v) => v.toFixed(2)}
              onChange={(sat) => onAdjustChange(mode, { sat })}
            />
            <SliderRow
              label={`${mode} bright`} min={-0.2} max={0.2} step={0.01}
              value={mode === 'light' ? adjLight.lit : adjDark.lit}
              format={signed}
              onChange={(lit) => onAdjustChange(mode, { lit })}
            />
          </div>
        ))}
        <SliderRow
          label="hue shift" min={-90} max={90}
          value={adjLight.hue}
          format={(v) => `${v}°`}
          onChange={(hue) => {
            onAdjustChange('light', { hue });
            onAdjustChange('dark', { hue });
          }}
        />
        <div>
          <Button variant="outline" size="sm" onClick={onResetAdjust}>
            Reset adjustments
          </Button>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-mono text-11 uppercase tracking-wider text-gray-11">Stick spacing</h2>
        {/* Angle and weight are edited per-element in ElementPanel now; this
         * stays here as a document-wide occlusion check across every stick,
         * however many there are. */}
        <p className={`font-mono text-11 ${tight ? 'text-orange-11' : 'text-gray-11'}`}>
          tightest gap {gap.toFixed(0)}°{tight ? ' — sticks may hide each other' : ''}
        </p>
      </section>

      {chip ? (
        <section className="flex flex-col gap-2">
          <h2 className="font-mono text-11 uppercase tracking-wider text-gray-11">Chip variant</h2>
          <SliderRow
            label="chip scale" min={0.2} max={1.5} step={0.01} value={chip.scale}
            format={(v) => v.toFixed(2)}
            onChange={(scale) => dispatch({ type: 'setVariant', name: 'chip', patch: { scale } })}
          />
        </section>
      ) : null}
    </div>
  );
}
