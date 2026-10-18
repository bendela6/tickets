import { describe, expect, test } from 'vitest';
import { expectTypeOf } from 'expect-type';
import { defineRegistry } from './define-registry';
import { noInputs, noLayouts } from './registries';

const TextInput = () => null;
const SelectInput = () => null;
const FieldStub = () => null;

describe('defineRegistry', () => {
  test('returns the registry unchanged at runtime', () => {
    const registry = defineRegistry({
      inputs: noInputs.register({
        text: { Component: TextInput as never, defaultValue: '' },
        select: { Component: SelectInput as never, defaultValue: null },
      }),
      layouts: noLayouts,
      field: { Component: FieldStub as never },
    });
    expect(Object.keys(registry).sort()).toEqual(['field', 'inputs', 'layouts']);
    expect(registry.inputs.names).toEqual(['text', 'select']);
  });

  test('preserves typed entries (type-level)', () => {
    const registry = defineRegistry({
      inputs: noInputs.register({
        text: { Component: TextInput as never, defaultValue: '' },
      }),
      layouts: noLayouts,
      field: { Component: FieldStub as never },
    });
    expectTypeOf(registry.inputs.names).toEqualTypeOf<readonly 'text'[]>();
    expectTypeOf(registry.inputs.get('text')).toHaveProperty('defaultValue');
  });
});

describe('defineRegistry names', () => {
  test.each(['submit', 'reset'])('refuses an input named %s, the builder button', (name) => {
    expect(() => {
      return defineRegistry({
        inputs: noInputs.register({ [name]: { Component: TextInput as never } }),
        layouts: noLayouts,
        field: { Component: FieldStub as never },
      });
    }).toThrow(`"${name}"`);
  });

  test.each(['field', 'action', 'submit'])('refuses a layout named %s', (name) => {
    expect(() => {
      return defineRegistry({
        inputs: noInputs,
        layouts: noLayouts.register({ [name]: { Component: FieldStub as never } }),
        field: { Component: FieldStub as never },
      });
    }).toThrow(`"${name}"`);
  });
});
