import type { Filter } from '@bh/resource';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RulesField, type RulesFieldConfig } from './rules-field';
import { FIELDS, optionsFor } from './rules.fixture';

const config: RulesFieldConfig = { fields: FIELDS, optionsFor };
const base = { name: 'rules', label: 'Rules', loading: false, onBlur: vi.fn(), config };

function renderRules(value: Filter[], extra: Partial<Parameters<typeof RulesField>[0]> = {}) {
  const onChange = vi.fn();
  render(<RulesField {...base} value={value} onChange={onChange} {...extra} />);
  return onChange;
}

describe('RulesField chips', () => {
  it('reads each condition as its field, its operator in words and its values', () => {
    renderRules([
      { field: 'priority', op: 'in', value: ['high', 'urgent'] },
      { field: 'due', op: 'lt', value: '2026-10-31' },
      { field: 'labels', op: 'in', value: ['api'] },
    ]);
    expect(
      screen.getByRole('button', { name: 'Remove filter: Priority is any of High, Urgent' }),
    ).toBeInTheDocument();
    // A date's `lt` reads "is before"; a list's `in` "has any of".
    expect(
      screen.getByRole('button', { name: /^Remove filter: Due is before \d+ Oct/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Remove filter: Labels has any of api' }),
    ).toBeInTheDocument();
  });

  it('draws the values as pills in their options’ colors', () => {
    renderRules([{ field: 'priority', op: 'in', value: ['high', 'low'] }]);
    expect(screen.getByText('High')).toHaveClass('bg-orange-3');
    // No color: the neutral tone.
    expect(screen.getByText('Low')).toHaveClass('bg-gray-3');
  });

  it('names a ref’s values by their titles once optionsFor answers', async () => {
    renderRules([{ field: 'owner', op: 'in', value: ['7', '12'] }]);
    expect(
      await screen.findByRole('button', { name: 'Remove filter: Owner is any of Ana, Luka' }),
    ).toBeInTheDocument();
  });

  it('reads an attribute’s path and an operator without a value', () => {
    renderRules([
      { field: 'stage.group', op: 'equals', value: 'open' },
      { field: 'owner', op: 'isMe' },
    ]);
    expect(
      screen.getByRole('button', { name: 'Remove filter: Stage · Group is Open' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove filter: Owner is me' })).toBeInTheDocument();
  });

  it('drops a condition with its ×, and commits the rest', async () => {
    const onChange = renderRules([
      { field: 'priority', op: 'in', value: ['high'] },
      { field: 'pinned', op: 'equals', value: true },
    ]);
    await userEvent.click(screen.getByRole('button', { name: 'Remove filter: Pinned is Yes' }));
    expect(onChange).toHaveBeenCalledWith([{ field: 'priority', op: 'in', value: ['high'] }]);
  });

  it('moves the focus from a removed chip to the next one’s ×, then to + Filter', async () => {
    const first = { field: 'priority', op: 'in', value: ['high'] };
    const second = { field: 'pinned', op: 'equals', value: true };
    const onChange = vi.fn();
    const { rerender } = render(
      <RulesField {...base} value={[first, second]} onChange={onChange} />,
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Remove filter: Priority is any of High' }),
    );
    rerender(<RulesField {...base} value={[second]} onChange={onChange} />);
    expect(screen.getByRole('button', { name: 'Remove filter: Pinned is Yes' })).toHaveFocus();
    await userEvent.click(screen.getByRole('button', { name: 'Remove filter: Pinned is Yes' }));
    rerender(<RulesField {...base} value={[]} onChange={onChange} />);
    expect(screen.getByRole('button', { name: 'Filter' })).toHaveFocus();
  });

  it('when read-only, draws its chips grey with a lock and no ×', () => {
    renderRules([{ field: 'priority', op: 'in', value: ['high'] }], { readOnly: true });
    const rules = screen.getByRole('group', { name: 'Rules' });
    expect(within(rules).queryByRole('button')).toBeNull();
    expect(within(rules).getByRole('img', { name: 'Set by the page' })).toBeInTheDocument();
    expect(within(rules).getByText('Priority')).toBeInTheDocument();
  });
});

describe('RulesField groups', () => {
  const either: Filter = {
    any: [
      { field: 'owner', op: 'isMe' },
      { field: 'owner', op: 'empty' },
    ],
  };

  it('reads an any group as one chip in words, joined by “or”', () => {
    renderRules([either]);
    const remove = screen.getByRole('button', {
      name: 'Remove filter: Owner is me or Owner is empty',
    });
    const chip = remove.parentElement as HTMLElement;
    expect(chip).toHaveTextContent('Owner is me or Owner is empty');
    expect(within(chip).getByText('or')).toHaveClass('uppercase');
    // It can't be opened, only removed.
    expect(within(chip).getAllByRole('button')).toEqual([remove]);
  });

  it('reads a not group with “not:” before it', () => {
    renderRules([{ not: { field: 'priority', op: 'equals', value: 'low' } }]);
    expect(
      screen.getByRole('button', { name: 'Remove filter: not: Priority is Low' }),
    ).toBeInTheDocument();
  });

  it('keeps a group unchanged as the rest changes, and drops it with its ×', async () => {
    const onChange = renderRules([either, { field: 'size', op: 'gte', value: 3 }]);
    await userEvent.click(
      screen.getByRole('button', { name: 'Remove filter: Size is at least 3' }),
    );
    expect(onChange).toHaveBeenLastCalledWith([either]);
    await userEvent.click(
      screen.getByRole('button', { name: 'Remove filter: Owner is me or Owner is empty' }),
    );
    expect(onChange).toHaveBeenLastCalledWith([{ field: 'size', op: 'gte', value: 3 }]);
  });

  it('when read-only, has a lock and no ×', () => {
    renderRules([either], { readOnly: true });
    const rules = screen.getByRole('group', { name: 'Rules' });
    expect(within(rules).queryByRole('button')).toBeNull();
    expect(within(rules).getByRole('img', { name: 'Set by the page' })).toBeInTheDocument();
  });
});
