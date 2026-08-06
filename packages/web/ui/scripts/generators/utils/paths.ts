import path from 'node:path';
import { fileURLToPath } from 'node:url';

// `fileURLToPath` rather than `import.meta.dirname`, matching the rest of the
// package: node populates both, but vitest may transform these modules, and
// Vite does not fill in `import.meta.dirname` in every transform mode.
const HERE = path.dirname(fileURLToPath(import.meta.url));

/** `scripts/generators/`. Build tooling — deliberately outside `src/`, so the
 *  package barrel cannot reach it and `node:fs` cannot land in a browser bundle. */
const GENERATORS_DIR = path.join(HERE, '..');

/** `packages/web/ui/`. */
const PACKAGE_ROOT = path.join(GENERATORS_DIR, '..', '..');

/**
 * The DTCG token sources — `tokens/*.tokens.json` at the package root.
 *
 * Deliberately NOT under `src/`: these are the design decisions the package is
 * built FROM, not code it ships. The distinction is worth the directory —
 * `src/tokens/` now holds only what comes out the other side (tokens.css and
 * the generated safelist), so "input" and "output" are never in one folder.
 *
 * Every consumer reads these by path — this file, and `src/docs/pages/spec.ts` /
 * `src/docs/pages/colors/` by relative import. There is deliberately no barrel:
 * routing ~2500 lines of JSON through one would be pure cost for the app
 * bundle, which needs none of it.
 */
export const TOKENS_DIR = path.join(PACKAGE_ROOT, 'tokens');

/** All shipped CSS — authored and generated alike. */
const STYLES_DIR = path.join(PACKAGE_ROOT, 'styles');

/**
 * Owned outright by the generator. Every file in here is overwritten whole on
 * every build, so the directory itself is the "do not edit" marker — there is
 * no hand-authored line anywhere inside it to preserve.
 */
export const GENERATED_DIR = path.join(STYLES_DIR, 'generated');

export const generatedCssFile = (name: string): string => path.join(GENERATED_DIR, name);

/**
 * Generated TypeScript, one file per family — the `styles/generated/` rule
 * applied to code. Under `src/style/` because that is the only code that reads
 * it: `cn.ts` and `tones.ts` both did so as `../../generated` before the move.
 * The directory is the "do not edit" marker.
 */
export const GENERATED_TS_DIR = path.join(PACKAGE_ROOT, 'src', 'style', 'generated');

export const generatedTsFile = (name: string): string => path.join(GENERATED_TS_DIR, name);
