import { describe, expect, test } from 'vitest';
import type { Filter } from '@bh/resource';
import type { FieldFilter } from '../types/field-filter';
import type { FieldNode } from '../types/field-node';
import type { LayoutNode } from '../types/layout-node';
import type { InputRegistry, LayoutComponentRegistry } from '../types/registry';
import { type FilterQuery, foldFilter } from './fold';
import { spreadFilter } from './spread';
import * as apps from './apps.fixture';

type Node = LayoutNode<InputRegistry, LayoutComponentRegistry>;

/** Each kind's empty value, as @bh/ui's inputs start. */
const EMPTY: Record<string, unknown> = {
  search: '',
  text: '',
  select: null,
  segmented: '',
  tabs: '',
  'toggle-chips': [],
  rules: [],
  number: null,
  user: [],
  checkbox: false,
  'date-range': [null, null],
};
const emptyOf = (field: FieldNode<InputRegistry>) => EMPTY[field.type];

function field(name: string, filter?: FieldFilter, type = 'select'): Node {
  return { kind: 'field', name, type, config: {}, ...(filter ? { filter } : {}) };
}

/** A filter's entries in one order, to compare two up to it. */
function sorted(filter: Filter): string[] {
  return ('all' in filter ? filter.all : [filter]).map((each) => JSON.stringify(each)).sort();
}

/** Spreads a value and folds it back, rest and all, as FilterForm does. */
function roundTrip(nodes: readonly Node[], value: FilterQuery): FilterQuery {
  const { values, rest } = spreadFilter(nodes, value, { emptyOf });
  const folded = foldFilter(nodes, values);
  return {
    ...folded,
    filter: { all: [...('all' in folded.filter ? folded.filter.all : []), ...rest] },
  };
}

describe('spreadFilter', () => {
  describe('{ op }', () => {
    test('takes the value of the condition with its field and operator', () => {
      const nodes = [field('status', { field: 'status.kind', op: 'in' }, 'toggle-chips')];
      const value = { filter: { all: [{ field: 'status.kind', op: 'in', value: ['active'] }] } };
      expect(spreadFilter(nodes, value).values).toEqual({ status: ['active'] });
    });

    test('leaves a condition of another operator alone', () => {
      const nodes = [field('type', { op: 'equals' })];
      const value = { filter: { all: [{ field: 'type', op: 'notEquals', value: 'bug' }] } };
      expect(spreadFilter(nodes, value, { emptyOf })).toEqual({
        values: { type: null },
        rest: [{ field: 'type', op: 'notEquals', value: 'bug' }],
      });
    });

    test('takes its value through map reversed, a key true or false as a boolean', () => {
      expect(
        spreadFilter(apps.signals.nodes, {
          filter: { all: [{ field: 'lastSeenAt', op: 'inLast', value: 14 }] },
        }).values.lastSeen,
      ).toBe('14 days');
      expect(
        spreadFilter(apps.cv.nodes, {
          filter: { all: [{ field: 'archived', op: 'equals', value: false }] },
        }).values.archived,
      ).toBe(false);
    });

    test('holds its map’s key for no condition when the value sets nothing of it', () => {
      expect(spreadFilter(apps.cv.nodes, { filter: { all: [] } }).values.archived).toBe(true);
    });

    test('can’t hold an operand its map has no key for, which goes to the rules', () => {
      const value = { filter: { all: [{ field: 'startedAt', op: 'inLast', value: 3 }] } };
      const { values } = spreadFilter(apps.itemsCore.nodes, value, { emptyOf });
      expect(values.started).toBe('');
      expect(values.rules).toEqual([{ field: 'startedAt', op: 'inLast', value: 3 }]);
    });

    test('is on, true, for a condition whose operator takes no operand', () => {
      const nodes = [field('unassigned', { field: 'assignee', op: 'empty' }, 'checkbox')];
      const value = { filter: { all: [{ field: 'assignee', op: 'empty' }] } };
      expect(spreadFilter(nodes, value).values).toEqual({ unassigned: true });
    });
  });

  test('{ range } takes either half', () => {
    const nodes = apps.walletAnalytics.nodes;
    expect(
      spreadFilter(nodes, { filter: { all: [{ field: 'day', op: 'lte', value: '2026-09-30' }] } })
        .values,
    ).toEqual({ days: [null, '2026-09-30'] });
    expect(
      spreadFilter(
        nodes,
        {
          filter: {
            all: [
              { field: 'day', op: 'gte', value: '2026-09-01' },
              { field: 'day', op: 'lte', value: '2026-09-30' },
            ],
          },
        },
        { emptyOf },
      ).values,
    ).toEqual({ days: ['2026-09-01', '2026-09-30'] });
    expect(spreadFilter(nodes, { filter: { all: [] } }, { emptyOf }).values).toEqual({
      days: [null, null],
    });
  });

  describe('{ presets }', () => {
    test('turns on each preset all of whose conditions the value holds', () => {
      const value = {
        filter: {
          all: [
            { field: 'status', op: 'equals', value: 'failed' },
            { field: 'finishedAt', op: 'inLast', value: 1 },
          ],
        },
      };
      expect(spreadFilter(apps.itemsCore.nodes, value, { emptyOf }).values).toMatchObject({
        presets: ['failed'],
        rules: [],
      });
      const half = { filter: { all: [{ field: 'status', op: 'equals', value: 'failed' }] } };
      expect(spreadFilter(apps.itemsCore.nodes, half, { emptyOf }).values).toMatchObject({
        presets: [],
        rules: [{ field: 'status', op: 'equals', value: 'failed' }],
      });
    });

    test('holding one preset, takes the one with the most conditions', () => {
      const value = {
        filter: {
          all: [
            { field: 'watchedAt', op: 'notEmpty' },
            { field: 'watchedAt', op: 'notInLast', value: 30 },
          ],
        },
      };
      expect(spreadFilter(apps.medialib.nodes, value, { emptyOf }).values).toEqual({
        show: 'long-ago',
        days: 30,
        who: [],
      });
      expect(
        spreadFilter(apps.medialib.nodes, { filter: { all: [] } }, { emptyOf }).values,
      ).toEqual({
        show: 'all',
        days: null,
        who: [],
      });
    });

    test('a field a when of its value shows sets it, so what it took is seen', () => {
      const value = { filter: { all: [{ field: 'watchedBy', op: 'in', value: ['7'] }] } };
      expect(spreadFilter(apps.medialib.nodes, value, { emptyOf }).values).toEqual({
        show: 'by-person',
        days: null,
        who: ['7'],
      });
    });
  });

  test('shows a condition in every field it matches', () => {
    const nodes = [
      field(
        'presets',
        {
          presets: [
            {
              value: 'blocked',
              label: 'Blocked',
              filter: { field: 'status', op: 'in', value: ['blocked'] },
            },
          ],
        },
        'toggle-chips',
      ),
      field('status', { op: 'in' }, 'toggle-chips'),
      field('rules', { rules: true }, 'rules'),
    ];
    const value = { filter: { all: [{ field: 'status', op: 'in', value: ['blocked'] }] } };
    expect(spreadFilter(nodes, value, { emptyOf }).values).toEqual({
      presets: ['blocked'],
      status: ['blocked'],
      rules: [],
    });
  });

  test('puts a condition nothing takes and every group in the rules field', () => {
    const value = {
      filter: {
        all: [
          { field: 'priority', op: 'in', value: ['high'] },
          {
            any: [
              { field: 'assignee', op: 'isMe' },
              { field: 'assignee', op: 'empty' },
            ],
          },
          { not: { field: 'status.kind', op: 'equals', value: 'done' } },
        ],
      },
    };
    const { values, rest } = spreadFilter(apps.anatomy.nodes, value, { emptyOf });
    expect(values.rules).toEqual(value.filter.all);
    expect(rest).toEqual([]);
  });

  test('puts them in rest without a rules field', () => {
    const group = { any: [{ field: 'a', op: 'empty' }] };
    expect(
      spreadFilter(apps.sessions.nodes, { filter: { all: [group] } }, { emptyOf }).rest,
    ).toEqual([group]);
  });

  test('puts a value that isn’t an all in rest', () => {
    const lone = { field: 'project', op: 'equals', value: 'bh' };
    expect(spreadFilter(apps.sessions.nodes, { filter: lone }, { emptyOf })).toEqual({
      values: { project: null, title: '' },
      rest: [lone],
    });
  });

  test('gives the field named search the value’s search', () => {
    expect(spreadFilter(apps.tickets.nodes, { search: 'login' }).values).toEqual({
      search: 'login',
      rules: [],
    });
    expect(spreadFilter(apps.tickets.nodes, {}).values.search).toBe('');
  });

  test('leaves out a field the value sets nothing of, without emptyOf', () => {
    expect(spreadFilter(apps.sessions.nodes, { filter: { all: [] } }).values).toEqual({});
  });

  describe('folding back what it spread gives the value, up to order', () => {
    const cases: [string, readonly Node[], FilterQuery][] = [
      [
        'the anatomy board',
        apps.anatomy.nodes,
        {
          search: 'login',
          filter: {
            all: [
              { field: 'assignee', op: 'isMe' },
              { field: 'status.kind', op: 'in', value: ['active', 'blocked'] },
              { field: 'priority', op: 'in', value: ['high', 'urgent'] },
              { field: 'due', op: 'lt', value: '2026-10-31' },
            ],
          },
        },
      ],
      [
        'tickets, holding a group',
        apps.tickets.nodes,
        {
          filter: {
            all: [
              { field: 'status.kind', op: 'in', value: ['active'] },
              {
                any: [
                  { field: 'assignee', op: 'isMe' },
                  { field: 'assignee', op: 'empty' },
                ],
              },
            ],
          },
        },
      ],
      [
        'items-core',
        apps.itemsCore.nodes,
        {
          search: 'example.com',
          filter: {
            all: [
              { field: 'status', op: 'equals', value: 'failed' },
              { field: 'finishedAt', op: 'inLast', value: 1 },
              { field: 'site', op: 'equals', value: 'docs' },
              { field: 'startedAt', op: 'inLast', value: 7 },
              { field: 'url', op: 'contains', value: '/blog' },
            ],
          },
        },
      ],
      [
        'signals',
        apps.signals.nodes,
        {
          search: 'timeout',
          filter: {
            all: [
              { field: 'app', op: 'equals', value: 'gateway' },
              { field: 'lastSeenAt', op: 'inLast', value: 14 },
              { field: 'status', op: 'equals', value: 'open' },
            ],
          },
        },
      ],
      [
        'medialib',
        apps.medialib.nodes,
        {
          filter: {
            all: [
              { field: 'watchedAt', op: 'notEmpty' },
              { field: 'watchedAt', op: 'notInLast', value: 30 },
            ],
          },
        },
      ],
      [
        'medialib by person',
        apps.medialib.nodes,
        { filter: { all: [{ field: 'watchedBy', op: 'in', value: ['7', '9'] }] } },
      ],
      [
        'cv',
        apps.cv.nodes,
        { search: 'rust', filter: { all: [{ field: 'archived', op: 'equals', value: false }] } },
      ],
      [
        'wallet-passes customers, holding a group',
        apps.walletCustomers.nodes,
        {
          filter: {
            all: [
              { field: 'program', op: 'equals', value: 'gold' },
              { not: { field: 'status', op: 'equals', value: 'lapsed' } },
            ],
          },
        },
      ],
      [
        'wallet-passes analytics',
        apps.walletAnalytics.nodes,
        {
          filter: {
            all: [
              { field: 'day', op: 'gte', value: '2026-09-01' },
              { field: 'day', op: 'lte', value: '2026-09-30' },
            ],
          },
        },
      ],
      [
        'session-board',
        apps.sessions.nodes,
        {
          filter: {
            all: [
              { field: 'project', op: 'equals', value: 'bh' },
              { field: 'title', op: 'contains', value: 'filter' },
            ],
          },
        },
      ],
    ];

    test.each(cases)('%s', (_, nodes, value) => {
      const back = roundTrip(nodes, value);
      expect(back.search).toBe(value.search);
      expect(sorted(back.filter)).toEqual(sorted(value.filter));
    });
  });
});
