/// <reference types="@testing-library/jest-dom/vitest" />
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineForm } from '../builder/define-form';
import { defineRegistry } from '../builder/define-registry';
import { FormProvider } from '../runtime/form-provider';
import type { FieldWrapperProps, InputProps } from '../types/registry';
import { FilterForm, type FilterFormProps, type FilterValue } from './filter-form';
import type { FilterQuery } from './fold';
import { kinds, operators, tasks } from './meta.fixture';
import type { FilterOption } from './meta';

/** A list of choices, a checkbox each, its count after its label. */
const Pick = (p: InputProps<{ options?: FilterOption[]; counts?: boolean }, string[]>) => {
  return (
    <fieldset aria-label={p.name}>
      {(p.config.options ?? []).map((option) => {
        const on = p.value.includes(option.value);
        const name = option.count === undefined ? option.label : `${option.label} ${option.count}`;
        return (
          <input
            key={option.value}
            type="checkbox"
            aria-label={name}
            checked={on}
            onChange={() => {
              p.onChange(
                on ? p.value.filter((each) => each !== option.value) : [...p.value, option.value],
              );
            }}
          />
        );
      })}
    </fieldset>
  );
};

/** A field under its label, so the label the metadata gives is seen. */
function Labelled({ label, children }: FieldWrapperProps) {
  return (
    <div>
      <span>{label}</span>
      {children}
    </div>
  );
}

const registry = defineRegistry({
  inputs: { pick: { Component: Pick, defaultValue: [] as string[] } },
  layouts: {},
  field: { Component: Labelled },
});

const form = defineForm(registry).build((b) => {
  return [
    b.pick({ name: 'status', config: { counts: true }, filter: { op: 'in' } }),
    b.pick({
      name: 'presets',
      label: 'Show',
      config: { counts: true },
      filter: {
        presets: [
          { value: 'mine', label: 'Mine', filter: { field: 'assignee', op: 'isMe' } },
          {
            value: 'pinned',
            label: 'Pinned',
            filter: { field: 'pinned', op: 'equals', value: true },
          },
        ],
      },
    }),
  ];
});

type Props = FilterFormProps<typeof registry.inputs>;

function draw(value: FilterValue, more: Partial<Props> = {}) {
  return (
    <FormProvider registry={registry}>
      <FilterForm
        form={form}
        value={value}
        onChange={vi.fn<(next: FilterQuery) => void>()}
        meta={tasks}
        operators={operators}
        kinds={kinds}
        {...more}
      />
    </FormProvider>
  );
}

/** Lets the timers and the promises they start run. */
async function wait(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('FilterForm, filled from the metadata', () => {
  it('takes each field’s label and options from the field its filter names', () => {
    render(draw({}));
    expect(screen.getByText('Status')).toBeInTheDocument();
    // A label the config gives stays.
    expect(screen.getByText('Show')).toBeInTheDocument();
    const status = screen.getByRole('group', { name: 'status' });
    expect(
      within(status)
        .getAllByRole('checkbox')
        .map((box) => box.ariaLabel),
    ).toEqual(['Open', 'Review', 'Done']);
  });

  it('counts each option with the field’s own condition left out, again a pause after each change', async () => {
    const countsBy = vi.fn(
      (_field: string, query: FilterQuery): Promise<Record<string, number>> => {
        const pinned = JSON.stringify(query).includes('pinned');
        const counts: Record<string, number> = pinned
          ? { open: 2, done: 1 }
          : { open: 12, review: 3, done: 40 };
        return Promise.resolve(counts);
      },
    );
    const value = { filter: { all: [{ field: 'status', op: 'in', value: ['open'] }] } };
    const { rerender } = render(draw(value, { countsBy }));
    await wait(0);
    expect(countsBy).toHaveBeenCalledWith('status', { filter: { all: [] } });
    expect(screen.getByRole('checkbox', { name: 'Open 12' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Done 40' })).toBeInTheDocument();

    const pinned = { field: 'pinned', op: 'equals', value: true };
    rerender(draw({ filter: { all: [...value.filter.all, pinned] } }, { countsBy }));
    await wait(299);
    expect(countsBy).toHaveBeenCalledTimes(1);
    await wait(1);
    expect(countsBy).toHaveBeenLastCalledWith('status', { filter: { all: [pinned] } });
    expect(screen.getByRole('checkbox', { name: 'Open 2' })).toBeInTheDocument();
  });

  it('counts each preset with the field’s conditions swapped for the preset’s', async () => {
    const countFor = vi.fn((query: FilterQuery) => {
      return Promise.resolve(JSON.stringify(query).includes('isMe') ? 7 : 4);
    });
    render(
      draw({ filter: { all: [{ field: 'pinned', op: 'equals', value: true }] } }, { countFor }),
    );
    await wait(0);
    expect(countFor).toHaveBeenCalledWith({
      filter: { all: [{ field: 'assignee', op: 'isMe' }] },
    });
    expect(screen.getByRole('checkbox', { name: 'Mine 7' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Pinned 4' })).toBeChecked();
  });

  it('keeps the counts it has when a count fails', async () => {
    let fail = false;
    const countsBy = vi.fn((): Promise<Record<string, number>> => {
      return fail ? Promise.reject(new Error('down')) : Promise.resolve({ open: 5 });
    });
    const { rerender } = render(draw({}, { countsBy }));
    await wait(0);
    fail = true;
    rerender(draw({ search: 'x' }, { countsBy }));
    await wait(300);
    expect(countsBy).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('checkbox', { name: 'Open 5' })).toBeInTheDocument();
  });

  it('throws, naming the field, on a filter the resource doesn’t allow', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const bad = defineForm(registry).build((b) => {
      return [b.pick({ name: 'quick', config: {}, filter: { op: 'contains', field: 'notes' } })];
    });
    expect(() => render(draw({}, { form: bad }))).toThrow(
      'FilterForm: the field "quick" filters "notes" by "contains": "notes" can\'t be filtered.',
    );
  });

  it('changes the filter through the filled fields', () => {
    const onChange = vi.fn<(next: FilterQuery) => void>();
    render(draw({}, { onChange }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Review' }));
    expect(onChange).toHaveBeenLastCalledWith({
      filter: { all: [{ field: 'status', op: 'in', value: ['review'] }] },
    });
  });
});
