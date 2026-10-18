/// <reference types="@testing-library/jest-dom/vitest" />
import { describe, expect, test } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { Form } from './Form';
import { NestedFields } from './nested-fields';
import { defineRegistry } from '../builder/define-registry';
import { defineForm } from '../builder/define-form';
import type { FieldWrapperProps, InputProps, LayoutComponentProps } from '../types/registry';
import { noInputs, noLayouts } from '../builder/registries';

const TextInput = (p: InputProps<object, string>) => {
  return (
    <input aria-label={p.name} value={p.value ?? ''} onChange={(e) => p.onChange(e.target.value)} />
  );
};

const ObjectInput = (p: InputProps<object, Record<string, unknown>>) => {
  return (
    <NestedFields
      name={p.name}
      nodes={[
        { kind: 'field', name: 'plain', type: 'text', config: {} },
        {
          kind: 'inline',
          props: {},
          children: [{ kind: 'field', name: 'inner', type: 'text', config: {} }],
        },
      ]}
      value={p.value ?? {}}
      onChange={p.onChange}
    />
  );
};

/** Marks each field with the wrapper that drew it. */
function wrapper(by: string) {
  return function Wrapper({ name, type, children }: FieldWrapperProps) {
    return (
      <div data-testid={name} data-wrapper={by} data-type={type}>
        {children}
      </div>
    );
  };
}

function Plain({ children }: LayoutComponentProps<Record<string, never>>) {
  return <div>{children}</div>;
}

const registry = defineRegistry({
  inputs: noInputs.register({
    text: { Component: TextInput, defaultValue: '' },
    object: { Component: ObjectInput, defaultValue: {} },
  }),
  layouts: noLayouts.register({
    inline: { Component: Plain, field: { Component: wrapper('inline') } },
    sheet: { Component: Plain, field: { Component: wrapper('sheet') } },
    box: { Component: Plain },
  }),
  field: { Component: wrapper('registry') },
});

const by = (name: string) => screen.getByTestId(name).getAttribute('data-wrapper');

describe('a layout’s field wrapper', () => {
  test('draws its fields at any depth, until another layout names its own', () => {
    const form = defineForm(registry).build((b) => {
      return [
        b.text({ name: 'top', config: {} }),
        b.inline({}, [
          b.text({ name: 'bar', config: {} }),
          b.box({}, [b.text({ name: 'deep', config: {} })]),
          b.sheet({}, [b.text({ name: 'sheet', config: {} })]),
        ]),
      ];
    });
    render(<Form registry={registry} form={form} />);
    expect(by('top')).toBe('registry');
    expect(by('bar')).toBe('inline');
    expect(by('deep')).toBe('inline');
    expect(by('sheet')).toBe('sheet');
  });

  test('stops at a form inside a field, which starts at the registry’s, its own layouts naming theirs', () => {
    const form = defineForm(registry).build((b) => {
      return [b.inline({}, [b.object({ name: 'size', config: {} })])];
    });
    render(<Form registry={registry} form={form} />);
    expect(by('size')).toBe('inline');
    const size = screen.getByTestId('size');
    expect(within(size).getByTestId('size.plain')).toHaveAttribute('data-wrapper', 'registry');
    expect(within(size).getByTestId('size.inner')).toHaveAttribute('data-wrapper', 'inline');
  });

  test('is told each field’s kind, in a form and in a form inside a field', () => {
    const form = defineForm(registry).build((b) => {
      return [b.text({ name: 'title', config: {} }), b.object({ name: 'size', config: {} })];
    });
    render(<Form registry={registry} form={form} />);
    expect(screen.getByTestId('title')).toHaveAttribute('data-type', 'text');
    expect(screen.getByTestId('size')).toHaveAttribute('data-type', 'object');
    expect(screen.getByTestId('size.inner')).toHaveAttribute('data-type', 'text');
  });
});
