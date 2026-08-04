import { readFileSync } from 'node:fs';
import path from 'node:path';
import { TOKENS_DIR } from './paths.ts';

/**
 * Read and parse one `*.tokens.json` from `src/tokens/`.
 *
 * `readFileSync` + `JSON.parse` rather than `import … with { type: 'json' }`:
 * these modules are executed by node directly, where a JSON import needs an
 * import attribute, and by vitest, where it does not. Reading the file has one
 * behaviour in both, and re-reads on every call so a generator run always sees
 * what is on disk rather than a module-cached copy.
 *
 * The type parameter is an assertion, not a validation — the shapes live in
 * `types.ts` and are checked by the generators that destructure them.
 */
export function readTokenFile<T>(name: string): T {
  return JSON.parse(readFileSync(path.join(TOKENS_DIR, name), 'utf8')) as T;
}
