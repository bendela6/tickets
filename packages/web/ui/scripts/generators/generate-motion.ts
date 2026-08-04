import { readTokenFile } from './utils/read-token-file.ts';
import type { MotionDoc } from './utils/types.ts';

/**
 * `styles/generated/motion.css` — easings, animations and the paint transition.
 *
 * `duration` is read from the same file but deliberately NOT emitted: a Tailwind
 * `duration-200` is already 200ms because the class says so, and a token would
 * be a second copy of the number — the only way the two could disagree. The JSON
 * records which rungs are sanctioned, not what they resolve to.
 *
 * The curves stay named because `cubic-bezier(.2, 0, 0, 1)` has no number a
 * reader can interpret.
 *
 * The two animations deliberately REPLACE Tailwind's built-in `animate-spin` and
 * `animate-pulse`. Their @keyframes keep the `ai-` prefix (declared in
 * index.css) because Tailwind injects its own `spin`/`pulse` keyframes when
 * those utilities compile, and two rules with one name is a last-one-wins race.
 */
export function generateMotion(indent = '  '): string {
  const doc = readTokenFile<MotionDoc>('motion.tokens.json');

  const easings = Object.entries(doc.ease)
    .map(([name, token]) => `${indent}--ease-${name}: ${token.$value};\n`)
    .join('');

  const animations = Object.entries(doc.animate)
    .map(([name, token]) => `${indent}--animate-${name}: ${token.$value};\n`)
    .join('');

  // Not a `--duration-*`/`--ease-*` rung, so it generates no utility of its own.
  // It exists to be read back through `transition-(--transition-paint)` at the
  // three eer diagram call sites, which animate paint only — transform and
  // translate are excluded so dragging a card stays immediate.
  const transitions = Object.entries(doc.transition)
    .map(([name, token]) => `${indent}--transition-${name}: ${token.$value};\n`)
    .join('');

  return `@theme inline {\n${easings}\n${animations}\n${transitions}}\n`;
}
