import { defineForm, defineRegistry, Form } from '@bh/form';
import type { Filter } from '@bh/resource';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FIELDS } from './bindings/rules/rules.fixture';
import { FieldWrapper } from './components/field-wrapper';
import type { InlineOverflow } from './layouts';
import { baseInputs, baseLayouts } from './registry';

const registry = defineRegistry({
  inputs: baseInputs,
  layouts: baseLayouts,
  field: { Component: FieldWrapper },
});

const RULES: Filter[] = [
  { field: 'priority', op: 'in', value: ['high'] },
  { field: 'owner', op: 'isMe' },
  { field: 'size', op: 'gte', value: 3 },
  { field: 'pinned', op: 'equals', value: true },
  { field: 'title', op: 'contains', value: 'login' },
];

/** A phone-wide row: a search box, then a filter's five rules. */
function renderRow(overflow: InlineOverflow) {
  const form = defineForm(registry).build((b) => {
    return [
      b.inline({ overflow }, [
        b.search({ name: 'search', label: 'Search', config: {} }),
        b.rules({ name: 'rules', label: 'Filters', config: { fields: FIELDS } }),
      ]),
    ];
  });
  render(
    <div style={{ width: 375 }}>
      <Form registry={registry} form={form} values={{ rules: RULES }} />
    </div>,
  );
  return screen.getByRole('searchbox', { name: 'Search' }).closest('.gap-6') as HTMLElement;
}

const chips = () => {
  return within(screen.getByRole('group', { name: 'Filters' })).getAllByRole('button', {
    name: /^Remove filter/,
  });
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('an inline row with more than fits', () => {
  it('wraps onto more lines by default', () => {
    const row = renderRow('wrap');
    expect(row).toHaveClass('flex-wrap');
    // Which puts a count and the buttons at its end.
    expect(row).toHaveClass('inline-row');
    expect(chips()).toHaveLength(5);
  });

  it('scrolls sideways on one line, fading at its end while there is more', () => {
    // A 375-pixel row holding 900 pixels of fields.
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(375);
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(900);
    const row = renderRow('scroll');
    expect(row).toHaveAttribute('data-overflow', 'scroll');
    expect(row).toHaveClass('inline-row', 'flex-nowrap', 'overflow-x-auto');
    expect(row).toHaveAttribute('data-more', 'true');
    // Scrolled to its end, there is nothing more to fade into.
    row.scrollLeft = 525;
    fireEvent.scroll(row);
    expect(row).not.toHaveAttribute('data-more');
  });

  it('collapses a rules field to its first chips and a “+3 more” that shows the rest', async () => {
    renderRow({ collapse: 2 });
    expect(chips()).toHaveLength(2);
    const more = screen.getByRole('button', { name: '+3 more' });
    expect(more).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(more);
    expect(chips()).toHaveLength(5);
    const fewer = screen.getByRole('button', { name: 'Fewer' });
    expect(fewer).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(fewer);
    expect(chips()).toHaveLength(2);
  });

  it('shows no “more” while every chip fits in the count', () => {
    renderRow({ collapse: 5 });
    expect(chips()).toHaveLength(5);
    expect(screen.queryByRole('button', { name: /more$/ })).toBeNull();
  });
});
