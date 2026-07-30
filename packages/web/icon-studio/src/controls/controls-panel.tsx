import { GROUND } from '../color';
import type { IconDoc, Stick } from '../doc';
import type { StudioAction } from '../state';
import { SliderRow } from './slider-row';
import { SwatchRow } from './swatch-row';

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
  doc, dispatch,
}: {
  doc: IconDoc;
  dispatch: (action: StudioAction) => void;
}) {
  const inkNames = Object.keys(doc.inks).filter((name) => name !== 'field');
  const sticks = doc.elements.filter(isStick);
  const gap = tightestGap(sticks.map((s) => s.angle));
  const tight = gap < GAP_WARNING_DEGREES;
  const chip = doc.variants.chip;

  return (
    <div className="flex flex-col gap-5">
      {(['light', 'dark'] as const).map((mode) => (
        <section key={mode} className="flex flex-col gap-2">
          <h2 className="font-mono text-11 uppercase tracking-wider text-gray-11">{mode} theme</h2>
          {inkNames.map((name) => {
            const hex = doc.inks[name]?.[mode] ?? '#000000';
            return (
              <SwatchRow
                key={name}
                label={`${mode} ${name}`}
                base={hex}
                derived={hex}
                ground={GROUND[mode]}
                onChange={(value) => dispatch({ type: 'setInk', name, patch: { [mode]: value } })}
              />
            );
          })}
        </section>
      ))}

      <section className="flex flex-col gap-2">
        <h2 className="font-mono text-11 uppercase tracking-wider text-gray-11">Chip field</h2>
        <SwatchRow
          label="chip field"
          base={doc.inks.field?.light ?? '#000000'}
          derived={doc.inks.field?.light ?? '#000000'}
          ground={doc.inks.top?.dark ?? GROUND.dark}
          onChange={(hex) => dispatch({ type: 'setInk', name: 'field', patch: { light: hex, dark: hex } })}
        />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-mono text-11 uppercase tracking-wider text-gray-11">Angles &amp; weight</h2>
        {sticks.map((stick) => (
          <div key={stick.id} className="flex flex-col gap-2">
            <SliderRow
              label={`${stick.id} angle`} min={0} max={180}
              value={stick.angle}
              format={(v) => `${v}°`}
              onChange={(angle) => dispatch({ type: 'updateElement', id: stick.id, patch: { angle } })}
            />
            <SliderRow
              label={`${stick.id} weight`} min={0.5} max={12} step={0.25}
              value={stick.weight}
              onChange={(weight) => dispatch({ type: 'updateElement', id: stick.id, patch: { weight } })}
            />
          </div>
        ))}
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
