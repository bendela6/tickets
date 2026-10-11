import { type Hue, type Tone, TONE_HUE } from '@bh/ui';

// Whole class strings per scale, since Tailwind sees only whole names: the
// fill, rule and text of the scale a tone resolves to.
const SCALE: Record<Hue, string> = {
  red: 'border-red-6 bg-red-3 text-red-11',
  orange: 'border-orange-6 bg-orange-3 text-orange-11',
  yellow: 'border-yellow-6 bg-yellow-3 text-yellow-11',
  green: 'border-green-6 bg-green-3 text-green-11',
  teal: 'border-teal-6 bg-teal-3 text-teal-11',
  cyan: 'border-cyan-6 bg-cyan-3 text-cyan-11',
  blue: 'border-blue-6 bg-blue-3 text-blue-11',
  indigo: 'border-indigo-6 bg-indigo-3 text-indigo-11',
  purple: 'border-purple-6 bg-purple-3 text-purple-11',
  pink: 'border-pink-6 bg-pink-3 text-pink-11',
  gray: 'border-gray-6 bg-gray-3 text-gray-11',
};

/** A tone as the page wrote it, or neutral for one that isn't a tone. */
export function toneOf(value: unknown): Tone {
  // Object.hasOwn, not `in`: a page's `tone=constructor` must not resolve through the prototype.
  return typeof value === 'string' && Object.hasOwn(TONE_HUE, value) ? (value as Tone) : 'neutral';
}

/**
 * A label inside a sentence or a heading, sized in em so it tracks the type it
 * sits in, and on the baseline so the line keeps its height.
 */
export function Badge({ label, tone }: { label: string; tone: Tone }) {
  return (
    <span
      data-tone={tone}
      className={`rounded-4 font-600 inline-flex items-center border-1 px-[0.45em] py-[0.2em] align-[0.1em] text-[0.7em] leading-none tracking-wider whitespace-nowrap uppercase ${SCALE[TONE_HUE[tone]]}`}
    >
      {label}
    </span>
  );
}
