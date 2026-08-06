import { collectDemos, rebaseNestedGlobKeys } from './collect-demos';
import { UI_SRC_ROOT } from './roots';

// The package's own demos. import.meta.glob is executed by the CONSUMER's
// vite (web or the dev app), relative to this file — then rebased onto the
// workspace-relative root so the keys stay unique when the web route merges
// them with the app's own demo map.
//
// rebaseNestedGlobKeys rather than rebaseGlobKeys: this module sits two
// directories below UI_SRC_ROOT (docs/gallery/), not one, and its matches
// arrive at two different `../` depths — see rebaseNestedGlobKeys's doc
// comment in collect-demos.ts. groupFromPath depends on getting this right.
//
// strictGroup: on. This is the one call site Step 8 of the group-derivation
// work (68 hand-edited demo files) needs to be loud about a leftover
// `meta.group` — see CollectDemosOptions in collect-demos.ts for why every
// other caller leaves it off.
export const packageDemos = collectDemos(
  rebaseNestedGlobKeys(
    `${UI_SRC_ROOT}/docs/gallery`,
    import.meta.glob('../../**/*.demo.tsx', { eager: true }) as Record<string, unknown>,
  ),
  { strictGroup: true },
);
