import { HUES, TONE_HUE, type Hue, type Tone } from '../../../style';
import type { Option } from '../../inputs/contract';

// An option's color as a resource's metadata gives it (OptionMeta.color): any
// bh tone, a role ('success') or a hue ('blue'), where a control paints from a
// hue. A filter form hands its fields the metadata's options as they are.

/** A color as a bh tone, a role or a hue by name; undefined for any other word. */
export function toneOf(color: string | undefined): Tone | undefined {
  return color !== undefined && color in TONE_HUE ? (color as Tone) : undefined;
}

/** The hue a bh tone paints from, a role's or a hue's own; undefined for any other word. */
export function hueOf(color: string | undefined): Hue | undefined {
  const tone = toneOf(color);
  return tone ? TONE_HUE[tone] : undefined;
}

const HUE_NAMES: ReadonlySet<string> = new Set(HUES);

/** The lists already painted, so a list keeps one copy while it is the same list. */
const painted = new WeakMap<readonly Option[], Option[]>();

/**
 * Options with each color painted from its tone's hue ('success' is green),
 * and a color no tone names left out: the list itself when every color is a
 * hue already, else one copy of it for as long as it's the same list.
 */
export function withHues(options: readonly Option[] | undefined): Option[] {
  if (!options) {
    return [];
  }
  if (options.every((option) => option.color === undefined || HUE_NAMES.has(option.color))) {
    return options as Option[];
  }
  let out = painted.get(options);
  if (!out) {
    out = options.map((option) => {
      const { color, ...rest } = option;
      const hue = hueOf(color);
      return hue ? { ...rest, color: hue } : rest;
    });
    painted.set(options, out);
  }
  return out;
}
