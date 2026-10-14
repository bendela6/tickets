import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { compile } from 'tailwindcss';

// The docs' promise, on Getting started › Styles and fonts, "Fonts of your
// own": an app names other fonts in an `@theme` after bh's stylesheet, and
// every `font-sans` and `font-mono` class and the page's own text follow. The
// tokens name IBM Plex there, and how they name it (an inline theme today) is
// theirs to change; this builds the app's stylesheet as that example writes it
// and reads where each font lands, so a change that strands Plex fails here.
//
// No family the tokens name is written down: the default is compiled from the
// tokens alone, so the test survives the tokens choosing another one.

const require = createRequire(import.meta.url);

/** `@bh/ui/tokens.css` as an app imports it, through the package's exports. */
const TOKENS = require.resolve('@bh/ui/tokens.css');

const INTER = "'Inter', system-ui, sans-serif";
const JETBRAINS = "'JetBrains Mono', ui-monospace, monospace";

/** The docs' example, less the font loading and the shell's stylesheet. */
const APP_STYLESHEET = `@import '@bh/ui/tokens.css';

@theme {
  --font-sans: ${INTER};
  --font-mono: ${JETBRAINS};
}
`;

/** A stylesheet compiled as an app's build compiles it, with the classes it writes. */
async function build(stylesheet: string): Promise<string> {
  const compiler = await compile(stylesheet, {
    base: dirname(TOKENS),
    loadStylesheet: async (id, from) => {
      let file: string;
      if (id === '@bh/ui/tokens.css') {
        file = TOKENS;
      } else if (id.startsWith('.')) {
        file = resolve(from, id);
      } else {
        file = require.resolve(id);
      }
      return { path: file, base: dirname(file), content: readFileSync(file, 'utf8') };
    },
  });
  return compiler.build(['font-sans', 'font-mono']);
}

/** Every rule of the sheet, innermost first: its selectors and its declarations. */
function rulesOf(css: string): { selectors: string[]; body: string }[] {
  return [...css.matchAll(/([^{};]*)\{([^{}]*)\}/g)].map(([, selector = '', body = '']) => {
    return { selectors: selector.split(',').map((s) => s.trim()), body };
  });
}

/** A declaration's value in a rule's body, if it has one. */
function declared(body: string, property: string): string | undefined {
  return new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`).exec(body)?.[1]?.trim();
}

/**
 * The family a selector's text is set in, with every `var()` resolved against
 * the custom properties `:root` declares, as a browser would. The last rule
 * that sets it wins, as in the cascade within one layer.
 */
function fontFamilyOf(css: string, selector: string): string {
  const rules = rulesOf(css);
  const root = new Map<string, string>();
  for (const rule of rules.filter((r) => r.selectors.includes(':root'))) {
    for (const [, name = '', value = ''] of rule.body.matchAll(/(--[\w-]+)\s*:\s*([^;]+)/g)) {
      root.set(name, value.trim());
    }
  }
  const families = rules
    .filter((r) => r.selectors.includes(selector))
    .map((r) => declared(r.body, 'font-family'))
    .filter((value) => value !== undefined);
  const family = families[families.length - 1];
  if (family === undefined) {
    throw new Error(`nothing sets ${selector}'s font-family`);
  }
  let value = family;
  for (let depth = 0; value.includes('var('); depth++) {
    if (depth > 8) {
      throw new Error(`${selector}'s font-family never resolves: ${value}`);
    }
    value = value.replace(
      /var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*))?\)/g,
      (_: string, name: string, fallback?: string) => root.get(name) ?? fallback?.trim() ?? '',
    );
  }
  return value.trim();
}

describe("an app's own fonts", () => {
  it('replace the tokens’ fonts in font-sans and font-mono', async () => {
    const css = await build(APP_STYLESHEET);
    expect(fontFamilyOf(css, '.font-sans')).toBe(INTER);
    expect(fontFamilyOf(css, '.font-mono')).toBe(JETBRAINS);
  });

  it('set the page’s own text, and its code in the mono', async () => {
    const css = await build(APP_STYLESHEET);
    // Preflight sets the root's; bh's base sets the body's over it.
    expect(fontFamilyOf(css, 'html')).toBe(INTER);
    expect(fontFamilyOf(css, 'body')).toBe(INTER);
    expect(fontFamilyOf(css, 'code')).toBe(JETBRAINS);
  });

  it('leave none of the tokens’ own families anywhere in the sheet', async () => {
    const tokensOnly = await build(`@import '@bh/ui/tokens.css';`);
    const defaults = [
      fontFamilyOf(tokensOnly, '.font-sans'),
      fontFamilyOf(tokensOnly, '.font-mono'),
    ];
    // The first family of each is the font the tokens name; the rest is the
    // system's fallback, which an app's own may share.
    const named = defaults.map((family) => family.split(',')[0]?.trim() ?? '');
    expect(named).not.toContain('');
    expect(named).not.toContain(INTER.split(',')[0]);
    expect(named).not.toContain(JETBRAINS.split(',')[0]);

    const css = await build(APP_STYLESHEET);
    for (const family of named) {
      expect(css).not.toContain(family);
    }
  });
});
