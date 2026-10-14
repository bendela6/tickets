import type { CSSProperties, ReactNode } from 'react';
import type { PartOptions } from '@bh/template';
import { axis, cn, HUES, over, TONE_HUE, TONE_NAMES, variants, type Tone } from '../../../style';

// How a part's text looks, from the options bh's renderers share: its tone,
// its face, its weight and the lines it takes, and the prefix before it. A
// template's part names a tone by its name, as a string; one that names none
// of bh's tones is drawn in the text's own color.

const SCALE = axis('scale', HUES, 'gray');

const inkClass = variants({
  base: '',
  config: {
    ink: { default: 'toned', options: { toned: over(SCALE, (hue) => `text-${hue}-11`) } },
  },
});

const WEIGHT: Record<NonNullable<PartOptions['weight']>, string> = {
  400: 'font-400',
  500: 'font-500',
  600: 'font-600',
};

/** One of bh's tones by its name, or undefined for a name that is none of them. */
export function toneOf(name: string | undefined): Tone | undefined {
  return TONE_NAMES.find((tone) => tone === name);
}

/**
 * The classes and style of a part's text: `tone` (or the value's own, which
 * the part's wins over), `mono`, `weight` and `clamp`. One line clamps by
 * cutting the text short with an ellipsis; more by the line clamp, which no
 * class spells for every count.
 */
export function partLook(
  part: PartOptions,
  tone?: string,
): { className: string; style?: CSSProperties } {
  const ink = toneOf(part.tone ?? tone);
  const lines = part.clamp;
  return {
    className: cn(
      'min-w-0',
      ink && inkClass({ scale: TONE_HUE[ink] }),
      part.mono && 'font-mono',
      part.weight && WEIGHT[part.weight],
      lines === 1 && 'block truncate',
      lines !== undefined && lines > 1 && 'overflow-hidden break-words',
    ),
    style:
      lines !== undefined && lines > 1
        ? { display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: lines }
        : undefined,
  };
}

/** Text as a part's options say: its tone, face, weight and lines, after its prefix. */
export function PartText({
  part,
  tone,
  className,
  children,
}: {
  /** The part's options. */
  part: PartOptions;
  /** The value's own tone, which the part's `tone` wins over. */
  tone?: string;
  /** Added to its classes. */
  className?: string;
  /** The text. */
  children: ReactNode;
}) {
  const look = partLook(part, tone);
  return (
    <span className={cn(look.className, className)} style={look.style}>
      {part.prefix}
      {children}
    </span>
  );
}
