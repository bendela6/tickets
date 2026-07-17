import { describe, expect, test } from 'vitest';
import { collectFields } from './collect-fields';
import type { LayoutNode } from '../types/layout-node';
import type { InputRegistry, LayoutComponentRegistry } from '../types/registry';

type R = InputRegistry;
type L = LayoutComponentRegistry;

describe('collectFields', () => {
  test('flattens a single-level tree', () => {
    const nodes: LayoutNode<R>[] = [
      { kind: 'field', name: 'a', type: 'text', config: {} },
      { kind: 'field', name: 'b', type: 'text', config: {} },
    ];
    const map = collectFields(nodes);
    expect([...map.keys()].sort()).toEqual(['a', 'b']);
  });

  test('recurses into group/row/column', () => {
    const nodes: LayoutNode<R, L>[] = [
      {
        kind: 'group',
        props: { title: 'g' },
        children: [
          {
            kind: 'row',
            props: {},
            children: [
              { kind: 'field', name: 'x', type: 'text', config: {} },
              {
                kind: 'column',
                props: {},
                children: [{ kind: 'field', name: 'y', type: 'text', config: {} }],
              },
            ],
          },
        ],
      },
    ];
    expect([...collectFields(nodes).keys()].sort()).toEqual(['x', 'y']);
  });

  test('throws on duplicate field names', () => {
    const nodes: LayoutNode<R, L>[] = [
      { kind: 'field', name: 'a', type: 'text', config: {} },
      {
        kind: 'group',
        props: { title: 'g' },
        children: [{ kind: 'field', name: 'a', type: 'text', config: {} }],
      },
    ];
    expect(() => collectFields(nodes)).toThrow(/duplicate field name "a"/);
  });

  test('returns the FieldNode object verbatim', () => {
    const node = { kind: 'field' as const, name: 'a', type: 'text', label: 'A', config: {} };
    const map = collectFields<R>([node]);
    expect(map.get('a')).toBe(node);
  });
});
