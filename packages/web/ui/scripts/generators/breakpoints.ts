import { readTokenFile } from './utils/read-token-file.ts';
import { constant, tsModule } from './utils/ts-module.ts';
import type { BreakpointsDoc, Family } from './utils/types.ts';

const PX_PER_REM = 16;

/**
 * The responsive breakpoints.
 *
 * Emitted in REM, not px, even though the token file declares px. Tailwind's own
 * defaults are rem (`--breakpoint-md: 48rem`), and that difference is not
 * cosmetic: a rem breakpoint responds when a reader raises their browser's
 * default font size, a px one does not. Emitting px would have been a quiet
 * accessibility regression for exactly the people who need the setting.
 *
 * The JSON stays in px because that is how the design states them and how
 * `useIsNarrow` needs to reason about them; the conversion belongs here, once.
 *
 * Emitting at all is what makes this file authoritative. Until 2026-08-04 it
 * merely restated Tailwind's defaults, so changing a value here would have
 * changed nothing.
 */
export function generateBreakpoints(indent = '  '): Family {
  const { breakpoint, container } = readTokenFile<BreakpointsDoc>('breakpoints.tokens.json');

  const toPx = (group: Record<string, { $value: string }>): Record<string, number> =>
    Object.fromEntries(
      Object.entries(group).map(([name, token]) => [name, Number.parseFloat(token.$value)]),
    );

  const px = toPx(breakpoint);
  const containerPx = toPx(container);

  const rem = (prefix: string, values: Record<string, number>): string =>
    Object.entries(values)
      .map(([name, value]) => `${indent}--${prefix}-${name}: ${value / PX_PER_REM}rem;\n`)
      .join('');

  return {
    // `--container-*` is Tailwind v4's container-query namespace: a rung named
    // `form-labels` becomes the `@form-labels:` variant, which applies at that
    // width of the nearest `@container` ancestor rather than the viewport.
    css: `@theme inline {\n${rem('breakpoint', px)}${rem('container', containerPx)}}\n`,
    ts: tsModule({
      source: 'breakpoints.tokens.json',
      summary:
        'In px, for code that reasons about widths — matchMedia and the panel\n' +
        'hooks. The stylesheet emits the same values in rem; see the generator.\n' +
        '`CONTAINERS` measures a form\'s own box, not the viewport, so a form in\n' +
        'a narrow drawer stacks its labels however wide the window is.',
      declarations: [constant('BREAKPOINTS', px), constant('CONTAINERS', containerPx)],
    }),
  };
}
