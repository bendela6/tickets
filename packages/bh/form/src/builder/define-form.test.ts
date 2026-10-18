import type { EntriesOf } from '@bh/registry';
import { describe, expect, expectTypeOf, test } from 'vitest';
import type { InputProps, LayoutComponentProps } from '../types/registry';
import type { FieldOptions } from './build-proxy';
import { defineRegistry } from './define-registry';
import { defineForm } from './define-form';
import { noInputs, noLayouts } from './registries';

const Stub = () => null;
const FieldStub = () => null;
const GroupLayout = ({ children }: LayoutComponentProps<{ title?: string }>) => {
  return children as React.ReactElement;
};
const RowLayout = ({ children }: LayoutComponentProps<Record<string, never>>) => {
  return children as React.ReactElement;
};
const registry = defineRegistry({
  inputs: noInputs.register({
    text: { Component: Stub as never, defaultValue: '' },
    select: { Component: Stub as never, defaultValue: null },
  }),
  layouts: noLayouts.register({
    group: { Component: GroupLayout },
    row: { Component: RowLayout },
  }),
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

  test("types a field's default as its input takes it, not as its kind's empty value", () => {
    const Picker = (_: InputProps<object, string | null>) => null;
    const picks = defineRegistry({
      inputs: noInputs.register({ pick: { Component: Picker, defaultValue: null } }),
      layouts: noLayouts,
      field: { Component: FieldStub as never },
    });
    expectTypeOf<
      FieldOptions<EntriesOf<typeof picks.inputs>, 'pick'>['defaultValue']
    >().toEqualTypeOf<string | null | undefined>();
    const config = defineForm(picks).build((b) => {
      return [b.pick({ name: 'p', defaultValue: 'first', config: {} })];
    });
    expect(config.nodes[0]).toMatchObject({ defaultValue: 'first' });
  });

  test('builds submit and reset buttons, with `when`', () => {
    const config = defineForm(registry).build((b) => {
      return [
        b.text({ name: 'name', config: {} }),
        b.row({}, [
          b.reset({ label: 'Reset' }),
          b.submit({ label: 'Save', when: { field: 'name', truthy: true } }),
        ]),
      ];
    });
    expect(config.nodes[1]).toMatchObject({
      kind: 'row',
      children: [
        { kind: 'action', action: 'reset', label: 'Reset' },
        { kind: 'action', action: 'submit', label: 'Save', when: { field: 'name', truthy: true } },
      ],
    });
  });

  test("carries the form's values to start at and its schema", () => {
    const schema = { '~standard': { version: 1, vendor: 'test', validate: () => ({ value: {} }) } };
    const config = defineForm(registry).build((b) => [b.text({ name: 'name', config: {} })], {
      defaultValues: { name: 'Anna' },
      schema: schema as never,
    });
    expect(config).toMatchObject({ defaultValues: { name: 'Anna' }, schema });
    expect(config.nodes).toHaveLength(1);
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
