import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Repo root, from `packages/web/ui/src/tokens/`. `fileURLToPath` rather than
 *  `import.meta.dirname`, which Vite does not populate in every transform mode. */
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..', '..', '..');

/**
 * The trees that consume `tokens.css`. `apps/eer` is deliberately absent — it
 * declares its own `@theme` with different radius values, so its classes are
 * not this vocabulary's to police.
 */
const ROOTS = [
  join(REPO_ROOT, 'packages', 'web', 'ui', 'src'),
  join(REPO_ROOT, 'packages', 'web', 'playground', 'src'),
  join(REPO_ROOT, 'apps', 'web', 'src'),
];

/**
 * Generated files restate what their generator emits; scanning them double-counts.
 * `vocabulary.test.ts` is skipped for a related reason: it unit-tests `RETIRED`
 * against literal retired-form strings (`rounded-[7px]`, `rounded-xs`, …) as
 * fixtures, so it always "contains" retired forms by design — that's not a
 * real call site left to sweep.
 */
const SKIP = new Set([
  'tones.generated.ts',
  'safelist.generated.css',
  'vocabulary.ts',
  'vocabulary.test.ts',
]);

export type RetiredFamily = 'radius' | 'border' | 'ring' | 'z';

/**
 * A retired form per family. Written against class-string contents, so each
 * pattern demands a quote, space, backtick or brace boundary on the left —
 * otherwise `border` matches inside `border-gray-6` and every colour utility
 * in the tree reports as a violation.
 */
export const RETIRED: Record<RetiredFamily, RegExp> = {
  // Arbitrary radii, plus the four rungs cleared to `initial`.
  radius: /(?<![\w-])rounded(-[a-z]{1,2})?-(\[[^\]\n]+\]|xs|2xl|3xl|4xl)(?![\w-])/g,
  // Bare `border` / `border-b` (width utilities with no number), and 1.5px.
  border: /(?<=[\s"'`{])border(-[trblxy])?(?=[\s"'`}])|border(-[trblxy])?-\[1\.5px\]/g,
  ring: /ring-\[3px\]|ring-\(length:--ring-focus\)/g,
  z: /(?<![\w-])z-(3|30)(?![\w-])/g,
};

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (/\.(ts|tsx)$/.test(entry.name) && !SKIP.has(entry.name)) yield full;
  }
}

/** Every occurrence of `family`'s retired forms, as `path:line: text`. */
export function scanRetired(family: RetiredFamily): string[] {
  const hits: string[] = [];
  for (const root of ROOTS) {
    for (const file of walk(root)) {
      const lines = readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, i) => {
        for (const match of line.matchAll(RETIRED[family])) {
          hits.push(`${relative(REPO_ROOT, file).split(sep).join('/')}:${i + 1}: ${match[0].trim()}`);
        }
      });
    }
  }
  return hits;
}
