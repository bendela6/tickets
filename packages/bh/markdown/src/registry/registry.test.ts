import { describe, expect, it } from 'vitest';
import { createRegistry } from './registry';
import { isBlockNode, type Renderer } from './types';

const note: Renderer = {
  name: 'note',
  body: 'markdown',
  description: 'A note callout.',
  examples: [':::note\nHello.\n:::'],
  component: () => null,
};

describe('createRegistry', () => {
  it('looks renderers up by name', () => {
    const registry = createRegistry([note]);
    expect(registry.get('note')).toBe(note);
    expect(registry.get('missing')).toBeUndefined();
  });

  it('exposes the name set for the scanner', () => {
    expect([...createRegistry([note]).names()]).toEqual(['note']);
  });

  it('accepts renderers registered after construction', () => {
    const registry = createRegistry([]);
    registry.register(note);
    expect(registry.get('note')).toBe(note);
  });

  it('rejects a duplicate name', () => {
    const registry = createRegistry([note]);
    expect(() => registry.register(note)).toThrow(/already registered/);
  });

  it('rejects a duplicate name in the initial array', () => {
    expect(() => createRegistry([note, note])).toThrow(/already registered/);
  });

  it('rejects a renderer with no description', () => {
    const registry = createRegistry([]);
    expect(() => registry.register({ ...note, description: '' })).toThrow(/has no description/);
  });

  it('rejects a renderer whose description is only whitespace', () => {
    const registry = createRegistry([]);
    expect(() => registry.register({ ...note, description: '  \n  ' })).toThrow(
      /has no description/,
    );
  });

  it('rejects a renderer with no examples', () => {
    const registry = createRegistry([]);
    expect(() => registry.register({ ...note, examples: [] })).toThrow(/has no examples/);
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
