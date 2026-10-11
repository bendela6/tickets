import { defineRegistry, Form, type FieldNode } from '@bh/form';
import { schemaToFormConfig } from '@bh/form/valibot';
import { fireEvent, render, screen } from '@testing-library/react';
import * as v from 'valibot';
import { describe, expect, it, vi } from 'vitest';
import { FieldWrapper } from './components/field-wrapper';
import { baseInputs, baseLayouts, type InputKind } from './registry';

const registry = defineRegistry({
  inputs: baseInputs,
  layouts: baseLayouts,
  field: { Component: FieldWrapper },
});

// A list and an object draw fields of their own, each described by its own help.
const KINDS = (Object.keys(baseInputs) as InputKind[]).filter(
  (kind) => kind !== 'list' && kind !== 'object',
);

function renderField(type: InputKind, extra: Record<string, unknown> = {}) {
  // One kind at a time, so its node cannot be typed as any one kind's.
  const field = { kind: 'field', name: 'pick', type, label: 'Pick', config: {}, ...extra };
  const node = field as FieldNode<typeof baseInputs>;
  return render(
    <Form registry={registry} form={{ nodes: [node] }} onSubmit={vi.fn()}>
      <button type="submit">Save</button>
    </Form>,
  );
}

describe('a form field', () => {
  it.each(KINDS)('of kind %s is described by its help, on the element its id is on', (type) => {
    renderField(type, { description: 'Only the team sees it.' });
    const described = document.querySelector('[aria-describedby]');
    expect(described).toHaveAccessibleDescription('Only the team sees it.');
    // A radio group takes no id: a `<label for>` cannot name a fieldset.
    if (type !== 'radio') {
      expect(described).toBe(document.getElementById('pick'));
    }
  });

  it('is described by its problem in its help’s place', async () => {
    renderField('text', {
      description: 'Only the team sees it.',
      validate: v.pipe(v.string(), v.nonEmpty('Enter a name.')),
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    const input = screen.getByRole('textbox');
    await vi.waitFor(() => expect(input).toHaveAccessibleDescription('Enter a name.'));
  });

  it('inside an object is described by its own help', () => {
    const config = schemaToFormConfig<typeof baseInputs>(
      v.object({
        size: v.object({
          width: v.pipe(v.number(), v.title('Width'), v.description('In pixels.')),
        }),
      }),
    );
    render(
      <Form
        registry={registry}
        form={config}
        defaultValues={{ size: { width: 4 } }}
        onSubmit={vi.fn()}
      />,
    );
    expect(screen.getByLabelText(/^Width/)).toHaveAccessibleDescription('In pixels.');
  });
});

describe('a form field whose options fail to load', () => {
  it('says so under it, and is described by that', async () => {
    const field = {
      kind: 'field',
      name: 'city',
      type: 'select',
      label: 'City',
      config: {
        options: {
          dependsOn: [],
          fn: () => Promise.reject(new Error('The cities could not be loaded.')),
        },
      },
    };
    render(
      <Form
        registry={registry}
        form={{ nodes: [field as FieldNode<typeof baseInputs>] }}
        onSubmit={vi.fn()}
      />,
    );
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('The cities could not be loaded.');
    expect(screen.getByRole('button', { name: 'City' })).toHaveAccessibleDescription(
      'The cities could not be loaded.',
    );
  });
});
