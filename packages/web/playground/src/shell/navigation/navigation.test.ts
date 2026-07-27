import type { MouseEvent } from 'react';
import { hashHref, isPlainClick, parseHashLocation } from './navigation';

describe('parseHashLocation', () => {
  it('reads the All view from an empty hash', () => {
    expect(parseHashLocation('')).toEqual({ slug: null, tab: null });
  });

  it('reads a bare slug', () => {
    expect(parseHashLocation('pill')).toEqual({ slug: 'pill', tab: null });
  });

  it('reads a tab off the `::` suffix', () => {
    expect(parseHashLocation('pill::docs')).toEqual({ slug: 'pill', tab: 'docs' });
  });

  it('reads the owning component out of a state anchor', () => {
    expect(parseHashLocation('pill--solid')).toEqual({ slug: 'pill', tab: null });
  });

  it('handles a state anchor and a tab together without confusing the two', () => {
    expect(parseHashLocation('pill--solid::demo')).toEqual({ slug: 'pill', tab: 'demo' });
  });

  it('treats an empty tab as no tab', () => {
    expect(parseHashLocation('pill::')).toEqual({ slug: 'pill', tab: null });
  });
});

describe('hashHref', () => {
  it('round-trips through parseHashLocation', () => {
    for (const target of [
      { slug: 'pill' },
      { slug: 'pill', tab: 'docs' },
      { slug: 'icon', tab: 'impl' },
    ]) {
      const parsed = parseHashLocation(hashHref(target).replace(/^#/, ''));
      expect(parsed.slug).toBe(target.slug);
      expect(parsed.tab).toBe(target.tab ?? null);
    }
  });

  it('points at the All view when there is no slug', () => {
    expect(hashHref({ slug: null })).toBe('#');
    expect(hashHref({})).toBe('#');
  });
});

describe('isPlainClick', () => {
  const click = (over: Partial<MouseEvent> = {}) =>
    ({ button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, ...over }) as MouseEvent;

  it('is true only for an unmodified primary click', () => {
    expect(isPlainClick(click())).toBe(true);
  });

  it('leaves modified and non-primary clicks to the browser', () => {
    // Each of these opens a new tab/window or a context menu — intercepting
    // them would break the point of rendering real hrefs.
    expect(isPlainClick(click({ metaKey: true }))).toBe(false);
    expect(isPlainClick(click({ ctrlKey: true }))).toBe(false);
    expect(isPlainClick(click({ shiftKey: true }))).toBe(false);
    expect(isPlainClick(click({ altKey: true }))).toBe(false);
    expect(isPlainClick(click({ button: 1 }))).toBe(false);
  });
});
