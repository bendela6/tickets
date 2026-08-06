// What the app actually ships, read back out of the stylesheets it ships.
//
// The gallery's foundation pages claim to show the live token values. Parsing
// the generated sheets is what makes that true by construction — a transcription
// into TypeScript would rot the first time someone edited a token.
//
// The SPEC side (what the token files declare) is no longer here. It used to be
// derived from raw JSON imports and compared against this live side by drift().
// Both are generated from the same token files now, so that comparison could
// only ever report "matched" — see src/style/generated/ for the values themselves.
import colorsCss from '../../styles/generated/colors.css?raw';
import shadowsCss from '../../styles/generated/shadows.css?raw';
import typographyCss from '../../styles/generated/typography.css?raw';
import borderCss from '../../styles/generated/border.css?raw';
import motionCss from '../../styles/generated/motion.css?raw';
import breakpointsCss from '../../styles/generated/breakpoints.css?raw';

// Every generated sheet, concatenated — the custom properties are split one
// file per token type, so reading a single file would silently narrow every
// lookup below to whichever family that file happens to own.
const tokensCss = [colorsCss, shadowsCss, typographyCss, borderCss, motionCss, breakpointsCss].join('\n');

export interface Token {
  /** Token name without the leading `--`. */
  name: string;
  value: string;
}

const DECLARATION = /--([\w-]+)\s*:\s*([^;]+);/g;

/**
 * Every custom property in the sheet, in source order. A name maps to a list
 * because the theme-varying ones are declared twice — once under `:root` and
 * again under `[data-theme='dark']` — so the first value is the light one and
 * the last is the dark one.
 */
export function parseCustomProperties(css: string): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const [, name, value] of css.matchAll(DECLARATION)) {
    const list = out.get(name!) ?? [];
    list.push(value!.trim());
    out.set(name!, list);
  }
  return out;
}

const LIVE = parseCustomProperties(tokensCss);

/** One level of `var(--x)` indirection — the `@theme` aliases are all one deep. */
function resolve(value: string, theme: 'light' | 'dark' = 'light'): string {
  const match = /^var\(--([\w-]+)\)$/.exec(value);
  if (!match) return value;
  const values = LIVE.get(match[1]!);
  if (!values?.length) return value;
  return theme === 'dark' ? values[values.length - 1]! : values[0]!;
}

/** Live tokens whose name matches `pattern`, with `var()` aliases resolved. */
export function liveTokens(pattern: RegExp, theme: 'light' | 'dark' = 'light'): Token[] {
  const out: Token[] = [];
  for (const [name, values] of LIVE) {
    if (!pattern.test(name)) continue;
    const raw = theme === 'dark' ? values[values.length - 1]! : values[0]!;
    out.push({ name, value: resolve(raw, theme) });
  }
  return out;
}

/**
 * A generated record as the `{ name, value }` rows the spec tables render.
 *
 * The generated modules export records, because a record is what CODE wants —
 * `RADII.md`, `BREAKPOINTS.lg`. The gallery is the one consumer that wants a
 * list, and prefixing the key here is what turns `md` into the custom-property
 * name a reader can search for.
 */
export function specRows(prefix: string, record: Record<string, string | number>): Token[] {
  return Object.entries(record).map(([key, value]) => ({
    name: `${prefix}-${key}`,
    value: String(value),
  }));
}

/**
 * Families that ship no CSS token, and why — rendered where a value table would
 * otherwise be.
 *
 * Measured: Tailwind has no `--border-width-*`, `--ring-*` or `--z-*` theme
 * namespace, so these are bare-value utilities and `border-7`, `ring-42` and
 * `z-999` all compile. No token file could have constrained them.
 */
export const NATIVE_FAMILIES: Record<string, string> = {
  border: 'border-1 / border-2 — the class states the width; any integer compiles.',
  ring: 'ring-3 — same rule as border.',
  z: 'z-10 / z-40 / z-50 — the class IS the layer number; any integer compiles.',
  duration: 'duration-120 / duration-200 / duration-320 — the class IS the millisecond count.',
};
