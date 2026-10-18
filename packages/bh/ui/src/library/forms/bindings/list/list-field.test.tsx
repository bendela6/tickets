import { defineRegistry, Form } from '@bh/form';
import { schemaToFormConfig } from '@bh/form/valibot';
import { fireEvent, render, screen, within } from '@testing-library/react';
import * as v from 'valibot';
import { describe, expect, it, vi } from 'vitest';
import { FieldWrapper } from '../../components/field-wrapper';
import { baseInputs, baseLayouts, type BaseInputs } from '../../registry';

const registry = defineRegistry({
  inputs: baseInputs,
  layouts: baseLayouts,
  field: { Component: FieldWrapper },
});

const SCHEMA = v.object({
  shortcuts: v.array(
    v.object({
      keys: v.pipe(v.string(), v.title('Keys')),
      action: v.pipe(v.string(), v.title('Action')),
    }),
  ),
  size: v.object({ width: v.pipe(v.number(), v.title('Width')) }),
});

function renderForm(defaultValues: Record<string, unknown>) {
  const onSubmit = vi.fn();
  const config = schemaToFormConfig<BaseInputs>(SCHEMA, {
    shortcuts: { config: { itemLabel: 'Shortcut' } },
  });
  render(
    <Form registry={registry} form={config} defaultValues={defaultValues} onSubmit={onSubmit}>
      <button type="submit">Save</button>
    </Form>,
  );
  return onSubmit;
}

describe('ListField', () => {
  it('draws each item as a form of its own, and adds, moves and removes items', async () => {
    const onSubmit = renderForm({
      shortcuts: [
        { keys: 'Ctrl+K', action: 'Search' },
        { keys: 'Esc', action: 'Close' },
      ],
      size: { width: 4 },
    });
    const first = screen.getByRole('region', { name: 'Shortcut 1' });
    expect(within(first).getByLabelText(/^Keys/)).toHaveValue('Ctrl+K');

    fireEvent.click(screen.getByRole('button', { name: 'Move Shortcut 2 up' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove Shortcut 2' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add shortcut' }));
    const added = screen.getByRole('region', { name: 'Shortcut 2' });
    fireEvent.change(within(added).getByLabelText(/^Action/), { target: { value: 'Help' } });
    fireEvent.click(screen.getByText('Save'));

    await vi.waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        shortcuts: [
          { keys: 'Esc', action: 'Close' },
          { keys: '', action: 'Help' },
        ],
        size: { width: 4 },
      });
    });
  });

  it('cannot move the first item up or the last one down', () => {
    renderForm({ shortcuts: [{ keys: 'a', action: 'b' }], size: null });
    expect(screen.getByRole('button', { name: 'Move Shortcut 1 up' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move Shortcut 1 down' })).toBeDisabled();
  });
});

describe('ObjectField', () => {
  it("draws the object's fields, and gives back the whole object", async () => {
    const onSubmit = renderForm({ shortcuts: [], size: null });
    fireEvent.change(screen.getByLabelText(/^Width/), { target: { value: '12' } });
    fireEvent.click(screen.getByText('Save'));
    await vi.waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({ shortcuts: [], size: { width: 12 } });
    });
  });
});
