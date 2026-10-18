import { render, screen } from '@testing-library/react';
import * as v from 'valibot';
import type { TemplateNode } from '@bh/template';
import { describe, expect, expectTypeOf, it } from 'vitest';
import type { Justify, RowAlign } from '../layout/components/row';
import type { Align, Gap } from '../layout/components/stack';
import { baseTemplateLayouts, type BaseLayouts } from './base-layouts';
import { TemplateGridLayout, type GridOptions } from './layouts/grid';
import { TemplateRepeatLayout, type RepeatOptions } from './layouts/repeat';
import { TemplateRowLayout, type RowOptions } from './layouts/row';
import { TemplateStackLayout, type StackOptions } from './layouts/stack';

const items = ['one', 'two', 'three'].map((text) => {
  return <span key={text}>{text}</span>;
});

/** Whether one of bh's layouts takes these options. */
function accepts(name: keyof BaseLayouts, options: unknown) {
  return v.is(baseTemplateLayouts.get(name).options, options);
}

describe('baseTemplateLayouts', () => {
  it('are row, stack, grid and repeat, frozen', () => {
    expect(baseTemplateLayouts.names).toEqual(['row', 'stack', 'grid', 'repeat']);
    expect(Object.isFrozen(baseTemplateLayouts)).toBe(true);
  });

  it('check the options a node gives', () => {
    expect(accepts('row', {})).toBe(true);
    expect(accepts('row', { justify: 'between', align: 'baseline', gap: 2, wrap: true })).toBe(
      true,
    );
    expect(accepts('row', { gap: 5 })).toBe(false);
    expect(accepts('row', { justify: 'around' })).toBe(false);
    expect(accepts('row', { direction: 'column' })).toBe(false);
    expect(accepts('stack', { align: 'center', gap: 3 })).toBe(true);
    expect(accepts('stack', { justify: 'between' })).toBe(false);
    expect(accepts('stack', { align: 'baseline' })).toBe(false);
    expect(accepts('grid', { columns: 3 })).toBe(true);
    expect(accepts('grid', { columns: { min: 160 }, gap: 2, align: 'start' })).toBe(true);
    expect(accepts('grid', {})).toBe(false);
    expect(accepts('grid', { columns: 1.5 })).toBe(false);
    expect(accepts('grid', { columns: 2, align: 'baseline' })).toBe(false);
    expect(accepts('repeat', { field: 'labels', max: 3, gap: 1, wrap: true })).toBe(true);
    expect(accepts('repeat', { max: 3 })).toBe(false);
    expect(accepts('repeat', { field: 'labels', max: 0 })).toBe(false);
  });

  it('draw row’s, stack’s and grid’s nodes once, and repeat’s once per entry of its field', () => {
    expect(baseTemplateLayouts.get('row').repeats).toBeUndefined();
    expect(baseTemplateLayouts.get('stack').repeats).toBeUndefined();
    expect(baseTemplateLayouts.get('grid').repeats).toBeUndefined();
    const { repeats } = baseTemplateLayouts.get('repeat');
    expect(repeats?.({ field: 'labels', max: 3 })).toEqual({ field: 'labels', max: 3 });
    expect(repeats?.({ field: 'labels' })).toEqual({ field: 'labels' });
  });

  it('type a template’s layouts and their options', () => {
    expectTypeOf<BaseLayouts>().toEqualTypeOf<{
      row: RowOptions;
      stack: StackOptions;
      grid: GridOptions;
      repeat: RepeatOptions;
    }>();
    expectTypeOf<GridOptions['columns']>().toEqualTypeOf<number | { min: number }>();
    // A template typed with bh's layouts.
    type Node = TemplateNode<BaseLayouts>;
    const empty: Node = { layout: 'row', nodes: [] };
    // @ts-expect-error a row spreads its nodes start, center, end or between
    const around: Node = { layout: 'row', options: { justify: 'around' }, nodes: [] };
    // @ts-expect-error a gap is a step: 0, 1, 2, 3, 4, 6 or 8
    const odd: Node = { layout: 'row', options: { gap: 5 }, nodes: [] };
    // @ts-expect-error a stack has no justify
    const justified: Node = { layout: 'stack', options: { justify: 'end' }, nodes: [] };
    // @ts-expect-error a grid says its columns
    const grid: Node = { layout: 'grid', nodes: [] };
    // @ts-expect-error a repeat says its list field
    const repeat: Node = { layout: 'repeat', options: { max: 3 }, nodes: [] };
    // @ts-expect-error bh registers no layout named overlay
    const overlay: Node = { layout: 'overlay', nodes: [] };
    expect([empty, around, odd, justified, grid, repeat, overlay]).toHaveLength(7);
  });

  it('take the options Row and Stack take', () => {
    expectTypeOf<NonNullable<RowOptions['gap']>>().toExtend<Gap>();
    expectTypeOf<NonNullable<RowOptions['justify']>>().toExtend<Justify>();
    expectTypeOf<NonNullable<RowOptions['align']>>().toExtend<RowAlign>();
    expectTypeOf<NonNullable<StackOptions['align']>>().toExtend<Align>();
    expectTypeOf<NonNullable<GridOptions['align']>>().toExtend<Align>();
  });
});

describe('the layouts', () => {
  it('row: its items side by side, in their order', () => {
    const { container, rerender } = render(
      <TemplateRowLayout options={{}} items={items} more={0} />,
    );
    expect(container.textContent).toBe('onetwothree');
    rerender(
      <TemplateRowLayout
        options={{ justify: 'between', align: 'baseline', gap: 2, wrap: true }}
        items={items}
        more={0}
      />,
    );
    expect(container.firstElementChild).toHaveClass('flex-wrap');
  });

  it('stack: its items one under another, in their order', () => {
    const { container } = render(
      <TemplateStackLayout options={{ align: 'center', gap: 2 }} items={items} more={0} />,
    );
    expect(container.textContent).toBe('onetwothree');
    expect(container.firstElementChild).toHaveClass('flex-col');
  });

  it('grid: its items in a fixed count of columns, or as many as fit at a least width', () => {
    const { container, rerender } = render(
      <TemplateGridLayout options={{ columns: 2, gap: 2 }} items={items} more={0} />,
    );
    const grid = container.firstElementChild as HTMLElement;
    expect(grid.style.gridTemplateColumns).toBe('repeat(2, minmax(0, 1fr))');
    expect(screen.getByText('three')).toBeInTheDocument();
    rerender(<TemplateGridLayout options={{ columns: { min: 160 } }} items={items} more={0} />);
    expect(grid.style.gridTemplateColumns).toBe('repeat(auto-fill, minmax(min(100%, 160px), 1fr))');
  });

  it('repeat: an item per entry, then the entries past max counted', () => {
    const { container, rerender } = render(
      <TemplateRepeatLayout options={{ field: 'labels', max: 3 }} items={items} more={2} />,
    );
    expect(container.textContent).toBe('onetwothree+2 more');
    rerender(<TemplateRepeatLayout options={{ field: 'labels' }} items={items} more={0} />);
    expect(container.textContent).toBe('onetwothree');
  });
});
