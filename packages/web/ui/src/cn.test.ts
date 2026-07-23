import { cn } from './cn';

describe('cn', () => {
  it('merges conflicting tailwind classes, last wins', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
  });

  it('keeps a color class next to every custom font-size token (twMerge trap)', () => {
    // Without registration, tailwind-merge buckets unknown text-* into the
    // text-COLOR group and drops the color. One assertion per custom size:
    for (const size of ['text-ui', 'text-meta', 'text-label', 'text-3xs', 'text-2xs']) {
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
