// Lazy shiki singleton: nothing in this module runs until getHighlighter()
// is first called (from Code/Source tab mount), so shiki's core + tsx
// grammar + our theme end up in a chunk the entry bundle never touches —
// verified post-build by checking apps/web/dist/assets for a separate shiki
// chunk not referenced by the entry's static imports.
//
// setHighlighterForTests lets component tests swap in a synchronous fake
// (`(code) => html`) instead of loading real shiki, keeping those tests fast
// and independent of the wasm/regex-engine machinery.
let highlighterPromise: Promise<(code: string) => string> | null = null;

export function setHighlighterForTests(fn: ((code: string) => string) | null) {
  highlighterPromise = fn ? Promise.resolve(fn) : null;
}

export function getHighlighter(): Promise<(code: string) => string> {
  highlighterPromise ??= (async () => {
    const [{ createHighlighterCore }, { createJavaScriptRegexEngine }, tsx, theme] =
      await Promise.all([
        import('shiki/core'),
        import('shiki/engine/javascript'),
        import('@shikijs/langs/tsx'),
        import('./instrument-dark.json'),
      ]);
    const shiki = await createHighlighterCore({
      // instrument-dark.json is authored in the plain VS Code `tokenColors`
      // shape (not the stricter `settings`-keyed TextMate raw-theme shape
      // shiki's types demand) — shiki normalizes `tokenColors` -> `settings`
      // at runtime (verified against the installed 4.3.1), so this is a
      // type-only cast, not a behavior change.
      themes: [(theme.default ?? theme) as ThemeRegistrationAny],
      langs: [tsx.default ?? tsx],
      engine: createJavaScriptRegexEngine(),
    });
    return (code: string) => shiki.codeToHtml(code, { lang: 'tsx', theme: 'instrument-dark' });
  })();
  return highlighterPromise;
}

// Only used for the cast above — kept as a type-only import so it's erased
// from the lazy chunk shiki itself only loads inside getHighlighter().
type ThemeRegistrationAny = import('shiki/core').ThemeRegistrationAny;
