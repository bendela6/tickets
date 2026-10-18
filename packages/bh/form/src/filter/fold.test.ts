import { describe, expect, test } from 'vitest';
import { baseOperators } from '@bh/resource';
import type { FieldFilter } from '../types/field-filter';
import type { LayoutNode } from '../types/layout-node';
import type { InputRegistry, LayoutComponentRegistry } from '../types/registry';
import { foldFilter } from './fold';
import {
  anatomy,
  cv,
  itemsCore,
  medialib,
  sessions,
  signals,
  tickets,
  walletAnalytics,
  walletCustomers,
} from './apps.fixture';

type Node = LayoutNode<InputRegistry, LayoutComponentRegistry>;

/** A field of any type holding this part of the filter. */
function field(name: string, filter?: FieldFilter): Node {
  return { kind: 'field', name, type: 'any', config: {}, ...(filter ? { filter } : {}) };
}

describe('foldFilter', () => {
  test('makes the field named search the query’s search, left out when empty', () => {
    const nodes = [field('search')];
    expect(foldFilter(nodes, { search: 'login' })).toEqual({
      search: 'login',
      filter: { all: [] },
    });
    expect(foldFilter(nodes, { search: '' })).toEqual({ filter: { all: [] } });
  });

  describe('{ op }', () => {
    test('writes the value as the operand, the field’s own name its field', () => {
      expect(foldFilter([field('type', { op: 'equals' })], { type: 'bug' })).toEqual({
        filter: { all: [{ field: 'type', op: 'equals', value: 'bug' }] },
      });
    });

    test('writes the field or path its filter names', () => {
      const nodes = [field('status', { field: 'status.kind', op: 'in' })];
      expect(foldFilter(nodes, { status: ['active', 'blocked'] }).filter).toEqual({
        all: [{ field: 'status.kind', op: 'in', value: ['active', 'blocked'] }],
      });
    });

    test.each([[''], [null], [[]], [false], [undefined]])(
      'writes nothing for the empty value %j',
      (value) => {
        expect(foldFilter([field('type', { op: 'equals' })], { type: value }).filter).toEqual({
          all: [],
        });
      },
    );

    test('turns the value into the operand through map, and null into no condition', () => {
      const nodes = [
        field('lastSeen', { field: 'lastSeenAt', op: 'inLast', map: { '7 days': 7, any: null } }),
      ];
      expect(foldFilter(nodes, { lastSeen: '7 days' }).filter).toEqual({
        all: [{ field: 'lastSeenAt', op: 'inLast', value: 7 }],
      });
      expect(foldFilter(nodes, { lastSeen: 'any' }).filter).toEqual({ all: [] });
    });

    test('maps a value its map names before asking whether it’s empty', () => {
      const nodes = [field('archived', { op: 'equals', map: { false: false, true: null } })];
      expect(foldFilter(nodes, { archived: false }).filter).toEqual({
        all: [{ field: 'archived', op: 'equals', value: false }],
      });
      expect(foldFilter(nodes, { archived: true }).filter).toEqual({ all: [] });
    });

    test('maps each of a list’s values', () => {
      const nodes = [field('size', { op: 'in', map: { small: [1, 2], large: 3, none: null } })];
      expect(foldFilter(nodes, { size: ['small', 'large', 'none'] }).filter).toEqual({
        all: [{ field: 'size', op: 'in', value: [1, 2, 3] }],
      });
      expect(foldFilter(nodes, { size: ['none'] }).filter).toEqual({ all: [] });
    });

    test('writes an operator that takes no operand without a value, while the value isn’t empty', () => {
      const nodes = [field('unassigned', { field: 'assignee', op: 'empty' })];
      expect(foldFilter(nodes, { unassigned: true }).filter).toEqual({
        all: [{ field: 'assignee', op: 'empty' }],
      });
      expect(foldFilter(nodes, { unassigned: false }).filter).toEqual({ all: [] });
    });

    test('reads which operators take no operand from the registry it’s given', () => {
      const operators = baseOperators.register({
        flagged: { name: 'flagged', label: 'is flagged', matches: () => true },
      });
      const nodes = [field('flag', { op: 'flagged' })];
      expect(foldFilter(nodes, { flag: true }, { operators }).filter).toEqual({
        all: [{ field: 'flag', op: 'flagged' }],
      });
    });
  });

  test('{ range } writes a condition for each half that’s set', () => {
    const nodes = [field('days', { field: 'day', range: ['gte', 'lte'] })];
    expect(foldFilter(nodes, { days: ['2026-09-01', '2026-09-30'] }).filter).toEqual({
      all: [
        { field: 'day', op: 'gte', value: '2026-09-01' },
        { field: 'day', op: 'lte', value: '2026-09-30' },
      ],
    });
    expect(foldFilter(nodes, { days: [null, '2026-09-30'] }).filter).toEqual({
      all: [{ field: 'day', op: 'lte', value: '2026-09-30' }],
    });
    expect(foldFilter(nodes, { days: [null, null] }).filter).toEqual({ all: [] });
  });

  describe('{ presets }', () => {
    const presets: FieldFilter = {
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
        {
          value: 'either',
          label: 'Either',
          filter: { any: [{ field: 'a', op: 'empty' }] },
        },
      ],
    };

    test('writes each preset that’s on, an all spread into the list', () => {
      expect(foldFilter([field('p', presets)], { p: ['failed', 'mine'] }).filter).toEqual({
        all: [
          { field: 'assignee', op: 'isMe' },
          { field: 'status', op: 'equals', value: 'failed' },
          { field: 'finishedAt', op: 'inLast', value: 1 },
        ],
      });
    });

    test('writes a group as one entry', () => {
      expect(foldFilter([field('p', presets)], { p: ['either'] }).filter).toEqual({
        all: [{ any: [{ field: 'a', op: 'empty' }] }],
      });
    });

    test('takes one preset as a single value, as a segmented holds it', () => {
      expect(foldFilter([field('p', presets)], { p: 'mine' }).filter).toEqual({
        all: [{ field: 'assignee', op: 'isMe' }],
      });
      expect(foldFilter([field('p', presets)], { p: '' }).filter).toEqual({ all: [] });
    });
  });

  test('{ rules } writes each entry as it is', () => {
    const rules = [
      { field: 'priority', op: 'in', value: ['high'] },
      { any: [{ field: 'assignee', op: 'isMe' }] },
    ];
    expect(foldFilter([field('rules', { rules: true })], { rules }).filter).toEqual({
      all: rules,
    });
  });

  test('writes the same condition once', () => {
    const nodes = [
      field('presets', {
        presets: [
          { value: 'blocked', label: 'Blocked', filter: { field: 's', op: 'equals', value: 'b' } },
        ],
      }),
      field('s', { op: 'equals' }),
      field('rules', { rules: true }),
    ];
    expect(
      foldFilter(nodes, {
        presets: ['blocked'],
        s: 'b',
        rules: [{ field: 's', op: 'equals', value: 'b' }],
      }).filter,
    ).toEqual({ all: [{ field: 's', op: 'equals', value: 'b' }] });
  });

  test('folds only the values it’s given, so a hidden field writes nothing', () => {
    expect(foldFilter(medialib.nodes, { show: 'unwatched' }).filter).toEqual({
      all: [{ field: 'watchedAt', op: 'empty' }],
    });
  });

  test('looks inside layouts for the fields', () => {
    const nodes: Node[] = [
      { kind: 'inline', props: {}, children: [field('type', { op: 'equals' })] },
    ];
    expect(foldFilter(nodes, { type: 'bug' }).filter).toEqual({
      all: [{ field: 'type', op: 'equals', value: 'bug' }],
    });
  });

  describe("the design's configs", () => {
    test('the anatomy board', () => {
      expect(
        foldFilter(anatomy.nodes, {
          search: 'login',
          presets: ['mine'],
          status: ['active', 'blocked'],
          type: null,
          rules: [
            { field: 'priority', op: 'in', value: ['high', 'urgent'] },
            { field: 'due', op: 'lt', value: '2026-10-31' },
          ],
        }),
      ).toEqual({
        search: 'login',
        filter: {
          all: [
            { field: 'assignee', op: 'isMe' },
            { field: 'status.kind', op: 'in', value: ['active', 'blocked'] },
            { field: 'priority', op: 'in', value: ['high', 'urgent'] },
            { field: 'due', op: 'lt', value: '2026-10-31' },
          ],
        },
      });
    });

    test('tickets', () => {
      expect(
        foldFilter(tickets.nodes, {
          search: '',
          rules: [{ field: 'project', op: 'equals', value: 'TIX' }],
        }),
      ).toEqual({ filter: { all: [{ field: 'project', op: 'equals', value: 'TIX' }] } });
    });

    test('items-core', () => {
      expect(
        foldFilter(itemsCore.nodes, {
          search: 'example.com',
          presets: ['failed'],
          site: 'docs',
          started: '7d',
          rules: [],
        }),
      ).toEqual({
        search: 'example.com',
        filter: {
          all: [
            { field: 'status', op: 'equals', value: 'failed' },
            { field: 'finishedAt', op: 'inLast', value: 1 },
            { field: 'site', op: 'equals', value: 'docs' },
            { field: 'startedAt', op: 'inLast', value: 7 },
          ],
        },
      });
      expect(foldFilter(itemsCore.nodes, { started: '' }).filter).toEqual({ all: [] });
    });

    test('signals', () => {
      expect(
        foldFilter(signals.nodes, {
          app: 'gateway',
          kind: null,
          level: 'error',
          lastSeen: '14 days',
          search: 'timeout',
          status: 'open',
        }),
      ).toEqual({
        search: 'timeout',
        filter: {
          all: [
            { field: 'app', op: 'equals', value: 'gateway' },
            { field: 'level', op: 'equals', value: 'error' },
            { field: 'lastSeenAt', op: 'inLast', value: 14 },
            { field: 'status', op: 'equals', value: 'open' },
          ],
        },
      });
    });

    test('medialib', () => {
      expect(foldFilter(medialib.nodes, { show: 'all' }).filter).toEqual({ all: [] });
      expect(foldFilter(medialib.nodes, { show: 'long-ago', days: 30 }).filter).toEqual({
        all: [
          { field: 'watchedAt', op: 'notEmpty' },
          { field: 'watchedAt', op: 'notInLast', value: 30 },
        ],
      });
      expect(foldFilter(medialib.nodes, { show: 'by-person', who: ['7'] }).filter).toEqual({
        all: [{ field: 'watchedBy', op: 'in', value: ['7'] }],
      });
    });

    test('cv', () => {
      expect(foldFilter(cv.nodes, { search: '', archived: false })).toEqual({
        filter: { all: [{ field: 'archived', op: 'equals', value: false }] },
      });
      expect(foldFilter(cv.nodes, { search: 'rust', archived: true })).toEqual({
        search: 'rust',
        filter: { all: [] },
      });
    });

    test('wallet-passes', () => {
      expect(
        foldFilter(walletCustomers.nodes, { search: '', program: 'gold', status: null }).filter,
      ).toEqual({ all: [{ field: 'program', op: 'equals', value: 'gold' }] });
      expect(
        foldFilter(walletAnalytics.nodes, { days: ['2026-09-01', '2026-09-30'] }).filter,
      ).toEqual({
        all: [
          { field: 'day', op: 'gte', value: '2026-09-01' },
          { field: 'day', op: 'lte', value: '2026-09-30' },
        ],
      });
    });

    test('session-board', () => {
      expect(foldFilter(sessions.nodes, { project: 'bh', title: 'filter' }).filter).toEqual({
        all: [
          { field: 'project', op: 'equals', value: 'bh' },
          { field: 'title', op: 'contains', value: 'filter' },
        ],
      });
    });
  });
});
