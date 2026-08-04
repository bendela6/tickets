import { readTokenFile } from './utils/read-token-file.ts';
import { constant, tsModule } from './utils/ts-module.ts';
import type { Family, SpacingDoc } from './utils/types.ts';

/**
 * The spacing multiplier — one value that every spacing utility resolves
 * through.
 *
 * `p-16` compiles to `calc(var(--spacing) * 16)`, so this single number decides
 * whether the 16 means pixels or quarter-rems. At 1px a number in a class name
 * IS pixels, matching `text-13` and `leading-19`. Tailwind's default of
 * 0.25rem made spacing the one family where a number was multiplied by four on
 * its way to the screen.
 *
 * px, not rem, and deliberately unlike the breakpoints: a breakpoint should
 * respond when a reader raises their default font size, because the question is
 * "does the layout still fit". Padding is not that question — a 16px gutter
 * that grows to 20px because someone enlarged their text pushes the text it was
 * supposed to frame. Type scales with the reader; the box around it should not.
 */
export function generateSpacing(indent = '  '): Family {
  const { spacing } = readTokenFile<SpacingDoc>('spacing.tokens.json');

  return {
    css: `@theme inline {\n${indent}--spacing: ${spacing};\n}\n`,
    ts: tsModule({
      source: 'spacing.tokens.json',
      summary: 'The multiplier, for code that needs to convert a rung to pixels.',
      declarations: [constant('SPACING', spacing, 'string')],
    }),
  };
}
