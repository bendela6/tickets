import { describe, expect, test, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Form } from './Form';
import { defineRegistry } from '../builder/define-registry';
import type { FieldWrapperProps, InputProps } from '../types/registry';

const SelectInput = (p: InputProps<{ options?: string[] }, string>) => {
  return (
    <select
      data-testid={p.name}
      value={p.value ?? ''}
      onChange={(e) => p.onChange(e.target.value)}
      onBlur={p.onBlur}
    >
      {(p.config.options ?? []).map((o) => {
        return (
          <option key={o} value={o}>
            {o}
          </option>
        );
      })}
    </select>
  );
};

function FieldStub({ children }: FieldWrapperProps) {
  return <>{children}</>;
}

const registry = defineRegistry({
  inputs: {
    select: { Component: SelectInput, defaultValue: '' },
  },
  layouts: {},
  field: { Component: FieldStub },
});

describe('<Form> async submit gating', () => {
  test('waits for pending resolvers before invoking onSubmit', async () => {
    const onSubmit = vi.fn();
    let resolveOptions!: (v: string[]) => void;
    const fn = vi.fn(() => {
      return new Promise<string[]>((res) => {
        resolveOptions = res;
      });
    });

    render(
      <Form
        registry={registry}
        config={{
          nodes: [
            {
              kind: 'field',
              name: 'state',
              type: 'select',
              defaultValue: '',
              config: { options: { fn, dependsOn: [] } },
            },
          ],
        }}
        onSubmit={onSubmit}
      />,
    );

    const formEl = screen.getByTestId('state').closest('form');
    if (!formEl) {
      throw new Error('form element not found');
    }
    fireEvent.submit(formEl);
    // Submit should be pending while options are still loading.
    expect(onSubmit).not.toHaveBeenCalled();
    resolveOptions(['CA', 'NY']);
    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalled());
  });
});
