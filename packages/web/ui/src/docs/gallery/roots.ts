// Workspace-relative roots that glob keys are rebased onto (see
// rebaseGlobKeys). Shared by the demo map and both source maps so a demo's
// `path` and its source keys stay in the same space — if these ever drift,
// every lookup silently misses.
export const UI_SRC_ROOT = 'packages/web/ui/src';
export const WEB_SRC_ROOT = 'apps/web/src';
