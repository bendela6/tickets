import * as v from 'valibot';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { baseLayoutSpecs, entriesOf, type LayoutSpec } from './layout-registry';
import type { BaseLayouts } from './layouts';
import { entryOf } from './registry';

describe('bh’s layouts', () => {
  it('are flex, grid and repeat, frozen', () => {
    expect(Object.keys(baseLayoutSpecs)).toEqual(['flex', 'grid', 'repeat']);
    expect(Object.isFrozen(baseLayoutSpecs)).toBe(true);
  });

  it('give each one’s options by its schema', () => {
    type OutputOf<K extends keyof BaseLayouts> = v.InferOutput<
      (typeof baseLayoutSpecs)[K]['options']
    >;
    expectTypeOf<OutputOf<'flex'>>().toEqualTypeOf<BaseLayouts['flex']>();
    expectTypeOf<OutputOf<'grid'>>().toEqualTypeOf<BaseLayouts['grid']>();
    expectTypeOf<OutputOf<'repeat'>>().toEqualTypeOf<BaseLayouts['repeat']>();
  });

  it('check the options a node gives', () => {
    const accepts = (name: keyof BaseLayouts, options: unknown) => {
      return v.is(baseLayoutSpecs[name].options, options);
    };
    expect(accepts('flex', {})).toBe(true);
    expect(accepts('flex', { direction: 'column', justify: 'between', gap: 2, wrap: true })).toBe(
      true,
    );
    expect(accepts('flex', { gap: 5 })).toBe(false);
    expect(accepts('flex', { justify: 'around' })).toBe(false);
    expect(accepts('flex', { colums: 2 })).toBe(false);
    expect(accepts('grid', { columns: 3 })).toBe(true);
    expect(accepts('grid', { columns: { min: 160 }, gap: 2, align: 'start' })).toBe(true);
    expect(accepts('grid', {})).toBe(false);
    expect(accepts('grid', { columns: 1.5 })).toBe(false);
    expect(accepts('grid', { columns: 2, align: 'baseline' })).toBe(false);
    expect(accepts('repeat', { field: 'labels', max: 3, gap: 1, wrap: true })).toBe(true);
    expect(accepts('repeat', { max: 3 })).toBe(false);
    expect(accepts('repeat', { field: 'labels', max: 0 })).toBe(false);
  });

  it('draw flex’s and grid’s nodes once, and repeat’s once per entry of its field', () => {
    expect(baseLayoutSpecs.flex.repeats).toBeUndefined();
    expect(baseLayoutSpecs.grid.repeats).toBeUndefined();
    expect(baseLayoutSpecs.repeat.repeats?.({ field: 'labels', max: 3 })).toEqual({
      field: 'labels',
      max: 3,
    });
    expect(baseLayoutSpecs.repeat.repeats?.({ field: 'labels' })).toEqual({ field: 'labels' });
  });

  it('take an app’s own beside them, by name', () => {
    const overlay: LayoutSpec<{ anchor: 'top-end' | 'bottom-end' }> = {
      options: v.strictObject({ anchor: v.picklist(['top-end', 'bottom-end']) }),
    };
    const layouts = { ...baseLayoutSpecs, overlay };
    expect(entryOf(layouts, 'overlay')).toBe(overlay);
    expect(entryOf(layouts, 'flex')).toBe(baseLayoutSpecs.flex);
    expect(entryOf(layouts, 'hasOwnProperty')).toBeUndefined();
  });
});

describe('entriesOf', () => {
  const record = { id: 12, title: 'Fix the login', labels: ['auth', 'web', 'ios', 'api'] };

  it('gives the record once per entry, the field holding that one entry', () => {
    expect(entriesOf(record, 'labels')).toEqual({
      records: [
        { ...record, labels: 'auth' },
        { ...record, labels: 'web' },
        { ...record, labels: 'ios' },
        { ...record, labels: 'api' },
      ],
      more: 0,
    });
  });

  it('stops at max, and counts the entries past it', () => {
    const { records, more } = entriesOf(record, 'labels', 3);
    expect(records.map((each) => each.labels)).toEqual(['auth', 'web', 'ios']);
    expect(more).toBe(1);
    expect(entriesOf(record, 'labels', 10).more).toBe(0);
  });

  it('gives an object entry as it is, its keys a level down', () => {
    const stack = { name: 'media', services: [{ name: 'web', state: 'running' }] };
    expect(entriesOf(stack, 'services').records).toEqual([
      { name: 'media', services: { name: 'web', state: 'running' } },
    ]);
  });

  it('gives none for nothing, and one for a value that is no list', () => {
    expect(entriesOf({ labels: [] }, 'labels')).toEqual({ records: [], more: 0 });
    expect(entriesOf({ labels: null }, 'labels')).toEqual({ records: [], more: 0 });
    expect(entriesOf({}, 'labels')).toEqual({ records: [], more: 0 });
    expect(entriesOf({ owner: 7 }, 'owner')).toEqual({ records: [{ owner: 7 }], more: 0 });
  });
});
