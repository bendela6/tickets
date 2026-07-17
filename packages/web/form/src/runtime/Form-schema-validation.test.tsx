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

const renderFormError = (msg: string) => <div data-testid="form-error">{msg}</div>;

describe('<Form> top-level schema validation', () => {
  test('cross-field rule blocks submit and surfaces via renderFormError', async () => {
    const onSubmit = vi.fn();
    const schema = v.pipe(
      v.object({
        password: v.string(),
        confirmPassword: v.string(),
      }),
      v.check(
        ({ password, confirmPassword }) => password === confirmPassword,
        'passwords must match',
      ),
    );

    render(
      <Form
        registry={registry}
        config={{
          nodes: [
            { kind: 'field', name: 'password', type: 'text', defaultValue: '', config: {} },
            {
              kind: 'field',
              name: 'confirmPassword',
              type: 'text',
              defaultValue: '',
              config: {},
            },
          ],
        }}
        schema={schema}
        onSubmit={onSubmit}
        renderFormError={renderFormError}
      />,
    );

    fireEvent.change(screen.getByTestId('input-password'), { target: { value: 'a' } });
    fireEvent.change(screen.getByTestId('input-confirmPassword'), { target: { value: 'b' } });
    const formEl = screen.getByTestId('input-password').closest('form');
    if (!formEl) {
      throw new Error('expected enclosing form');
    }
    fireEvent.submit(formEl);

    await vi.waitFor(() => {
      expect(screen.getByTestId('form-error')).toHaveTextContent('passwords must match');
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test('per-field error wins over conflicting top-level field-path issue', async () => {
    const onSubmit = vi.fn();
    const schema = v.object({
      email: v.pipe(v.string(), v.minLength(1, 'TOP-LEVEL message')),
    });
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
              validate: v.pipe(v.string(), v.minLength(1, 'required')),
            },
          ],
        }}
        schema={schema}
        onSubmit={onSubmit}
        renderFormError={renderFormError}
      />,
    );

    const formEl = screen.getByTestId('input-email').closest('form');
    if (!formEl) {
      throw new Error('expected enclosing form');
    }
    fireEvent.submit(formEl);

    await vi.waitFor(() => {
      expect(screen.getByTestId('error-email')).toHaveTextContent('required');
    });
    expect(screen.getByTestId('error-email')).not.toHaveTextContent('TOP-LEVEL message');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test('per-field passes, top-level cross-field fails', async () => {
    const onSubmit = vi.fn();
    const schema = v.pipe(
      v.object({
        a: v.string(),
        b: v.string(),
      }),
      v.check(({ a, b }) => a === b, 'a and b must match'),
    );

    render(
      <Form
        registry={registry}
        config={{
          nodes: [
            {
              kind: 'field',
              name: 'a',
              type: 'text',
              defaultValue: '',
              config: {},
              validate: v.pipe(v.string(), v.minLength(1, 'a required')),
            },
            {
              kind: 'field',
              name: 'b',
              type: 'text',
              defaultValue: '',
              config: {},
              validate: v.pipe(v.string(), v.minLength(1, 'b required')),
            },
          ],
        }}
        schema={schema}
        onSubmit={onSubmit}
        renderFormError={renderFormError}
      />,
    );

    fireEvent.change(screen.getByTestId('input-a'), { target: { value: 'x' } });
    fireEvent.change(screen.getByTestId('input-b'), { target: { value: 'y' } });
    const formEl = screen.getByTestId('input-a').closest('form');
    if (!formEl) {
      throw new Error('expected enclosing form');
    }
    fireEvent.submit(formEl);

    await vi.waitFor(() => {
      expect(screen.getByTestId('form-error')).toHaveTextContent('a and b must match');
    });
    expect(screen.queryByTestId('error-a')).not.toBeInTheDocument();
    expect(screen.queryByTestId('error-b')).not.toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test('hidden fields are stripped from the top-level schema input', async () => {
    const onSubmit = vi.fn();
    // Top-level requires `extras` non-empty WHEN PRESENT — but `extras` is
    // hidden when `enabled !== 'yes'`, so it is stripped before the schema
    // runs and the optional rule short-circuits cleanly.
    const schema = v.object({
      enabled: v.string(),
      extras: v.optional(v.pipe(v.string(), v.minLength(1, 'extras required'))),
    });

    render(
      <Form
        registry={registry}
        config={{
          nodes: [
            { kind: 'field', name: 'enabled', type: 'text', defaultValue: 'no', config: {} },
            {
              kind: 'field',
              name: 'extras',
              type: 'text',
              defaultValue: '',
              config: {},
              when: { field: 'enabled', eq: 'yes' },
            },
          ],
        }}
        schema={schema}
        onSubmit={onSubmit}
        renderFormError={renderFormError}
      />,
    );

    // extras is hidden because enabled !== 'yes'
    expect(screen.queryByTestId('input-extras')).not.toBeInTheDocument();
    const formEl = screen.getByTestId('input-enabled').closest('form');
    if (!formEl) {
      throw new Error('expected enclosing form');
    }
    fireEvent.submit(formEl);

    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ enabled: 'no' }));
    expect(screen.queryByTestId('form-error')).not.toBeInTheDocument();
    expect(screen.queryByTestId('error-extras')).not.toBeInTheDocument();
  });
});
