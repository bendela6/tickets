import { describe, expect, test } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useForm } from './use-form';
import type { FormConfig } from '../types/form-config';
import type { InputRegistry } from '../types/registry';

type R = InputRegistry;

const config: FormConfig<R> = {
  nodes: [
    { kind: 'field', name: 'name', type: 'text', defaultValue: 'Beka', config: {} },
    { kind: 'field', name: 'count', type: 'number', defaultValue: 0, config: {} },
  ],
};

describe('useForm', () => {
  test('initializes values from collectFields defaults', () => {
    const { result } = renderHook(() => useForm({ form: config }));
    expect(result.current.getValues()).toEqual({ name: 'Beka', count: 0 });
  });

  test('defaultValues prop overlays per-field defaults', () => {
    const { result } = renderHook(() => useForm({ form: config, defaultValues: { name: 'Anna' } }));
    expect(result.current.getValues()).toEqual({ name: 'Anna', count: 0 });
  });

  test("a field with no default of its own starts at its input's, from the registry", () => {
    const registry = {
      inputs: {
        text: { Component: () => null, defaultValue: '' },
        tags: { Component: () => null, defaultValue: [] as string[] },
      },
      layouts: {},
      field: { Component: () => null },
    };
    const bare: FormConfig<typeof registry.inputs> = {
      nodes: [
        { kind: 'field', name: 'name', type: 'text', config: {} },
        { kind: 'field', name: 'labels', type: 'tags', config: {} },
        { kind: 'field', name: 'title', type: 'text', defaultValue: 'Draft', config: {} },
        { kind: 'field', name: 'note', type: 'text', config: {} },
      ],
    };
    const { result } = renderHook(() => {
      return useForm({ form: bare, registry, defaultValues: { note: 'Kept' } });
    });
    expect(result.current.getValues()).toEqual({
      name: '',
      labels: [],
      title: 'Draft',
      note: 'Kept',
    });
  });

  test('setFieldValue updates the value', () => {
    const { result } = renderHook(() => useForm({ form: config }));
    act(() => {
      result.current.setFieldValue('name', 'Sam');
    });
    expect(result.current.getValues().name).toBe('Sam');
  });
});
