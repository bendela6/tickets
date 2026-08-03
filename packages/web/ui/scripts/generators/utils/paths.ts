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
 * Every consumer reads these by path — this file, and `foundation/spec.ts` /
 * `foundation/colors` by relative import. There is deliberately no barrel:
 * routing ~2500 lines of JSON through one would be pure cost for the app
 * bundle, which needs none of it.
 */
export const TOKENS_DIR = path.join(PACKAGE_ROOT, 'tokens');

/** Spliced in place — only the marked regions are rewritten. Shipped, so `src/`. */
export const TOKENS_CSS_FILE = path.join(PACKAGE_ROOT, 'src', 'tokens', 'tokens.css');

/** Overwritten whole. Shipped, so `src/`. */
export const TONES_FILE = path.join(PACKAGE_ROOT, 'src', 'style', 'tones', 'tones.generated.ts');
