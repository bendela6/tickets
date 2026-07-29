import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
// @ts-expect-error — plain .mjs module without type declarations, same
// cross-boundary import `scan-baseline.test.ts` already relies on.
import { diffAgainstBaseline, readBaseline } from '../../scripts/scan-hardcoded-values.mjs';

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
  border: /(?<=[\s"'`{])border(-[trblxy])?(?=[\s"'`}])|(?<![\w-])border(-[trblxy])?-\[1\.5px\]/g,
  ring: /(?<![\w-])ring-(\[3px\]|\(length:--ring-focus\))/g,
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

type Hit = {
  /** Repo-relative, POSIX-separated path. */
  file: string;
  line: number;
  /** The matched token, trimmed (e.g. `border`, `border-b`). */
  text: string;
  /** The full source line, trimmed — stable across unrelated edits elsewhere
   *  in the file, unlike a line number, so this is what baseline keys use. */
  lineText: string;
};

function collectHits(family: RetiredFamily): Hit[] {
  const hits: Hit[] = [];
  for (const root of ROOTS) {
    for (const file of walk(root)) {
      const lines = readFileSync(file, 'utf8').split('\n');
      const relFile = relative(REPO_ROOT, file).split(sep).join('/');
      lines.forEach((line, i) => {
        for (const match of line.matchAll(RETIRED[family])) {
          hits.push({ file: relFile, line: i + 1, text: match[0].trim(), lineText: line.trim() });
        }
      });
    }
  }
  return hits;
}

/** Every occurrence of `family`'s retired forms, as `path:line: text`. */
export function scanRetired(family: RetiredFamily): string[] {
  return collectHits(family).map((h) => `${h.file}:${h.line}: ${h.text}`);
}

const BORDER_BASELINE_FILE = join(HERE, '..', '..', 'scripts', 'border-baseline.json');

/**
 * `RETIRED.border` matches a bare word between class-string-shaped
 * delimiters, so it cannot tell a real Tailwind class apart from prose, a
 * comment, a test description, or a data/enum string literal like
 * `'text' | 'border'` — tightening the regex to exclude those shapes starts
 * rejecting real class strings too (see `border-baseline.json`'s `_comment`).
 * So `border` gets the same reviewed-baseline ratchet
 * `scan-hardcoded-values.mjs` already uses for `apps/eer`: every hit is keyed
 * on `path::fullLineText` (not a line number, which churns on unrelated
 * edits), and anything not already in `border-baseline.json` is a real,
 * unswept site.
 *
 * `fresh` — current hits absent from the baseline; must be empty, or one of
 * these is a real bare-border site that still needs sweeping.
 * `fixed` — baseline entries with no current match; must also be empty, or
 * the baseline has rotted into stale excuses for lines that no longer exist
 * in that shape (the baseline "must only shrink" — a fixed entry means the
 * line changed and the baseline needs pruning, not that it can stay).
 */
export function scanBorderAgainstBaseline(): { fresh: string[]; fixed: string[] } {
  const hits = collectHits('border').map((h) => ({
    key: `${h.file}::${h.lineText}`,
    line: `${h.file}:${h.line}: ${h.text}`,
  }));
  const baseline = readBaseline(BORDER_BASELINE_FILE) as string[];
  const currentKeys = [...new Set(hits.map((h) => h.key))];
  const { fresh, fixed } = diffAgainstBaseline(currentKeys, baseline) as {
    fresh: string[];
    fixed: string[];
  };
  const freshSet = new Set(fresh);
  return {
    fresh: hits.filter((h) => freshSet.has(h.key)).map((h) => h.line),
    fixed,
  };
}
