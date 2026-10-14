import * as v from 'valibot';
import {
  dateValue,
  datetimeValue,
  idValue,
  numberValue,
  optionSettings,
  optionValue,
  refSettings,
  urlValue,
} from './schemas';
import type { BaseKind, KindSpec } from './types';
import { Json } from './values';

/**
 * What one of bh's kinds allows: its row in the table above BaseKind, and the
 * registered operators it names.
 */
type Allows = Pick<KindSpec, 'many' | 'sort' | 'group' | 'search' | 'format' | 'operators'>;

/** One of bh's kinds, frozen: an app adds its own beside them, never changes them. */
function baseKind(
  name: BaseKind,
  allows: Allows,
  value: KindSpec['value'],
  settings?: v.GenericSchema,
): KindSpec {
  const operators = Object.freeze([...allows.operators]);
  return Object.freeze({
    name,
    ...(settings ? { settings } : {}),
    value,
    ...allows,
    // Frozen like the spec: its type stays KindSpec's, an array.
    operators: operators as KindSpec['operators'],
  });
}

const text = v.string();
const boolean = v.boolean();

/**
 * The nine kinds bh registers, in the table's order: text, url, number,
 * boolean, date, datetime, option, ref and json. Each names the operators it
 * allows, by their names in the operator registry (baseOperators), as an
 * app's kind does. An app's own go beside them through createKindRegistry.
 */
export const baseKinds: readonly KindSpec[] = Object.freeze([
  baseKind(
    'text',
    {
      many: true,
      sort: true,
      group: false,
      search: true,
      format: 'plain',
      operators: [
        'equals',
        'notEquals',
        'in',
        'notIn',
        'contains',
        'startsWith',
        'empty',
        'notEmpty',
      ],
    },
    () => text,
  ),
  baseKind(
    'url',
    {
      many: true,
      sort: true,
      group: false,
      search: true,
      operators: [
        'equals',
        'notEquals',
        'in',
        'notIn',
        'contains',
        'startsWith',
        'empty',
        'notEmpty',
      ],
    },
    () => urlValue,
  ),
  baseKind(
    'number',
    {
      many: false,
      sort: true,
      group: false,
      search: false,
      format: 'number',
      operators: [
        'equals',
        'notEquals',
        'in',
        'notIn',
        'lt',
        'lte',
        'gt',
        'gte',
        'empty',
        'notEmpty',
      ],
    },
    () => numberValue,
  ),
  baseKind(
    'boolean',
    {
      many: false,
      sort: true,
      group: true,
      search: false,
      operators: ['equals', 'empty', 'notEmpty'],
    },
    () => boolean,
  ),
  baseKind(
    'date',
    {
      many: false,
      sort: true,
      group: false,
      search: false,
      format: 'date',
      operators: [
        'equals',
        'notEquals',
        'lt',
        'lte',
        'gt',
        'gte',
        'inLast',
        'notInLast',
        'empty',
        'notEmpty',
      ],
    },
    () => dateValue,
  ),
  baseKind(
    'datetime',
    {
      many: false,
      sort: true,
      group: false,
      search: false,
      format: 'datetime',
      operators: ['lt', 'lte', 'gt', 'gte', 'inLast', 'notInLast', 'empty', 'notEmpty'],
    },
    () => datetimeValue,
  ),
  baseKind(
    'option',
    {
      many: true,
      sort: true,
      group: true,
      search: false,
      operators: ['equals', 'notEquals', 'in', 'notIn', 'empty', 'notEmpty'],
    },
    optionValue,
    optionSettings,
  ),
  baseKind(
    'ref',
    {
      many: true,
      sort: true,
      group: true,
      search: false,
      // isMe: the row points at the person viewing it; a ref to anything but
      // people leaves it out of its field's query.filter
      operators: ['equals', 'notEquals', 'in', 'notIn', 'empty', 'notEmpty', 'isMe'],
    },
    () => idValue,
    refSettings,
  ),
  baseKind(
    'json',
    { many: false, sort: false, group: false, search: false, operators: ['empty', 'notEmpty'] },
    () => Json,
  ),
]);
