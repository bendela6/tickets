/// <reference types="@testing-library/jest-dom" />
import { describe, expect, test } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { Form } from './Form';
import { defineRegistry } from '../builder/define-registry';
import type { FieldWrapperProps, InputProps } from '../types/registry';

let renderCount = 0;
const TextInput = (p: InputProps<Record<string, never>, string>) => {
  return (
    <input
      data-testid={p.name}
      value={p.value ?? ''}
      onChange={(e) => p.onChange(e.target.value)}
    />
  );
};
const ConditionalInput = (p: InputProps<Record<string, never>, string>) => {
  renderCount++;
  return (
    <input
      data-testid={p.name}
      value={p.value ?? ''}
      onChange={(e) => p.onChange(e.target.value)}
    />
  );
};

function FieldStub({ children }: FieldWrapperProps) {
  return <>{children}</>;
}

const registry = defineRegistry({
  inputs: {
    text: { Component: TextInput, defaultValue: '' },
    conditional: { Component: ConditionalInput, defaultValue: '' },
  },
  layouts: {},
  field: { Component: FieldStub },
});

describe('useVisibility scoping', () => {
  test('predicate does not re-render visible-gated field when unrelated field changes', () => {
    renderCount = 0;
    render(
      <Form
        registry={registry}
        config={{
          nodes: [
            // 'flag' gates 'gated' visibility (when flag === 'show')
            {
              kind: 'field',
              name: 'flag',
              type: 'text',
              defaultValue: 'show',
              config: {},
            },
            {
              kind: 'field',
              name: 'gated',
              type: 'conditional',
              when: { field: 'flag', eq: 'show' },
              defaultValue: '',
              config: {},
            },
            // 'unrelated' is NOT referenced by any `when`.
            {
              kind: 'field',
              name: 'unrelated',
              type: 'text',
              defaultValue: '',
              config: {},
            },
          ],
        }}
      />,
    );
    const startCount = renderCount;
    expect(startCount).toBeGreaterThan(0); // initial render

    // Mutate the unrelated field. The conditional input should NOT re-render
    // (its visibility predicate only references `flag`).
    act(() => {
      fireEvent.change(screen.getByTestId('unrelated'), { target: { value: 'X' } });
    });

    expect(renderCount).toBe(startCount);
  });
});
