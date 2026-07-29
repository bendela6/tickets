// The package's single entry point — `@tickets/ui` resolves here and nothing
// else does, apart from the tokens.css stylesheet.
//
// `tokens/` is not re-exported: the JSON is read by path from foundation/, and
// pulling ~2500 lines of it through the barrel would be pure cost.
//
// `gallery/demos` and `gallery/demo-sources` ARE re-exported, and they each run
// an eager `import.meta.glob`. That is safe only because this package declares
// `sideEffects: false`, which lets the bundler drop them for the consumers that
// never touch `packageDemos` — every screen except the gallery route. If that
// flag is ever removed, all 18 demo modules and their raw source text land in
// the app's entry chunk.
export * from './components';
export * from './forms';
export * from './table';
export * from './style';
export * from './foundation';
export * from './gallery';
export * from './gallery/demos';
export * from './gallery/demo-sources';
