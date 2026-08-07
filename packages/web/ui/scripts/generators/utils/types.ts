/** Shared vocabulary for the token generators. */

export type Theme = 'light' | 'dark';

/** A pair of theme blocks of the same shape. */
export interface ByTheme<T> {
  light: T;
  dark: T;
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

/** One theme's worth of colour. */
export interface ColorTheme {
  /** `gray: { 1: '#f7f6f2', contrast: '#ffffff' }` — eleven perceptual scales. */
  hue: Record<string, Record<string, string>>;
  /** Defined by what they sit above, which no hue step expresses. */
  surface: Record<string, string>;
  /** Chosen for recognition rather than contrast — a highlighter is yellow. */
  literal: Record<string, string>;
}

/**
 * `colors.tokens.json`. Theme at the ROOT, so each block reads as a palette.
 *
 * `role` sits outside them because it does not vary by theme: it maps a JOB
 * (`danger`) to the hue that currently does it (`red`), and putting it under
 * one theme would duplicate it and invite the copies to disagree.
 */
export interface ColorsDoc extends ByTheme<ColorTheme> {
  role: Record<string, string>;
}

/** `shadows.tokens.json`. Rung to value, one block per theme. */
export type ShadowsDoc = ByTheme<Record<string, string>>;

/** `typography.tokens.json`. */
export interface TypographyDoc {
  text: Record<string, { $value: string }>;
  'font-weight': Record<string, { $value: string }>;
  font: Record<string, { $value: string }>;
}

// `border` has no Doc type: it reads no token file. Every edge family is a
// bare-value utility, so the number in the class IS the pixel count and there
// was never a value to declare — see `generators/border.ts`.

/** `motion.tokens.json`. `duration` is sanctioned rungs and emits nothing. */
export interface MotionDoc {
  duration: Record<string, { $value: string }>;
  ease: Record<string, { $value: string }>;
  animate: Record<string, { $value: string }>;
  transition: Record<string, { $value: string }>;
}

/** `spacing.tokens.json`. One value: the multiplier every rung resolves through. */
export interface SpacingDoc {
  spacing: string;
}

/** `breakpoints.tokens.json`. */
export interface BreakpointsDoc {
  breakpoint: Record<string, { $value: string }>;
  /**
   * Container-query widths. A different axis from `breakpoint`, not more of the
   * same: these measure the element a form is laid out inside, so a form in a
   * narrow drawer stacks its labels no matter how wide the window is.
   */
  container: Record<string, { $value: string }>;
}
