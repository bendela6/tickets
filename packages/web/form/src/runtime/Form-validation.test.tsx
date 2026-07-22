/// <reference types="@testing-library/jest-dom" />
import { describe, expect, test, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import * as v from 'valibot';
import { Form } from './Form';
import { defineRegistry } from '../builder/define-registry';
import type { FieldWrapperProps, InputProps } from '../types/registry';

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

function FieldStub({ name, label, required, error, children }: FieldWrapperProps) {
  return (
    <label data-testid={`field-${name}`}>
      <span>
        {label}
        {required && '*'}
      </span>
      {children}
      {error && <span data-testid={`error-${name}`}>{error}</span>}
    </label>
  );
}

const registry = defineRegistry({
  inputs: {
    text: { Component: TextInput, defaultValue: '' },
  },
  layouts: {},
  field: { Component: FieldStub },
});

describe('<Form> per-field validation', () => {
  test('schema rejects → onSubmit not called, error surfaces via renderField', async () => {
    const onSubmit = vi.fn();
    render(
      <Form
        registry={registry}
        config={{
          nodes: [
            {
              kind: 'field',
              name: 'email',
              type: 'text',
              defaultValue: '',
              config: {},
              validate: v.pipe(v.string(), v.email('Bad email')),
            },
          ],
        }}
        onSubmit={onSubmit}
      />,
    );
    const input = screen.getByTestId('input-email');
    if (!(input instanceof HTMLInputElement)) {
      throw new Error('expected input');
    }
    fireEvent.change(input, { target: { value: 'not-an-email' } });
    const formEl = input.closest('form');
    if (!formEl) {
      throw new Error('expected enclosing form');
    }
    fireEvent.submit(formEl);
    await vi.waitFor(() => {
      expect(screen.getByTestId('error-email')).toHaveTextContent('Bad email');
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test('schema accepts → onSubmit fires with stripped visible values', async () => {
    const onSubmit = vi.fn();
    render(
      <Form
        registry={registry}
        config={{
          nodes: [
            {
              kind: 'field',
              name: 'email',
              type: 'text',
              defaultValue: '',
              config: {},
              validate: v.pipe(v.string(), v.email('Bad email')),
            },
          ],
        }}
        onSubmit={onSubmit}
      />,
    );
    const input = screen.getByTestId('input-email');
    if (!(input instanceof HTMLInputElement)) {
      throw new Error('expected input');
    }
    fireEvent.change(input, { target: { value: 'a@b.co' } });
    const formEl = input.closest('form');
    if (!formEl) {
      throw new Error('expected enclosing form');
    }
    fireEvent.submit(formEl);
    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ email: 'a@b.co' }));
  });

  test("hidden field's validate does not block submission", async () => {
    const onSubmit = vi.fn();
    render(
      <Form
        registry={registry}
        config={{
          nodes: [
            {
              kind: 'field',
              name: 'country',
              type: 'text',
              defaultValue: 'CA',
              config: {},
            },
            {
              kind: 'field',
              name: 'state',
              type: 'text',
              defaultValue: '',
              config: {},
              validate: v.pipe(v.string(), v.minLength(1, 'state required')),
              when: { field: 'country', eq: 'US' },
            },
          ],
        }}
        onSubmit={onSubmit}
      />,
    );
    // state is hidden because country !== 'US'
    expect(screen.queryByTestId('input-state')).not.toBeInTheDocument();
    const formEl = screen.getByTestId('input-country').closest('form');
    if (!formEl) {
      throw new Error('expected enclosing form');
    }
    fireEvent.submit(formEl);
    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ country: 'CA' }));
    expect(screen.queryByTestId('error-state')).not.toBeInTheDocument();
  });
});
