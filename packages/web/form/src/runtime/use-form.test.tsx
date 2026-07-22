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
    const { result } = renderHook(() => useForm({ config }));
    expect(result.current.getValues()).toEqual({ name: 'Beka', count: 0 });
  });

  test('defaultValues prop overlays per-field defaults', () => {
    const { result } = renderHook(() => useForm({ config, defaultValues: { name: 'Anna' } }));
    expect(result.current.getValues()).toEqual({ name: 'Anna', count: 0 });
  });

  test('setFieldValue updates the value', () => {
    const { result } = renderHook(() => useForm({ config }));
    act(() => {
      result.current.setFieldValue('name', 'Sam');
    });
    expect(result.current.getValues().name).toBe('Sam');
  });
});
