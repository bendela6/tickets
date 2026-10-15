/// <reference types="@testing-library/jest-dom/vitest" />
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { defineForm } from '../builder/define-form';
import { defineRegistry } from '../builder/define-registry';
import { FormProvider } from '../runtime/form-provider';
import type { FilterCountProps, InputProps } from '../types/registry';
import { FilterForm, type FilterFormProps } from './filter-form';
import { kinds, operators, tasks } from './meta.fixture';

const Text = (p: InputProps<object, string>) => {
  return (
    <input aria-label={p.name} value={p.value ?? ''} onChange={(e) => p.onChange(e.target.value)} />
  );
};

/** What the count part is given, as text. */
function Count({ shown, total, label, loading }: FilterCountProps) {
  return (
    <output>{loading ? 'Counting' : `${String(shown)} of ${String(total)} ${label.other}`}</output>
  );
}

const inputs = { text: { Component: Text, defaultValue: '' } };
const field = { Component: ({ children }: { children?: React.ReactNode }) => <>{children}</> };
const counted = defineRegistry({
  inputs,
  layouts: {},
  field,
  filter: { count: Count, changes: () => null, sheet: () => null },
});
const plain = defineRegistry({ inputs, layouts: {}, field });

const form = defineForm(counted).build((b) => {
  return [
    b.text({ name: 'status', config: {}, filter: { op: 'equals' } }),
    b.slot({ name: 'count' }),
  ];
});

function draw(
  registry: typeof counted | typeof plain,
  count: FilterFormProps<typeof inputs>['count'],
) {
  return (
    <FormProvider registry={registry}>
      <FilterForm
        form={form}
        value={{}}
        onChange={vi.fn()}
        meta={tasks}
        operators={operators}
        kinds={kinds}
        count={count}
      />
    </FormProvider>
  );
}

describe('FilterForm’s count', () => {
  it('draws the registry’s count in the count slot, with the resource’s name for its rows', () => {
    const { rerender } = render(draw(counted, { shown: 12, total: 40 }));
    expect(screen.getByRole('status')).toHaveTextContent('12 of 40 tasks');
    rerender(draw(counted, 'loading'));
    expect(screen.getByRole('status')).toHaveTextContent('Counting');
  });

  it('draws nothing without a count, or without the registry’s part', () => {
    const { rerender } = render(draw(counted, undefined));
    expect(screen.queryByRole('status')).toBeNull();
    rerender(draw(plain, { shown: 12, total: 40 }));
    expect(screen.queryByRole('status')).toBeNull();
  });
});
