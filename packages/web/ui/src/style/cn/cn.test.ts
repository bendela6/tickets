import { FONT_WEIGHTS, TEXT_SIZES } from '../../generated';
import { cn } from './cn';

// These are behaviour tests, not value tests: they assert what tailwind-merge
// DOES for every rung on the scale, which is a claim about a third-party
// library's bucketing and can fail for a reason worth knowing about.
//
// The scale is imported rather than parsed back out of the stylesheet. It used
// to be read from the CSS to pin cn.ts's hand-copied list against it; cn.ts
// imports the same generated module now, so the two cannot disagree and the
// file read was indirection without a check inside it.

describe('cn', () => {
  it('merges conflicting tailwind classes, last wins', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
  });

  it('keeps a color class next to every font-size on the scale', () => {
    // Without registration, tailwind-merge buckets unknown text-* into the
    // text-COLOR group and drops the color. A size added to the scale but not
    // reaching cn fails silently in the browser, and only where a colour sits
    // beside it — this is the only place that catches it.
    expect(TEXT_SIZES.length).toBeGreaterThan(3);
    for (const size of TEXT_SIZES) {
      expect(cn('text-indigo-contrast', `text-${size}`)).toBe(`text-indigo-contrast text-${size}`);
    }
  });

  it('keeps the font family next to every numeric weight', () => {
    // `font-*` serves both family and weight, so an unregistered `font-500` is
    // read as a family and evicts `font-sans` — the same trap one namespace
    // over.
    expect(FONT_WEIGHTS.length).toBeGreaterThan(0);
    for (const weight of FONT_WEIGHTS) {
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
