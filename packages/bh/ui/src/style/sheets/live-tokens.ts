// What the app actually ships, read back out of the stylesheets it ships, for
// the tests that hold the generated sheets to their contracts. Parsing the
// sheets is what makes those tests about the real CSS — a transcription into
// TypeScript would rot the first time someone edited a token.
//
// The SPEC side (what the token files declare) is no longer here. It used to be
// derived from raw JSON imports and compared against this live side by drift().
// Both are generated from the same token files now, so that comparison could
// only ever report "matched" — see src/style/generated/ for the values themselves.
import colorsCss from '../../../styles/generated/colors.css?raw';
import shadowsCss from '../../../styles/generated/shadows.css?raw';
import typographyCss from '../../../styles/generated/typography.css?raw';
import borderCss from '../../../styles/generated/border.css?raw';
import motionCss from '../../../styles/generated/motion.css?raw';
import breakpointsCss from '../../../styles/generated/breakpoints.css?raw';

// Every generated sheet, concatenated — the custom properties are split one
// file per token type, so reading a single file would silently narrow every
// lookup below to whichever family that file happens to own.
const tokensCss = [colorsCss, shadowsCss, typographyCss, borderCss, motionCss, breakpointsCss].join(
  '\n',
);

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
    // Both groups are mandatory in DECLARATION, so this never skips a real
    // declaration — it is what stands in for a non-null assertion.
    if (name === undefined || value === undefined) {
      continue;
    }
    const list = out.get(name) ?? [];
    list.push(value.trim());
    out.set(name, list);
  }
  return out;
}

const LIVE = parseCustomProperties(tokensCss);

/** One level of `var(--x)` indirection — the `@theme` aliases are all one deep. */
function resolve(value: string, theme: 'light' | 'dark' = 'light'): string {
  const match = /^var\(--([\w-]+)\)$/.exec(value);
  if (!match) {
    return value;
  }
  const name = match[1];
  if (name === undefined) {
    return value;
  }
  const values = LIVE.get(name);
  if (!values?.length) {
    return value;
  }
  // `values` is non-empty, so the fallback is unreachable — it is the guard
  // that replaces a non-null assertion on the indexed read.
  return (theme === 'dark' ? values[values.length - 1] : values[0]) ?? value;
}

/** Live tokens whose name matches `pattern`, with `var()` aliases resolved. */
export function liveTokens(pattern: RegExp, theme: 'light' | 'dark' = 'light'): Token[] {
  const out: Token[] = [];
  for (const [name, values] of LIVE) {
    if (!pattern.test(name)) {
      continue;
    }
    const raw = theme === 'dark' ? values[values.length - 1] : values[0];
    // A name only reaches LIVE with at least one value, so this never skips.
    if (raw === undefined) {
      continue;
    }
    out.push({ name, value: resolve(raw, theme) });
  }
  return out;
}
