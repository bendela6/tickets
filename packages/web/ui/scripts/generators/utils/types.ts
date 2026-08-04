/** Shared vocabulary for the token generators. */

export type Theme = 'light' | 'dark';

/**
 * How a token reaches Tailwind. `color` bridges to `--color-<name>`, `shadow`
 * to `--shadow-<rung>` — two different var namespaces, which is the only reason
 * the kind has to ride along with the value instead of being re-derived from it.
 */
export type TokenKind = 'color' | 'shadow';

export interface ResolvedToken {
  value: string;
  type: TokenKind;
}

/** Token name (`gray-1`, `shadow-xs`) to its resolved value, for one theme. */
export type TokenMap = Record<string, ResolvedToken>;

/** What every family generator returns: the same token names, valued per theme. */
export interface FamilyTokens {
  light: TokenMap;
  dark: TokenMap;
}

/** A DTCG leaf. Only `$value` is read; `$type` is documentation for the author. */
export interface DesignToken {
  $type?: string;
  $value: string;
}

/** `colors.{light,dark}.tokens.json` — `{ gray: { 1: …, contrast: … }, … }`. */
export type ColorDoc = Record<string, Record<string, DesignToken>>;

/** `shadows.{light,dark}.tokens.json` — `{ shadow: { xs, md, lg } }`. */
export interface ShadowDoc {
  shadow: Record<string, DesignToken>;
}

/** `typography.tokens.json` — sizes, weights and families, none theme-varying. */
export interface TypographyDoc {
  text: Record<string, DesignToken>;
  'font-weight': Record<string, DesignToken>;
  font: Record<string, DesignToken>;
}

/** `radius.tokens.json` — the four corner rungs. */
export interface RadiusDoc {
  radius: Record<string, DesignToken>;
}

/**
 * `motion.tokens.json`. `duration` is a sanctioned-rung registry that emits
 * nothing — `duration-200` is already 200ms because the Tailwind class says so.
 * The other three do emit.
 */
export interface MotionDoc {
  duration: Record<string, DesignToken>;
  ease: Record<string, DesignToken>;
  animate: Record<string, DesignToken>;
  transition: Record<string, DesignToken>;
}

/** `semantic.tokens.json`. Surfaces and literals carry both themes inline. */
export interface SemanticDoc {
  scale: Record<string, string>;
  surface: Record<string, Record<Theme, string>>;
  literal: Record<string, Record<Theme, string>>;
}

/** One regenerable region of tokens.css, found by its marker comment pair. */
export interface Marker {
  start: string;
  end: string;
  region: string;
}
