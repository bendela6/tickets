import type { Family } from './utils/types.ts';

/**
 * Edge treatment: corner radius.
 *
 * The ONE generator with no token file. `border.tokens.json` was deleted on
 * 2026-08-07 for the same reason `layout.tokens.json` went on 2026-08-04: it
 * had nothing left to emit. Border and ring never could — Tailwind has no
 * `--border-width-*` or `--ring-*` theme namespace, so `border-7` and `ring-42`
 * compile to exactly those widths and only fractions are rejected. Radius
 * joined them the same day: the named rungs (`rounded-sm`, and a second
 * `rounded-control-*` ladder beside it) are gone, and `rounded-<n>` is n pixels
 * for any integer, the way `p-16` is 16px. A file listing values that no longer
 * reach CSS can only describe an agreement, never enforce one — so the six
 * sanctioned radii live where they are read, on the gallery's Radius page.
 *
 * What this generator emits instead is the utility that makes that true.
 * Tailwind's stock `rounded-*` reads `--radius-*` and has NO bare-value form —
 * measured, `rounded-4` compiles to nothing on a stock theme, because radius is
 * not on the `--spacing` scale the way padding is. So the namespace is cleared
 * and the fifteen utilities are redefined over it. Three things survive the
 * redefinition, all measured against Tailwind 4.3.2:
 *
 * - `rounded-full` and `rounded-none` (static utilities, not token reads);
 * - `rounded-[7px]` and friends (the custom utility takes the integer case and
 *   leaves the arbitrary one to core — which is why `--value()` is given
 *   `integer` ALONE. Adding `[length]` to it appends the unit twice and yields
 *   `border-radius: 6pxpx`);
 * - variants — `hover:rounded-4`, `md:rounded-8`.
 *
 * Bare `rounded` does NOT survive, and that is the point: it used to be a silent
 * alias for 4px that no gate objected to.
 *
 * Fractions do not compile (`rounded-4.5` emits nothing), the same constraint
 * `border-3.5` and `ring-1.5` already carry.
 */

/**
 * Every corner utility Tailwind ships, and the properties each one sets — read
 * back out of Tailwind's own output rather than transcribed, because a corner
 * mapped wrong here is a visual bug no test would name.
 *
 * Broadest first: all four corners, then the four sides, then the single
 * corners. Definition order is cascade order, so this is what lets
 * `rounded-8 rounded-t-0` square off just the top.
 */
const CORNERS: [suffix: string, properties: string[]][] = [
  ['', ['border-radius']],
  ['-s', ['border-start-start-radius', 'border-end-start-radius']],
  ['-e', ['border-start-end-radius', 'border-end-end-radius']],
  ['-t', ['border-top-left-radius', 'border-top-right-radius']],
  ['-r', ['border-top-right-radius', 'border-bottom-right-radius']],
  ['-b', ['border-bottom-right-radius', 'border-bottom-left-radius']],
  ['-l', ['border-top-left-radius', 'border-bottom-left-radius']],
  ['-ss', ['border-start-start-radius']],
  ['-se', ['border-start-end-radius']],
  ['-ee', ['border-end-end-radius']],
  ['-es', ['border-end-start-radius']],
  ['-tl', ['border-top-left-radius']],
  ['-tr', ['border-top-right-radius']],
  ['-br', ['border-bottom-right-radius']],
  ['-bl', ['border-bottom-left-radius']],
];

export function generateBorder(indent = '  '): Family {
  const utilities = CORNERS.map(([suffix, properties]) => {
    const body = properties
      .map((property) => `${indent}${property}: calc(--value(integer) * 1px);\n`)
      .join('');
    return `@utility rounded${suffix}-* {\n${body}}\n`;
  }).join('\n');

  return { css: `@theme inline {\n${indent}--radius-*: initial;\n}\n\n${utilities}` };
}
