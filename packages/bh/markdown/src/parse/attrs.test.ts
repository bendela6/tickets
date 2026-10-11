import { describe, expect, it } from 'vitest';
import { parseAttrs } from './attrs';

describe('parseAttrs', () => {
  it('parses bare, quoted, and flag attributes', () => {
    expect(parseAttrs('{type=warning title="Before you migrate" compact}')).toEqual({
      type: 'warning',
      title: 'Before you migrate',
      compact: true,
    });
  });

  it('returns an empty object for no attributes', () => {
    expect(parseAttrs('')).toEqual({});
  });
});
