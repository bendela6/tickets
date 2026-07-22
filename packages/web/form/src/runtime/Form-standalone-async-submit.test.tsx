import { describe, expect, test, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { Form } from './Form';
import { useStandaloneForm } from './use-standalone-form';
import { defineRegistry } from '../builder/define-registry';
import type { FieldWrapperProps, InputProps } from '../types/registry';

const SelectInput = (p: InputProps<{ options?: string[] }, string>) => {
  return (
    <select data-testid={p.name} value={p.value ?? ''} onChange={(e) => p.onChange(e.target.value)}>
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

describe('useStandaloneForm.submit() async-resolver gating', () => {
  test('waits for visible pending resolvers before invoking onSubmit', async () => {
    const onSubmit = vi.fn();
    let resolveOptions!: (v: string[]) => void;
    const fn = vi.fn(() => {
      return new Promise<string[]>((res) => {
        resolveOptions = res;
      });
    });

    function Page() {
      const api = useStandaloneForm({
        config: {
          nodes: [
            {
              kind: 'field',
              name: 'state',
              type: 'select',
              defaultValue: '',
              config: { options: { fn, dependsOn: [] } },
            },
          ],
        },
        onSubmit,
      });
      return (
        <>
          <button data-testid="external-save" onClick={() => api.submit()}>
            Save
          </button>
          <Form
            formApi={api}
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
          />
        </>
      );
    }

    render(<Page />);
    fireEvent.click(screen.getByTestId('external-save'));
    // Submit is gated on the visible field's pending resolver.
    expect(onSubmit).not.toHaveBeenCalled();
    act(() => {
      resolveOptions(['CA', 'NY']);
    });
    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalled());
  });
});
