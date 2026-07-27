// The package's single entry point — `@tickets/playground` resolves here, and
// styles.css is the only other export because a stylesheet cannot travel
// through a TypeScript barrel.
//
// The whole viewer is surfaced rather than the hand-picked subset that used to
// live here: a host that renders one tab in isolation, or reuses the code
// block, should not have to reach past the entry to do it. `sideEffects: false`
// keeps that free — nothing here runs at import time, so a host that only
// mounts GalleryShell never pays for shiki or axe.
export * from './shell';
export * from './page';
export * from './preview';
export * from './code';
