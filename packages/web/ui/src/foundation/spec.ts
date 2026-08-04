import radiusTokens from '../../tokens/radius.tokens.json';
import breakpointTokens from '../../tokens/breakpoints.tokens.json';
import motionTokens from '../../tokens/motion.tokens.json';
import typographyTokens from '../../tokens/typography.tokens.json';
import shadowsLightTokens from '../../tokens/shadows.light.tokens.json';
import shadowsDarkTokens from '../../tokens/shadows.dark.tokens.json';
// The live stylesheet, read as text rather than transcribed into TypeScript.
// A transcription would rot the first time someone edits the sheet; parsing the
// files themselves means the "live" column of every view below is whatever the
// app actually ships, by construction.
//
// Every generated sheet, concatenated — the custom properties are split one
// file per token type now, so reading a single file would silently narrow every
// lookup below to whichever family that file happens to own.
import colorsCss from '../../styles/generated/colors.css?raw';
import shadowsCss from '../../styles/generated/shadows.css?raw';
import typographyCss from '../../styles/generated/typography.css?raw';
import radiusCss from '../../styles/generated/radius.css?raw';
import motionCss from '../../styles/generated/motion.css?raw';

const tokensCss = [colorsCss, shadowsCss, typographyCss, radiusCss, motionCss].join('\n');

export interface Token {
  /** Token name without the leading `--`. */
  name: string;
  value: string;
}

// ---------------------------------------------------------------------------
// Live side — what tokens.css defines today
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Spec side — the token set declared in tokens/*.tokens.json
// ---------------------------------------------------------------------------

type TokenGroup = Record<string, { $value: string }>;

function group(source: unknown): TokenGroup {
  return source as TokenGroup;
}

function tokens(source: unknown, prefix: string): Token[] {
  return Object.entries(group(source)).map(([key, token]) => ({
    name: `${prefix}-${key}`,
    value: token.$value,
  }));
}

export interface TextSize extends Token {
  /** The step number, which is also the size in px. */
  step: string;
  lineHeight?: string;
  letterSpacing?: string;
}

const TEXT = group(typographyTokens.text);

/**
 * The nine sizes, without the `--line-height` / `--letter-spacing` companions
 * that share the `text` namespace — those are folded onto their size instead,
 * which is how they are actually used.
 */
export const TEXT_SIZES: TextSize[] = Object.keys(TEXT)
  .filter((key) => !key.includes('--'))
  .map((step) => ({
    name: `text-${step}`,
    step,
    value: TEXT[step]!.$value,
    lineHeight: TEXT[`${step}--line-height`]?.$value,
    letterSpacing: TEXT[`${step}--letter-spacing`]?.$value,
  }));

export const FONT_WEIGHTS = tokens(typographyTokens['font-weight'], 'font-weight');
export const FONT_FAMILIES = tokens(typographyTokens.font, 'font');
export const RADII = tokens(radiusTokens.radius, 'radius');
export const DURATIONS = tokens(motionTokens.duration, 'duration');
export const EASINGS = tokens(motionTokens.ease, 'ease');
export const ANIMATIONS = tokens(motionTokens.animate, 'animate');
export const BREAKPOINTS = tokens(breakpointTokens.breakpoint, 'breakpoint');

export interface ShadowToken {
  name: string;
  light: string;
  dark: string;
}

/**
 * The only family whose value differs by theme, so both are carried.
 *
 * The JSON is keyed `shadow: { xs, md, lg }` — group names the family, leaf is
 * the rung. `name` re-joins the two because every consumer (the drift table,
 * the elevation demo's `valueOf`) matches against the CSS custom property,
 * which is `--shadow-xs`.
 */
export const SHADOWS: ShadowToken[] = Object.keys(group(shadowsLightTokens.shadow)).map((key) => ({
  name: `shadow-${key}`,
  light: group(shadowsLightTokens.shadow)[key]!.$value,
  dark: group(shadowsDarkTokens.shadow)[key]!.$value,
}));

// ---------------------------------------------------------------------------
// Drift — what changes if the proposed set replaces the live one
// ---------------------------------------------------------------------------

/**
 * Values are compared, not names: the proposal renames every token (`--text-ui`
 * becomes `text-13`), so name equality would report the whole system as
 * replaced. Matching on value instead says the useful thing — which live token
 * each proposed one *is*, and which sizes genuinely appear or disappear.
 */
function normalize(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/(^|[\s(,])(-?)(?:0*)(\.\d+|\d+(?:\.\d+)?)/g, (_, lead, sign, num) => `${lead}${sign}${Number.parseFloat(num)}`);
}

export type DriftStatus = 'matched' | 'added' | 'dropped';

export interface DriftRow {
  family: string;
  status: DriftStatus;
  /** Proposed token name — absent when the row is a live token being dropped. */
  spec?: string;
  /** Live token name — absent when the row is a proposed token being added. */
  live?: string;
  value: string;
}

export function driftFor(family: string, spec: Token[], live: Token[]): DriftRow[] {
  const rows: DriftRow[] = [];
  const claimed = new Set<string>();
  for (const token of spec) {
    const match = live.find((l) => !claimed.has(l.name) && normalize(l.value) === normalize(token.value));
    if (match) claimed.add(match.name);
    rows.push({
      family,
      status: match ? 'matched' : 'added',
      spec: token.name,
      live: match?.name,
      value: token.value,
    });
  }
  for (const token of live) {
    if (claimed.has(token.name)) continue;
    rows.push({ family, status: 'dropped', live: token.name, value: token.value });
  }
  return rows;
}

export interface DriftFamily {
  family: string;
  rows: DriftRow[];
  /** Why a family drifts, where the raw counts would mislead. */
  note?: string;
}

/**
 * Drift compares two copies of a value — the sheet's and the spec's — so it
 * only means something for families that HAVE two copies. Border, ring, z,
 * duration and breakpoint are Tailwind-native: `border-1` is 1px because the
 * class says so, and `layout.tokens.json` records which rungs are
 * sanctioned, not what they resolve to. Listing them here would report every
 * rung as `dropped` in perpetuity.
 */
export function drift(): DriftFamily[] {
  return [
    // `[a-z0-9]`, not `[a-z]`: the sizes are numeric now, and a
    // letters-only pattern made every new rung invisible to drift.
    { family: 'text', rows: driftFor('text', TEXT_SIZES, liveTokens(/^text-[a-z0-9]+$/)) },
    { family: 'radius', rows: driftFor('radius', RADII, liveTokens(/^radius-(sm|md|lg|xl)$/)) },
    {
      family: 'shadow',
      rows: driftFor(
        'shadow',
        SHADOWS.map((s) => ({ name: s.name, value: s.light })),
        liveTokens(/^shadow-[a-z]+$/),
      ),
    },
    { family: 'font', rows: driftFor('font', FONT_FAMILIES, liveTokens(/^font-(sans|mono)$/)) },
    {
      family: 'font-weight',
      rows: driftFor('font-weight', FONT_WEIGHTS, liveTokens(/^font-weight-/)),
      note: 'Tailwind ships font-weight utilities without our declaring them; these name the three the design actually uses.',
    },
    { family: 'ease', rows: driftFor('ease', EASINGS, liveTokens(/^ease-/)) },
    { family: 'animate', rows: driftFor('animate', ANIMATIONS, liveTokens(/^animate-/)) },
  ];
}

/**
 * Families that ship no token, and why — rendered where a drift table would be.
 *
 * Border, ring and z-index no longer have token files at all (dropped
 * 2026-08-04). Measured: Tailwind has no `--border-width-*`, `--ring-*` or
 * `--z-*` theme namespace, so `border-7`, `ring-42` and `z-999` all compile to
 * exactly those values. A token file could not have constrained them — there is
 * nothing to clear and nothing to look up — so the rungs the design sanctions
 * are documented in `layout.demo.tsx`, the only place that ever read them.
 */
export const NATIVE_FAMILIES: Record<string, string> = {
  border: 'border-1 / border-2 — the class states the width; any integer compiles.',
  ring: 'ring-3 — same rule as border.',
  z: 'z-10 / z-40 / z-50 — the class IS the layer number; any integer compiles.',
  duration: 'duration-120 / duration-200 / duration-320 — the class IS the millisecond count.',
  breakpoint: "Tailwind's standard sm/md/lg/xl/2xl, unmodified.",
};

/** Counts for a headline, so a page can say "12 matched, 5 added" up front. */
export function driftSummary(families: DriftFamily[] = drift()): Record<DriftStatus, number> {
  const out: Record<DriftStatus, number> = { matched: 0, added: 0, dropped: 0 };
  for (const family of families) for (const row of family.rows) out[row.status] += 1;
  return out;
}
