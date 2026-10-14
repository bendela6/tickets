import { HUES, PALETTE, type Hue } from '../../../../../style';

/**
 * The rung an ANSI foreground is drawn at: 11 for a colour, 9 for its bright
 * twin, 12 for black, the page's own strongest text. A rung rather than a
 * value, so the page's light and dark themes each resolve it.
 */
export type AnsiStep = '9' | '11' | '12';

/** A terminal colour, in the page's terms: a hue and the rung to draw it at. */
export interface AnsiColor {
  hue: Hue;
  step: AnsiStep;
}

// The eight colours of codes 30-37 and 40-47, in their order. Magenta has no
// hue of its own in Instrument and takes purple; black and white take gray,
// at the rungs below.
const STANDARD_HUES: readonly Hue[] = [
  'gray',
  'red',
  'green',
  'yellow',
  'blue',
  'purple',
  'cyan',
  'gray',
];

const BLACK = 0;
const WHITE = 7;

/**
 * One of the sixteen standard colours: 0-7 as 30-37 asks for them, 8-15 as
 * their bright twins (90-97).
 *
 * A colour is drawn at rung 11, its bright twin at 9. Black is the page's
 * strongest text (gray 12) and white a step quieter (gray 11), since a light
 * page has no use for white text; bright black is gray 9, the dim gray a
 * terminal draws it as, and bright white gray 12, louder than white as it is
 * in a terminal.
 */
export function standardColor(index: number): AnsiColor {
  const bright = index >= 8;
  const base = index % 8;
  const hue = STANDARD_HUES[base] ?? 'gray';
  if (base === BLACK) {
    return { hue, step: bright ? '9' : '12' };
  }
  if (base === WHITE) {
    return { hue, step: bright ? '12' : '11' };
  }
  return { hue, step: bright ? '9' : '11' };
}

/** The six levels of each channel in the 256-colour cube (codes 16-231). */
const CUBE_LEVELS = [0, 95, 135, 175, 215, 255];

/**
 * One of the 256 colours of `38;5;n`: the sixteen standard ones, then the
 * 6x6x6 cube and the 24 grays, which have no rung of their own and take the
 * nearest hue.
 */
export function paletteColor(index: number): AnsiColor | undefined {
  if (!Number.isInteger(index) || index < 0 || index > 255) {
    return undefined;
  }
  if (index < 16) {
    return standardColor(index);
  }
  if (index < 232) {
    const cube = index - 16;
    return rgbColor(
      CUBE_LEVELS[Math.floor(cube / 36)] ?? 0,
      CUBE_LEVELS[Math.floor(cube / 6) % 6] ?? 0,
      CUBE_LEVELS[cube % 6] ?? 0,
    );
  }
  const level = 8 + (index - 232) * 10;
  return rgbColor(level, level, level);
}

// Below this much chroma (the spread between the strongest and weakest
// channel, 0-1) a colour reads as gray, whatever its hue angle says.
const GRAY_CHROMA = 0.15;

/**
 * Any colour of `38;2;r;g;b`, as the nearest of Instrument's hues at rung 11.
 *
 * A gray stays gray: near black is the strongest text, as black is; near
 * white is gray 11, as white is; between them it is gray 9, the dim gray a
 * terminal's grays are mostly used for.
 */
export function rgbColor(red: number, green: number, blue: number): AnsiColor | undefined {
  if (
    ![red, green, blue].every(
      (channel) => Number.isInteger(channel) && channel >= 0 && channel <= 255,
    )
  ) {
    return undefined;
  }
  const { angle, chroma, lightness } = hsl(red, green, blue);
  if (chroma < GRAY_CHROMA) {
    if (lightness < 0.25) {
      return standardColor(BLACK);
    }
    if (lightness > 0.8) {
      return standardColor(WHITE);
    }
    return { hue: 'gray', step: '9' };
  }
  return { hue: nearestHue(angle), step: '11' };
}

interface Hsl {
  /** Degrees, 0-360. */
  angle: number;
  /** 0-1. */
  chroma: number;
  /** 0-1. */
  lightness: number;
}

function hsl(red: number, green: number, blue: number): Hsl {
  const r = red / 255;
  const g = green / 255;
  const b = blue / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const chroma = max - min;
  let angle = 0;
  if (chroma > 0) {
    if (max === r) {
      angle = ((g - b) / chroma) % 6;
    } else if (max === g) {
      angle = (b - r) / chroma + 2;
    } else {
      angle = (r - g) / chroma + 4;
    }
    angle *= 60;
    if (angle < 0) {
      angle += 360;
    }
  }
  return { angle, chroma, lightness: (max + min) / 2 };
}

function hexAngle(hex: string): number {
  const value = Number.parseInt(hex.slice(1), 16);
  return hsl((value >> 16) & 255, (value >> 8) & 255, value & 255).angle;
}

// Each chromatic hue's angle, read off its solid rung in the light theme, so
// the table follows the tokens if a hue is ever retuned.
const HUE_ANGLES: readonly (readonly [Hue, number])[] = HUES.filter((hue) => hue !== 'gray').map(
  (hue) => [hue, hexAngle(PALETTE.light.hue[hue]?.['9'] ?? '#000000')] as const,
);

function nearestHue(angle: number): Hue {
  let best: Hue = 'gray';
  let bestDistance = Infinity;
  for (const [hue, hueAngle] of HUE_ANGLES) {
    const apart = Math.abs(angle - hueAngle);
    const distance = Math.min(apart, 360 - apart);
    if (distance < bestDistance) {
      best = hue;
      bestDistance = distance;
    }
  }
  return best;
}
