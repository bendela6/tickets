/// <reference types="@testing-library/jest-dom/vitest" />
import { describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Form } from './Form';
import { NestedFields } from './nested-fields';
import { defineRegistry } from '../builder/define-registry';
import { defineForm } from '../builder/define-form';
import type { FieldWrapperProps, InputProps } from '../types/registry';
import { noInputs, noLayouts } from '../builder/registries';

// Calls onChange whatever it's told, so the form's own guard is what's tested.
const TextInput = (p: InputProps<object, string>) => {
  return (
    <input
      aria-label={p.name}
      data-read-only={p.readOnly ? 'yes' : 'no'}
      value={p.value ?? ''}
      onChange={(e) => p.onChange(e.target.value)}
    />
  );
};

const GroupInput = (p: InputProps<object, Record<string, unknown>>) => {
  return (
    <NestedFields
      name={p.name}
      nodes={[{ kind: 'field', name: 'inner', type: 'text', config: {} }]}
      value={p.value ?? {}}
      readOnly={p.readOnly}
      onChange={p.onChange}
    />
  );
};

function FieldStub({ children }: FieldWrapperProps) {
  return <>{children}</>;
}

const registry = defineRegistry({
  inputs: noInputs.register({
    text: { Component: TextInput, defaultValue: '' },
    group: { Component: GroupInput, defaultValue: {} },
  }),
  layouts: noLayouts,
  field: { Component: FieldStub },
});

const form = defineForm(registry).build((b) => {
  return [
    b.text({ name: 'project', readOnly: true, config: {} }),
    b.text({ name: 'title', config: {} }),
    b.group({ name: 'more', readOnly: true, config: {} }),
    b.reset({ label: 'Clear', to: 'start' }),
    b.submit({ label: 'Apply' }),
  ];
});

const input = (name: string): HTMLInputElement => screen.getByLabelText(name);

describe('a read-only field', () => {
  test('the builder writes it, and leaves it out unless given', () => {
    expect(form.nodes[0]).toMatchObject({ name: 'project', readOnly: true });
    expect(form.nodes[1]).not.toHaveProperty('readOnly');
  });

  test('its input is told, and the form ignores its onChange', () => {
    const onCommit = vi.fn();
    render(
      <Form
        registry={registry}
        form={form}
        defaultValues={{ project: 'TIX' }}
        onCommit={onCommit}
      />,
    );
    expect(input('project')).toHaveAttribute('data-read-only', 'yes');
    expect(input('title')).toHaveAttribute('data-read-only', 'no');
    fireEvent.change(input('project'), { target: { value: 'BH' } });
    expect(input('project').value).toBe('TIX');
    expect(onCommit).not.toHaveBeenCalled();
  });

  test('a reset leaves its value, and a submit still sends it', async () => {
    const onSubmit = vi.fn();
    render(
      <Form registry={registry} form={form} values={{ project: 'TIX' }} onSubmit={onSubmit} />,
    );
    fireEvent.change(input('title'), { target: { value: 'login' } });
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(input('title').value).toBe('');
    expect(input('project').value).toBe('TIX');
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    await vi.waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({ project: 'TIX', title: '', more: {} });
    });
  });

  test('nested fields are read-only with it', () => {
    render(<Form registry={registry} form={form} defaultValues={{ more: { inner: 'kept' } }} />);
    const inner = input('more.inner');
    expect(inner).toHaveAttribute('data-read-only', 'yes');
    fireEvent.change(inner, { target: { value: 'changed' } });
    expect(input('more.inner').value).toBe('kept');
  });
});
