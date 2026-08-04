import { GROUND } from '../color';
import type { IconDoc, Ink } from '../doc';
import { SwatchRow } from './swatch-row';

/**
 * One swatch pair (light + dark) per named ink the vividness/brightness layer
 * adjusts. This edits `base` — the un-adjusted seed colour studio.tsx keeps
 * outside the document — never `doc.inks` directly: `doc.inks` is re-derived
 * from `base` plus the current adjustment on every change (see studio.tsx),
 * so a swatch wired straight to `setInk` would be overwritten by the very
 * next vividness/brightness tweak. `onBaseChange` is that same path
 * `ControlsPanel` used before this panel existed.
 */
export function InkPanel({
  doc, base, onBaseChange,
}: {
  doc: IconDoc;
  /** The un-adjusted seed colour per adjustable ink (every ink but the chip
   * field) — what these swatches edit directly. */
  base: Record<string, Ink>;
  onBaseChange: (name: string, mode: 'light' | 'dark', hex: string) => void;
}) {
  const inkNames = Object.keys(base);

  return (
    <div className="flex flex-col gap-20">
      {(['light', 'dark'] as const).map((mode) => (
        <section key={mode} className="flex flex-col gap-8">
          <h2 className="font-mono text-11 uppercase tracking-wider text-gray-11">{mode} theme</h2>
          {inkNames.map((name) => {
            const rawHex = base[name]?.[mode] ?? '#000000';
            // doc.inks already reflects the current vividness/brightness
            // adjustment (re-derived from `base` upstream in studio.tsx), so
            // this is the swatch's live, adjusted preview.
            const derivedHex = doc.inks[name]?.[mode] ?? rawHex;
            return (
              <SwatchRow
                key={name}
                label={`${mode} ${name}`}
                base={rawHex}
                derived={derivedHex}
                ground={GROUND[mode]}
                onChange={(hex) => onBaseChange(name, mode, hex)}
              />
            );
          })}
        </section>
      ))}
    </div>
  );
}
