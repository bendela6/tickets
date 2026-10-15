import { defineRegistry, FormProvider } from '@bh/form';
import type { Filter } from '@bh/resource';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

function renderRules(value: Filter[] = []) {
  const onChange = vi.fn();
  render(
    <FormProvider registry={registry}>
      <RulesField
        name="rules"
        label="Rules"
        loading={false}
        onBlur={vi.fn()}
        config={{ fields: FIELDS, optionsFor }}
        value={value}
        onChange={onChange}
      />
    </FormProvider>,
  );
  return onChange;
}

const dialog = () => screen.getByRole('dialog');
const option = (name: string | RegExp) => within(dialog()).getByRole('option', { name });

/** An operator's row, by its words and its name after them: "is any of in". */
const opRow = (words: string, op: string) => option(new RegExp(`^${words} ?${op}$`));

/** + Filter, then a field, then an operator, by its words and its name. */
async function choose(field: string, words: string, op: string) {
  await userEvent.click(screen.getByRole('button', { name: 'Filter' }));
  await userEvent.click(option(new RegExp(field)));
  await userEvent.click(opRow(words, op));
}

describe('+ Filter', () => {
  it('offers the fields a rule may name, each with its kind', async () => {
    renderRules();
    await userEvent.click(screen.getByRole('button', { name: 'Filter' }));
    const fields = within(dialog()).getAllByRole('option');
    expect(fields.map((each) => each.textContent)).toEqual([
      'Priorityoption',
      'Stageoption',
      'Ownerref · users',
      'Labelsoption, many',
      'Duedate',
      'Createddatetime',
      // A kind without a registry glyph has a mark of its own.
      '12Sizenumber',
      'AaTitletext',
      'Pinnedboolean',
    ]);
  });

  it('offers the operators the field allows, in its words, and goes back to the fields', async () => {
    renderRules();
    await userEvent.click(screen.getByRole('button', { name: 'Filter' }));
    await userEvent.click(option(/^Labels/));
    // A list offers no `equals`, and reads `in` as "has any of".
    const ops = within(dialog()).getAllByRole('option');
    expect(ops.map((each) => each.textContent)).toEqual([
      'has any ofin',
      'has none ofnotIn',
      'is emptyempty',
    ]);
    await userEvent.click(screen.getByRole('button', { name: 'Back to fields' }));
    expect(option(/^Priority/)).toBeInTheDocument();
  });

  it('draws a select for `equals` on an option, without its archived ones, and adds the rule', async () => {
    const onChange = renderRules();
    await choose('Priority', 'is', 'equals');
    const add = within(dialog()).getByRole('button', { name: 'Add' });
    expect(add).toBeDisabled();
    await userEvent.click(within(dialog()).getByRole('button', { name: /Priority is/ }));
    expect(screen.queryByRole('option', { name: 'Someday' })).toBeNull();
    await userEvent.click(screen.getByRole('option', { name: 'High' }));
    await userEvent.click(add);
    expect(onChange).toHaveBeenCalledWith([{ field: 'priority', op: 'equals', value: 'high' }]);
  });

  it('draws a number with “days” for `inLast`', async () => {
    const onChange = renderRules();
    await choose('Due', 'is in the last', 'inLast');
    const days = within(dialog()).getByRole('spinbutton', { name: 'Due is in the last' });
    expect(within(dialog()).getByText('days')).toBeInTheDocument();
    await userEvent.type(days, '7');
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Add' }));
    expect(onChange).toHaveBeenCalledWith([{ field: 'due', op: 'inLast', value: 7 }]);
  });

  it('draws Yes and No for a boolean', async () => {
    const onChange = renderRules();
    await choose('Pinned', 'is', 'equals');
    await userEvent.click(within(dialog()).getByRole('radio', { name: 'No' }));
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Add' }));
    expect(onChange).toHaveBeenCalledWith([{ field: 'pinned', op: 'equals', value: false }]);
  });

  it('draws nothing for an operator without a value, as `isMe`', async () => {
    const onChange = renderRules();
    await choose('Owner', 'is me', 'isMe');
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Add' }));
    expect(onChange).toHaveBeenCalledWith([{ field: 'owner', op: 'isMe' }]);
  });

  it('offers a ref’s rows by their titles, from optionsFor', async () => {
    const onChange = renderRules();
    await choose('Owner', 'is any of', 'in');
    await userEvent.click(within(dialog()).getByRole('combobox', { name: 'Owner is any of' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Luka' }));
    await userEvent.keyboard('{Escape}');
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Add' }));
    expect(onChange).toHaveBeenCalledWith([{ field: 'owner', op: 'in', value: ['12'] }]);
  });

  it('drops the draft on Cancel, and on Escape', async () => {
    const onChange = renderRules();
    await choose('Size', 'is', 'equals');
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    await choose('Size', 'is', 'equals');
    await userEvent.type(within(dialog()).getByRole('spinbutton'), '3');
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('goes back from the value to the operators', async () => {
    renderRules();
    await choose('Size', 'is', 'equals');
    await userEvent.click(screen.getByRole('button', { name: 'Back to operators' }));
    expect(opRow('is at least', 'gte')).toBeInTheDocument();
  });

  it('is worked by the keyboard: arrows in the lists, Enter, and Escape', async () => {
    const onChange = renderRules();
    await userEvent.click(screen.getByRole('button', { name: 'Filter' }));
    // The search box has the focus: type, and Enter picks the first match.
    await userEvent.keyboard('tit{Enter}');
    // Title allows `in`, then `contains`: down one, and Enter.
    await userEvent.keyboard('{ArrowDown}{Enter}');
    const box = within(dialog()).getByRole('textbox', { name: 'Title contains' });
    expect(box).toHaveFocus();
    await userEvent.keyboard('login{Enter}');
    expect(onChange).toHaveBeenCalledWith([{ field: 'title', op: 'contains', value: 'login' }]);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('a chip, opened', () => {
  it('opens at its operator, and keeps the value while the input stays the same', async () => {
    const onChange = renderRules([{ field: 'priority', op: 'in', value: ['high'] }]);
    await userEvent.click(
      screen.getByRole('button', { name: 'Edit filter: Priority is any of High' }),
    );
    expect(opRow('is any of', 'in')).toHaveAttribute('aria-selected', 'true');
    await userEvent.click(opRow('is none of', 'notIn'));
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Save' }));
    expect(onChange).toHaveBeenCalledWith([{ field: 'priority', op: 'notIn', value: ['high'] }]);
  });
});
