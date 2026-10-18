// @bh/shell: the app frame every app mounts inside. The app hands in what is
// its own — the nav list, the brand, the footer, where state is remembered — and
// this package draws the rest. No data, no app words (domain-free.test.ts).
// The build's versions come from @bh/shell/vite, a separate entry: it runs in Node.
export * from './nav';
export * from './search';
export * from './shell';
export * from './theme';
export * from './version';
