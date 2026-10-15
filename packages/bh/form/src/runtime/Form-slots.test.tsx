/// <reference types="@testing-library/jest-dom/vitest" />
import type { ReactNode } from 'react';
import { describe, expect, test } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Form } from './Form';
import { useStandaloneForm } from './use-standalone-form';
import { collectFields } from './collect-fields';
import { defineRegistry } from '../builder/define-registry';
import { defineForm } from '../builder/define-form';
import type { FieldWrapperProps, InputProps, LayoutComponentProps } from '../types/registry';
import type { FormConfig } from '../types/form-config';

const TextInput = (p: InputProps<object, string>) => {
  return (
    <input aria-label={p.name} value={p.value ?? ''} onChange={(e) => p.onChange(e.target.value)} />
  );
};

const ListInput = (p: InputProps<object, Record<string, unknown>[]>) => {
  return <span data-testid="list">{p.value.length}</span>;
};

function FieldStub({ children }: FieldWrapperProps) {
  return <>{children}</>;
}

function Box({ children }: LayoutComponentProps<Record<string, never>>) {
  return <section aria-label="box">{children}</section>;
}

const registry = defineRegistry({
  inputs: {
    text: { Component: TextInput, defaultValue: '' },
    list: { Component: ListInput, defaultValue: [] as Record<string, unknown>[] },
  },
  layouts: { box: { Component: Box } },
  field: { Component: FieldStub },
});

const form = defineForm(registry).build((b) => {
  return [
    b.text({ name: 'first', config: {} }),
    b.slot({ name: 'count' }),
    b.box({}, [b.text({ name: 'second', config: {} }), b.slot({ name: 'end' })]),
    b.slot({ name: 'when', when: { field: 'first', eq: 'show' } }),
  ];
});

/** The text of the form's elements in the order they're drawn: inputs by name, slots by text. */
function order(container: HTMLElement): string[] {
  return [...container.querySelectorAll('input, [data-slot]')].map((element) => {
    return element.getAttribute('aria-label') ?? element.textContent ?? '';
  });
}

describe('slot nodes', () => {
  test('the builder makes one: a kind, a name and a when, holding no value', () => {
    expect(form.nodes[1]).toEqual({ kind: 'slot', name: 'count' });
    expect(form.nodes[3]).toEqual({
      kind: 'slot',
      name: 'when',
      when: { field: 'first', eq: 'show' },
    });
    expect([...collectFields(form.nodes).keys()]).toEqual(['first', 'second']);
  });

  test('<Form slots> draws each where its node sits, inside layouts too', () => {
    const { container } = render(
      <Form
        registry={registry}
        form={form}
        slots={{
          count: <span data-slot>12 of 40</span>,
          end: <span data-slot>Save to view</span>,
        }}
      />,
    );
    expect(order(container)).toEqual(['first', '12 of 40', 'second', 'Save to view']);
    expect(screen.getByRole('region', { name: 'box' })).toHaveTextContent('Save to view');
  });

  test('draws nothing for a slot it’s given nothing of', () => {
    const { container } = render(
      <Form registry={registry} form={form} slots={{ end: <span data-slot>end</span> }} />,
    );
    expect(order(container)).toEqual(['first', 'second', 'end']);
    render(<Form registry={registry} form={form} />);
  });

  test('a slot’s when shows it', () => {
    const { container } = render(
      <Form registry={registry} form={form} slots={{ when: <span data-slot>shown</span> }} />,
    );
    expect(order(container)).not.toContain('shown');
    fireEvent.change(screen.getByLabelText('first'), { target: { value: 'show' } });
    expect(order(container)).toContain('shown');
  });

  test('<Form formApi> takes slots too', () => {
    function Held(): ReactNode {
      const formApi = useStandaloneForm({ form, registry });
      return (
        <Form
          registry={registry}
          formApi={formApi}
          slots={{ count: <span data-slot>3 items</span> }}
        />
      );
    }
    const { container } = render(<Held />);
    expect(order(container)).toEqual(['first', '3 items', 'second']);
  });

  test('a slot in plain data is drawn as the builder’s is', () => {
    const data: FormConfig<typeof registry.inputs, typeof registry.layouts> = {
      nodes: [
        { kind: 'slot', name: 'count' },
        { kind: 'field', name: 'first', type: 'text', config: {} },
      ],
    };
    const { container } = render(
      <Form registry={registry} form={data} slots={{ count: <span data-slot>count</span> }} />,
    );
    expect(order(container)).toEqual(['count', 'first']);
  });
});

describe('defineRegistry', () => {
  test('refuses a layout, or an input, named slot', () => {
    expect(() => {
      return defineRegistry({
        inputs: {},
        layouts: { slot: { Component: Box } },
        field: { Component: FieldStub },
      });
    }).toThrow('"slot"');
    expect(() => {
      return defineRegistry({
        inputs: { slot: { Component: TextInput } },
        layouts: {},
        field: { Component: FieldStub },
      });
    }).toThrow('"slot"');
  });
});
