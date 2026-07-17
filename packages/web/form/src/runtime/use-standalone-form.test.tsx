import { describe, expect, test, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Form } from './Form';
import { useStandaloneForm } from './use-standalone-form';
import { defineRegistry } from '../builder/define-registry';
import type { FieldWrapperProps, InputProps } from '../types/registry';

const TextInput = (p: InputProps<Record<string, never>, string>) => {
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
  },
  layouts: {},
  field: { Component: FieldStub },
});

describe('useStandaloneForm', () => {
  test('exposes isDirty/submit/reset and shares state with <Form>', async () => {
    const onSubmit = vi.fn();
    function Page() {
      const api = useStandaloneForm({
        config: {
          nodes: [{ kind: 'field', name: 'a', type: 'text', defaultValue: '', config: {} }],
        },
        onSubmit,
      });
      return (
        <>
          <span data-testid="dirty">{String(api.isDirty)}</span>
          <button data-testid="save" onClick={() => api.submit()}>
            save
          </button>
          <button data-testid="revert" onClick={() => api.reset()}>
            revert
          </button>
          <Form
            formApi={api}
            registry={registry}
            config={{
              nodes: [{ kind: 'field', name: 'a', type: 'text', defaultValue: '', config: {} }],
            }}
          />
        </>
      );
    }
    render(<Page />);
    expect(screen.getByTestId('dirty').textContent).toBe('false');
    fireEvent.change(screen.getByTestId('a'), { target: { value: 'x' } });
    expect(screen.getByTestId('dirty').textContent).toBe('true');
    fireEvent.click(screen.getByTestId('save'));
    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ a: 'x' }));
    fireEvent.click(screen.getByTestId('revert'));
    expect(screen.getByTestId('dirty').textContent).toBe('false');
  });
});
