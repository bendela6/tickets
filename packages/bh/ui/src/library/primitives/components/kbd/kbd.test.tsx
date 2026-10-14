import { render } from '@testing-library/react';
import axe from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Kbd } from './kbd';
import { faceOf, keysOf } from './keys';

/** What a sighted reader sees: the text with the screen-reader-only words taken out. */
function seen(element: Element): string {
  const copy = element.cloneNode(true) as Element;
  copy.querySelectorAll('.sr-only').forEach((node) => node.remove());
  return copy.textContent;
}

/** What a screen reader reads: the text with the hidden glyphs taken out. */
function heard(element: Element): string {
  const copy = element.cloneNode(true) as Element;
  copy.querySelectorAll('[aria-hidden="true"]').forEach((node) => node.remove());
  return copy.textContent;
}

function outer(container: HTMLElement): HTMLElement {
  return container.firstElementChild as HTMLElement;
}

describe('Kbd', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is a <kbd> holding a <kbd> for each key of a chord', () => {
    const { container } = render(<Kbd keys={['mod', 'shift', 'K']} platform="other" />);
    const chord = outer(container);
    expect(chord.tagName).toBe('KBD');
    expect([...chord.querySelectorAll(':scope > kbd')].map((key) => key.textContent)).toEqual([
      'Ctrl',
      'Shift',
      'K',
    ]);
  });

  it('draws a PC’s words joined with +, and a Mac’s glyphs side by side', () => {
    const { container, rerender } = render(<Kbd keys="mod+shift+K" platform="other" />);
    expect(seen(outer(container))).toBe('Ctrl+Shift+K');
    rerender(<Kbd keys="mod+shift+K" platform="apple" />);
    expect(seen(outer(container))).toBe('⌘⇧K');
  });

  it('says each glyph as its word, with the + a PC shows', () => {
    const { container } = render(<Kbd keys={['mod', 'alt', 'up']} platform="apple" />);
    expect(heard(outer(container))).toBe('Command+Option+Up Arrow');
  });

  it('takes the reader’s platform when none is given', () => {
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5)' });
    const { container, unmount } = render(<Kbd keys="mod+K" />);
    expect(seen(outer(container))).toBe('⌘K');
    unmount();

    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' });
    const other = render(<Kbd keys="mod+K" />);
    expect(seen(outer(other.container))).toBe('Ctrl+K');
  });

  it('lets `platform` win over the reader’s', () => {
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5)' });
    const { container } = render(<Kbd keys="mod+K" platform="other" />);
    expect(seen(outer(container))).toBe('Ctrl+K');
  });

  it('passes its other props on, so a hint can be hidden or titled', () => {
    const { container } = render(<Kbd keys="esc" aria-hidden title="Closes the dialog" />);
    expect(outer(container)).toHaveAttribute('aria-hidden', 'true');
    expect(outer(container)).toHaveAttribute('title', 'Closes the dialog');
  });

  it('lets a caller’s classes win over its own', () => {
    const { container } = render(<Kbd keys="K" className="text-gray-12" />);
    expect(outer(container)).toHaveClass('text-gray-12');
    expect(outer(container)).not.toHaveClass('text-gray-10');
  });

  it('passes axe as every variant, alone and in a sentence', async () => {
    const { container } = render(
      <p>
        Press <Kbd keys="mod+K" platform="apple" /> or <Kbd keys="mod+K" platform="other" /> to
        search, <Kbd keys="esc" variant="tint" size="sm" /> to close, and{' '}
        <Kbd keys={['shift', 'enter']} variant="text" size="lg" /> to send.
      </p>,
    );
    const results = await axe.run(container);
    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });
});

describe('keysOf', () => {
  it('splits a string on the + between keys and takes an array as it is', () => {
    expect(keysOf('mod+K')).toEqual(['mod', 'K']);
    expect(keysOf(['mod', 'K'])).toEqual(['mod', 'K']);
    expect(keysOf('Esc')).toEqual(['Esc']);
  });

  it('reads a + with nothing on one side as the key itself', () => {
    expect(keysOf('+')).toEqual(['+']);
    expect(keysOf('Ctrl++')).toEqual(['Ctrl', '+']);
    expect(keysOf('mod+shift++')).toEqual(['mod', 'shift', '+']);
  });
});

describe('faceOf', () => {
  it('names the modifiers and the named keys each platform’s way', () => {
    const both = (key: string) => [faceOf(key, 'apple').shown, faceOf(key, 'other').shown];
    expect(both('mod')).toEqual(['⌘', 'Ctrl']);
    expect(both('ctrl')).toEqual(['⌃', 'Ctrl']);
    expect(both('alt')).toEqual(['⌥', 'Alt']);
    expect(both('option')).toEqual(['⌥', 'Alt']);
    expect(both('shift')).toEqual(['⇧', 'Shift']);
    expect(both('enter')).toEqual(['↵', 'Enter']);
    expect(both('esc')).toEqual(['esc', 'Esc']);
    expect(both('up')).toEqual(['↑', '↑']);
    expect(both('ArrowDown')).toEqual(['↓', '↓']);
  });

  it('reads a name in any case, draws a letter in capitals and anything else as written', () => {
    expect(faceOf('SHIFT', 'other').shown).toBe('Shift');
    expect(faceOf('k', 'other').shown).toBe('K');
    expect(faceOf('F5', 'apple').shown).toBe('F5');
    expect(faceOf('/', 'apple').shown).toBe('/');
    expect(faceOf('Page', 'other').shown).toBe('Page');
  });

  it('gives a glyph a word to be spoken by, and a word none', () => {
    expect(faceOf('mod', 'apple')).toEqual({ shown: '⌘', spoken: 'Command' });
    expect(faceOf('⌘', 'other')).toEqual({ shown: '⌘', spoken: 'Command' });
    expect(faceOf('mod', 'other')).toEqual({ shown: 'Ctrl' });
  });
});
