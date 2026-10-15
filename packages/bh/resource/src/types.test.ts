import * as v from 'valibot';
import { describe, expect, expectTypeOf, it } from 'vitest';
import type { Sort } from './query';
import { createKindRegistry } from './registry';
import type { ResourceMeta } from './meta';
import type { OptionMeta } from './schemas';
import type { BaseKind, FieldMeta, KindValue, Operator, OperatorSpec } from './types';
import type { FieldValue, Json, Row } from './values';

// tickets' items, as their metadata reads: a templated title, a status whose
// options carry their group, an assignee that is a ref of users, labels.
const items: ResourceMeta = {
  resource: 'items',
  label: { one: 'Item', other: 'Items' },
  roles: { idField: 'id', titleField: 'name', versionField: 'updatedAt' },
  fields: [
    {
      key: 'id',
      label: 'ID',
      type: { kind: 'number' },
      query: { filter: ['equals', 'in'], sort: true, group: false, search: false },
      write: { create: false, update: false, required: false },
    },
    {
      key: 'name',
      label: 'Name',
      type: { kind: 'text' },
      template: '{project}-{number} {title}',
      query: { filter: ['contains'], sort: true, group: false, search: true },
      write: { create: false, update: false, required: false },
    },
    {
      key: 'status',
      label: 'Status',
      type: {
        kind: 'option',
        settings: {
          options: [
            {
              value: 'todo',
              label: 'To do',
              color: 'gray',
              order: 0,
              attributes: { kind: 'todo' },
            },
            {
              value: 'done',
              label: 'Done',
              color: 'success',
              order: 1,
              attributes: { kind: 'done' },
            },
          ],
          attributes: [
            {
              key: 'kind',
              label: 'Group',
              kind: 'option',
              options: [
                { value: 'todo', label: 'To do', order: 0 },
                { value: 'done', label: 'Done', order: 1 },
              ],
            },
          ],
        },
      },
      query: { filter: ['in', 'notIn', 'empty'], sort: true, group: true, search: false },
      write: { create: true, update: true, required: true, default: 'todo' },
    },
    {
      key: 'assignee',
      label: 'Assignee',
      type: { kind: 'ref', settings: { of: 'users' } },
      query: { filter: ['equals', 'empty'], sort: true, group: true, search: false },
      write: { create: true, update: true, required: false },
    },
    {
      key: 'labels',
      label: 'Labels',
      type: { kind: 'text', many: true },
      query: { filter: ['in'], sort: false, group: false, search: false },
      write: { create: true, update: true, required: false, default: [] },
    },
    {
      key: 'estimate',
      label: 'Estimate',
      type: { kind: 'number' },
      format: { name: 'duration', options: { unit: 'hours' } },
      query: { filter: ['lt', 'gt'], sort: true, group: false, search: false },
      write: { create: true, update: true, required: false },
    },
    {
      key: 'updatedAt',
      label: 'Updated',
      type: { kind: 'datetime' },
      query: { filter: ['gte', 'lt'], sort: true, group: false, search: false },
      write: { create: false, update: false, required: false },
    },
  ],
  sort: [{ field: 'updatedAt', dir: 'desc' }],
  serves: {
    read: true,
    create: true,
    update: true,
    delete: true,
    filter: { any: true, not: true },
    sort: { max: 10 },
    page: { numbered: 'any', cursor: true, total: true, max: 500 },
  },
  actions: [],
};

describe('the metadata’s shapes', () => {
  it('name operators, kinds and formats by registered names', () => {
    expectTypeOf<Operator>().toEqualTypeOf<string>();
    expectTypeOf<OperatorSpec['name']>().toEqualTypeOf<string>();
    expectTypeOf<BaseKind>().toEqualTypeOf<keyof KindValue>();
    expectTypeOf<FieldMeta['type']['kind']>().toEqualTypeOf<string>();
    expectTypeOf<Row>().toEqualTypeOf<Record<string, FieldValue>>();
  });

  it('check a field’s settings, operators and default by its kind', () => {
    const kinds = createKindRegistry();
    for (const field of items.fields) {
      const kind = kinds.get(field.type.kind);
      expect(kind, field.key).toBeDefined();
      expect(kind?.operators, field.key).toEqual(expect.arrayContaining(field.query.filter));
      if (kind?.settings) {
        expect(v.is(kind.settings, field.type.settings), field.key).toBe(true);
      }
      const { default: value } = field.write;
      if (value !== undefined && !field.type.many) {
        expect(v.is(kind?.value(field.type.settings) ?? v.never(), value), field.key).toBe(true);
      }
    }
  });

  it('give the resource its own order, by fields that sort', () => {
    expectTypeOf<ResourceMeta['sort']>().toEqualTypeOf<Sort[]>();
    for (const { field } of items.sort) {
      expect(items.fields.find((each) => each.key === field)?.query.sort, field).toBe(true);
    }
    // @ts-expect-error the metadata always says its order
    const unsorted: ResourceMeta = { ...items, sort: undefined };
    expect(unsorted).toBeDefined();
  });

  it('keep a field’s keys in their groups', () => {
    const field: FieldMeta = {
      key: 'status',
      label: 'Status',
      type: { kind: 'option', settings: { options: [] } },
      query: { filter: [], sort: false, group: false, search: false },
      // @ts-expect-error a field's default sits in `write`
      default: 'todo',
      write: { create: true, update: true, required: false },
    };
    // @ts-expect-error a field holds a list or says nothing: `many` is true or absent
    const single: FieldMeta['type'] = { kind: 'text', many: false };
    // @ts-expect-error an option's color is spelled color
    const colour: OptionMeta = { value: 'todo', label: 'To do', colour: 'gray', order: 0 };
    // @ts-expect-error the roles name fields by keys that end in Field
    const roles: ResourceMeta['roles'] = { idField: 'id', title: 'name' };
    expect([field, single, colour, roles]).toHaveLength(4);
  });

  it('let settings and a json value be any JSON', () => {
    const json: Json = { nested: [1, 'two', { three: true }], none: null };
    expectTypeOf(json).toExtend<FieldValue>();
    // @ts-expect-error a date object is no JSON: a date is its YYYY-MM-DD text
    const notJson: Json = new Date();
    expect(notJson).toBeDefined();
  });
});
