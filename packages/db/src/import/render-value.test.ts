// packages/db/src/import/render-value.test.ts
// Pure unit tests over verify-import.ts's rendering/grouping functions — no
// database. The real imported data (tickets_dev, 635 items) has 0 rows in
// value_number/value_date/value_bool/value_json and no multi-value (item,
// field) groups, so renderScalar's number/date/bool/json branches and
// groupByItem's sort-and-join branch never execute in the integration
// suite. The legacy schema has 3 target_date (date) and 5 labels
// (multi_select) placements, though — one value entered in the old app
// before cutover exercises these paths for the first time, at cutover,
// unverified, unless something asserts them ahead of time. That's what this
// file is for. See task-12-brief.md fix 4.
import { describe, expect, it } from 'vitest';
import { groupByItem, renderImported, renderLegacy, renderScalar } from './verify-import';

// Every field verify-import.ts's ::text-casts render to postgres's OWN
// canonical text form — that's what these fixtures use, not JS-native
// stringification, since that's what the real SQL rows will contain.
const emptyRow = {
  item_id: 1,
  field_key: 'x',
  value_text: null,
  value_number: null,
  value_date: null,
  value_bool: null,
  value_json: null,
};

describe('renderScalar', () => {
  it('renders value_text', () => {
    expect(renderScalar({ ...emptyRow, value_text: 'hello' })).toBe('hello');
  });

  it('renders value_number (postgres numeric ::text form)', () => {
    expect(renderScalar({ ...emptyRow, value_number: '3.50' })).toBe('3.50');
  });

  it('renders value_date (postgres date ::text form)', () => {
    expect(renderScalar({ ...emptyRow, value_date: '2026-07-14' })).toBe('2026-07-14');
  });

  it('renders value_bool (postgres boolean ::text form)', () => {
    expect(renderScalar({ ...emptyRow, value_bool: 'true' })).toBe('true');
    expect(renderScalar({ ...emptyRow, value_bool: 'false' })).toBe('false');
  });

  it('renders value_json (postgres jsonb ::text form)', () => {
    expect(renderScalar({ ...emptyRow, value_json: '{"a":1}' })).toBe('{"a":1}');
  });

  it('falls through in CHECK-constraint order and returns null when every column is null', () => {
    expect(renderScalar({ ...emptyRow })).toBeNull();
  });

  it('prefers value_text over every other populated column (iv_one_value guarantees only one is ever actually set)', () => {
    expect(
      renderScalar({
        item_id: 1, field_key: 'x',
        value_text: 'text', value_number: '1', value_date: '2026-01-01', value_bool: 'true', value_json: '{}',
      }),
    ).toBe('text');
  });
});

describe('renderLegacy / renderImported (option-shaped values)', () => {
  it('renderLegacy prefers status_key, then option_value, then a scalar', () => {
    expect(renderLegacy({ ...emptyRow, item_id: 1, field_key: 'status', option_value: 'ov', status_key: 'sk' })).toBe('sk');
    expect(renderLegacy({ ...emptyRow, item_id: 1, field_key: 'priority', option_value: 'ov', status_key: null })).toBe('ov');
    expect(renderLegacy({ ...emptyRow, item_id: 1, field_key: 'estimate', option_value: null, status_key: null, value_number: '5' })).toBe('5');
  });

  it('renderImported prefers option_value, then user_name, then a scalar', () => {
    expect(renderImported({ ...emptyRow, item_id: 1, field_key: 'status', option_value: 'ov', user_name: 'claude' })).toBe('ov');
    expect(renderImported({ ...emptyRow, item_id: 1, field_key: 'assignee', option_value: null, user_name: 'claude' })).toBe('claude');
    expect(renderImported({ ...emptyRow, item_id: 1, field_key: 'estimate', option_value: null, user_name: null, value_date: '2026-07-14' })).toBe('2026-07-14');
  });
});

describe('groupByItem', () => {
  it('groups a single-value field to its rendered string', () => {
    const states = groupByItem([{ item_id: 1, field_key: 'title', rendered: 'Fix the thing' }]);
    expect(states.get(1)?.get('title')).toBe('Fix the thing');
  });

  it('sorts and comma-joins a multi-value field, independent of input row order (labels/multi_select)', () => {
    const inOrder = groupByItem([
      { item_id: 1, field_key: 'labels', rendered: 'urgent' },
      { item_id: 1, field_key: 'labels', rendered: 'backend' },
      { item_id: 1, field_key: 'labels', rendered: 'design' },
    ]);
    const reversed = groupByItem([
      { item_id: 1, field_key: 'labels', rendered: 'design' },
      { item_id: 1, field_key: 'labels', rendered: 'backend' },
      { item_id: 1, field_key: 'labels', rendered: 'urgent' },
    ]);
    expect(inOrder.get(1)?.get('labels')).toBe('backend,design,urgent');
    expect(reversed.get(1)?.get('labels')).toBe('backend,design,urgent');
  });

  it('renders a field with only null-valued rows as null, not an empty string', () => {
    const states = groupByItem([{ item_id: 1, field_key: 'target_date', rendered: null }]);
    expect(states.get(1)?.get('target_date')).toBeNull();
  });

  it('keeps different items and different fields separate', () => {
    const states = groupByItem([
      { item_id: 1, field_key: 'title', rendered: 'Item one' },
      { item_id: 2, field_key: 'title', rendered: 'Item two' },
      { item_id: 1, field_key: 'status', rendered: 'todo' },
    ]);
    expect(states.get(1)?.get('title')).toBe('Item one');
    expect(states.get(1)?.get('status')).toBe('todo');
    expect(states.get(2)?.get('title')).toBe('Item two');
    expect(states.get(2)?.has('status')).toBe(false);
  });
});
