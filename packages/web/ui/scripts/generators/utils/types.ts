/** Shared vocabulary for the token generators. */

export type Theme = 'light' | 'dark';

/** A value that differs by theme. Surfaces, ramps and shadows all carry both. */
export interface Themed {
  light: string;
  dark: string;
}

/** Token name (`gray-1`, `shadow-xs`) to its value, for one theme. */
export type TokenMap = Record<string, string>;

/**
 * What every family generator returns.
 *
 * A family may produce a stylesheet, a TypeScript module, or both — breakpoints
 * emit CSS that Tailwind reads AND a module the panel hooks read, while the
 * border widths are documentation and emit no CSS at all.
 */
export interface Family {
  css?: string;
  ts?: string;
}

// ---------------------------------------------------------------------------
// Token document shapes
// ---------------------------------------------------------------------------

/** `colors.tokens.json`. */
export interface ColorsDoc {
  /** `gray: { 1: { light, dark }, contrast: { … } }` — eleven perceptual scales. */
  ramp: Record<string, Record<string, Themed>>;
  /** A JOB (`danger`) to the ramp that currently does it (`red`). */
  role: Record<string, string>;
  /** Defined by what they sit above, which no ramp step expresses. */
  surface: Record<string, Themed>;
  /** Chosen for recognition rather than contrast — a highlighter is yellow. */
  literal: Record<string, Themed>;
}

/** `shadows.tokens.json`. */
export interface ShadowsDoc {
  shadow: Record<string, Themed>;
}

/** `typography.tokens.json`. */
export interface TypographyDoc {
  text: Record<string, { $value: string }>;
  'font-weight': Record<string, { $value: string }>;
  font: Record<string, { $value: string }>;
}

/** `border.tokens.json`. Only `radius` reaches CSS; the rest is documentation. */
export interface BorderDoc {
  radius: Record<string, string>;
  width: number[];
  ring: number[];
}

/** `motion.tokens.json`. `duration` is sanctioned rungs and emits nothing. */
export interface MotionDoc {
  duration: Record<string, { $value: string }>;
  ease: Record<string, { $value: string }>;
  animate: Record<string, { $value: string }>;
  transition: Record<string, { $value: string }>;
}

/** `breakpoints.tokens.json`. */
export interface BreakpointsDoc {
  breakpoint: Record<string, { $value: string }>;
}
