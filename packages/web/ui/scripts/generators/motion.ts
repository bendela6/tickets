import { readTokenFile } from './utils/read-token-file.ts';
import { constant, tsModule } from './utils/ts-module.ts';
import type { Family, MotionDoc } from './utils/types.ts';

/**
 * Easings, animations and the paint transition.
 *
 * `duration` is read but deliberately NOT emitted: `duration-200` is already
 * 200ms because the Tailwind class says so, and a token would be a second copy
 * of the number — the only way the two could disagree. The JSON records which
 * rungs are sanctioned, not what they resolve to.
 *
 * The curves stay named because `cubic-bezier(.2, 0, 0, 1)` has no number a
 * reader can interpret.
 *
 * The two animations deliberately REPLACE Tailwind's built-in `animate-spin`
 * and `animate-pulse`. Their @keyframes keep the `ai-` prefix (declared in
 * styles/index.css) because Tailwind injects its own `spin`/`pulse` keyframes
 * when those utilities compile, and two rules with one name is a last-one-wins
 * race.
 */
export function generateMotion(indent = '  '): Family {
  const doc = readTokenFile<MotionDoc>('motion.tokens.json');

  const decls = (entries: Record<string, { $value: string }>, prefix: string): string =>
    Object.entries(entries)
      .map(([key, token]) => `${indent}--${prefix}-${key}: ${token.$value};\n`)
      .join('');

  return {
    // `--transition-paint` generates no utility of its own; it exists to be read
    // back through `transition-(--transition-paint)` at the eer diagram call
    // sites, which animate paint only so dragging a card stays immediate.
    css:
      `@theme inline {\n` +
      decls(doc.ease, 'ease') +
      `\n` +
      decls(doc.animate, 'animate') +
      `\n` +
      decls(doc.transition, 'transition') +
      `}\n`,
    ts: tsModule({
      source: 'motion.tokens.json',
      summary: 'DURATIONS are sanctioned rungs — the class states the milliseconds.',
      declarations: [
        constant('DURATIONS', Object.keys(doc.duration)),
        constant('EASINGS', Object.fromEntries(Object.entries(doc.ease).map(([k, v]) => [k, v.$value]))),
        constant('ANIMATIONS', Object.fromEntries(Object.entries(doc.animate).map(([k, v]) => [k, v.$value]))),
      ],
    }),
  };
}
