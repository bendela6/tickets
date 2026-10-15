import { getSchema } from '@tiptap/core';
import { describe, expect, it } from 'vitest';
import { buildExtensions, PRESETS } from '../index';
import { initials } from './mention';

describe('custom nodes', () => {
  const schema = getSchema(buildExtensions(PRESETS.full));

  it('callout is a block with kind attr', () => {
    const callout = schema.nodes['callout'];
    expect(callout).toBeDefined();
    expect(callout?.spec.attrs).toHaveProperty('kind');
  });

  it('mention is an inline atom with label attr', () => {
    const node = schema.nodes['mention'];
    expect(node).toBeDefined();
    expect(node?.spec.inline).toBe(true);
    expect(node?.spec.atom).toBe(true);
    expect(node?.spec.attrs).toHaveProperty('label');
  });
});

describe('initials', () => {
  it('takes two words’ first letters, or one word’s first two', () => {
    expect(initials('Mara K.')).toBe('MK');
    expect(initials('beka')).toBe('BE');
    expect(initials('  ')).toBe('');
  });
});
