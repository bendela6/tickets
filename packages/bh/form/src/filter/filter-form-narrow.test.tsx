/// <reference types="@testing-library/jest-dom/vitest" />
import { type ReactNode, useState } from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineForm } from '../builder/define-form';
import { defineRegistry } from '../builder/define-registry';
import { FormProvider } from '../runtime/form-provider';
import type { FilterSheetProps, InputProps, LayoutComponentProps } from '../types/registry';
import { FilterForm, type FilterValue } from './filter-form';
import type { FilterQuery } from './fold';
import { kinds, operators, tasks } from './meta.fixture';
import type { FilterOption } from './meta';
import { noInputs, noLayouts } from '../builder/registries';

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

/** A list of choices, a checkbox each. */
const Pick = (p: InputProps<{ options?: FilterOption[] }, string[]>) => {
  return (
    <fieldset aria-label={p.name}>
      {(p.config.options ?? []).map((option) => {
        const on = p.value.includes(option.value);
        return (
          <input
            key={option.value}
            type="checkbox"
            aria-label={option.label}
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

/** A bar of fields, told when to move some to a sheet. */
function Bar({ children }: LayoutComponentProps<{ narrow?: { below: number; keep: string[] } }>) {
  return <div role="toolbar">{children}</div>;
}

/**
 * A button with its badge, and the sheet it opens. In place, where a drawer
 * portals it: React carries its events up the same way, through the bar's form.
 */
function Sheet({ title, count, open, onOpenChange, children }: FilterSheetProps) {
  return (
    <>
      <button type="button" onClick={() => onOpenChange(true)}>
        {count > 0 ? `${title} ${count}` : title}
      </button>
      {open ? (
        <div role="dialog" aria-label={title}>
          {children}
        </div>
      ) : null}
    </>
  );
}

const registry = defineRegistry({
  inputs: noInputs.register({
    text: { Component: Text, defaultValue: '' },
    check: { Component: Check, defaultValue: false },
    pick: { Component: Pick, defaultValue: [] as string[] },
  }),
  layouts: noLayouts.register({ bar: { Component: Bar } }),
  field: { Component: ({ children }: { children?: ReactNode }) => <>{children}</> },
  filter: { count: () => null, changes: () => null, sheet: Sheet },
});

const form = defineForm(registry).build((b) => {
  return [
    b.bar({ narrow: { below: 640, keep: ['search', 'status'] } }, [
      b.text({ name: 'search', config: {} }),
      b.check({ name: 'pinned', config: {}, filter: { op: 'equals' } }),
      b.pick({ name: 'status', config: {}, filter: { op: 'in' } }),
      b.text({ name: 'title', config: {}, filter: { op: 'contains' } }),
      b.reset({ label: 'Clear', to: 'start' }),
    ]),
  ];
});

const open = { field: 'status', op: 'in', value: ['open'] };
const pinned = { field: 'pinned', op: 'equals', value: true };
const crash = { field: 'title', op: 'contains', value: 'crash' };

type Spy = (next: FilterQuery) => void;

function Page(props: {
  spy: Spy;
  start?: FilterValue;
  countFor?: (v: FilterQuery) => Promise<number>;
}) {
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
        {...(props.countFor ? { countFor: props.countFor } : {})}
      />
    </FormProvider>
  );
}

/** The window's width, as the form measures its own. */
function width(pixels: number) {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(pixels);
}

const sheet = () => screen.getByRole('dialog', { name: 'Filters' });

async function settle(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

beforeEach(() => {
  // The sheet's form drawn in place sits in the bar's, which a portal avoids.
  const error = console.error.bind(console);
  vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    if (!String(args[0]).includes('cannot be a descendant of')) {
      error(...args);
    }
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('FilterForm in a narrow window', () => {
  it('draws every field in the bar while it is wide enough', () => {
    width(1000);
    render(<Page spy={vi.fn()} />);
    expect(screen.getByLabelText('pinned')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Filters/ })).toBeNull();
  });

  it('keeps the kept fields in the bar, applying at once, and a Filters button where the rest were', () => {
    width(375);
    const spy = vi.fn<Spy>();
    render(<Page spy={spy} />);
    const bar = screen.getByRole('toolbar');
    const order = [...bar.querySelectorAll('input[aria-label="search"], button, fieldset')].map(
      (element) => element.getAttribute('aria-label') ?? element.textContent,
    );
    expect(order).toEqual(['search', 'Filters', 'status', 'Clear']);
    expect(screen.queryByLabelText('pinned')).toBeNull();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Open' }));
    expect(spy).toHaveBeenLastCalledWith({ filter: { all: [open] } });
  });

  it('badges the button with the conditions the sheet’s fields hold', () => {
    width(375);
    render(<Page spy={vi.fn()} start={{ filter: { all: [open, pinned, crash] } }} />);
    expect(screen.getByRole('button', { name: 'Filters 2' })).toBeInTheDocument();
  });

  it('applies the sheet’s fields on its submit only, with the bar’s, then closes', async () => {
    width(375);
    const spy = vi.fn<Spy>();
    render(<Page spy={spy} start={{ filter: { all: [open] } }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    fireEvent.click(within(sheet()).getByLabelText('pinned'));
    fireEvent.change(within(sheet()).getByLabelText('title'), { target: { value: 'crash' } });
    expect(spy).not.toHaveBeenCalled();
    // No countFor: the label says no number.
    fireEvent.click(within(sheet()).getByRole('button', { name: 'Show items' }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(spy).toHaveBeenLastCalledWith({ filter: { all: [open, pinned, crash] } });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'Filters 2' })).toBeInTheDocument();
  });

  it('empties only the sheet’s fields with its Clear', async () => {
    width(375);
    const spy = vi.fn<Spy>();
    render(<Page spy={spy} start={{ filter: { all: [open, pinned] } }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Filters 1' }));
    expect(within(sheet()).getByLabelText('pinned')).toBeChecked();
    fireEvent.click(within(sheet()).getByRole('button', { name: 'Clear' }));
    expect(within(sheet()).getByLabelText('pinned')).not.toBeChecked();
    expect(spy).not.toHaveBeenCalled();
    fireEvent.click(within(sheet()).getByRole('button', { name: 'Show items' }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(spy).toHaveBeenLastCalledWith({ filter: { all: [open] } });
  });

  it('lets the bar’s Clear empty the sheet’s fields too, without waiting for a change in the bar', async () => {
    width(375);
    const spy = vi.fn<Spy>();
    render(<Page spy={spy} start={{ filter: { all: [pinned] } }} />);
    const clear = within(screen.getByRole('toolbar')).getByRole('button', { name: 'Clear' });
    expect(clear).toBeEnabled();
    fireEvent.click(clear);
    await act(async () => {
      await Promise.resolve();
    });
    expect(spy).toHaveBeenLastCalledWith({ filter: { all: [] } });
  });

  it('fills the submit’s count from countFor, a pause after each change', async () => {
    vi.useFakeTimers();
    width(375);
    const countFor = vi.fn((query: FilterQuery) => {
      return Promise.resolve(JSON.stringify(query).includes('pinned') ? 3 : 7);
    });
    render(<Page spy={vi.fn()} start={{ filter: { all: [open] } }} countFor={countFor} />);
    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    await settle(300);
    expect(countFor).toHaveBeenLastCalledWith({ filter: { all: [open] } });
    expect(within(sheet()).getByRole('button', { name: 'Show 7 items' })).toBeInTheDocument();
    fireEvent.click(within(sheet()).getByLabelText('pinned'));
    await settle(299);
    expect(within(sheet()).getByRole('button', { name: 'Show 7 items' })).toBeInTheDocument();
    await settle(1);
    expect(countFor).toHaveBeenLastCalledWith({ filter: { all: [open, pinned] } });
    expect(within(sheet()).getByRole('button', { name: 'Show 3 items' })).toBeInTheDocument();
  });

  it('stops the sheet’s submit at the sheet, though its portal is inside the bar', async () => {
    width(375);
    const outside = vi.fn();
    render(
      <div onSubmit={outside}>
        <Page spy={vi.fn()} />
      </div>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    fireEvent.click(within(sheet()).getByRole('button', { name: 'Show items' }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(outside).not.toHaveBeenCalled();
  });
});
