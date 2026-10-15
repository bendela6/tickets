import { defineRegistry, FormProvider } from '@bh/form';
import type { Filter } from '@bh/resource';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { FieldWrapper } from '../../components/field-wrapper';
import { baseInputs, baseLayouts } from '../../registry';
import { RulesField } from './rules-field';
import { FIELDS, optionsFor } from './rules.fixture';

const registry = defineRegistry({
  inputs: baseInputs,
  layouts: baseLayouts,
  field: { Component: FieldWrapper },
});

/** A rules field with `add: 'panel'` that holds what it commits, as a form would. */
function Harness({ start, onChange }: { start: Filter[]; onChange: (next: Filter[]) => void }) {
  const [value, setValue] = useState(start);
  return (
    <FormProvider registry={registry}>
      <RulesField
        name="rules"
        label="Rules"
        loading={false}
        onBlur={vi.fn()}
        config={{ add: 'panel', fields: FIELDS, optionsFor }}
        value={value}
        onChange={(next) => {
          onChange(next);
          setValue(next);
        }}
      />
    </FormProvider>
  );
}

function renderPanel(start: Filter[] = []) {
  const onChange = vi.fn();
  render(<Harness start={start} onChange={onChange} />);
  return onChange;
}

const panel = () => screen.getByRole('dialog', { name: 'Filters' });
const row = (name: string | RegExp) => within(panel()).getByRole('group', { name });

async function openPanel() {
  await userEvent.click(screen.getByRole('button', { name: /^Filters/ }));
  return panel();
}

describe('the rules in a side panel', () => {
  it('has a Filters button with how many there are, and keeps the chips in the bar', () => {
    renderPanel([
      { field: 'priority', op: 'in', value: ['high'] },
      { field: 'size', op: 'gte', value: 3 },
    ]);
    expect(screen.getByRole('button', { name: 'Filters, 2 filters' })).toHaveAttribute(
      'aria-haspopup',
      'dialog',
    );
    expect(
      screen.getByRole('button', { name: 'Remove filter: Priority is any of High' }),
    ).toBeInTheDocument();
    // The panel holds + Filter; the bar doesn't.
    expect(screen.queryByRole('button', { name: 'Filter' })).toBeNull();
  });

  it('says only "Filters" while there are none, and that the panel has none yet', async () => {
    renderPanel();
    await openPanel();
    expect(within(panel()).getByText(/No filters yet/)).toBeInTheDocument();
  });

  it('lists each rule as a row: its field, its operator as a select, its value’s input', async () => {
    renderPanel([
      { field: 'priority', op: 'in', value: ['high'] },
      { field: 'title', op: 'contains', value: 'login' },
    ]);
    await openPanel();
    const priority = row('Priority is any of High');
    expect(within(priority).getByText('Priority')).toBeInTheDocument();
    expect(within(priority).getByRole('button', { name: /^Priority operator/ })).toHaveTextContent(
      'is any of',
    );
    expect(
      within(priority).getByRole('combobox', { name: 'Priority is any of' }),
    ).toBeInTheDocument();
    expect(
      within(row('Title contains login')).getByRole('textbox', { name: 'Title contains' }),
    ).toHaveValue('login');
  });

  it('applies a changed operator at once, keeping the value while the input stays the same', async () => {
    const onChange = renderPanel([{ field: 'priority', op: 'in', value: ['high'] }]);
    await openPanel();
    await userEvent.click(
      within(row('Priority is any of High')).getByRole('button', { name: /^Priority operator/ }),
    );
    await userEvent.click(screen.getByRole('option', { name: 'is none of' }));
    expect(onChange).toHaveBeenLastCalledWith([
      { field: 'priority', op: 'notIn', value: ['high'] },
    ]);
    expect(row('Priority is none of High')).toBeInTheDocument();
  });

  it('applies nothing for a row whose operator still wants a value, until it has one', async () => {
    const onChange = renderPanel([{ field: 'size', op: 'gte', value: 3 }]);
    await openPanel();
    await userEvent.click(
      within(row('Size is at least 3')).getByRole('button', { name: /^Size operator/ }),
    );
    // `in` draws tags, not a number: the value goes, and so does the rule, for now.
    await userEvent.click(screen.getByRole('option', { name: 'is any of' }));
    expect(onChange).toHaveBeenLastCalledWith([]);
    const draft = row('Size is any of');
    expect(within(draft).getByText('Applies nothing until it has a value.')).toBeInTheDocument();
    await userEvent.type(within(draft).getByRole('textbox'), '5{Enter}');
    expect(onChange).toHaveBeenLastCalledWith([{ field: 'size', op: 'in', value: [5] }]);
    expect(within(panel()).queryByText('Applies nothing until it has a value.')).toBeNull();
  });

  it('applies a value as it is typed', async () => {
    const onChange = renderPanel([{ field: 'title', op: 'contains', value: 'log' }]);
    await openPanel();
    await userEvent.type(within(panel()).getByRole('textbox', { name: 'Title contains' }), 'in');
    expect(onChange).toHaveBeenLastCalledWith([{ field: 'title', op: 'contains', value: 'login' }]);
  });

  it('removes a row with its ×', async () => {
    const onChange = renderPanel([
      { field: 'priority', op: 'in', value: ['high'] },
      { field: 'owner', op: 'isMe' },
    ]);
    await openPanel();
    await userEvent.click(
      within(panel()).getByRole('button', { name: 'Remove filter: Owner is me' }),
    );
    expect(onChange).toHaveBeenLastCalledWith([{ field: 'priority', op: 'in', value: ['high'] }]);
    expect(within(panel()).queryByRole('group', { name: 'Owner is me' })).toBeNull();
  });

  it('adds a rule with + Filter at its foot, in the three steps', async () => {
    const onChange = renderPanel([{ field: 'priority', op: 'in', value: ['high'] }]);
    await openPanel();
    await userEvent.click(within(panel()).getByRole('button', { name: 'Filter' }));
    const editor = screen.getByRole('dialog', { name: 'Add a filter' });
    await userEvent.click(within(editor).getByRole('option', { name: /^Owner/ }));
    await userEvent.click(within(editor).getByRole('option', { name: /^is me/ }));
    await userEvent.click(within(editor).getByRole('button', { name: 'Add' }));
    expect(onChange).toHaveBeenLastCalledWith([
      { field: 'priority', op: 'in', value: ['high'] },
      { field: 'owner', op: 'isMe' },
    ]);
    expect(row('Owner is me')).toBeInTheDocument();
  });

  it('reads a rule it can’t draw in words, an attribute’s, and keeps it', async () => {
    const onChange = renderPanel([
      { field: 'stage.group', op: 'equals', value: 'open' },
      { field: 'title', op: 'contains', value: 'a' },
    ]);
    await openPanel();
    expect(within(row('Stage · Group is Open')).getByText('Stage · Group is Open')).toBeVisible();
    await userEvent.type(within(panel()).getByRole('textbox', { name: 'Title contains' }), 'b');
    expect(onChange).toHaveBeenLastCalledWith([
      { field: 'stage.group', op: 'equals', value: 'open' },
      { field: 'title', op: 'contains', value: 'ab' },
    ]);
  });

  it('closes on Escape and gives the focus back to Filters', async () => {
    renderPanel([{ field: 'owner', op: 'isMe' }]);
    await openPanel();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'Filters, 1 filter' })).toHaveFocus();
  });

  it('has no Filters button when read-only', () => {
    render(
      <FormProvider registry={registry}>
        <RulesField
          name="rules"
          label="Rules"
          loading={false}
          onBlur={vi.fn()}
          readOnly
          config={{ add: 'panel', fields: FIELDS }}
          value={[{ field: 'owner', op: 'isMe' }]}
          onChange={vi.fn()}
        />
      </FormProvider>,
    );
    expect(screen.queryByRole('button', { name: /^Filters/ })).toBeNull();
  });
});
