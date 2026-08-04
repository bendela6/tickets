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
  const { breakpoint } = readTokenFile<BreakpointsDoc>('breakpoints.tokens.json');

  const px = Object.fromEntries(
    Object.entries(breakpoint).map(([name, token]) => [name, Number.parseFloat(token.$value)]),
  );

  const rungs = Object.entries(px)
    .map(([name, value]) => `${indent}--breakpoint-${name}: ${value / PX_PER_REM}rem;\n`)
    .join('');

  return {
    css: `@theme inline {\n${rungs}}\n`,
    ts: tsModule({
      source: 'breakpoints.tokens.json',
      summary:
        'In px, for code that reasons about widths — matchMedia and the panel\n' +
        'hooks. The stylesheet emits the same values in rem; see the generator.',
      declarations: [constant('BREAKPOINTS', px)],
    }),
  };
}
