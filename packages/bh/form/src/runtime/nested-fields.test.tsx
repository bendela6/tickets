/// <reference types="@testing-library/jest-dom/vitest" />
import type { EntriesOf } from '@bh/registry';
import { describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import * as v from 'valibot';
import { Form } from './Form';
import { defineRegistry } from '../builder/define-registry';
import type { FormConfig } from '../types/form-config';
import type { FieldWrapperProps, InputProps, InputRegistry } from '../types/registry';
import { schemaToFormConfig } from '../valibot/schema-to-form-config';
import { defaultValuesOf, NestedFields, useFormRegistry } from './nested-fields';
import { noInputs, noLayouts } from '../builder/registries';

const TextInput = (p: InputProps<object, string>) => {
  return (
    <input
      aria-label={p.name}
      value={p.value}
      onChange={(e) => p.onChange(e.target.value)}
      onBlur={p.onBlur}
    />
  );
};

type Item = Record<string, unknown>;

/** A list input, as a design system writes one: each item drawn with NestedFields. */
const ListInput = (p: InputProps<{ item: FormConfig<InputRegistry> }, Item[]>) => {
  const registry = useFormRegistry();
  const items = p.value;
  return (
    <div>
      {items.map((item, index) => {
        return (
          <NestedFields
            key={index}
            name={`${p.name}.${index}`}
            nodes={p.config.item.nodes}
            value={item}
            onChange={(next) => p.onChange(items.map((old, at) => (at === index ? next : old)))}
          />
        );
      })}
      <button
        type="button"
        onClick={() => p.onChange([...items, defaultValuesOf(p.config.item.nodes, registry)])}
      >
        Add
      </button>
    </div>
  );
};

function FieldStub({ name, label, error, children }: FieldWrapperProps) {
  return (
    <div data-testid={`field-${name}`}>
      <span>{label}</span>
      {children}
      {error ? <span role="alert">{error}</span> : null}
    </div>
  );
}

const registry = defineRegistry({
  inputs: noInputs.register({
    text: { Component: TextInput, defaultValue: '' },
    list: { Component: ListInput, defaultValue: [] as Item[] },
  }),
  layouts: noLayouts,
  field: { Component: FieldStub },
});

const SCHEMA = v.object({
  shortcuts: v.array(
    v.object({
      keys: v.pipe(v.string(), v.nonEmpty('Name the keys')),
      action: v.pipe(v.string(), v.title('Action')),
    }),
  ),
});

describe('<NestedFields>', () => {
  test('draws each item with the form registry, and edits and adds items', async () => {
    const onSubmit = vi.fn();
    render(
      <Form
        registry={registry}
        form={schemaToFormConfig<EntriesOf<typeof registry.inputs>>(SCHEMA)}
        defaultValues={{ shortcuts: [{ keys: 'Ctrl+K', action: 'Search' }] }}
        onSubmit={onSubmit}
      >
        <button type="submit">Save</button>
      </Form>,
    );
    expect(screen.getByLabelText('shortcuts.0.keys')).toHaveValue('Ctrl+K');
    expect(screen.getByTestId('field-shortcuts.0.action')).toHaveTextContent('Action');

    fireEvent.change(screen.getByLabelText('shortcuts.0.action'), { target: { value: 'Find' } });
    fireEvent.click(screen.getByText('Add'));
    fireEvent.change(screen.getByLabelText('shortcuts.1.keys'), { target: { value: 'Esc' } });
    fireEvent.click(screen.getByText('Save'));

    await vi.waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        shortcuts: [
          { keys: 'Ctrl+K', action: 'Find' },
          { keys: 'Esc', action: '' },
        ],
      });
    });
  });

  test("shows an item field's problem once the field has been left", () => {
    render(
      <Form
        registry={registry}
        form={schemaToFormConfig<EntriesOf<typeof registry.inputs>>(SCHEMA)}
        defaultValues={{ shortcuts: [{ keys: '', action: '' }] }}
      />,
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    fireEvent.blur(screen.getByLabelText('shortcuts.0.keys'));
    expect(screen.getByRole('alert')).toHaveTextContent('Name the keys');
  });

  test('defaultValuesOf takes each field default, else its input default', () => {
    const nodes = [
      { kind: 'field', name: 'a', type: 'text', config: {} },
      { kind: 'field', name: 'b', type: 'text', config: {}, defaultValue: 'x' },
    ] as const;
    expect(defaultValuesOf(nodes as never, registry as never)).toEqual({ a: '', b: 'x' });
  });

  test('useFormRegistry throws outside a <Form>', () => {
    const Lost = () => {
      useFormRegistry();
      return null;
    };
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Lost />)).toThrow(/inside <Form>/);
  });
});
