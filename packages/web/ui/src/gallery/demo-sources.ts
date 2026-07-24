import { rebaseGlobKeys } from './collect-demos';
import { UI_SRC_ROOT } from './roots';

// Keys are rebased onto the same root as packageDemos, so `sources[demo.path]`
// resolves after the web route merges these with the app's own maps.
export const packageDemoSources = rebaseGlobKeys(
  UI_SRC_ROOT,
  import.meta.glob('../**/*.demo.tsx', {
    query: '?raw',
    import: 'default',
    eager: true,
  }) as Record<string, string>,
);

// The component files themselves, for the Implementation tab. Deliberately
// LAZY (no `eager`): this glob covers every source file in the package, and
// eager-inlining them all would drag the whole package's text into whichever
// bundle imports this module. Each entry becomes its own chunk, fetched only
// when someone opens the tab.
// Demos are excluded because they're already imported eagerly above — leaving
// them in makes rollup warn that the dynamic import can't split a module it
// also has statically. Tests are excluded because nobody opens this tab to
// read them.
export const packageComponentSources = rebaseGlobKeys(
  UI_SRC_ROOT,
  import.meta.glob(['../**/*.{ts,tsx}', '!../**/*.demo.tsx', '!../**/*.test.{ts,tsx}'], {
    query: '?raw',
    import: 'default',
  }) as Record<string, () => Promise<string>>,
);
