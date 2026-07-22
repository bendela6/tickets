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
