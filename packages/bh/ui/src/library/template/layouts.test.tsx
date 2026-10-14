import { render, screen } from '@testing-library/react';
import { baseLayoutSpecs, type FlexOptions, type Gap, type GridOptions } from '@bh/template';
import { describe, expect, expectTypeOf, it } from 'vitest';
import type { Justify, RowAlign } from '../layout/components/row';
import type { Align, Gap as StackGap } from '../layout/components/stack';
import { baseTemplateLayouts } from './layout-registry';
import { FlexLayout, GridLayout, RepeatLayout } from './layouts';

const items = ['one', 'two', 'three'].map((text) => {
  return <span key={text}>{text}</span>;
});

describe('baseTemplateLayouts', () => {
  it('lays out each of @bh/template’s layouts, with its spec as it is', () => {
    expect(Object.keys(baseTemplateLayouts)).toEqual(Object.keys(baseLayoutSpecs));
    for (const [name, spec] of Object.entries(baseLayoutSpecs)) {
      const { Component, ...own } = baseTemplateLayouts[name as keyof typeof baseLayoutSpecs];
      expect(own, name).toEqual(spec);
      expect(typeof Component, name).toBe('function');
    }
  });

  it('takes the options Row and Stack take', () => {
    expectTypeOf<Gap>().toExtend<StackGap>();
    expectTypeOf<NonNullable<FlexOptions['justify']>>().toExtend<Justify>();
    expectTypeOf<NonNullable<FlexOptions['align']>>().toExtend<RowAlign>();
    expectTypeOf<NonNullable<GridOptions['align']>>().toExtend<Align>();
  });
});

describe('the layouts', () => {
  it('flex: its items in their order, in a row or a column', () => {
    const { container, rerender } = render(<FlexLayout options={{}} items={items} more={0} />);
    expect(container.textContent).toBe('onetwothree');
    rerender(
      <FlexLayout
        options={{ direction: 'column', justify: 'between', align: 'baseline', gap: 2, wrap: true }}
        items={items}
        more={0}
      />,
    );
    expect(container.textContent).toBe('onetwothree');
  });

  it('grid: its items in a fixed count of columns, or as many as fit at a least width', () => {
    const { container, rerender } = render(
      <GridLayout options={{ columns: 2, gap: 2 }} items={items} more={0} />,
    );
    const grid = container.firstElementChild as HTMLElement;
    expect(grid.style.gridTemplateColumns).toBe('repeat(2, minmax(0, 1fr))');
    expect(screen.getByText('three')).toBeInTheDocument();
    rerender(<GridLayout options={{ columns: { min: 160 } }} items={items} more={0} />);
    expect(grid.style.gridTemplateColumns).toBe('repeat(auto-fill, minmax(min(100%, 160px), 1fr))');
  });

  it('repeat: an item per entry, then the entries past max counted', () => {
    const { container, rerender } = render(
      <RepeatLayout options={{ field: 'labels', max: 3 }} items={items} more={2} />,
    );
    expect(container.textContent).toBe('onetwothree+2 more');
    rerender(<RepeatLayout options={{ field: 'labels' }} items={items} more={0} />);
    expect(container.textContent).toBe('onetwothree');
  });
});
