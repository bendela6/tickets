// Token build entry point. Run directly:
//
//   node scripts/generators/build-tokens.ts    (via `pnpm --filter @tickets/ui tokens:build`)
//
// Reads the DTCG token JSON in `tokens/` and SPLICES the token-derived
// regions of `tokens.css` back in place, leaving every hand-authored line around
// them byte-for-byte untouched. Also writes `style/tones/tones.generated.ts`.
//
// Six of the ten token files are read, and that is not an oversight — a token
// file plays one of two roles:
//
//   EMITTED — the value lives in the JSON and this is what puts it into CSS:
//   colors.{light,dark}, shadows.{light,dark}, semantic, tones.
//
//   SANCTIONED RUNGS — the value lives in the Tailwind class, and the JSON only
//   records which rungs may be reached for: layout.tokens.json and motion's
//   durations. `duration-200` is already 200ms because the class says so;
//   emitting `--duration-200: 200ms` would create the second copy of the value
//   that is the only way the two could ever disagree. `foundation/spec.ts` reads
//   those files and `spec.test.ts` asserts the sheet declares NO token for them,
//   so wiring them in here would break that suite on purpose.
//
// radius.tokens.json and typography.tokens.json straddle the two: their values
// ARE in tokens.css, hand-authored into the `@theme inline` block alongside the
// `initial` clears that retire off-scale rungs — enforcement DTCG cannot
// express. The two copies are not left on trust: `foundation/spec.ts`'s
// `drift()` matches them by value, so an edit to either side fails
// `spec.test.ts` rather than passing silently.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { emitCssRegions } from './emit-css-regions.ts';
import { generateTones } from './generate-tones.ts';
import { resolveTokenMaps } from './resolve-token-maps.ts';
import { spliceRegion } from './utils/splice-region.ts';
import { TOKENS_CSS_FILE, TONES_FILE } from './utils/paths.ts';
import type { Marker } from './utils/types.ts';

// Only the text strictly between each pair is regenerated; the markers
// themselves, and every hand-authored line outside them, are left alone.
const MARKERS: Marker[] = [
  { start: '/* tokens:light — generated, do not edit */', end: '/* /tokens:light */', region: 'light' },
  { start: '/* tokens:dark — generated, do not edit */', end: '/* /tokens:dark */', region: 'dark' },
  { start: '/* tokens:theme — generated, do not edit */', end: '/* /tokens:theme */', region: 'theme' },
  { start: '/* tokens:leading — generated, do not edit */', end: '/* /tokens:leading */', region: 'leading' },
];

export function build(): void {
  const { light, dark } = resolveTokenMaps();
  const regions = emitCssRegions({ light, dark });

  let css = readFileSync(TOKENS_CSS_FILE, 'utf8');
  for (const marker of MARKERS) {
    const body = regions[marker.region];
    if (body === undefined) throw new Error(`no generator produced the "${marker.region}" region`);
    css = spliceRegion(css, marker, body);
  }
  writeFileSync(TOKENS_CSS_FILE, css, 'utf8');
  console.log(`Updated ${path.relative(process.cwd(), TOKENS_CSS_FILE)}`);

  writeFileSync(TONES_FILE, generateTones(light), 'utf8');
  console.log(`Updated ${path.relative(process.cwd(), TONES_FILE)}`);
}

// Importing this module (the design-doc parity check does) must not write files.
const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  build();
}
