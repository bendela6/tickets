import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cn } from './cn';

// Every `--text-*` size token the theme actually generates a utility for.
// `--text-label--line-height` and friends are modifiers on those tokens, not
// sizes of their own, so they're filtered out by the double dash. (Read from
// the package root — vitest's cwd — since import.meta.url isn't a file URL
// under the dev-server transform.)
const THEME_TEXT_SIZES = [
  ...readFileSync(join(process.cwd(), 'src/tokens/tokens.css'), 'utf8').matchAll(
    /^\s+--text-([a-z0-9-]+):/gm,
  ),
]
  .map((m) => m[1]!)
  .filter((name) => !name.includes('--'));

describe('cn', () => {
  it('merges conflicting tailwind classes, last wins', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
  });

  it('keeps a color class next to every font-size token the theme defines', () => {
    // Without registration, tailwind-merge buckets unknown text-* into the
    // text-COLOR group and drops the color. Driven off tokens.css rather than
    // a hand-copied list: adding a `--text-*` token without registering it in
    // cn.ts fails silently in the browser, and only where a color sits beside
    // it, so this is the only place that catches it.
    expect(THEME_TEXT_SIZES.length).toBeGreaterThan(3);
    for (const name of THEME_TEXT_SIZES) {
      expect(cn('text-on-accent', `text-${name}`)).toBe(`text-on-accent text-${name}`);
    }
  });

  it('keeps a color class next to the eer-only sizes, which live outside this theme', () => {
    for (const size of ['text-3xs', 'text-2xs']) {
      expect(cn('text-on-accent', size)).toBe(`text-on-accent ${size}`);
    }
  });

  it('still merges two font sizes to the last one', () => {
    expect(cn('text-ui', 'text-meta')).toBe('text-meta');
    expect(cn('text-3xs', 'text-label')).toBe('text-label');
  });

  it('passes through conditional values like clsx', () => {
    expect(cn('a', false && 'b', undefined, 'c')).toBe('a c');
  });
});
