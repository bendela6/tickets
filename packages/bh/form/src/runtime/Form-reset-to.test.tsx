/// <reference types="@testing-library/jest-dom/vitest" />
import type { ReactNode } from 'react';
import { describe, expect, test, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { Form } from './Form';
import { useStandaloneForm, type FormApi } from './use-standalone-form';
import { defineRegistry } from '../builder/define-registry';
import { defineForm } from '../builder/define-form';
import type { FieldWrapperProps, InputProps } from '../types/registry';

const TextInput = (p: InputProps<object, string>) => {
  return (
    <input aria-label={p.name} value={p.value ?? ''} onChange={(e) => p.onChange(e.target.value)} />
  );
};

function FieldStub({ children, error }: FieldWrapperProps) {
  return (
    <>
      {children}
      {error ? <p role="alert">{error}</p> : null}
    </>
  );
}

const registry = defineRegistry({
  inputs: { text: { Component: TextInput, defaultValue: '' } },
  layouts: {},
  field: { Component: FieldStub },
});

const form = defineForm(registry).build((b) => {
  return [
    b.text({ name: 'name', config: {} }),
    b.reset({ label: 'Undo' }),
    b.reset({ label: 'Clear', to: 'start' }),
    b.submit({ label: 'Apply' }),
  ];
});

const name = (): HTMLInputElement => screen.getByLabelText('name');
const button = (label: string) => screen.getByRole('button', { name: label });

async function apply() {
  fireEvent.click(button('Apply'));
  await act(async () => {
    await Promise.resolve();
  });
}

describe("a reset's to", () => {
  test('the builder writes it on a reset only, and leaves it out unless given', () => {
    expect(form.nodes[1]).toEqual({ kind: 'action', action: 'reset', label: 'Undo' });
    expect(form.nodes[2]).toMatchObject({ action: 'reset', label: 'Clear', to: 'start' });
    const submit = defineForm(registry).build((b) => [b.submit({ label: 'Go', to: 'start' })]);
    expect(submit.nodes[0]).not.toHaveProperty('to');
  });

  test("'start' goes back to where the form started after a submit, the default to what was submitted", async () => {
    const onSubmit = vi.fn();
    render(
      <Form registry={registry} form={form} defaultValues={{ name: 'any' }} onSubmit={onSubmit} />,
    );
    fireEvent.change(name(), { target: { value: 'Anna' } });
    await apply();
    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ name: 'Anna' }));
    fireEvent.change(name(), { target: { value: 'Beka' } });
    fireEvent.click(button('Undo'));
    expect(name().value).toBe('Anna');
    fireEvent.click(button('Clear'));
    expect(name().value).toBe('any');
  });

  test('each waits for something to put back, by its own rule', async () => {
    const onSubmit = vi.fn();
    render(<Form registry={registry} form={form} onSubmit={onSubmit} />);
    expect(button('Undo')).toBeDisabled();
    expect(button('Clear')).toBeDisabled();
    fireEvent.change(name(), { target: { value: 'Anna' } });
    expect(button('Undo')).toBeEnabled();
    expect(button('Clear')).toBeEnabled();
    await apply();
    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalled());
    // At what was submitted, and away from the start.
    await vi.waitFor(() => expect(button('Undo')).toBeDisabled());
    expect(button('Clear')).toBeEnabled();
  });

  test("'start' forgets a failed save", async () => {
    const onCommit = vi.fn(() => Promise.reject(new Error('The server said no.')));
    const saving = defineForm(registry).build((b) => {
      return [b.text({ name: 'name', config: {} }), b.reset({ label: 'Clear', to: 'start' })];
    });
    render(<Form registry={registry} form={saving} onCommit={onCommit} />);
    fireEvent.change(name(), { target: { value: 'Anna' } });
    expect(await screen.findByRole('alert')).toHaveTextContent('The server said no.');
    fireEvent.click(button('Clear'));
    expect(name().value).toBe('');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  test("FormApi's reset takes it too", async () => {
    let api: FormApi | undefined;
    const onSubmit = vi.fn();
    function Held(): ReactNode {
      api = useStandaloneForm({ form, registry, onSubmit });
      return <Form registry={registry} formApi={api} />;
    }
    render(<Held />);
    fireEvent.change(name(), { target: { value: 'Anna' } });
    await act(async () => {
      await api?.submit();
    });
    fireEvent.change(name(), { target: { value: 'Beka' } });
    act(() => api?.reset());
    expect(name().value).toBe('Anna');
    act(() => api?.reset({ to: 'start' }));
    expect(name().value).toBe('');
  });
});
