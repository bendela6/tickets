/// <reference types="@testing-library/jest-dom" />
import { describe, expect, test, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Form } from './Form';
import { defineRegistry } from '../builder/define-registry';
import type { FieldWrapperProps, InputProps, LayoutComponentProps } from '../types/registry';

const TextInput = (p: InputProps<{ placeholder?: string }, string>) => {
  return (
    <input
      data-testid={`input-${p.name}`}
      value={p.value ?? ''}
      placeholder={p.config.placeholder}
      onChange={(e) => p.onChange(e.target.value)}
      onBlur={p.onBlur}
    />
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

function FieldStub({ name, label, required, children }: FieldWrapperProps) {
  return (
    <label data-testid={`field-${name}`}>
      <span>
        {label}
        {required && '*'}
      </span>
      {children}
    </label>
  );
}

const registry = defineRegistry({
  inputs: {
    text: { Component: TextInput, defaultValue: '' },
  },
  layouts: {
    group: { Component: GroupLayout },
  },
  field: { Component: FieldStub },
});

describe('<Form>', () => {
  test('renders fields, accepts input, submits values', async () => {
    const onSubmit = vi.fn();
    render(
      <Form
        registry={registry}
        config={{
          nodes: [
            {
              kind: 'group',
              props: { title: 'Profile' },
              children: [
                {
                  kind: 'field',
                  name: 'name',
                  type: 'text',
                  label: 'Name',
                  required: true,
                  defaultValue: '',
                  config: { placeholder: 'Beka' },
                },
              ],
            },
          ],
        }}
        onSubmit={onSubmit}
      />,
    );
    expect(screen.getByText('Profile')).toBeInTheDocument();
    expect(screen.getByText('Name*')).toBeInTheDocument();
    const input = screen.getByTestId('input-name');
    if (!(input instanceof HTMLInputElement)) {
      throw new Error('expected an <input>');
    }
    expect(input.placeholder).toBe('Beka');
    fireEvent.change(input, { target: { value: 'Sam' } });
    const formEl = input.closest('form');
    if (!formEl) {
      throw new Error('expected enclosing <form>');
    }
    fireEvent.submit(formEl);
    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ name: 'Sam' }));
  });

  test('hides field whose `when` evaluates false', () => {
    render(
      <Form
        registry={registry}
        config={{
          nodes: [
            //
            { kind: 'field', name: 'a', type: 'text', defaultValue: 'x', config: {} },
            {
              kind: 'field',
              name: 'b',
              type: 'text',
              defaultValue: '',
              when: { field: 'a', eq: 'NEVER' },
              config: {},
            },
          ],
        }}
      />,
    );
    expect(screen.queryByTestId('input-a')).toBeInTheDocument();
    expect(screen.queryByTestId('input-b')).not.toBeInTheDocument();
  });
});
