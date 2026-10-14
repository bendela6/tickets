import * as v from 'valibot';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { defineHost, type Host, type HostSpec } from './host';
import type { BaseLayouts } from './layouts';
import type { TemplateNode } from './template';

// Two hosts, as their own features will define them (TK-76, TK-16.2): a card,
// its icon and title fixed and its body the template; and a column, its header
// drawn above its cell, and its width, align and sort settings.
const card = defineHost({
  fixed: v.strictObject({
    icon: v.optional(v.string()),
    title: v.string(),
    actions: v.optional(v.array(v.string())),
  }),
  order: ['icon', 'title', 'actions', 'template'],
});

const column = defineHost({
  fixed: v.strictObject({
    header: v.string(),
    width: v.optional(v.number()),
    align: v.optional(v.picklist(['start', 'end'])),
    sort: v.optional(v.string()),
  }),
  order: ['header', 'template'],
});

describe('a host', () => {
  it('holds its fixed parts as plain values, and its template', () => {
    const hosts: Host<v.InferOutput<typeof card.fixed>> = {
      fixed: { icon: 'server', title: 'Hosts', actions: ['restart'] },
      template: {
        layout: 'flex',
        options: { justify: 'between' },
        nodes: [{ field: 'name' }, { field: 'state' }],
      },
    };
    expect(v.is(card.fixed, hosts.fixed)).toBe(true);
    expect(JSON.parse(JSON.stringify(hosts))).toEqual(hosts);
    expectTypeOf(hosts.template).toEqualTypeOf<TemplateNode>();
  });

  it('checks its fixed parts by its kind’s schema', () => {
    expect(v.is(column.fixed, { header: 'Size', width: 120, align: 'end', sort: 'size' })).toBe(
      true,
    );
    expect(v.is(column.fixed, { header: 'Size', width: '120px' })).toBe(false);
    // A fixed part is a plain value: a template goes in `template`, never here.
    expect(v.is(card.fixed, { title: 'Hosts', body: { field: 'name' } })).toBe(false);
  });

  it('says where its template goes among the parts it draws', () => {
    expect(card.order.indexOf('template')).toBe(3);
    expect(column.order).toEqual(['header', 'template']);
    const stray: HostSpec<{ title: string }> = {
      fixed: v.object({ title: v.string() }),
      // @ts-expect-error a host draws its own fixed parts and its template, nothing else
      order: ['subtitle', 'template'],
    };
    expect(stray).toBeDefined();
    const titled = defineHost({
      fixed: v.strictObject({ title: v.string() }),
      // @ts-expect-error defined, its parts are its schema's keys
      order: ['title', 'subtitle', 'template'],
    });
    expect(titled.order).toHaveLength(3);
  });

  it('is refused when its order names no template, or a part twice', () => {
    const fixed = v.strictObject({ title: v.string() });
    expect(() => defineHost({ fixed, order: ['title'] })).toThrow(/names no "template"/);
    expect(() => defineHost({ fixed, order: ['title', 'template', 'title'] })).toThrow(
      /names "title" twice/,
    );
  });

  it('takes an app’s own layouts in its template', () => {
    interface AppLayouts extends BaseLayouts {
      overlay: { anchor: 'top-end' | 'bottom-end' };
    }
    const tile: Host<{ title: string }, AppLayouts> = {
      fixed: { title: 'Avatar' },
      template: { layout: 'overlay', options: { anchor: 'top-end' }, nodes: [{ field: 'user' }] },
    };
    expect(tile.fixed.title).toBe('Avatar');
  });
});
