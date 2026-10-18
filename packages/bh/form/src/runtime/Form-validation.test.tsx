/// <reference types="@testing-library/jest-dom/vitest" />
import { describe, expect, test, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import * as v from 'valibot';
import { Form } from './Form';
import { defineRegistry } from '../builder/define-registry';
import type { FieldWrapperProps, InputProps } from '../types/registry';
import { noInputs, noLayouts } from '../builder/registries';

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
  inputs: noInputs.register({
    text: { Component: TextInput, defaultValue: '' },
  }),
  layouts: noLayouts,
  field: { Component: FieldStub },
});

describe('<Form> per-field validation', () => {
  test('schema rejects → onSubmit not called, error surfaces via renderField', async () => {
    const onSubmit = vi.fn();
    render(
      <Form
        registry={registry}
        form={{
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
        form={{
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
        form={{
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

  test("an untouched field is checked at its input's default, so its own message shows", async () => {
    const onSubmit = vi.fn();
    render(
      <Form
        registry={registry}
        form={{
          nodes: [
            {
              kind: 'field',
              name: 'name',
              type: 'text',
              config: {},
              validate: v.pipe(v.string(), v.minLength(1, 'Name is needed')),
            },
          ],
        }}
        onSubmit={onSubmit}
      />,
    );
    const formEl = screen.getByTestId('input-name').closest('form');
    if (!formEl) {
      throw new Error('expected enclosing form');
    }
    fireEvent.submit(formEl);
    await vi.waitFor(() => {
      expect(screen.getByTestId('error-name')).toHaveTextContent('Name is needed');
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  describe('when a field shows its problem', () => {
    const twoFields = {
      nodes: [
        {
          kind: 'field' as const,
          name: 'name',
          type: 'text' as const,
          config: {},
          validate: v.pipe(v.string(), v.minLength(1, 'Name is needed')),
        },
        {
          kind: 'field' as const,
          name: 'email',
          type: 'text' as const,
          config: {},
          validate: v.pipe(v.string(), v.minLength(1, 'Email is needed')),
        },
      ],
    };

    test('leaving a field shows its problem, and not the problems of fields not reached', async () => {
      render(<Form registry={registry} form={twoFields} onSubmit={vi.fn()} />);
      fireEvent.blur(screen.getByTestId('input-name'));
      await vi.waitFor(() => {
        expect(screen.getByTestId('error-name')).toHaveTextContent('Name is needed');
      });
      expect(screen.queryByTestId('error-email')).not.toBeInTheDocument();
    });

    test('a submit shows every problem', async () => {
      render(<Form registry={registry} form={twoFields} onSubmit={vi.fn()} />);
      const formEl = screen.getByTestId('input-name').closest('form');
      if (!formEl) {
        throw new Error('expected enclosing form');
      }
      fireEvent.submit(formEl);
      await vi.waitFor(() => {
        expect(screen.getByTestId('error-email')).toHaveTextContent('Email is needed');
      });
      expect(screen.getByTestId('error-name')).toHaveTextContent('Name is needed');
    });

    test('a problem a submit showed goes once the field is put right', async () => {
      render(<Form registry={registry} form={twoFields} onSubmit={vi.fn()} />);
      const formEl = screen.getByTestId('input-name').closest('form');
      if (!formEl) {
        throw new Error('expected enclosing form');
      }
      fireEvent.submit(formEl);
      await vi.waitFor(() => {
        expect(screen.getByTestId('error-name')).toHaveTextContent('Name is needed');
      });
      fireEvent.change(screen.getByTestId('input-name'), { target: { value: 'Ada' } });
      fireEvent.blur(screen.getByTestId('input-name'));
      await vi.waitFor(() => {
        expect(screen.queryByTestId('error-name')).not.toBeInTheDocument();
      });
      // The field not yet put right keeps its problem.
      expect(screen.getByTestId('error-email')).toHaveTextContent('Email is needed');
    });

    test("the form's own problem goes once a field puts it right", async () => {
      render(
        <Form
          registry={registry}
          form={twoFields}
          schema={v.custom((value) => (value as { name?: string }).name === 'Ada', 'Only Ada.')}
          onSubmit={vi.fn()}
          renderFormError={(message) => <p data-testid="form-error">{message}</p>}
        />,
      );
      const formEl = screen.getByTestId('input-name').closest('form');
      if (!formEl) {
        throw new Error('expected enclosing form');
      }
      fireEvent.submit(formEl);
      await vi.waitFor(() => {
        expect(screen.getByTestId('form-error')).toHaveTextContent('Only Ada.');
      });
      fireEvent.change(screen.getByTestId('input-name'), { target: { value: 'Ada' } });
      fireEvent.blur(screen.getByTestId('input-name'));
      await vi.waitFor(() => {
        expect(screen.queryByTestId('form-error')).not.toBeInTheDocument();
      });
    });

    test("a form's own problem waits for a submit", async () => {
      render(
        <Form
          registry={registry}
          form={twoFields}
          schema={v.custom(() => false, 'Something is off.')}
          onSubmit={vi.fn()}
          renderFormError={(message) => <p data-testid="form-error">{message}</p>}
        />,
      );
      fireEvent.blur(screen.getByTestId('input-name'));
      await vi.waitFor(() => expect(screen.getByTestId('error-name')).toBeInTheDocument());
      expect(screen.queryByTestId('form-error')).not.toBeInTheDocument();
      const formEl = screen.getByTestId('input-name').closest('form');
      if (!formEl) {
        throw new Error('expected enclosing form');
      }
      fireEvent.submit(formEl);
      await vi.waitFor(() => {
        expect(screen.getByTestId('form-error')).toHaveTextContent('Something is off.');
      });
    });
  });
});
