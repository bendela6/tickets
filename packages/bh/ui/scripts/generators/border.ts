import type { Family } from './utils/types.ts';

/**
 * Edge treatment: corner radius and the width of every edge you can draw.
 *
 * The ONE generator with no token file. `border.tokens.json` was deleted on
 * 2026-08-07 for the same reason `layout.tokens.json` went on 2026-08-04: it had
 * nothing left to emit. A file listing values that no longer reach CSS can only
 * describe an agreement, never enforce one — so the sanctioned rungs live where
 * they are read, in the docs site's `tokens` block (its radius and borders
 * tables).
 *
 * What it emits instead is utility DEFINITIONS. Two halves, redefined for
 * opposite reasons, both so that the number in the class IS the pixel count the
 * way `p-16` is 16px:
 *
 * - RADIUS has no bare-value form at all. Stock `rounded-*` reads `--radius-*`,
 *   and radius is not on the `--spacing` scale the way padding is — measured,
 *   `rounded-4` compiles to nothing on a stock theme. So the namespace is
 *   cleared and the fifteen corner utilities are redefined over it.
 * - WIDTHS have a bare-value form that rejects fractions. Measured, `border-1.5`
 *   and `ring-1.5` compile to nothing — silently, which is how a control once
 *   ended up with no visible focus ring at all. So the eleven width utilities
 *   are redefined to accept `--value(number)`.
 *
 * Four things survive both redefinitions, all measured against Tailwind 4.3.2:
 *
 * - `rounded-full` / `rounded-none`, and `border-solid` / `border-dashed` —
 *   static utilities, not value reads;
 * - the colour half of the `border-*` namespace. `border-gray-6` is untouched:
 *   `--value(number)` matches a number and nothing else, so core still owns
 *   colours, and tailwind-merge still buckets width and colour separately
 *   (verified — `border-1.5 border-gray-6` keeps both);
 * - arbitrary values (`rounded-[7px]`, `border-[1.5px]`), which core keeps. That
 *   is why `--value()` is given ONE type. Adding `[length]` beside it appends
 *   the unit twice and yields `border-radius: 6pxpx`;
 * - variants — `hover:rounded-4`, `focus:border-1.5`.
 *
 * Bare `rounded` does NOT survive, and that is the point: it used to be a silent
 * alias for 4px that no gate objected to. Bare `border` still does, because
 * Tailwind defines it statically and there is no namespace to clear.
 *
 * TWO TRAPS live in the width half, both measured:
 *
 * 1. **Every `var()` needs an inline fallback.** Tailwind registers
 *    `--tw-border-style` and the ring chain through `@property`, but only when
 *    one of ITS utilities is in the bundle. A page using `border-1.5` and no
 *    core border class gets no registration, `var(--tw-border-style)` resolves
 *    to nothing, and the declaration is dropped — a border that silently does
 *    not paint. `var(--tw-border-style, solid)` is immune either way, and still
 *    yields to `border-dashed`, which sets the property.
 * 2. **Integers now emit twice** — core's `border-width: 2px` and ours
 *    `calc(2 * 1px)`, in that order, one duplicate rule per distinct class.
 *    Identical rendering, ours wins, and it cannot be avoided: `--value()` has
 *    no "fractions only" filter and there is no width namespace to clear.
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

/**
 * The border edges, as `utility name -> CSS property stem`. Every one expands to
 * a `-style` and a `-width`, which is what core does — dropping the style line
 * would leave `border-1.5` invisible under preflight's `border: 0 solid`.
 *
 * Logical properties for x/y/s/e, physical for t/r/b/l, exactly as Tailwind
 * maps them. Read back from its output, not transcribed.
 */
const EDGES: [utility: string, property: string][] = [
  ['border', 'border'],
  ['border-x', 'border-inline'],
  ['border-y', 'border-block'],
  ['border-s', 'border-inline-start'],
  ['border-e', 'border-inline-end'],
  ['border-t', 'border-top'],
  ['border-r', 'border-right'],
  ['border-b', 'border-bottom'],
  ['border-l', 'border-left'],
];

/** `calc(--value(number) * 1px)` — the one expression both halves share. */
const WIDTH = 'calc(--value(number) * 1px)';

/**
 * The ring's box-shadow chain, copied from core's own `ring-2` output with every
 * `var()` given the fallback core's `@property` block would otherwise supply.
 *
 * This is the one definition that duplicates Tailwind INTERNALS rather than a
 * CSS property name, so it is the one that can rot silently if a future version
 * recomposes the chain. `spec.test.ts` pins it: it compiles `ring-2` against
 * stock Tailwind and against this sheet, and fails if the two disagree on
 * anything but the width literal.
 */
const RING = [
  '--tw-ring-shadow: var(--tw-ring-inset,) 0 0 0 ' +
    `calc(${WIDTH} + var(--tw-ring-offset-width, 0px)) var(--tw-ring-color, currentcolor)`,
  'box-shadow: var(--tw-inset-shadow, 0 0 #0000), var(--tw-inset-ring-shadow, 0 0 #0000), ' +
    'var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow), var(--tw-shadow, 0 0 #0000)',
];

export function generateBorder(indent = '  '): Family {
  const utility = (name: string, declarations: string[]): string => {
    return `@utility ${name}-* {\n${declarations.map((d) => `${indent}${d};\n`).join('')}}\n`;
  };

  const radius = CORNERS.map(([suffix, properties]) => {
    return utility(
      `rounded${suffix}`,
      properties.map((property) => `${property}: ${WIDTH}`),
    );
  });

  const widths = [
    ...EDGES.map(([name, property]) => {
      return utility(name, [
        `${property}-style: var(--tw-border-style, solid)`,
        `${property}-width: ${WIDTH}`,
      ]);
    }),
    utility('outline', [
      'outline-style: var(--tw-outline-style, solid)',
      `outline-width: ${WIDTH}`,
    ]),
    utility('ring', RING),
  ];

  return {
    css:
      `@theme inline {\n${indent}--radius-*: initial;\n}\n\n` +
      `${radius.join('\n')}\n${widths.join('\n')}`,
  };
}
