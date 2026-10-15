/// <reference types="@testing-library/jest-dom/vitest" />
import { useState } from 'react';
import type { Filter } from '@bh/resource';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { defineForm } from '../builder/define-form';
import { defineRegistry } from '../builder/define-registry';
import { FormProvider } from '../runtime/form-provider';
import type { FilterChangesProps, InputProps } from '../types/registry';
import { FilterForm, type FilterValue } from './filter-form';
import type { FilterQuery } from './fold';
import { kinds, operators, tasks } from './meta.fixture';

// Plain inputs, each named by its field: a filter form draws whatever the
// registry gives it.
const Text = (p: InputProps<object, string>) => {
  return (
    <input aria-label={p.name} value={p.value ?? ''} onChange={(e) => p.onChange(e.target.value)} />
  );
};

const Check = (p: InputProps<object, boolean>) => {
  return (
    <input
      type="checkbox"
      aria-label={p.name}
      checked={p.value === true}
      onChange={(e) => p.onChange(e.target.checked)}
    />
  );
};

/** A list of strings, a checkbox each: toggle chips. */
const Chips = (p: InputProps<{ options: string[] }, string[]>) => {
  return (
    <fieldset aria-label={p.name}>
      {p.config.options.map((option) => {
        const on = p.value.includes(option);
        return (
          <input
            key={option}
            type="checkbox"
            aria-label={option}
            checked={on}
            onChange={() => {
              p.onChange(on ? p.value.filter((each) => each !== option) : [...p.value, option]);
            }}
          />
        );
      })}
    </fieldset>
  );
};

function Changes({ count }: FilterChangesProps) {
  return <output>{count === 0 ? '' : `${count} waiting`}</output>;
}

const registry = defineRegistry({
  inputs: {
    text: { Component: Text, defaultValue: '' },
    check: { Component: Check, defaultValue: false },
    chips: { Component: Chips, defaultValue: [] as string[] },
  },
  layouts: {},
  field: { Component: ({ children }) => <>{children}</> },
  filter: {
    count: () => null,
    sheet: () => null,
    changes: Changes,
  },
});

/** A board's filters: a search, presets, a status, a quick "Mine" and a person shown by a choice. */
function boardForm(withButtons: boolean) {
  return defineForm(registry).build((b) => {
    return [
      b.text({ name: 'search', config: {} }),
      b.chips({
        name: 'presets',
        config: { options: ['mine', 'recent'] },
        filter: {
          presets: [
            { value: 'mine', label: 'Mine', filter: { field: 'assignee', op: 'isMe' } },
            {
              value: 'recent',
              label: 'Updated this week',
              filter: { field: 'updatedAt', op: 'inLast', value: 7 },
            },
          ],
        },
      }),
      b.text({ name: 'status', config: {}, filter: { op: 'equals' } }),
      b.check({ name: 'onlyMine', config: {}, filter: { field: 'assignee', op: 'isMe' } }),
      b.text({ name: 'show', config: {} }),
      b.text({
        name: 'person',
        config: {},
        when: { field: 'show', eq: 'person' },
        filter: { field: 'assignee', op: 'equals' },
      }),
      b.slot({ name: 'changes' }),
      b.slot({ name: 'end' }),
      b.reset({ label: 'Clear', to: 'start' }),
      ...(withButtons ? [b.submit({ label: 'Apply' })] : []),
    ];
  });
}

/** A page holding the value, as the address does, and handing each new one back. */
function Page(props: { form: ReturnType<typeof boardForm>; start?: FilterValue; spy: Spy }) {
  const [value, setValue] = useState<FilterValue>(props.start ?? {});
  return (
    <FormProvider registry={registry}>
      <FilterForm
        form={props.form}
        meta={tasks}
        operators={operators}
        kinds={kinds}
        value={value}
        onChange={(next) => {
          props.spy(next);
          setValue(next);
        }}
        slots={{ end: <span>Saved views</span> }}
      />
    </FormProvider>
  );
}

type Spy = (next: FilterQuery) => void;

const field = (name: string): HTMLInputElement => screen.getByLabelText(name);
const type = (name: string, text: string) => {
  fireEvent.change(field(name), { target: { value: text } });
};
const all = (...entries: Filter[]): FilterQuery => ({ filter: { all: entries } });

async function press(label: string) {
  fireEvent.click(screen.getByRole('button', { name: label }));
  await act(async () => {
    await Promise.resolve();
  });
}

describe('FilterForm', () => {
  it('applies each change at once, as the query’s { search, filter }', () => {
    const spy = vi.fn<Spy>();
    render(<Page form={boardForm(false)} spy={spy} />);
    type('status', 'open');
    expect(spy).toHaveBeenLastCalledWith(all({ field: 'status', op: 'equals', value: 'open' }));
    fireEvent.click(screen.getByLabelText('recent'));
    expect(spy).toHaveBeenLastCalledWith(
      all(
        { field: 'updatedAt', op: 'inLast', value: 7 },
        { field: 'status', op: 'equals', value: 'open' },
      ),
    );
    type('search', 'login');
    expect(spy).toHaveBeenLastCalledWith({
      search: 'login',
      filter: {
        all: [
          { field: 'updatedAt', op: 'inLast', value: 7 },
          { field: 'status', op: 'equals', value: 'open' },
        ],
      },
    });
    // The app's slot is drawn where the form places it; a form without a
    // button has no changes waiting to say.
    expect(screen.getByText('Saved views')).toBeInTheDocument();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('applies with its button, saying how many changes wait until then', async () => {
    const spy = vi.fn<Spy>();
    render(<Page form={boardForm(true)} spy={spy} />);
    const changes = screen.getByRole('status');
    expect(changes).toHaveTextContent('');
    type('status', 'open');
    fireEvent.click(field('onlyMine'));
    expect(spy).not.toHaveBeenCalled();
    expect(changes).toHaveTextContent('2 waiting');
    await press('Apply');
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenLastCalledWith(
      all({ field: 'status', op: 'equals', value: 'open' }, { field: 'assignee', op: 'isMe' }),
    );
    expect(changes).toHaveTextContent('');
    // The preset holding the same condition shows it too, once applied.
    expect(screen.getByLabelText('mine')).toBeChecked();
  });

  it('empties the form with Clear, after an Apply too', async () => {
    const spy = vi.fn<Spy>();
    render(<Page form={boardForm(true)} spy={spy} />);
    type('status', 'open');
    await press('Apply');
    await press('Clear');
    expect(field('status')).toHaveValue('');
    expect(screen.getByRole('status')).toHaveTextContent('1 waiting');
    await press('Apply');
    expect(spy).toHaveBeenLastCalledWith(all());
  });

  it('applies Clear at once in a form without a button', async () => {
    const spy = vi.fn<Spy>();
    render(<Page form={boardForm(false)} spy={spy} />);
    type('status', 'open');
    type('search', 'login');
    await press('Clear');
    expect(field('status')).toHaveValue('');
    expect(field('search')).toHaveValue('');
    expect(spy).toHaveBeenLastCalledWith(all());
  });

  it('shows a new value from outside, after Back, without calling onChange', () => {
    const spy = vi.fn<Spy>();
    const form = boardForm(false);
    const page = (value: FilterValue) => {
      return (
        <FormProvider registry={registry}>
          <FilterForm
            form={form}
            value={value}
            onChange={spy}
            meta={tasks}
            operators={operators}
            kinds={kinds}
          />
        </FormProvider>
      );
    };
    const { rerender } = render(page({}));
    rerender(
      page({
        search: 'crash',
        filter: { all: [{ field: 'status', op: 'equals', value: 'done' }] },
      }),
    );
    expect(field('search')).toHaveValue('crash');
    expect(field('status')).toHaveValue('done');
    rerender(page({ filter: { all: [{ field: 'assignee', op: 'isMe' }] } }));
    expect(field('status')).toHaveValue('');
    expect(field('onlyMine')).toBeChecked();
    expect(screen.getByLabelText('mine')).toBeChecked();
    expect(spy).not.toHaveBeenCalled();
  });

  it('writes nothing for a hidden field', () => {
    const spy = vi.fn<Spy>();
    render(<Page form={boardForm(false)} spy={spy} />);
    type('show', 'person');
    type('person', 'ana');
    expect(spy).toHaveBeenLastCalledWith(all({ field: 'assignee', op: 'equals', value: 'ana' }));
    type('show', 'everyone');
    expect(screen.queryByLabelText('person')).toBeNull();
    expect(spy).toHaveBeenLastCalledWith(all());
  });

  it('drops a condition from every field holding it', () => {
    const spy = vi.fn<Spy>();
    render(<Page form={boardForm(false)} spy={spy} />);
    const preset = screen.getByLabelText('mine');
    fireEvent.click(preset);
    expect(field('onlyMine')).toBeChecked();
    fireEvent.click(field('onlyMine'));
    expect(preset).not.toBeChecked();
    expect(spy).toHaveBeenLastCalledWith(all());
  });

  it('hands back what no field can show, until Clear', async () => {
    const spy = vi.fn<Spy>();
    const group: Filter = {
      any: [
        { field: 'priority', op: 'equals', value: 'high' },
        { field: 'pinned', op: 'equals', value: true },
      ],
    };
    render(<Page form={boardForm(false)} spy={spy} start={{ filter: { all: [group] } }} />);
    type('status', 'open');
    expect(spy).toHaveBeenLastCalledWith(
      all({ field: 'status', op: 'equals', value: 'open' }, group),
    );
    await press('Clear');
    expect(spy).toHaveBeenLastCalledWith(all());
  });

  it('doesn’t keep Clear waiting while the value holds what no field can show', async () => {
    const spy = vi.fn<Spy>();
    const group: Filter = {
      any: [
        { field: 'priority', op: 'equals', value: 'high' },
        { field: 'pinned', op: 'equals', value: true },
      ],
    };
    render(<Page form={boardForm(false)} spy={spy} start={{ filter: { all: [group] } }} />);
    expect(screen.getByRole('button', { name: 'Clear' })).toBeEnabled();
    await press('Clear');
    expect(spy).toHaveBeenLastCalledWith(all());
    expect(screen.getByRole('button', { name: 'Clear' })).toBeDisabled();
  });

  it('keeps a preset that sets nothing through the value it hands out', () => {
    const spy = vi.fn<Spy>();
    const shows = defineForm(registry).build((b) => {
      return [
        b.text({
          name: 'show',
          config: {},
          filter: {
            presets: [
              { value: 'all', label: 'All', filter: { all: [] } },
              { value: 'by-person', label: 'By person', filter: { all: [] } },
              { value: 'mine', label: 'Mine', filter: { field: 'assignee', op: 'isMe' } },
            ],
          },
        }),
      ];
    });
    render(<Page form={shows} spy={spy} />);
    expect(field('show')).toHaveValue('all');
    type('show', 'by-person');
    expect(spy).toHaveBeenLastCalledWith(all());
    // The value spreads to All as well; the field keeps what was picked.
    expect(field('show')).toHaveValue('by-person');
    type('show', 'mine');
    expect(spy).toHaveBeenLastCalledWith(all({ field: 'assignee', op: 'isMe' }));
    expect(field('show')).toHaveValue('mine');
  });
});
