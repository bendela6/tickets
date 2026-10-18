/// <reference types="@testing-library/jest-dom/vitest" />
import { useState } from 'react';
import type { Filter } from '@bh/resource';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { defineForm } from '../builder/define-form';
import { defineRegistry } from '../builder/define-registry';
import { FormProvider } from '../runtime/form-provider';
import type { InputProps, LayoutComponentProps } from '../types/registry';
import { countAsks } from './counts';
import { FilterForm, type FilterValue } from './filter-form';
import type { FilterQuery } from './fold';
import { kinds, operators, tasks } from './meta.fixture';
import { noInputs, noLayouts } from '../builder/registries';

const Text = (p: InputProps<object, string>) => {
  return (
    <input aria-label={p.name} value={p.value ?? ''} onChange={(e) => p.onChange(e.target.value)} />
  );
};

/** A list of filters, each a line, with a remove button unless it's read-only. */
const Rules = (p: InputProps<object, Filter[]>) => {
  return (
    <ul aria-label={p.label ?? p.name} data-read-only={p.readOnly ? '' : undefined}>
      {p.value.map((entry, index) => {
        const words = JSON.stringify(entry);
        return (
          <li key={words}>
            {words}
            {p.readOnly ? null : (
              <button
                type="button"
                onClick={() => p.onChange(p.value.filter((_, at) => at !== index))}
              >
                Remove {words}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
};

function Bar({ children }: LayoutComponentProps<object>) {
  return <div role="toolbar">{children}</div>;
}

const inputs = noInputs.register({
  text: { Component: Text, defaultValue: '' },
  rules: { Component: Rules, defaultValue: [] as Filter[] },
});

const registry = defineRegistry({
  inputs,
  layouts: noLayouts.register({ bar: { Component: Bar } }),
  field: { Component: ({ children }) => <>{children}</> },
});

const form = defineForm(registry).build((b) => {
  return [
    b.bar({}, [
      b.text({ name: 'status', config: {}, filter: { op: 'equals' } }),
      b.rules({ name: 'rules', label: 'Filters', config: {}, filter: { rules: true } }),
      b.reset({ label: 'Clear', to: 'start' }),
    ]),
  ];
});

const project: Filter = { field: 'title', op: 'startsWith', value: 'TIX' };
const open: Filter = { field: 'status', op: 'equals', value: 'open' };

function Page(props: { spy: (next: FilterQuery) => void; start?: FilterValue; locked?: Filter }) {
  const [value, setValue] = useState<FilterValue>(props.start ?? {});
  return (
    <FormProvider registry={registry}>
      <FilterForm
        form={form}
        value={value}
        onChange={(next) => {
          props.spy(next);
          setValue(next);
        }}
        meta={tasks}
        operators={operators}
        kinds={kinds}
        locked={props.locked ?? project}
      />
    </FormProvider>
  );
}

describe('FilterForm’s locked conditions', () => {
  it('are drawn first in the bar, read-only', () => {
    render(<Page spy={vi.fn()} />);
    const bar = screen.getByRole('toolbar');
    const lists = within(bar).getAllByRole('list');
    expect(lists[0]).toHaveAccessibleName('Set by the page');
    expect(lists[0]).toHaveAttribute('data-read-only');
    expect(lists[0]).toHaveTextContent(JSON.stringify(project));
    expect(within(lists[0] as HTMLElement).queryByRole('button')).toBeNull();
  });

  it('come first in every value it hands out', () => {
    const spy = vi.fn<(next: FilterQuery) => void>();
    render(<Page spy={spy} />);
    fireEvent.change(screen.getByLabelText('status'), { target: { value: 'done' } });
    expect(spy).toHaveBeenLastCalledWith({
      filter: { all: [project, { field: 'status', op: 'equals', value: 'done' }] },
    });
  });

  it('stay through Clear', async () => {
    const spy = vi.fn<(next: FilterQuery) => void>();
    render(<Page spy={spy} />);
    fireEvent.change(screen.getByLabelText('status'), { target: { value: 'done' } });
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(spy).toHaveBeenLastCalledWith({ filter: { all: [project] } });
    expect(screen.getByRole('list', { name: 'Set by the page' })).toHaveTextContent(
      JSON.stringify(project),
    );
  });

  it('show in their own field only, when a value holds them', () => {
    render(<Page spy={vi.fn()} start={{ filter: { all: [open, project] } }} locked={open} />);
    // The status field leaves the locked condition to the locked field…
    expect(screen.getByLabelText('status')).toHaveValue('');
    expect(screen.getByRole('list', { name: 'Set by the page' })).toHaveTextContent(
      JSON.stringify(open),
    );
    // …and the reader's rules hold the rest.
    expect(screen.getByRole('list', { name: 'Filters' })).toHaveTextContent(
      JSON.stringify(project),
    );
    expect(screen.getByRole('list', { name: 'Filters' })).not.toHaveTextContent(
      JSON.stringify(open),
    );
  });

  it('apply without a rules input to draw them', () => {
    const plain = defineRegistry({
      inputs: noInputs.register({ text: inputs.get('text') }),
      layouts: noLayouts,
      field: { Component: ({ children }) => <>{children}</> },
    });
    const one = defineForm(plain).build((b) => {
      return [b.text({ name: 'status', config: {}, filter: { op: 'equals' } })];
    });
    const spy = vi.fn<(next: FilterQuery) => void>();
    render(
      <FormProvider registry={plain}>
        <FilterForm
          form={one}
          value={{}}
          onChange={spy}
          meta={tasks}
          operators={operators}
          kinds={kinds}
          locked={project}
        />
      </FormProvider>,
    );
    fireEvent.change(screen.getByLabelText('status'), { target: { value: 'done' } });
    expect(spy).toHaveBeenLastCalledWith({
      filter: { all: [project, { field: 'status', op: 'equals', value: 'done' }] },
    });
  });

  it('come first in every count it asks for', () => {
    const counted = defineForm(registry).build((b) => {
      return [b.text({ name: 'status', config: { counts: true }, filter: { op: 'equals' } })];
    });
    const asks = countAsks(counted.nodes, { filter: { all: [open] } }, {}, [project]);
    expect(asks).toEqual([
      { name: 'status', path: 'status', query: { filter: { all: [project] } } },
    ]);
  });
});
