import { defineRegistry, Form, type FieldNode } from '@bh/form';
import { schemaToFormConfig } from '@bh/form/valibot';
import { render, screen } from '@testing-library/react';
import * as v from 'valibot';
import { describe, expect, it, vi } from 'vitest';
import { FieldWrapper } from './components/field-wrapper';
import { baseInputs, baseLayouts, type BaseInputs, type InputKind } from './registry';

const registry = defineRegistry({
  inputs: baseInputs,
  layouts: baseLayouts,
  field: { Component: FieldWrapper },
});

// A list and an object draw fields of their own, and rules a chip per rule,
// tested below.
const KINDS = [...baseInputs.names].filter(
  (kind) => kind !== 'list' && kind !== 'object' && kind !== 'rules',
);

// What makes each family of controls read-only: HTML's `readonly` on the
// text-entry controls, `aria-readonly` on the ones HTML's attribute can't reach,
// and `aria-disabled` on a picker's trigger, which opens nothing.
function isReadOnly(element: Element): boolean {
  return (
    element.hasAttribute('readonly') ||
    element.getAttribute('aria-readonly') === 'true' ||
    element.getAttribute('aria-disabled') === 'true'
  );
}

// Options for the kinds that draw a control per option, and those kinds.
const OPTIONS = [
  { value: 'a', label: 'A' },
  { value: 'b', label: 'B' },
];
const WITH_OPTIONS = new Set<InputKind>(['checkbox-group', 'toggle-chips', 'tabs']);
const PEOPLE = [{ id: 'a', name: 'Ana' }];

function renderField(type: InputKind, readOnly: boolean) {
  const config = WITH_OPTIONS.has(type)
    ? { options: OPTIONS }
    : type === 'avatars'
      ? { people: PEOPLE }
      : {};
  const field = { kind: 'field', name: 'pick', type, label: 'Pick', config, readOnly };
  const node = field as FieldNode<BaseInputs>;
  return render(<Form registry={registry} form={{ nodes: [node] }} onSubmit={vi.fn()} />);
}

describe('a read-only form field', () => {
  it.each(KINDS)('of kind %s makes its control read-only', (type) => {
    const { container, unmount } = renderField(type, true);
    expect([...container.querySelectorAll('*')].some(isReadOnly)).toBe(true);
    unmount();
    const editable = renderField(type, false);
    expect([...editable.container.querySelectorAll('*')].some(isReadOnly)).toBe(false);
  });

  it('of kind list offers nothing that changes it, and its items are read-only', () => {
    const config = schemaToFormConfig<BaseInputs>(
      v.object({ links: v.array(v.object({ url: v.pipe(v.string(), v.title('Url')) })) }),
    );
    const list = config.nodes[0] as FieldNode<BaseInputs>;
    render(
      <Form
        registry={registry}
        form={{ nodes: [{ ...list, readOnly: true }] }}
        defaultValues={{ links: [{ url: 'https://example.com' }] }}
        onSubmit={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: /Add/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Remove/ })).toBeNull();
    expect(screen.getByLabelText(/^Url/)).toHaveAttribute('readonly');
  });

  it('of kind object makes its fields read-only', () => {
    const config = schemaToFormConfig<BaseInputs>(
      v.object({ size: v.object({ width: v.pipe(v.number(), v.title('Width')) }) }),
    );
    const object = config.nodes[0] as FieldNode<BaseInputs>;
    render(
      <Form
        registry={registry}
        form={{ nodes: [{ ...object, readOnly: true }] }}
        defaultValues={{ size: { width: 4 } }}
        onSubmit={vi.fn()}
      />,
    );
    expect(screen.getByLabelText(/^Width/)).toHaveAttribute('readonly');
  });
});
