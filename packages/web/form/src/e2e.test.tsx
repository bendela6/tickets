import { describe, expect, test, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import * as v from 'valibot';
import { defineRegistry, defineForm, Form } from './index';
import { schemaToFormConfig } from './valibot';
import type { FieldWrapperProps, InputProps, LayoutComponentProps } from './index';

const TextInput = (p: InputProps<{ placeholder?: string }, string>) => {
  return (
    <input
      data-testid={p.name}
      value={p.value ?? ''}
      placeholder={p.config.placeholder}
      onChange={(e) => p.onChange(e.target.value)}
    />
  );
};
const SelectInput = (p: InputProps<{ options: { value: string; label: string }[] }, string>) => {
  return (
    <select data-testid={p.name} value={p.value ?? ''} onChange={(e) => p.onChange(e.target.value)}>
      {(p.config.options ?? []).map((o) => {
        return (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        );
      })}
    </select>
  );
};

function GroupLayout({
  props,
  children,
}: LayoutComponentProps<{ title?: string; description?: string }>) {
  return (
    <fieldset>
      <legend>{props.title}</legend>
      {children}
    </fieldset>
  );
}

function FieldStub({ label, children }: FieldWrapperProps) {
  return (
    <label>
      <span>{label}</span>
      {children}
    </label>
  );
}

const registry = defineRegistry({
  inputs: {
    text: { Component: TextInput, defaultValue: '' },
    select: { Component: SelectInput, defaultValue: '' },
  },
  layouts: {
    group: { Component: GroupLayout },
  },
  field: { Component: FieldStub },
});

describe('@tickets/form end-to-end', () => {
  test('hand-authored config + when + submit', async () => {
    const onSubmit = vi.fn();
    const config = defineForm(registry).build((b) => {
      return [
        b.group({ title: 'Where' }, [
          b.select({
            name: 'country',
            label: 'Country',
            defaultValue: 'US',
            config: {
              options: [
                //
                { value: 'US', label: 'United States' },
                { value: 'CA', label: 'Canada' },
              ],
            },
          }),
          b.select({
            name: 'state',
            label: 'State',
            when: { field: 'country', eq: 'US' },
            config: {
              options: [
                //
                { value: 'CA', label: 'California' },
                { value: 'NY', label: 'New York' },
              ],
            },
          }),
        ]),
      ];
    });
    render(<Form registry={registry} config={config} onSubmit={onSubmit} />);
    expect(screen.getByTestId('country')).toBeInTheDocument();
    expect(screen.getByTestId('state')).toBeInTheDocument();
    // Switch country to CA -> state should hide.
    fireEvent.change(screen.getByTestId('country'), { target: { value: 'CA' } });
    expect(screen.queryByTestId('state')).not.toBeInTheDocument();

    const formEl = screen.getByTestId('country').closest('form');
    if (!formEl) {
      throw new Error('form not found');
    }
    fireEvent.submit(formEl);
    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ country: 'CA' }));
  });

  test('valibot helper produces a tree the runtime can render', () => {
    const schema = v.object({ name: v.string(), accept: v.boolean() });
    const config = schemaToFormConfig<typeof registry.inputs>(schema, {
      accept: {
        type: 'select',
        config: {
          options: [
            //
            { value: 'true', label: 'Yes' },
            { value: 'false', label: 'No' },
          ],
        },
      },
    });
    expect(config.nodes).toHaveLength(2);
    render(<Form registry={registry} config={config as never} />);
    expect(screen.getByTestId('name')).toBeInTheDocument();
    expect(screen.getByTestId('accept')).toBeInTheDocument();
  });
});
