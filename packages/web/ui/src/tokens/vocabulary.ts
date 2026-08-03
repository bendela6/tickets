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
 * The trees that consume `tokens.css`.
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
  // Arbitrary radii, the four rungs cleared to `initial`, and bare `rounded`
  // / `rounded-<side>` with no rung at all (Tailwind's static 0.25rem
  // default). The corner-suffix alternative is an explicit whitelist rather
  // than a generic `[a-z]{1,2}`, because `sm`/`md`/`lg`/`xl` are themselves
  // two lowercase letters — a generic group would swallow a real rung
  // (`rounded-sm`) as if it were a side suffix and let the bare branch below
  // match right past it.
  radius:
    /(?<![\w-])rounded(-t|-r|-b|-l|-tl|-tr|-bl|-br|-ss|-se|-ee|-es)?(?:-(\[[^\]\n]+\]|xs|2xl|3xl|4xl)|(?![\w-]))/g,
  // Bare `border` / `border-b` (width utilities with no number), and 1.5px.
  // The left boundary includes `:` so a variant-prefixed bare form
  // (`disabled:border`) is caught too — a bare word preceded by a Tailwind
  // state variant is still a real, functional utility, not prose.
  border: /(?<=[\s"'`{:])border(-[trblxy])?(?=[\s"'`}])|(?<![\w-])border(-[trblxy])?-\[1\.5px\]/g,
  ring: /(?<![\w-])ring-(\[3px\]|\(length:--ring-focus\))/g,
  // `z-30` used to be retired as off-ladder, back when layout.tokens.json
  // sanctioned only 10/40/50. The ladder is now Tailwind's full 0/10/20/30/40/50,
  // so 30 is a rung and only `z-3` is left — that one is not a layer at all but a
  // `z-3` typo for `z-30`, which lands a would-be overlay under everything.
  z: /(?<![\w-])z-3(?![\w-])/g,
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

/**
 * Which families get the reviewed-baseline ratchet rather than a flat
 * zero-tolerance scan, and where each one's reviewed non-matches live. Only
 * families whose retired pattern matches on bare, undecorated English words
 * (currently `border`'s bare-width words and `radius`'s bare `rounded`) can
 * ever collide with prose/identifiers — `ring` and `z`'s patterns require a
 * `-[…]`/numeric suffix no comment would ever spell out, so they stay exact:
 * `scanRetired('ring' | 'z')` must always be `[]`, no baseline needed.
 *
 * A baseline is its own small JSON file per family, not one file keyed by
 * family, because `readBaseline()` (in `scan-hardcoded-values.mjs`)
 * hard-validates `{ violations: string[] }` — a flat array of strings.
 * Nesting a second family under one `violations` key
 * would fail that shared validator (or require changing a contract another
 * script also depends on) for no benefit: one small file per family is a
 * strictly smaller, safer change than reshaping a validator two scripts share.
 */
const BASELINE_FILES: Partial<Record<RetiredFamily, string>> = {
  border: join(HERE, '..', '..', 'scripts', 'border-baseline.json'),
  radius: join(HERE, '..', '..', 'scripts', 'radius-baseline.json'),
};

/**
 * `RETIRED.border` and `RETIRED.radius`'s bare-word alternatives match
 * between class-string-shaped delimiters, so neither can tell a real
 * Tailwind class apart from prose, a comment, a test description, a data/enum
 * string literal like `'text' | 'border'`, or (for `radius`) a local
 * identifier like `const rounded = …` — tightening either regex to exclude
 * those shapes starts rejecting real class strings too (see each baseline
 * file's own `_comment`). So both families get a reviewed-baseline ratchet,
 * built on the same `readBaseline()`/`diffAgainstBaseline()` exported by
 * `scan-hardcoded-values.mjs`: every hit is keyed on `path::fullLineText`
 * (not a line number, which churns on unrelated edits), and anything not
 * already in that family's baseline file is a real, unswept site.
 *
 * `fresh` — current hits absent from the baseline; must be empty, or one of
 * these is a real unswept site.
 * `fixed` — baseline entries with no current match; must also be empty, or
 * the baseline has rotted into stale excuses for lines that no longer exist
 * in that shape (the baseline "must only shrink" — a fixed entry means the
 * line changed and the baseline needs pruning, not that it can stay).
 */
export function scanAgainstBaseline(family: RetiredFamily): { fresh: string[]; fixed: string[] } {
  const baselineFile = BASELINE_FILES[family];
  if (!baselineFile) {
    throw new Error(`no baseline file configured for family "${family}" — use scanRetired instead`);
  }
  const hits = collectHits(family).map((h) => ({
    key: `${h.file}::${h.lineText}`,
    line: `${h.file}:${h.line}: ${h.text}`,
  }));
  const baseline = readBaseline(baselineFile) as string[];
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
