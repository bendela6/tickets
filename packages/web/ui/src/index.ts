// The package's single entry point.
//
// Two things are deliberately NOT re-exported here:
//   - `tokens/` — the JSON is read by path and tokens.css has its own export
//     entry; a stylesheet cannot travel through a TypeScript barrel anyway.
//   - `gallery/demos` and `gallery/demo-sources` — both run an EAGER
//     `import.meta.glob`, so re-exporting them would make every consumer of
//     this package pull in all 18 demo modules and their raw source text.
//     Hosts import those two by their own export entries, on purpose.
export * from './components';
export * from './style';
export * from './foundation';
export * from './gallery';
