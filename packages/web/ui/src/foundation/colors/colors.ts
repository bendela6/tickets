import { HUE_TONES, LITERALS, RAMPS, SURFACES, TONE_RAMP } from '../../generated';

/**
 * Contrast analysis over the generated colour tables.
 *
 * The VALUES live in `src/generated/colors.ts`, emitted from
 * `tokens/colors.tokens.json`. What is hand-written here is the maths — WCAG
 * luminance and the pairings the tone system can actually produce — because
 * that is logic, not data, and no generator can derive which combinations a
 * component will put next to each other.
 */

export type Theme = 'light' | 'dark';

/** The eleven ramps, in declaration order — gray last, after the chromatics. */
export const HUES: readonly string[] = HUE_TONES;

/**
 * Rung numbers, derived from the ramps rather than restated.
 *
 * Any ramp can stand for the set — the generator asserts they all carry the
 * same rungs, so a disagreement is a build failure, not a runtime surprise.
 */
export const STEPS = Object.keys(Object.values(RAMPS)[0] ?? {})
  .filter((s) => /^\d+$/.test(s))
  .map(Number);

export type Step = number;

// What each step is for. Identical on every scale, so a step number means one
// thing everywhere — that is the whole point of numbering rather than naming.
// Prose, not data: it cannot be derived from the hexes.
export const STEP_JOBS: Record<number, string> = {
  1: 'app background',
  2: 'subtle background',
  3: 'component background',
  4: 'component hover',
  5: 'component active',
  6: 'subtle border',
  7: 'border, focus ring',
  8: 'border hover',
  9: 'solid fill',
  10: 'solid fill hover',
  11: 'text, low contrast',
  12: 'text, high contrast',
};

/** Hex for a step (`9`) or the scale's contrast token (`'contrast'`). */
export function colorOf(theme: Theme, scale: string, step: Step | 'contrast'): string {
  const ramp = (RAMPS as Record<string, Record<string, { light: string; dark: string }>>)[scale];
  const token = ramp?.[String(step)];
  if (!token) throw new Error(`unknown color token: ${scale}-${step} (${theme})`);
  return token[theme];
}

export const SEMANTIC_SCALES: Record<string, string> = TONE_RAMP;
export { SURFACES, LITERALS };

// ---------------------------------------------------------------------------
// Contrast
// ---------------------------------------------------------------------------

function channel(value: number): number {
  const s = value / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** WCAG 2.x relative luminance. */
export function luminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  const r = channel((n >> 16) & 255);
  const g = channel((n >> 8) & 255);
  const b = channel(n & 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio, 1–21. Order of arguments does not matter. */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

/** 4.5 for body text, 3 for non-text UI whose shape carries information. */
export type ContrastMin = 4.5 | 3;

/**
 * `required` fails the build. `advisory` is reported but does not, because
 * WCAG 1.4.11 only covers visual information *required* to identify a
 * component — an outline chip is identified by its label, so its border is
 * decoration. Holding decoration to 3:1 would force a much heavier chip than
 * the design wants, and a check that everything fails teaches nothing.
 */
export type Severity = 'required' | 'advisory';

export interface Pairing {
  /** `subtle`, `solid`, `text`, `outline-border`, `field-border`. */
  emphasis: string;
  theme: Theme;
  scale: string;
  /** What is being measured — `text` or `border`. */
  what: 'text' | 'border';
  fgLabel: string;
  bgLabel: string;
  fg: string;
  bg: string;
  ratio: number;
  min: ContrastMin;
  severity: Severity;
  passes: boolean;
}

type Side = [label: string, hex: string];

function pair(
  emphasis: string,
  what: 'text' | 'border',
  theme: Theme,
  scale: string,
  fg: Side,
  // A border separates two surfaces and must be visible against both, so the
  // worse side is the one that counts. Text sits on one surface only.
  bgs: Side[],
  min: ContrastMin,
  severity: Severity,
): Pairing {
  let worst = bgs[0]!;
  let ratio = contrastRatio(fg[1], worst[1]);
  for (const bg of bgs.slice(1)) {
    const r = contrastRatio(fg[1], bg[1]);
    if (r < ratio) {
      ratio = r;
      worst = bg;
    }
  }
  // Round before comparing so a 4.499 does not fail on float noise alone.
  const rounded = Math.round(ratio * 100) / 100;
  return {
    emphasis,
    what,
    theme,
    scale,
    fgLabel: fg[0],
    bgLabel: worst[0],
    fg: fg[1],
    bg: worst[1],
    ratio: rounded,
    min,
    severity,
    passes: rounded >= min,
  };
}

/**
 * Every foreground/background combination the tone system can produce, checked
 * against WCAG. One function, two consumers: the gallery renders it and the
 * suite fails on the `required` ones — so the UI and the check cannot disagree
 * about what is broken.
 */
export function checkPairings(scales: readonly string[] = HUES): Pairing[] {
  const out: Pairing[] = [];
  for (const theme of ['light', 'dark'] as const) {
    const page: Side = ['page', colorOf(theme, 'gray', 1)];
    const field: Side = ['field fill', SURFACES.raised![theme]];

    for (const scale of scales) {
      const step = (n: Step): Side => [`step ${n}`, colorOf(theme, scale, n)];
      const contrast: Side = ['contrast', colorOf(theme, scale, 'contrast')];
      out.push(
        pair('subtle', 'text', theme, scale, step(11), [step(3)], 4.5, 'required'),
        pair('solid', 'text', theme, scale, contrast, [step(9)], 4.5, 'required'),
        pair('text', 'text', theme, scale, step(11), [page], 4.5, 'required'),
        pair('outline-border', 'border', theme, scale, step(7), [page], 3, 'advisory'),
      );
    }

    // The one border that genuinely carries information: on an input, nothing
    // but the border says a field is there. Judged against both surfaces it
    // divides.
    out.push(
      pair('field-border', 'border', theme, 'gray', ['step 7', colorOf(theme, 'gray', 7)], [page, field], 3, 'required'),
    );
  }
  return out;
}

/** Only the failures that should block a build. */
export function failingPairings(scales?: readonly string[]): Pairing[] {
  return checkPairings(scales).filter((p) => !p.passes && p.severity === 'required');
}

/** Below target, but decoration rather than information. */
export function advisoryPairings(scales?: readonly string[]): Pairing[] {
  return checkPairings(scales).filter((p) => !p.passes && p.severity === 'advisory');
}
