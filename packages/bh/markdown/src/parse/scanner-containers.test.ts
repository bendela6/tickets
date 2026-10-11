import { describe, expect, it } from 'vitest';
import { createRegistry } from '../registry/registry';
import type { Renderer } from '../registry/types';
import { validateDocument } from '../validate';
import { scanBlocks } from './scanner';

// The scanner knows nothing of markdown's containers, so a fence or directive
// indented in a list item, or quoted in a blockquote, is not a block: it stays
// markdown inside the <li> or <blockquote>. That is a design limit, not a bug,
// and these tests pin it; validation warns about the directive case.

const names = new Set(['warning', 'erd']);

describe('scanBlocks — blocks nested inside lists and blockquotes', () => {
  it('does not recognise a directive indented inside a list item', () => {
    const src = ['- item', '  :::warning', '  body', '  :::'].join('\n');
    const segments = scanBlocks(src, names);
    expect(segments).toHaveLength(1);
    expect(segments[0]?.kind).toBe('markdown');
  });

  it('does not recognise a directive prefixed by a blockquote marker', () => {
    const src = ['> :::warning', '> body', '> :::'].join('\n');
    const segments = scanBlocks(src, names);
    expect(segments).toHaveLength(1);
    expect(segments[0]?.kind).toBe('markdown');
  });

  it('does not recognise a fence indented inside a list item', () => {
    const src = ['- item', '  ```erd', '  title: Core', '  ```'].join('\n');
    const segments = scanBlocks(src, names);
    expect(segments).toHaveLength(1);
    expect(segments[0]?.kind).toBe('markdown');
  });

  it('does not recognise a fence prefixed by a blockquote marker', () => {
    const src = ['> ```erd', '> title: Core', '> ```'].join('\n');
    const segments = scanBlocks(src, names);
    expect(segments).toHaveLength(1);
    expect(segments[0]?.kind).toBe('markdown');
  });
});

describe('validateDocument — warns about the directive cases above', () => {
  const warning: Renderer = {
    name: 'warning',
    body: 'markdown',
    description: 'A warning callout.',
    examples: [':::warning\nx\n:::'],
    component: () => null,
  };
  const registry = createRegistry([warning]);

  it('warns on the directive indented inside a list item', () => {
    const src = ['- item', '  :::warning', '  body', '  :::'].join('\n');
    const { warnings } = validateDocument(src, registry);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.message).toMatch(/not recognised/i);
  });

  it('warns on the directive prefixed by a blockquote marker', () => {
    const src = ['> :::warning', '> body', '> :::'].join('\n');
    const { warnings } = validateDocument(src, registry);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.message).toMatch(/not recognised/i);
  });
});
