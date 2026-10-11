import { describe, expect, test } from 'vitest';
import { expectTypeOf } from 'expect-type';
import { defineRegistry } from './define-registry';

const TextInput = () => null;
const SelectInput = () => null;
const FieldStub = () => null;

describe('defineRegistry', () => {
  test('returns the registry unchanged at runtime', () => {
    const registry = defineRegistry({
      inputs: {
        text: { Component: TextInput as never, defaultValue: '' },
        select: { Component: SelectInput as never, defaultValue: null },
      },
      layouts: {},
      field: { Component: FieldStub as never },
    });
    expect(Object.keys(registry).sort()).toEqual(['field', 'inputs', 'layouts']);
    expect(Object.keys(registry.inputs).sort()).toEqual(['select', 'text']);
  });

  test('preserves typed entries (type-level)', () => {
    const registry = defineRegistry({
      inputs: {
        text: { Component: TextInput as never, defaultValue: '' },
      },
      layouts: {},
      field: { Component: FieldStub as never },
    });
    expectTypeOf(registry.inputs).toHaveProperty('text');
    expectTypeOf(registry.inputs.text).toHaveProperty('defaultValue');
  });
});

describe('defineRegistry names', () => {
  test.each(['submit', 'reset'])('refuses an input named %s, the builder button', (name) => {
    expect(() => {
      return defineRegistry({
        inputs: { [name]: { Component: TextInput as never } },
        layouts: {},
        field: { Component: FieldStub as never },
      });
    }).toThrow(`"${name}"`);
  });

  test.each(['field', 'action', 'submit'])('refuses a layout named %s', (name) => {
    expect(() => {
      return defineRegistry({
        inputs: {},
        layouts: { [name]: { Component: FieldStub as never } },
        field: { Component: FieldStub as never },
      });
    }).toThrow(`"${name}"`);
  });
});
