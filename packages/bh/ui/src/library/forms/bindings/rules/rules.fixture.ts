import type { FieldMeta } from '@bh/resource';
import type { RuleOption } from './meta';

// A made-up resource's fields, as a filter form gives them to its rules: one
// of each family a rule is drawn for.

/** A field of a kind, filterable by `filter`. */
function field(key: string, label: string, type: FieldMeta['type'], filter: string[]): FieldMeta {
  return {
    key,
    label,
    type,
    query: { filter, sort: true, group: false, search: false },
    write: { create: true, update: true, required: false },
  };
}

export const PRIORITY = field(
  'priority',
  'Priority',
  {
    kind: 'option',
    settings: {
      options: [
        { value: 'urgent', label: 'Urgent', color: 'red', order: 0 },
        { value: 'high', label: 'High', color: 'orange', order: 1 },
        { value: 'normal', label: 'Normal', color: 'blue', order: 2 },
        { value: 'low', label: 'Low', order: 3 },
        { value: 'someday', label: 'Someday', order: 4, archived: true },
      ],
    },
  },
  ['equals', 'notEquals', 'in', 'notIn', 'empty', 'notEmpty'],
);

export const STAGE = field(
  'stage',
  'Stage',
  {
    kind: 'option',
    settings: {
      options: [
        { value: 'draft', label: 'Draft', order: 0, attributes: { group: 'open' } },
        { value: 'review', label: 'Review', order: 1, attributes: { group: 'open' } },
        { value: 'shipped', label: 'Shipped', order: 2, attributes: { group: 'closed' } },
      ],
      attributes: [
        {
          key: 'group',
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
  ['equals', 'notEquals', 'in', 'notIn'],
);

export const OWNER = field('owner', 'Owner', { kind: 'ref', settings: { of: 'users' } }, [
  'equals',
  'in',
  'notIn',
  'empty',
  'isMe',
]);

export const LABELS = field(
  'labels',
  'Labels',
  {
    kind: 'option',
    many: true,
    settings: {
      options: [
        { value: 'api', label: 'api', order: 0 },
        { value: 'ui', label: 'ui', order: 1 },
      ],
    },
  },
  ['equals', 'in', 'notIn', 'empty'],
);

export const DUE = field('due', 'Due', { kind: 'date' }, ['equals', 'lt', 'gt', 'inLast', 'empty']);

export const CREATED = field('created', 'Created', { kind: 'datetime' }, ['lt', 'gte', 'inLast']);

export const SIZE = field('size', 'Size', { kind: 'number' }, ['equals', 'in', 'lt', 'gte']);

export const TITLE = field('title', 'Title', { kind: 'text' }, ['contains', 'in', 'empty']);

export const PINNED = field('pinned', 'Pinned', { kind: 'boolean' }, ['equals', 'empty']);

export const NOTES = field('notes', 'Notes', { kind: 'json' }, []);

export const FIELDS: FieldMeta[] = [
  PRIORITY,
  STAGE,
  OWNER,
  LABELS,
  DUE,
  CREATED,
  SIZE,
  TITLE,
  PINNED,
  NOTES,
];

export const PEOPLE: RuleOption[] = [
  { value: '7', label: 'Ana' },
  { value: '12', label: 'Luka' },
];

/** The rows a ref field holds, as an app's `optionsFor` answers. */
export function optionsFor(target: FieldMeta): Promise<RuleOption[]> {
  return Promise.resolve(target.key === 'owner' ? PEOPLE : []);
}
