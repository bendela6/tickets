import { cn } from '@tickets/ui';
import config from '../../../icons.config.json';

/**
 * The brand mark: the same drawing the favicon and the install icons are
 * generated from. Colours, angles and stroke weight all come from
 * `apps/web/icons.config.json` — the document @tickets/icon-studio writes
 * those assets out of — so the logo in the shell and the icon in the tab
 * cannot drift apart. There is one copy of the values, not two.
 *
 * The config is the `IconDoc` shape (`inks` + `elements`, see
 * `packages/web/icon-studio/src/doc.ts`), not the three-stick shape it used
 * to be. Geometry mirrors the studio's `renderSvg()` for the `favicon`
 * variant: a 48-unit grid, each stick a full diameter through the centre,
 * scaled by that variant's own `scale` (see `stickGeometry` below) exactly
 * as `renderSvg` multiplies every element's reach and weight together for
 * it. The studio is a dev-only package that must stay out of the app's
 * bundle, so the drawing is re-derived here rather than imported — the two
 * files agree by matching convention, not by sharing code.
 */

/** Centre of the 48-unit grid. Locked by the mark spec, same as the studio's `CENTRE`. */
const CENTRE = 24;

/** Rail size. The mobile top bar, sitting next to 15px text, asks for a smaller one. */
const DEFAULT_SIZE = 20;

interface Ink {
  light: string;
  dark: string;
}

/** The one element shape this component knows how to draw. */
interface StickElement {
  id: string;
  ink: string;
  angle: number;
  reach: number;
  weight: number;
}

/**
 * A ring or dot has no `angle` — there is nothing here for it to rotate as a
 * diameter. The shell mark only ever draws sticks; skipping anything else,
 * rather than reading an `angle` that was never there, is what keeps this
 * component from throwing the day the studio's default document grows a
 * ring. (Task 9's brand-mark fix — see the report for why this was chosen
 * over drawing rings/dots too.)
 */
function isStick(element: unknown): element is StickElement {
  if (typeof element !== 'object' || element === null) return false;
  const e = element as Record<string, unknown>;
  return (
    e.type === 'stick'
    && typeof e.id === 'string'
    && typeof e.ink === 'string'
    && typeof e.angle === 'number'
    && typeof e.reach === 'number'
    && typeof e.weight === 'number'
  );
}

const inks = config.inks as Record<string, Ink>;

/**
 * The favicon variant's own `scale` — read as defensively as `config.elements`
 * above, rather than trusted at the type level, because it is JSON and not
 * something TypeScript's structural inference from the current file's shape
 * can be relied on to hold across a future edit. Falls back to 1 (the
 * locked mark's own value) so a document that predates variants, or one
 * missing the favicon entry, still draws at its natural size instead of
 * throwing.
 */
function faviconScale(value: unknown): number {
  if (typeof value !== 'object' || value === null) return 1;
  const variants = (value as Record<string, unknown>).variants;
  if (typeof variants !== 'object' || variants === null) return 1;
  const favicon = (variants as Record<string, unknown>).favicon;
  if (typeof favicon !== 'object' || favicon === null) return 1;
  const scale = (favicon as Record<string, unknown>).scale;
  return typeof scale === 'number' && Number.isFinite(scale) ? scale : 1;
}

const FAVICON_SCALE = faviconScale(config);

/**
 * The path geometry and stroke width for one stick element, scaled by the
 * favicon variant — the same multiplier `render.ts`'s `renderSvg` applies to
 * every element's reach and weight for that variant. Exported as a pure
 * function, decoupled from the module-level `config` import, so the scaling
 * itself is directly testable without mocking a JSON module: the committed
 * fixture's favicon variant is scale 1, so a rendering test against it alone
 * cannot tell "scale applied, and it's 1" apart from "scale ignored".
 */
export function stickGeometry(
  element: Pick<StickElement, 'reach' | 'weight'>,
  scale: number,
): { d: string; strokeWidth: number } {
  const reach = element.reach * scale;
  return {
    d: `M${CENTRE} ${CENTRE - reach}L${CENTRE} ${CENTRE + reach}`,
    strokeWidth: element.weight * scale,
  };
}

/** A missing ink draws black rather than throwing — same posture as the studio's `resolveInk`. */
function inkOf(name: string, mode: 'light' | 'dark'): string {
  return inks[name]?.[mode] ?? '#000';
}

/** Every stick in the document, front to back — `elements[0]` is the one drawn on top. */
const STICKS: StickElement[] = (config.elements as unknown[]).filter(isStick);

/**
 * One custom property per element, keyed by its id — `--brand-top`,
 * `--brand-mid`, `--brand-low` for today's document, but the name follows
 * whatever ids the document actually holds rather than three hardcoded stick
 * names. Declared in document order; a CSS rule's own property order has no
 * effect on the cascade, so this only has to match once, for readability.
 *
 * Custom properties inherit, so a nested `[data-theme='light']` wrapper
 * re-asserting light inside a dark subtree beats the outer dark — which two
 * equal-specificity ancestor rules could never do in both directions at
 * once. This is the same mechanism tokens.css uses for the palette; the
 * mark's triad stays out of the palette because it is brand artwork,
 * deliberately off-scale.
 */
function themeBlock(selector: string, mode: 'light' | 'dark'): string {
  const props = STICKS.map((element) => `--brand-${element.id}:${inkOf(element.ink, mode)}`).join(';');
  return `${selector}{${props}}`;
}

export const BRAND_MARK_CSS = [
  themeBlock(":root,[data-theme='light']", 'light'),
  themeBlock("[data-theme='dark']", 'dark'),
].join('');

/**
 * `elements` reads front to back — `elements[0]` is the one a layer panel
 * would list on top — so, exactly like the studio's renderer
 * (`packages/web/icon-studio/src/generate/render.ts`), painting proceeds in
 * *reverse* document order: the frontmost element is emitted last, since SVG
 * has no z-index and later markup paints over earlier markup. One
 * convention for "who paints on top," shared by both files rather than
 * invented twice.
 */
const PAINT_ORDER = [...STICKS].reverse();

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
        {PAINT_ORDER.map((element) => {
          const { d, strokeWidth } = stickGeometry(element, FAVICON_SCALE);
          return (
            <path
              key={element.id}
              d={d}
              fill="none"
              stroke={`var(--brand-${element.id})`}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              transform={`rotate(${element.angle} ${CENTRE} ${CENTRE})`}
            />
          );
        })}
      </svg>
    </>
  );
}
