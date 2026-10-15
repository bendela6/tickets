import { defineForm, defineRegistry, Form, type FieldNode } from '@bh/form';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FieldWrapper } from '../components/field-wrapper';
import { baseInputs, baseLayouts, type InputKind } from '../registry';

// In an `inline` row, the pickers draw their field's label inside the
// trigger, muted, and an empty one reads its placeholder: "Type: any".

const registry = defineRegistry({
  inputs: baseInputs,
  layouts: baseLayouts,
  field: { Component: FieldWrapper },
});

const OPTIONS = [
  { value: 'bug', label: 'Bug' },
  { value: 'feature', label: 'Feature' },
];
const PEOPLE = [{ id: '7', name: 'Ana Beridze' }];

/** Each picker, the role its trigger has, its config, and a value it can hold. */
const CASES: [InputKind, string, object, unknown, string][] = [
  ['select', 'button', { options: OPTIONS }, 'bug', 'Bug'],
  ['multi-select', 'combobox', { options: OPTIONS }, ['bug'], 'Bug'],
  ['date', 'button', {}, '2026-10-31', 'Oct 31, 2026'],
  ['date-range', 'combobox', {}, ['2026-10-01T00:00:00Z', '2026-10-31T00:00:00Z'], 'Oct'],
  ['user', 'combobox', { people: PEOPLE }, ['7'], 'Ana Beridze'],
];

function renderRow(type: InputKind, config: object, value?: unknown, inline = true) {
  const field = {
    kind: 'field',
    name: 'type',
    type,
    label: 'Type',
    config: { ...config, placeholder: 'any' },
  } as FieldNode<typeof baseInputs>;
  const form = defineForm(registry).build(() => {
    return inline ? [{ kind: 'inline', props: {}, children: [field] }] : [field];
  });
  render(
    <Form
      registry={registry}
      form={form}
      {...(value === undefined ? {} : { values: { type: value } })}
    />,
  );
}

describe('a picker in an inline row', () => {
  it.each(CASES)(
    '%s draws its label inside its trigger, then its placeholder',
    (type, role, config) => {
      renderRow(type, config);
      const trigger = screen.getByRole(role, { name: 'Type' });
      expect(trigger).toHaveTextContent(/^Type:\s?any/);
      expect(screen.getByText('Type:')).toHaveClass('text-gray-11');
      // The label inside is the only one shown; the wrapper's names it unseen.
      expect(screen.getByText('Type', { selector: 'label' })).toHaveClass('sr-only');
      // The row's controls are the 30-pixel rung.
      expect(trigger).toHaveClass('h-30');
    },
  );

  it.each(CASES)('%s keeps its label before its value', (type, role, config, value, shown) => {
    renderRow(type, config, value);
    const trigger = screen.getByRole(role, { name: 'Type' });
    expect(trigger).toHaveTextContent('Type:');
    expect(trigger).toHaveTextContent(shown);
  });

  it.each(CASES)('%s draws no label inside outside a row', (type, role, config) => {
    renderRow(type, config, undefined, false);
    expect(screen.getByRole(role, { name: 'Type' })).not.toHaveTextContent('Type:');
  });
});
