import { useEffect, useState } from 'react';
import { cn } from '@tickets/ui';
import { SWATCHES } from '../doc/constants';
import { contrastRatio, grade } from '../doc/contrast';
import type { Ground, Pair } from '../doc/types';

const HEX = /^#[0-9a-fA-F]{6}$/;

const otherGround = (ground: Ground): Ground => (ground === 'light' ? 'dark' : 'light');

/** Below this the colour does not read against its ground. */
const READABLE = 4.5;

/**
 * One control for a colour that is always two colours.
 *
 * The swatch is split diagonally so both halves are visible at once, and the
 * `ground` chip in the canvas — not a second control here — decides which half
 * the hex and the eight presets edit. There is no named palette and no
 * indirection: you pick colours, not references.
 *
 * The contrast readout follows the same rule. The large reading is against the
 * ground you are previewing; the small one reports the other pair and turns
 * danger-coloured if that half fails, so a dark variant cannot quietly rot
 * while you work in light.
 */
export function ColourPairField({
  label,
  value,
  ground,
  against,
  onChange,
  showContrast = true,
}: {
  /** What this colour is — `FILL`, `STROKE`, `ARTBOARD`. */
  label: string;
  value: Pair;
  ground: Ground;
  /** The pair this colour is read against, for the contrast readout. */
  against: Pair;
  onChange: (hex: string) => void;
  showContrast?: boolean;
}) {
  const other = otherGround(ground);
  const current = value[ground];
  const [draft, setDraft] = useState(current);

  // The field is controlled by the document, but the user types into it one
  // character at a time and `#4E4` is not yet a colour. The draft holds what
  // they have typed; it resyncs whenever the document's value changes under it
  // — swapping ground, picking a swatch, undoing.
  useEffect(() => setDraft(current), [current]);

  const commit = (text: string) => {
    const normalised = text.startsWith('#') ? text : `#${text}`;
    if (HEX.test(normalised)) onChange(normalised.toUpperCase());
    else setDraft(current);
  };

  const ratio = contrastRatio(current, against[ground]);
  const otherRatio = contrastRatio(value[other], against[other]);
  const readable = ratio >= READABLE;

  return (
    <div className="flex flex-col gap-2.25 rounded-lg bg-surface-inset p-2.5">
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden
          className="relative size-8 flex-none overflow-hidden rounded-md border-1 border-gray-7 shadow-raised"
        >
          <span
            className="absolute inset-0"
            style={{ background: value.light, clipPath: 'polygon(0 0, 100% 0, 0 100%)' }}
          />
          <span
            className="absolute inset-0"
            style={{ background: value.dark, clipPath: 'polygon(100% 0, 100% 100%, 0 100%)' }}
          />
        </span>

        <div className="flex min-w-0 flex-1 flex-col gap-0.75">
          <span className="font-sans text-9 font-500 tracking-widest text-gray-9">
            {label} · {ground} value
          </span>
          <input
            aria-label={`${label} ${ground} value`}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={(event) => commit(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') commit(event.currentTarget.value);
              if (event.key === 'Escape') setDraft(current);
            }}
            spellCheck={false}
            className="w-full bg-transparent font-mono text-13 font-500 uppercase text-gray-12 outline-none"
          />
        </div>

        {showContrast ? (
          <div className="flex flex-none flex-col items-end gap-0.75">
            <span
              className={cn(
                'inline-flex h-4.25 items-center rounded-sm px-1.5 font-sans text-9 font-500 tracking-wide',
                readable ? 'bg-indigo-3 text-indigo-9' : 'bg-surface-raised text-gray-11',
              )}
            >
              {grade(ratio)}
            </span>
            <span className="font-mono text-10 text-gray-11">{ratio.toFixed(2)} : 1</span>
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate font-mono text-9 text-gray-9">
          ground {against[ground].toUpperCase()}
        </span>
        {showContrast ? (
          <span
            className={cn(
              'flex-none font-mono text-9',
              otherRatio >= READABLE ? 'text-gray-11' : 'text-red-9',
            )}
          >
            {other} {otherRatio.toFixed(2)} {grade(otherRatio)}
          </span>
        ) : (
          <span className="flex-none font-mono text-9 text-gray-9">
            swaps on prefers-color-scheme
          </span>
        )}
      </div>

      <div className="grid grid-cols-8 gap-1">
        {SWATCHES.map((hex) => (
          <button
            key={hex}
            type="button"
            title={hex}
            aria-label={`Set ${label.toLowerCase()} to ${hex}`}
            aria-pressed={hex.toUpperCase() === current.toUpperCase()}
            onClick={() => onChange(hex)}
            className={cn(
              'h-4.75 rounded-sm',
              hex.toUpperCase() === current.toUpperCase()
                ? 'border-2 border-indigo-9'
                : 'border-1 border-gray-7',
            )}
            style={{ background: hex }}
          />
        ))}
      </div>

      <span className="font-mono text-9 text-gray-9">
        the preview chip picks which half you edit
      </span>
    </div>
  );
}
