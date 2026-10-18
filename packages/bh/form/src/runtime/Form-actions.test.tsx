/// <reference types="@testing-library/jest-dom/vitest" />
import { describe, expect, test, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import * as v from 'valibot';
import { Form } from './Form';
import { useStandaloneForm } from './use-standalone-form';
import { defineRegistry } from '../builder/define-registry';
import { defineForm } from '../builder/define-form';
import type { ActionProps, FieldWrapperProps, InputProps } from '../types/registry';
import { noInputs, noLayouts } from '../builder/registries';

const TextInput = (p: InputProps<object, string>) => {
  return (
    <input
      aria-label={p.name}
      value={p.value ?? ''}
      onChange={(e) => p.onChange(e.target.value)}
      onBlur={p.onBlur}
    />
  );
};

function FieldStub({ name, error, children }: FieldWrapperProps) {
  return (
    <div data-testid={`field-${name}`}>
      {children}
      {error ? <p role="alert">{error}</p> : null}
    </div>
  );
}

const registry = defineRegistry({
  inputs: noInputs.register({ text: { Component: TextInput, defaultValue: '' } }),
  layouts: noLayouts,
  field: { Component: FieldStub },
});

const contact = defineForm(registry).build((b) => {
  return [
    b.text({ name: 'name', config: {} }),
    b.reset({ label: 'Reset' }),
    b.submit({ label: 'Save' }),
  ];
});

describe('<Form> buttons', () => {
  test('a submit node submits the form', async () => {
    const onSubmit = vi.fn();
    render(<Form registry={registry} form={contact} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText('name'), { target: { value: 'Anna' } });
    const save = screen.getByRole('button', { name: 'Save' });
    expect(save).toHaveAttribute('type', 'submit');
    fireEvent.click(save);
    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ name: 'Anna' }));
  });

  test('a reset node waits for a change, then puts the values back', () => {
    render(<Form registry={registry} form={contact} onSubmit={vi.fn()} />);
    const reset = screen.getByRole('button', { name: 'Reset' });
    expect(reset).toHaveAttribute('type', 'button');
    expect(reset).toBeDisabled();
    fireEvent.change(screen.getByLabelText('name'), { target: { value: 'Anna' } });
    expect(reset).toBeEnabled();
    fireEvent.click(reset);
    expect(screen.getByLabelText('name')).toHaveValue('');
    expect(reset).toBeDisabled();
  });

  test("draws the registry's button when it has one", async () => {
    const seen: ActionProps[] = [];
    const Button = (p: ActionProps) => {
      seen.push(p);
      return (
        <button type={p.action === 'submit' ? 'submit' : 'button'} onClick={p.onClick}>
          {p.label}!
        </button>
      );
    };
    const withButton = defineRegistry({ ...registry, action: { Component: Button } });
    const onSubmit = vi.fn();
    render(<Form registry={withButton} form={contact} onSubmit={onSubmit} />);
    expect(screen.getByRole('button', { name: 'Save!' })).toBeInTheDocument();
    expect(seen.find((p) => p.action === 'reset')).toMatchObject({
      label: 'Reset',
      disabled: true,
      loading: false,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save!' }));
    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalled());
  });

  test('a button with `when` shows only while it holds', () => {
    const form = defineForm(registry).build((b) => {
      return [
        b.text({ name: 'name', config: {} }),
        b.submit({ label: 'Save', when: { field: 'name', truthy: true } }),
      ];
    });
    render(<Form registry={registry} form={form} onSubmit={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('name'), { target: { value: 'Anna' } });
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  test('buttons submit nothing of their own', async () => {
    const onSubmit = vi.fn();
    render(<Form registry={registry} form={contact} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ name: '' }));
  });
});

describe("<Form> and the form's own options", () => {
  const form = defineForm(registry).build(
    (b) => [b.text({ name: 'name', config: {} }), b.submit({ label: 'Save' })],
    {
      defaultValues: { name: 'From the form' },
      schema: v.object({ name: v.pipe(v.string(), v.minLength(3, 'Too short')) }),
    },
  );

  test("starts at the form's values, and <Form defaultValues> wins", () => {
    const { unmount } = render(<Form registry={registry} form={form} />);
    expect(screen.getByLabelText('name')).toHaveValue('From the form');
    unmount();
    render(<Form registry={registry} form={form} defaultValues={{ name: 'From the page' }} />);
    expect(screen.getByLabelText('name')).toHaveValue('From the page');
  });

  test("checks with the form's schema", async () => {
    const onSubmit = vi.fn();
    render(<Form registry={registry} form={form} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText('name'), { target: { value: 'An' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Too short');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test('<Form formApi> draws the form the hook was given', () => {
    function Page() {
      const api = useStandaloneForm({ registry, form });
      return <Form formApi={api} registry={registry} />;
    }
    render(<Page />);
    expect(screen.getByLabelText('name')).toHaveValue('From the form');
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });
});
