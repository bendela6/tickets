import {
  createKindRegistry,
  createOperatorRegistry,
  type FieldMeta,
  type ResourceMeta,
} from '@bh/resource';

// A made-up resource for the filter form's tests: tasks, with a field of each
// family a filter form fills from the metadata.

/** A field of a kind, filtered by `filter`'s operators. */
function field(key: string, label: string, type: FieldMeta['type'], filter: string[]): FieldMeta {
  return {
    key,
    label,
    type,
    query: {
      filter,
      sort: type.many !== true,
      group: type.kind === 'option' || type.kind === 'ref' || type.kind === 'boolean',
      search: key === 'title',
    },
    write: { create: true, update: true, required: false },
  };
}

const LISTS = ['equals', 'notEquals', 'in', 'notIn', 'empty', 'notEmpty'];

export const tasks: ResourceMeta = {
  resource: 'tasks',
  label: { one: 'task', other: 'tasks' },
  roles: { idField: 'id', titleField: 'title' },
  fields: [
    field('id', 'Id', { kind: 'text' }, []),
    field('title', 'Title', { kind: 'text' }, ['contains', 'startsWith', 'empty', 'notEmpty']),
    field(
      'status',
      'Status',
      {
        kind: 'option',
        settings: {
          options: [
            {
              value: 'done',
              label: 'Done',
              color: 'success',
              order: 2,
              attributes: { kind: 'closed' },
            },
            { value: 'open', label: 'Open', color: 'blue', order: 0, attributes: { kind: 'open' } },
            { value: 'review', label: 'Review', order: 1, attributes: { kind: 'open' } },
            {
              value: 'parked',
              label: 'Parked',
              order: 3,
              archived: true,
              attributes: { kind: 'closed' },
            },
          ],
          attributes: [
            {
              key: 'kind',
              label: 'Group',
              kind: 'option',
              options: [
                { value: 'open', label: 'Open', order: 0 },
                { value: 'closed', label: 'Closed', order: 1 },
              ],
            },
          ],
        },
      },
      LISTS,
    ),
    field('assignee', 'Assignee', { kind: 'ref', settings: { of: 'users' } }, [...LISTS, 'isMe']),
    field('labels', 'Labels', { kind: 'text', many: true }, ['in', 'notIn', 'empty', 'notEmpty']),
    field('updatedAt', 'Updated', { kind: 'datetime' }, ['gte', 'lte', 'inLast', 'notInLast']),
    field('pinned', 'Pinned', { kind: 'boolean' }, ['equals']),
    field('notes', 'Notes', { kind: 'text' }, []),
  ],
  sort: [{ field: 'updatedAt', dir: 'desc' }],
  actions: [],
  serves: {
    read: true,
    create: true,
    update: true,
    delete: true,
    filter: { any: true, not: true },
    sort: { max: 3 },
    page: { numbered: 'any', cursor: false, total: true, max: 100 },
  },
};

export const operators = createOperatorRegistry();
export const kinds = createKindRegistry([], operators);
