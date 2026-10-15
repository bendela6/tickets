import { describe, expect, test } from 'vitest';
import type { FieldFilter } from '../types/field-filter';
import type { FieldNode } from '../types/field-node';
import type { LayoutNode } from '../types/layout-node';
import type { InputRegistry, LayoutComponentRegistry } from '../types/registry';
import { dropShared } from './shared';
import * as apps from './apps.fixture';

type Node = LayoutNode<InputRegistry, LayoutComponentRegistry>;

const EMPTY: Record<string, unknown> = {
  'toggle-chips': [],
  select: null,
  segmented: '',
  rules: [],
  'date-range': [null, null],
};
const emptyOf = (field: FieldNode<InputRegistry>) => EMPTY[field.type];

function field(name: string, type: string, filter: FieldFilter): Node {
  return { kind: 'field', name, type, config: {}, filter };
}

const blocked = { field: 'status.kind', op: 'in', value: ['blocked'] };
const mine = { field: 'assignee', op: 'isMe' };

// The design's case: a "Blocked" preset beside the status chips and the rules.
const nodes = [
  field('presets', 'toggle-chips', {
    presets: [
      { value: 'blocked', label: 'Blocked', filter: blocked },
      { value: 'mine', label: 'Mine', filter: mine },
      { value: 'mine-blocked', label: 'Mine, blocked', filter: { all: [mine, blocked] } },
    ],
  }),
  field('status', 'toggle-chips', { field: 'status.kind', op: 'in' }),
  field('type', 'select', { op: 'equals' }),
  field('rules', 'rules', { rules: true }),
];

describe('dropShared', () => {
  test('unpicking Blocked in the status chips turns the Blocked preset off', () => {
    const values = { presets: ['blocked', 'mine'], status: [], type: null, rules: [] };
    const next = dropShared(
      nodes,
      values,
      { field: 'status', value: [], previous: ['blocked'] },
      { emptyOf },
    );
    expect(next).toEqual({ presets: ['mine'], status: [], type: null, rules: [] });
  });

  test('turning a preset off empties the quick field holding its condition', () => {
    const values = { presets: [], status: ['blocked'], type: null, rules: [] };
    const next = dropShared(
      nodes,
      values,
      { field: 'presets', value: [], previous: ['blocked'] },
      { emptyOf },
    );
    expect(next).toEqual({ presets: [], status: [], type: null, rules: [] });
  });

  test('a quick field and a rule: removing either removes the other', () => {
    const rule = { field: 'type', op: 'equals', value: 'bug' };
    const fromRules = dropShared(
      nodes,
      { presets: [], status: [], type: 'bug', rules: [] },
      { field: 'rules', value: [], previous: [rule] },
      { emptyOf },
    );
    expect(fromRules.type).toBeNull();
    const fromQuick = dropShared(
      nodes,
      { presets: [], status: [], type: null, rules: [rule, mine] },
      { field: 'type', value: null, previous: 'bug' },
      { emptyOf },
    );
    expect(fromQuick.rules).toEqual([mine]);
  });

  test('two presets sharing a condition: turning one off turns the other off', () => {
    const values = { presets: ['mine-blocked'], status: [], type: null, rules: [] };
    const next = dropShared(
      nodes,
      values,
      { field: 'presets', value: ['mine-blocked'], previous: ['mine', 'mine-blocked'] },
      { emptyOf },
    );
    expect(next.presets).toEqual([]);
  });

  test('turning off a preset that shares nothing leaves the others on', () => {
    const values = { presets: ['mine'], status: [], type: null, rules: [] };
    const next = dropShared(
      nodes,
      values,
      { field: 'presets', value: ['mine'], previous: ['blocked', 'mine'] },
      { emptyOf },
    );
    expect(next).toBe(values);
  });

  test('a field dropping a condition another preset holds turns that preset off', () => {
    const values = { presets: ['mine-blocked'], status: ['blocked'], type: null, rules: [] };
    const next = dropShared(
      nodes,
      values,
      { field: 'status', value: [], previous: ['blocked'] },
      { emptyOf },
    );
    expect(next.presets).toEqual([]);
  });

  test('picking a second status lets the preset of the first go', () => {
    const values = { presets: ['blocked'], status: ['blocked', 'active'], type: null, rules: [] };
    const next = dropShared(
      nodes,
      values,
      { field: 'status', value: ['blocked', 'active'], previous: ['blocked'] },
      { emptyOf },
    );
    expect(next.presets).toEqual([]);
  });

  test('changes nothing, and hands back the same values, when nothing was dropped', () => {
    const values = { presets: ['blocked'], status: ['blocked'], type: null, rules: [] };
    expect(
      dropShared(nodes, values, { field: 'type', value: 'bug', previous: null }, { emptyOf }),
    ).toBe(values);
  });

  test('a field holding one preset goes to the one that sets nothing', () => {
    const values = { show: 'long-ago', days: 30, who: [] };
    const next = dropShared(
      [...apps.medialib.nodes, field('rules', 'rules', { rules: true })],
      { ...values, rules: [{ field: 'watchedAt', op: 'notEmpty' }] },
      { field: 'rules', value: [], previous: [{ field: 'watchedAt', op: 'notEmpty' }] },
      { emptyOf },
    );
    expect(next.show).toBe('all');
  });

  test('a field with a map takes its key for no condition', () => {
    const rule = { field: 'archived', op: 'equals', value: false };
    const next = dropShared(
      [...apps.cv.nodes, field('rules', 'rules', { rules: true })],
      { search: '', archived: false, rules: [rule] },
      { field: 'rules', value: [], previous: [rule] },
    );
    expect(next.archived).toBe(true);
  });

  test('a range lets go of the half it shared', () => {
    const rule = { field: 'day', op: 'lte', value: '2026-09-30' };
    const next = dropShared(
      [...apps.walletAnalytics.nodes, field('rules', 'rules', { rules: true })],
      { days: ['2026-09-01', '2026-09-30'], rules: [rule] },
      { field: 'rules', value: [], previous: [rule] },
      { emptyOf },
    );
    expect(next.days).toEqual(['2026-09-01', null]);
  });
});
