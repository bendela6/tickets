import radiusTokens from '../tokens/next/radius.tokens.json';
import layoutTokens from '../tokens/next/layout.tokens.json';
import motionTokens from '../tokens/next/motion.tokens.json';
import typographyTokens from '../tokens/next/typography.tokens.json';
import shadowsLightTokens from '../tokens/next/shadows.light.tokens.json';
import shadowsDarkTokens from '../tokens/next/shadows.dark.tokens.json';
// The live stylesheet, read as text rather than transcribed into TypeScript.
// A transcription would rot the first time someone edits tokens.css; parsing
// the file itself means the "live" column of every view below is whatever the
// app actually ships, by construction.
import tokensCss from '../tokens/tokens.css?raw';

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
// Spec side — the numbered set proposed in tokens/next
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
export const BORDERS = tokens(layoutTokens.border, 'border');
export const RINGS = tokens(layoutTokens.ring, 'ring');
export const LAYERS = tokens(layoutTokens.z, 'z');
export const BREAKPOINTS = tokens(layoutTokens.breakpoint, 'breakpoint');

export interface ShadowToken {
  name: string;
  light: string;
  dark: string;
}

/** The only family whose value differs by theme, so both are carried. */
export const SHADOWS: ShadowToken[] = Object.keys(group(shadowsLightTokens.ins)).map((key) => ({
  name: key,
  light: group(shadowsLightTokens.ins)[key]!.$value,
  dark: group(shadowsDarkTokens.ins)[key]!.$value,
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
 * `text` compares sizes only. Line-heights ride along with their size, and a
 * live line-height of `1.45` would otherwise "match" an unrelated one.
 */
export function drift(): DriftFamily[] {
  return [
    // `[a-z0-9]`, not `[a-z]`: the sizes are moving to numeric names, and a
    // letters-only pattern made every new rung invisible to drift — reported
    // as proposed-but-not-live while it sat in tokens.css all along.
    { family: 'text', rows: driftFor('text', TEXT_SIZES, liveTokens(/^text-[a-z0-9]+$/)) },
    // Narrowed to the four live rungs: xs/2xl/3xl/4xl are `initial` —
    // declarations of absence, not tokens — and matching them would report
    // the scale as drifting from itself over an unmatchable value.
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
    { family: 'duration', rows: driftFor('duration', DURATIONS, liveTokens(/^duration-/)) },
    { family: 'ease', rows: driftFor('ease', EASINGS, liveTokens(/^ease-/)) },
    { family: 'animate', rows: driftFor('animate', ANIMATIONS, liveTokens(/^animate-/)) },
    {
      family: 'border',
      rows: driftFor('border', BORDERS, liveTokens(/^border-[a-z]+$/)),
      note: 'The live sheet has one width, named `hair`; the proposal splits it into thin and thick.',
    },
    { family: 'ring', rows: driftFor('ring', RINGS, liveTokens(/^ring-/)) },
    { family: 'z', rows: driftFor('z', LAYERS, liveTokens(/^z-/)) },
    {
      family: 'breakpoint',
      rows: driftFor('breakpoint', BREAKPOINTS, liveTokens(/^breakpoint-/)),
      note: 'Breakpoints are currently written inline at each call site; naming them is new.',
    },
  ];
}

/** Counts for a headline, so a page can say "12 matched, 5 added" up front. */
export function driftSummary(families: DriftFamily[] = drift()): Record<DriftStatus, number> {
  const out: Record<DriftStatus, number> = { matched: 0, added: 0, dropped: 0 };
  for (const family of families) for (const row of family.rows) out[row.status] += 1;
  return out;
}
