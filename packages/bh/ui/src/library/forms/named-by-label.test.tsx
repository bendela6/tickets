import { defineRegistry, Form, type FieldNode } from '@bh/form';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FieldWrapper } from './components/field-wrapper';
import { baseInputs, baseLayouts, type BaseInputs, type InputKind } from './registry';

const registry = defineRegistry({
  inputs: baseInputs,
  layouts: baseLayouts,
  field: { Component: FieldWrapper },
});

const OPTIONS = [
  { value: 'free', label: 'Free' },
  { value: 'team', label: 'Team' },
];

// The kinds whose element a `<label for>` cannot name — a fieldset, a
// radiogroup, a slider drawn on a div — and the role each is found by.
const CASES: [InputKind, string, object][] = [
  ['radio', 'radiogroup', { options: OPTIONS }],
  ['checkbox-group', 'group', { options: OPTIONS }],
  // A combobox drawn on a div, named by its own aria-label, not its placeholder.
  ['multi-select', 'combobox', { options: OPTIONS, placeholder: 'Choose' }],
  ['segmented', 'radiogroup', { options: OPTIONS }],
  ['toggle-chips', 'group', { options: OPTIONS }],
  ['tabs', 'group', { options: OPTIONS }],
  ['avatars', 'group', {}],
  ['rules', 'group', {}],
  ['rating', 'radiogroup', {}],
  ['slider', 'slider', {}],
  ['range', 'slider', {}],
];

function renderField(type: InputKind, config: object) {
  const field = { kind: 'field', name: 'plan', type, label: 'Plan', config };
  const node = field as FieldNode<BaseInputs>;
  render(<Form registry={registry} form={{ nodes: [node] }} onSubmit={vi.fn()} />);
}

describe('a form field a <label for> cannot reach', () => {
  it.each(CASES)('of kind %s is named by the field’s label', (type, role, config) => {
    renderField(type, config);
    // Range has two thumbs, "Plan lower bound" and "Plan upper bound".
    expect(screen.getAllByRole(role, { name: /^Plan/ }).length).toBeGreaterThan(0);
    expect(screen.queryAllByRole(role, { name: /^plan/ })).toEqual([]);
  });

  it('is named by its config’s label over the field’s', () => {
    renderField('radio', { options: OPTIONS, label: 'Billing plan' });
    expect(screen.getByRole('radiogroup', { name: 'Billing plan' })).toBeInTheDocument();
  });
});
