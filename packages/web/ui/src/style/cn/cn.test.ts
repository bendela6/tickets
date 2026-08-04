import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cn } from './cn';

// Every `--text-*` size token the theme actually generates a utility for.
// `--text-11--line-height` and friends are modifiers on those tokens, not
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
    expect(cn('px-8', 'px-16')).toBe('px-16');
  });

  it('keeps a color class next to every font-size token the theme defines', () => {
    // Without registration, tailwind-merge buckets unknown text-* into the
    // text-COLOR group and drops the color. Driven off tokens.css rather than
    // a hand-copied list: adding a `--text-*` token without registering it in
    // cn.ts fails silently in the browser, and only where a color sits beside
    // it, so this is the only place that catches it.
    expect(THEME_TEXT_SIZES.length).toBeGreaterThan(3);
    for (const name of THEME_TEXT_SIZES) {
      expect(cn('text-indigo-contrast', `text-${name}`)).toBe(`text-indigo-contrast text-${name}`);
    }
  });

  it('keeps the font family next to every numeric weight the theme defines', () => {
    // `font-*` serves both family and weight, so an unregistered `font-500`
    // is read as a family and evicts `font-sans` — the same trap as the
    // sizes, one namespace over. Driven off tokens.css for the same reason.
    const weights = [
      ...readFileSync(join(process.cwd(), 'src/tokens/tokens.css'), 'utf8').matchAll(
        /^\s+--font-weight-(\d+):/gm,
      ),
    ].map((m) => m[1]!);
    expect(weights.length).toBeGreaterThan(0);
    for (const weight of weights) {
      expect(cn('font-sans', `font-${weight}`)).toBe(`font-sans font-${weight}`);
    }
  });

  it('still merges two weights, and two families, to the last one', () => {
    expect(cn('font-400', 'font-600')).toBe('font-600');
    expect(cn('font-sans', 'font-mono')).toBe('font-mono');
  });

  it('still merges two font sizes to the last one', () => {
    expect(cn('text-13/19', 'text-12/17')).toBe('text-12/17');
    expect(cn('text-9', 'text-11/13 tracking-wider')).toBe('text-11/13 tracking-wider');
  });

  it('passes through conditional values like clsx', () => {
    expect(cn('a', false && 'b', undefined, 'c')).toBe('a c');
  });
});
