import { describe, expect, test } from 'vitest';
import type { LayoutComponentProps } from '../types/registry';
import { defineRegistry } from './define-registry';
import { defineForm } from './define-form';

const Stub = () => null;
const FieldStub = () => null;
const GroupLayout = ({ children }: LayoutComponentProps<{ title?: string }>) => {
  return children as React.ReactElement;
};
const RowLayout = ({ children }: LayoutComponentProps<Record<string, never>>) => {
  return children as React.ReactElement;
};
const registry = defineRegistry({
  inputs: {
    text: { Component: Stub as never, defaultValue: '' },
    select: { Component: Stub as never, defaultValue: null },
  },
  layouts: {
    group: { Component: GroupLayout },
    row: { Component: RowLayout },
  },
  field: { Component: FieldStub as never },
});

describe('defineForm', () => {
  test('builds a tree with field, group, row helpers', () => {
    const config = defineForm(registry).build((b) => {
      return [
        b.group({ title: 'Profile' }, [
          b.text({ name: 'name', label: 'Name', required: true, config: { placeholder: 'Beka' } }),
          b.row({}, [
            //
            b.text({ name: 'a', config: {} }),
            b.text({ name: 'b', config: {} }),
          ]),
        ]),
      ];
    });
    expect(config.nodes).toHaveLength(1);
    expect(config.nodes[0]).toMatchObject({
      kind: 'group',
      props: { title: 'Profile' },
      children: [
        //
        { kind: 'field', name: 'name', type: 'text', required: true, label: 'Name' },
        {
          kind: 'row',
          children: [
            //
            { kind: 'field', name: 'a', type: 'text' },
            { kind: 'field', name: 'b', type: 'text' },
          ],
        },
      ],
    });
  });

  test('throws for unknown input type', () => {
    expect(() => {
      return defineForm(registry).build((b) => {
        return [
          (b as unknown as { unknownType: (o: unknown) => unknown }).unknownType({
            name: 'x',
          }) as never,
        ];
      });
    }).toThrow(/no input type "unknownType"/);
  });
});
