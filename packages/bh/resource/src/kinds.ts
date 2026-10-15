import * as v from 'valibot';
import {
  dateValue,
  datetimeValue,
  emailValue,
  FileValue,
  idValue,
  markdownValue,
  numberSettings,
  numberValue,
  optionSettings,
  optionValue,
  phoneValue,
  refSettings,
  richtextValue,
  textSettings,
  textValue,
  timeValue,
  urlValue,
} from './schemas';
import { ordered } from './operators';
import type { BaseKind, KindSpec } from './types';
import { Json, type Scalar } from './values';

/**
 * What one of bh's kinds allows: its row in the table above BaseKind, the
 * registered operators it names, and how it orders and is searched where bh
 * holds the rows itself.
 */
type Allows = Pick<
  KindSpec,
  'many' | 'sort' | 'group' | 'search' | 'format' | 'operators' | 'compare' | 'searchText'
>;

/** Where `a` sits against `b`: below 0 before it, 0 with it, above 0 after it. */
function sign<T>(a: T, b: T): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Text alphabetically, case ignored. */
function byText(a: Scalar, b: Scalar): number {
  return sign(String(a).toLowerCase(), String(b).toLowerCase());
}

/** A number by value. */
function byValue(a: Scalar, b: Scalar): number {
  return sign(Number(a), Number(b));
}

/** false, then true. */
function byTruth(a: Scalar, b: Scalar): number {
  return sign(Number(a === true), Number(b === true));
}

/** A day, a time or an instant by its ISO text, a datetime's fraction padded. */
function byIso(a: Scalar, b: Scalar): number {
  return sign(ordered(String(a)), ordered(String(b)));
}

// Each option field's order, by its settings, worked out once per field.
const orders = new WeakMap<object, Map<string, number>>();

/** Each option's place among the field's options, by their `order`. */
function orderOf(settings: Record<string, Json> | undefined): Map<string, number> {
  const known = settings && orders.get(settings);
  if (known) {
    return known;
  }
  const parsed = v.safeParse(optionSettings, settings);
  const order = new Map(
    parsed.success ? parsed.output.options.map((option) => [option.value, option.order]) : [],
  );
  if (settings) {
    orders.set(settings, order);
  }
  return order;
}

/** An option by its `order`, never its label; one the field doesn't have, last. */
function byOrder(a: Scalar, b: Scalar, settings?: Record<string, Json>): number {
  const order = orderOf(settings);
  const at = (value: Scalar) => order.get(String(value)) ?? Number.MAX_VALUE;
  return sign(at(a), at(b));
}

/** A rich text's words: each text node's, in order, a space between. */
function wordsOf(value: Scalar): string {
  const words: string[] = [];
  const visit = (node: unknown) => {
    if (typeof node !== 'object' || node === null) {
      return;
    }
    const { text, content } = node as { text?: unknown; content?: unknown };
    if (typeof text === 'string') {
      words.push(text);
    }
    if (Array.isArray(content)) {
      content.forEach(visit);
    }
  };
  try {
    visit(JSON.parse(String(value)));
  } catch {
    return '';
  }
  return words.join(' ');
}

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

const boolean = v.boolean();

/**
 * The fifteen kinds bh registers, in the table's order: text, markdown,
 * richtext, url, email, phone, number, boolean, date, time, datetime, option,
 * ref, file and json. Each names the operators it allows, by their names in
 * the operator registry (baseOperators), as an app's kind does. An app's own
 * go beside them through createKindRegistry.
 */
export const baseKinds: readonly KindSpec[] = Object.freeze([
  baseKind(
    'text',
    {
      compare: byText,
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
    textValue,
    textSettings,
  ),
  baseKind(
    'markdown',
    {
      many: true,
      sort: false,
      group: false,
      search: true,
      operators: ['contains', 'empty', 'notEmpty'],
    },
    () => markdownValue,
  ),
  baseKind(
    'richtext',
    {
      searchText: wordsOf,
      many: true,
      sort: false,
      group: false,
      // A search looks in its text (@bh/richtext's docToText), never its JSON,
      // so no operator looks into it.
      search: true,
      operators: ['empty', 'notEmpty'],
    },
    () => richtextValue,
  ),
  baseKind(
    'url',
    {
      compare: byText,
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
    'email',
    {
      compare: byText,
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
    () => emailValue,
  ),
  baseKind(
    'phone',
    {
      compare: byText,
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
    () => phoneValue,
  ),
  baseKind(
    'number',
    {
      compare: byValue,
      many: true,
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
    numberValue,
    numberSettings,
  ),
  baseKind(
    'boolean',
    {
      compare: byTruth,
      many: true,
      sort: true,
      group: true,
      search: false,
      // in and notIn: a list of them holds a true, or none
      operators: ['equals', 'in', 'notIn', 'empty', 'notEmpty'],
    },
    () => boolean,
  ),
  baseKind(
    'date',
    {
      compare: byIso,
      many: true,
      sort: true,
      group: false,
      search: false,
      format: 'date',
      operators: [
        'equals',
        'notEquals',
        'in',
        'notIn',
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
    'time',
    {
      compare: byIso,
      many: true,
      sort: true,
      group: false,
      search: false,
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
    () => timeValue,
  ),
  baseKind(
    'datetime',
    {
      compare: byIso,
      many: true,
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
      compare: byOrder,
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
    'file',
    { many: true, sort: false, group: false, search: false, operators: ['empty', 'notEmpty'] },
    () => FileValue,
  ),
  baseKind(
    'json',
    { many: true, sort: false, group: false, search: false, operators: ['empty', 'notEmpty'] },
    () => Json,
  ),
]);
