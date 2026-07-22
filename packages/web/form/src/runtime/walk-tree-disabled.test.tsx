import { describe, expect, test, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { Form } from './Form';
import { defineRegistry } from '../builder/define-registry';
import type { FieldWrapperProps, InputProps } from '../types/registry';

const TextInput = (p: InputProps<Record<string, never>, string>) => {
  return (
    <input
      data-testid={p.name}
      value={p.value ?? ''}
      disabled={p.disabled}
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
  },
  layouts: {},
  field: { Component: FieldStub },
});

describe('walk-tree disabled wiring', () => {
  test('inputs receive disabled=true while submit is in flight', async () => {
    let resolveSubmit!: () => void;
    const onSubmit = vi.fn(() => {
      return new Promise<void>((res) => {
        resolveSubmit = res;
      });
    });

    render(
      <Form
        registry={registry}
        config={{
          nodes: [{ kind: 'field', name: 'a', type: 'text', defaultValue: '', config: {} }],
        }}
        onSubmit={onSubmit}
      />,
    );

    const input = screen.getByTestId('a');
    expect(input).toHaveProperty('disabled', false);

    const formEl = input.closest('form');
    if (!formEl) {
      throw new Error('form not found');
    }
    fireEvent.submit(formEl);

    // Submit promise is in flight → isSubmitting true → input disabled.
    await vi.waitFor(() => expect(screen.getByTestId('a')).toHaveProperty('disabled', true));

    // Settle the submit, input becomes enabled again.
    act(() => {
      resolveSubmit();
    });
    await vi.waitFor(() => expect(screen.getByTestId('a')).toHaveProperty('disabled', false));
  });
});
