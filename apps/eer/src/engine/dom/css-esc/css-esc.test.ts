import { describe, expect, it } from 'vitest';

import { cssEsc } from './css-esc';

describe('cssEsc', () => {
  it('passes plain identifiers through untouched', () => {
    expect(cssEsc('item_types')).toBe('item_types');
  });

  it('escapes double quotes and backslashes', () => {
    expect(cssEsc('a"b')).toBe('a\\"b');
    expect(cssEsc('a\\b')).toBe('a\\\\b');
  });

  it('produces a selector that actually matches the element', () => {
    const el = document.createElement('div');
    el.dataset.entity = 'we"ird\\id';
    document.body.appendChild(el);
    expect(document.querySelector(`[data-entity="${cssEsc('we"ird\\id')}"]`)).toBe(el);
    el.remove();
  });
});
