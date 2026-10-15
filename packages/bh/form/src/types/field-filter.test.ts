import { describe, expect, expectTypeOf, test } from 'vitest';
import { defineRegistry } from '../builder/define-registry';
import { defineForm } from '../builder/define-form';
import type { FieldFilter, Preset } from './field-filter';
import type { FieldNode } from './field-node';

const Stub = () => null;
const registry = defineRegistry({
  inputs: {
    text: { Component: Stub as never, defaultValue: '' },
    select: { Component: Stub as never, defaultValue: null },
    chips: { Component: Stub as never, defaultValue: [] as string[] },
  },
  layouts: {},
  field: { Component: Stub as never },
});

describe('FieldFilter', () => {
  test('takes each of its four shapes', () => {
    expectTypeOf({ op: 'equals' }).toExtend<FieldFilter>();
    expectTypeOf({
      op: 'inLast',
      field: 'lastSeenAt',
      map: { '7 days': 7, '14 days': 14, all: null },
    }).toExtend<FieldFilter>();
    expectTypeOf({
      range: ['gte', 'lte'] as [string, string],
      field: 'day',
    }).toExtend<FieldFilter>();
    expectTypeOf({
      presets: [{ value: 'mine', label: 'Mine', filter: { field: 'assignee', op: 'isMe' } }],
    }).toExtend<FieldFilter>();
    expectTypeOf({ rules: true as const }).toExtend<FieldFilter>();
  });

  test('refuses a shape it has none of', () => {
    // @ts-expect-error: a condition names its operator under `op`
    const noOp: FieldFilter = { operator: 'equals' };
    // @ts-expect-error: a range has two operators
    const oneHalf: FieldFilter = { range: ['gte'] };
    // @ts-expect-error: `rules` is true or absent
    const notRules: FieldFilter = { rules: false };
    // @ts-expect-error: a preset's filter is a filter, not a string
    const preset: Preset = { value: 'mine', label: 'Mine', filter: 'assignee is me' };
    // @ts-expect-error: a map's operand is a scalar, a list of them, or null
    const map: FieldFilter = { op: 'equals', map: { yes: { deep: true } } };
    expect([noOp, oneHalf, notRules, preset, map]).toHaveLength(5);
  });

  test('is a key of every field, and the builder passes it through', () => {
    expectTypeOf<FieldNode<typeof registry.inputs>['filter']>().toEqualTypeOf<
      FieldFilter | undefined
    >();
    const form = defineForm(registry).build((b) => {
      return [
        b.text({ name: 'title', config: {}, filter: { op: 'contains' } }),
        b.select({ name: 'type', config: {} }),
      ];
    });
    expect(form.nodes[0]).toMatchObject({ name: 'title', filter: { op: 'contains' } });
    expect(form.nodes[1]).not.toHaveProperty('filter');
  });

  test('survives JSON.stringify and JSON.parse unchanged in a FormConfig', () => {
    const form = defineForm(registry).build((b) => {
      return [
        b.text({ name: 'search', config: {} }),
        b.chips({
          name: 'presets',
          config: {},
          filter: {
            presets: [
              { value: 'mine', label: 'Mine', filter: { field: 'assignee', op: 'isMe' } },
              {
                value: 'failed',
                label: 'Failed today',
                filter: {
                  all: [
                    { field: 'status', op: 'equals', value: 'failed' },
                    { field: 'finishedAt', op: 'inLast', value: 1 },
                  ],
                },
              },
            ],
          },
        }),
        b.chips({ name: 'status', config: {}, filter: { field: 'status.kind', op: 'in' } }),
        b.select({
          name: 'lastSeen',
          config: {},
          filter: { field: 'lastSeenAt', op: 'inLast', map: { '7 days': 7, all: null } },
        }),
        b.chips({ name: 'days', config: {}, filter: { field: 'day', range: ['gte', 'lte'] } }),
        b.chips({ name: 'rules', config: {}, filter: { rules: true } }),
      ];
    });
    expect(JSON.parse(JSON.stringify(form))).toEqual(form);
  });
});
