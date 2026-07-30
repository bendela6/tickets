import { cn } from '@tickets/ui';
import config from '../../../icons.config.json';

/**
 * The brand mark: the same three sticks the favicon and the install icons are
 * drawn from. Colours, angles and stroke weight all come from
 * `apps/web/icons.config.json` — the file @tickets/icon-studio generates those
 * assets out of — so the logo in the shell and the icon in the tab cannot
 * drift apart. There is one copy of the values, not two.
 *
 * Geometry mirrors the studio's `svgBare()`: a 48-unit grid with each stick a
 * full diameter through the centre. The studio is a dev-only package that must
 * stay out of the app's bundle, so the drawing is re-derived here rather than
 * imported.
 */

/** Centre of the 48-unit grid, and the bare mark's reach. Both locked by the mark spec. */
const CENTRE = 24;
const REACH = 18;

/** Rail size. The mobile top bar, sitting next to 15px text, asks for a smaller one. */
const DEFAULT_SIZE = 20;

/**
 * The config is JSON, so its arrays type as `string[]` / `number[]` and say
 * nothing about length. Narrowing to a triad once, here, is what lets every
 * stick below read a value the compiler knows exists.
 */
function triad<T>(values: readonly T[], field: string): [T, T, T] {
  const [a, b, c] = values;
  if (a === undefined || b === undefined || c === undefined) {
    throw new Error(`icons.config.json: "${field}" must list three values, got ${values.length}`);
  }
  return [a, b, c];
}

const [topAngle, midAngle, lowAngle] = triad(config.angles, 'angles');

/**
 * Custom properties, not one rule per stick. Custom properties inherit, so a
 * nested `[data-theme='light']` wrapper re-asserting light inside a dark
 * subtree beats the outer dark — which two equal-specificity ancestor rules
 * could never do in both directions at once. This is the same mechanism
 * tokens.css uses for the palette; the mark's triad stays out of the palette
 * because it is brand artwork, deliberately off-scale.
 */
function themeBlock(selector: string, [top, mid, low]: [string, string, string]): string {
  return `${selector}{--brand-top:${top};--brand-mid:${mid};--brand-low:${low}}`;
}

export const BRAND_MARK_CSS = [
  themeBlock(":root,[data-theme='light']", triad(config.light, 'light')),
  themeBlock("[data-theme='dark']", triad(config.dark, 'dark')),
].join('');

/** Painted back to front, so `top` is the stick you see on top. */
const STICKS = [
  { name: 'low', angle: lowAngle, stroke: 'var(--brand-low)' },
  { name: 'mid', angle: midAngle, stroke: 'var(--brand-mid)' },
  { name: 'top', angle: topAngle, stroke: 'var(--brand-top)' },
] as const;

export function BrandMark({ size = DEFAULT_SIZE, className }: { size?: number; className?: string }) {
  return (
    <>
      {/*
        `href` + `precedence` are React 19's stylesheet hoisting: the block is
        lifted into <head> and kept to a single copy however many marks render.
        That keeps the component self-contained — no shell wiring to forget,
        which would leave the strokes resolving to nothing.
      */}
      <style href="brand-mark" precedence="default">
        {BRAND_MARK_CSS}
      </style>
      <svg
        viewBox={`0 0 ${CENTRE * 2} ${CENTRE * 2}`}
        width={size}
        height={size}
        aria-hidden
        className={cn('shrink-0', className)}
      >
        {STICKS.map((stick) => (
          <path
            key={stick.name}
            d={`M${CENTRE} ${CENTRE - REACH}L${CENTRE} ${CENTRE + REACH}`}
            fill="none"
            stroke={stick.stroke}
            strokeWidth={config.bareWeight}
            strokeLinecap="round"
            transform={`rotate(${stick.angle} ${CENTRE} ${CENTRE})`}
          />
        ))}
      </svg>
    </>
  );
}
