import { describe, expect, test } from 'vitest';
import { collectVisibleFields } from './collect-visible-fields';
import type { LayoutNode } from '../types/layout-node';
import type { InputRegistry, LayoutComponentRegistry } from '../types/registry';

type R = InputRegistry;
type L = LayoutComponentRegistry;

describe('collectVisibleFields', () => {
  test('returns all fields when no `when` clauses are present', () => {
    const nodes: LayoutNode<R>[] = [
      { kind: 'field', name: 'a', type: 'text', config: {} },
      { kind: 'field', name: 'b', type: 'text', config: {} },
    ];
    expect([...collectVisibleFields(nodes, {})].sort()).toEqual(['a', 'b']);
  });

  test('excludes fields whose own `when` evaluates false', () => {
    const nodes: LayoutNode<R>[] = [
      { kind: 'field', name: 'country', type: 'text', config: {} },
      {
        kind: 'field',
        name: 'state',
        type: 'text',
        config: {},
        when: { field: 'country', eq: 'US' },
      },
    ];
    expect([...collectVisibleFields(nodes, { country: 'US' })].sort()).toEqual([
      'country',
      'state',
    ]);
    expect([...collectVisibleFields(nodes, { country: 'CA' })]).toEqual(['country']);
  });

  test('excludes fields when an ancestor layout `when` evaluates false', () => {
    const nodes: LayoutNode<R, L>[] = [
      { kind: 'field', name: 'mode', type: 'text', config: {} },
      {
        kind: 'group',
        props: { title: 'g' },
        when: { field: 'mode', eq: 'advanced' },
        children: [
          { kind: 'field', name: 'tuning', type: 'text', config: {} },
          {
            kind: 'row',
            props: {},
            children: [{ kind: 'field', name: 'extra', type: 'text', config: {} }],
          },
        ],
      },
    ];
    expect([...collectVisibleFields(nodes, { mode: 'simple' })]).toEqual(['mode']);
    expect([...collectVisibleFields(nodes, { mode: 'advanced' })].sort()).toEqual([
      'extra',
      'mode',
      'tuning',
    ]);
  });

  test('combines own `when` with ancestor `when`', () => {
    const nodes: LayoutNode<R, L>[] = [
      { kind: 'field', name: 'a', type: 'text', config: {} },
      { kind: 'field', name: 'b', type: 'text', config: {} },
      {
        kind: 'group',
        props: { title: 'g' },
        when: { field: 'a', truthy: true },
        children: [
          {
            kind: 'field',
            name: 'inner',
            type: 'text',
            config: {},
            when: { field: 'b', eq: 'show' },
          },
        ],
      },
    ];
    expect([...collectVisibleFields(nodes, { a: '', b: 'show' })].sort()).toEqual(['a', 'b']);
    expect([...collectVisibleFields(nodes, { a: '1', b: 'hide' })].sort()).toEqual(['a', 'b']);
    expect([...collectVisibleFields(nodes, { a: '1', b: 'show' })].sort()).toEqual([
      'a',
      'b',
      'inner',
    ]);
  });
});
