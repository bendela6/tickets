import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { entriesOf, layoutData } from './layout-registry';

describe('a layout spec', () => {
  it('is checked: an options schema, and a repeats function', () => {
    const options = v.strictObject({});
    expect(v.is(layoutData, { options })).toBe(true);
    expect(v.is(layoutData, { options, repeats: () => ({ field: 'labels' }) })).toBe(true);
    expect(v.is(layoutData, {})).toBe(false);
    expect(v.is(layoutData, { options, repeats: 'labels' })).toBe(false);
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
