import { describe, expect, it } from 'vitest';
import { noBlocks } from './registry';
import { isBlockNode, type Renderer } from './types';

const note: Renderer = {
  name: 'note',
  body: 'markdown',
  description: 'A note callout.',
  examples: [':::note\nHello.\n:::'],
  component: () => null,
};

describe('noBlocks', () => {
  it('holds none, and register gives a registry of blocks by name, leaving it as it was', () => {
    const registry = noBlocks.register({ note });
    expect(registry.get('note')).toBe(note);
    expect(registry.names).toEqual(['note']);
    expect(registry.has('missing')).toBe(false);
    expect(() => registry.get('missing')).toThrow('No block is registered as "missing".');
    expect(noBlocks.names).toEqual([]);
  });

  it('rejects a name taken already', () => {
    const registry = noBlocks.register({ note });
    expect(() => registry.register({ note })).toThrow(
      'A block is registered as "note" already: override replaces one.',
    );
  });

  it('rejects a block registered by a name other than its own', () => {
    expect(() => noBlocks.register({ callout: note })).toThrow(
      'The block "callout" is named "note": register it by its own name.',
    );
  });

  it('rejects a block with no description, or one only whitespace', () => {
    expect(() => noBlocks.register({ note: { ...note, description: '' } })).toThrow(
      'block "note": description: says what the block is',
    );
    expect(() => noBlocks.register({ note: { ...note, description: '  \n  ' } })).toThrow(
      'description: says what the block is',
    );
  });

  it('rejects a block with no examples', () => {
    expect(() => noBlocks.register({ note: { ...note, examples: [] } })).toThrow(
      'block "note": examples: shows one at least',
    );
  });
});

describe('isBlockNode', () => {
  it('returns true for a block node', () => {
    expect(isBlockNode({ type: 'block', name: 'note', attrs: {}, line: 1 })).toBe(true);
  });

  it('returns false for a non-block node', () => {
    expect(isBlockNode({ type: 'paragraph', children: [] })).toBe(false);
  });
});
