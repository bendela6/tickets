import type { Filter } from '@bh/resource';
import { describe, expect, expectTypeOf, it } from 'vitest';
import type { BaseLayouts, FlexOptions, GridOptions, RepeatOptions } from './layouts';
import type { Part } from './part';
import type { LayoutNode, TemplateNode } from './template';

// A ticket in a list: its key as a blue link beside its title, its status on
// the right; its description, two lines at most; then its labels, three at
// most and "+N", its assignee, when it was last updated and, only while it's
// blocked, a red "Blocked".
const ticketRow: TemplateNode = {
  layout: 'flex',
  options: { direction: 'column', gap: 1 },
  nodes: [
    {
      layout: 'flex',
      options: { justify: 'between', gap: 2 },
      nodes: [
        {
          layout: 'flex',
          options: { gap: 2, align: 'baseline' },
          nodes: [
            {
              text: '{project}-{number}',
              renderer: { name: 'link', options: { to: '/p/{project}/t/{number}' } },
              options: { tone: 'blue', mono: true },
            },
            { field: 'title', options: { clamp: 1 } },
          ],
        },
        { field: 'status' },
      ],
    },
    { field: 'description', options: { clamp: 2, tone: 'gray' } },
    {
      layout: 'flex',
      options: { gap: 2, wrap: true },
      nodes: [
        {
          layout: 'repeat',
          options: { field: 'labels', max: 3, gap: 1 },
          nodes: [{ field: 'labels', renderer: 'pill' }],
        },
        { field: 'assignee', options: { empty: 'Unassigned' } },
        { field: 'updatedAt', format: 'relative', options: { prefix: 'updated ' } },
        {
          value: 'Blocked',
          renderer: 'pill',
          options: { tone: 'danger' },
          when: { field: 'status.kind', op: 'equals', value: 'blocked' },
        },
      ],
    },
  ],
};

// A stack's tile: its host beside its state; four figures in two columns, each
// in its format; and each of its services, a dot and a name, four at most.
const stackTile: TemplateNode = {
  layout: 'flex',
  options: { direction: 'column', gap: 3 },
  nodes: [
    {
      layout: 'flex',
      options: { justify: 'between' },
      nodes: [{ field: 'host', options: { mono: true, tone: 'gray' } }, { field: 'state' }],
    },
    {
      layout: 'grid',
      options: { columns: 2, gap: 2 },
      nodes: [
        { field: 'cpu', renderer: { name: 'meter', options: { max: 1 } }, format: 'percent' },
        { field: 'memory', format: 'bytes' },
        { field: 'uptime', format: 'duration', options: { prefix: 'up ' } },
        { field: 'deployedAt', format: 'relative', options: { empty: 'Never deployed' } },
      ],
    },
    {
      layout: 'repeat',
      options: { field: 'services', max: 4, gap: 2, wrap: true },
      when: { not: { field: 'services', op: 'empty' } },
      nodes: [
        {
          layout: 'flex',
          options: { gap: 1 },
          nodes: [
            { field: 'services.state', renderer: 'dot' },
            { field: 'services.name', options: { mono: true } },
          ],
        },
      ],
    },
  ],
};

describe('a template', () => {
  it('is JSON: it reads back from its text as it was written', () => {
    for (const template of [ticketRow, stackTile]) {
      expect(JSON.parse(JSON.stringify(template))).toEqual(template);
    }
  });

  it('is one part, or a layout holding more, nested as deep as it needs', () => {
    const title: TemplateNode = { field: 'title' };
    const deep: TemplateNode = {
      layout: 'flex',
      nodes: [{ layout: 'grid', options: { columns: { min: 160 } }, nodes: [stackTile, title] }],
    };
    expectTypeOf<TemplateNode>().toEqualTypeOf<LayoutNode | Part>();
    expect([title, deep]).toHaveLength(2);
  });

  it('names its layout by its name and checks the options it gives it', () => {
    const empty: TemplateNode = { layout: 'flex', nodes: [] };
    // @ts-expect-error flex spreads its nodes start, center, end or between
    const around: TemplateNode = { layout: 'flex', options: { justify: 'around' }, nodes: [] };
    // @ts-expect-error a gap is a step: 0, 1, 2, 3, 4, 6 or 8
    const odd: TemplateNode = { layout: 'flex', options: { gap: 5 }, nodes: [] };
    // @ts-expect-error a grid says its columns
    const grid: TemplateNode = { layout: 'grid', nodes: [] };
    // @ts-expect-error a repeat says its list field
    const repeat: TemplateNode = { layout: 'repeat', options: { max: 3 }, nodes: [] };
    // @ts-expect-error bh registers no layout named overlay
    const overlay: TemplateNode = { layout: 'overlay', nodes: [] };
    expect([empty, around, odd, grid, repeat, overlay]).toHaveLength(6);
  });

  it('takes an app’s own layouts beside bh’s', () => {
    interface AppLayouts extends BaseLayouts {
      overlay: { anchor: 'top-end' | 'bottom-end' };
    }
    const avatar: TemplateNode<AppLayouts> = {
      layout: 'overlay',
      options: { anchor: 'bottom-end' },
      nodes: [{ field: 'assignee' }, { field: 'presence' }],
    };
    const row: TemplateNode<AppLayouts> = { layout: 'flex', nodes: [avatar, { field: 'name' }] };
    const wrong: TemplateNode<AppLayouts> = {
      layout: 'overlay',
      // @ts-expect-error the overlay's anchor is one of its own
      options: { anchor: 'middle' },
      nodes: [],
    };
    expect([avatar, row, wrong]).toHaveLength(3);
  });

  it('keeps bh’s layouts’ options', () => {
    expectTypeOf<BaseLayouts>().toEqualTypeOf<{
      flex: FlexOptions;
      grid: GridOptions;
      repeat: RepeatOptions;
    }>();
    expectTypeOf<RepeatOptions>().toExtend<FlexOptions>();
    expectTypeOf<GridOptions['columns']>().toEqualTypeOf<number | { min: number }>();
  });

  it('lets any node show only while a filter on the record holds', () => {
    expectTypeOf<Part['when']>().toEqualTypeOf<Filter | undefined>();
    expectTypeOf<LayoutNode['when']>().toEqualTypeOf<Filter | undefined>();
  });

  it('keeps a part a leaf, told apart from a layout by its `layout`', () => {
    // @ts-expect-error a part holds no nodes
    const holding: TemplateNode = { field: 'title', nodes: [] };
    // @ts-expect-error a layout node holds nodes, an empty list at least
    const bare: TemplateNode = { layout: 'flex' };
    expect([holding, bare]).toHaveLength(2);

    // A node without a layout is a part, and a part may show a field.
    const fields = (node: TemplateNode): string[] => {
      if (node.layout === undefined) {
        return node.field === undefined ? [] : [node.field];
      }
      return node.nodes.flatMap(fields);
    };
    expect(fields(stackTile)).toEqual([
      'host',
      'state',
      'cpu',
      'memory',
      'uptime',
      'deployedAt',
      'services.state',
      'services.name',
    ]);
  });
});
