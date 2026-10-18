import * as v from 'valibot';
import { defineRegistry } from '@bh/registry';
import type { FieldType, OperatorSpec } from './types';
import type { Scalar } from './values';
import { functionSchema, labelSchema, nameSchema } from './words';

// bh's fifteen operators: entries of the operator registry like an app's own,
// with no type or table of their names beside them. Each kind names the ones
// it allows in its own entry of baseKinds, as an app's kind does.

/** A row's value, as `matches` gets it. */
type Value = Scalar | Scalar[] | null;

/** An operand, as `matches` gets it. */
type Operand = Scalar | Scalar[] | undefined;

/** A many field's values; a single value as a list of one; none as []. */
function listOf(value: Value | Operand): Scalar[] {
  if (value === null || value === undefined) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

/** Text with its case folded, so it matches whatever its case. */
function lower(value: Scalar): string {
  return String(value).toLowerCase();
}

// A datetime as its schema takes it, its fraction apart: to the second, then
// up to nine digits, then Z.
const DATETIME = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,9}))?Z$/;

/**
 * Text that orders as its value does: a datetime with its fraction padded to
 * nine digits, so '09:30:00Z' and '09:30:00.000Z' are one instant; a date, a
 * day without a time, as it is.
 */
export function ordered(text: string): string {
  const match = DATETIME.exec(text);
  return match ? `${match[1]}.${(match[2] ?? '').padEnd(9, '0')}Z` : text;
}

/**
 * Where a row's value sits against the operand: below 0 before it, 0 at it,
 * above 0 after it. A number by value; a date by day, a time by minute and a
 * datetime by instant, as their ISO text orders once a datetime's fraction is
 * padded.
 * Undefined when the two don't compare: no value, a list, or two kinds of
 * value.
 */
function compare(value: Value, operand: Operand): number | undefined {
  if (typeof value === 'number' && typeof operand === 'number') {
    return value - operand;
  }
  if (typeof value === 'string' && typeof operand === 'string') {
    const [a, b] = [ordered(value), ordered(operand)];
    return a < b ? -1 : a > b ? 1 : 0;
  }
  return undefined;
}

/**
 * Whether the row's value compares with the operand, and sits where `holds`
 * says: on a many field, one of its values.
 */
function sits(value: Value, operand: Operand, holds: (at: number) => boolean): boolean {
  return listOf(value).some((each) => {
    const at = compare(each, operand);
    return at !== undefined && holds(at);
  });
}

/** Whether the row holds any of the operand's values: on a many field, any of its own. */
function holdsAny(value: Value, operand: Operand): boolean {
  const values = listOf(operand);
  return listOf(value).some((each) => values.includes(each));
}

/** Whether one of the row's values passes `test` against the operand, case ignored. */
function text(
  value: Value,
  operand: Operand,
  test: (value: string, term: string) => boolean,
): boolean {
  if (typeof operand !== 'string') {
    return false;
  }
  const term = lower(operand);
  return listOf(value).some((each) => test(lower(each), term));
}

const DAY = 86_400_000;

// A date as its schema takes it: a day, no time.
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The moment a number of days back from now, by this machine's clock, as an
 * ISO datetime in UTC; for a date, that moment's day.
 */
function daysAgo(days: number, like: string): string {
  const moment = new Date(Date.now() - days * DAY).toISOString();
  return DATE.test(like) ? moment.slice(0, 10) : moment;
}

/**
 * Whether the row's value is at or after the moment `days` back from now: a
 * date by day, a datetime by instant. Undefined when it isn't one, or the
 * operand isn't a number of days.
 */
function within(value: Value, days: Operand): boolean | undefined {
  if (typeof value !== 'string' || typeof days !== 'number') {
    return undefined;
  }
  const at = compare(value, daysAgo(days, value));
  return at === undefined ? undefined : at >= 0;
}

/** The field's own value: a number, a day, an option. */
const one = (value: v.GenericSchema): v.GenericSchema => value;

/** 1 to 100 of the field's values. */
function some(value: v.GenericSchema): v.GenericSchema {
  return v.pipe(
    v.array(value),
    v.minLength(1, 'name at least one value'),
    v.maxLength(100, 'name at most 100 values'),
  );
}

/** 1 to 200 characters, whatever the field's kind. */
function term(): v.GenericSchema {
  return v.pipe(
    v.string(),
    v.minLength(1, 'look for at least one character'),
    v.maxLength(200, 'look for at most 200 characters'),
  );
}

/** A number of days back from now: a whole number, 1 or more. */
function days(): v.GenericSchema {
  return v.pipe(v.number(), v.integer('count whole days'), v.minValue(1, 'count at least one day'));
}

/** A date's, a time's and a datetime's words for a range: 'is before', 'is after'. */
function onDates(words: string): NonNullable<OperatorSpec['labels']> {
  return { kinds: { date: words, time: words, datetime: words } };
}

/**
 * What the operator registry checks of each operator: a word for its name,
 * a label and labels that say something, its operand's schema from a
 * function, and its `matches`.
 */
export const operatorData = v.object({
  name: nameSchema,
  label: labelSchema,
  labels: v.optional(
    v.object({
      many: v.optional(labelSchema),
      kinds: v.optional(v.record(v.string(), labelSchema)),
    }),
  ),
  operand: v.optional(functionSchema<OperatorSpec['operand']>('its operand')),
  matches: functionSchema<OperatorSpec['matches']>('its matches'),
});

const operators = defineRegistry<OperatorSpec>({ name: 'operator', schema: operatorData });

/** One of bh's operators, frozen, its words too: an app adds its own beside them, never changes them. */
function operator(spec: OperatorSpec): OperatorSpec {
  if (spec.labels) {
    Object.freeze(spec.labels.kinds);
    Object.freeze(spec.labels);
  }
  return Object.freeze(spec);
}

/**
 * The fifteen operators bh registers, in this order: equals, notEquals, in,
 * notIn, contains, startsWith, lt, lte, gt, gte, inLast, notInLast, empty,
 * notEmpty and isMe, a registry (@bh/registry). An app registers its own
 * beside them: `baseOperators.register({ near: { … } })`. Their rules hold for `matches` and for each
 * adapter's SQL alike:
 *
 * - On a many field, `in` holds when the row holds any of the values, `notIn`
 *   when it holds none of them, and `empty` when it holds none at all;
 *   `contains`, `startsWith`, the ranges and `inLast` hold when one of its
 *   values does, and `notInLast` when none does. `equals` and `notEquals`
 *   aren't offered there.
 * - `notEquals`, `notIn` and `notInLast` keep the rows that have no value:
 *   "status is not done" keeps the items without a status.
 * - `contains` and `startsWith` ignore case.
 * - `lt`, `lte`, `gt` and `gte` compare a number by value, a date by day, a
 *   time by minute and a datetime by instant, so a month is `gte` its first
 *   moment and `lt` the next month's; a row without a value passes none of
 *   them.
 * - `inLast` and `notInLast` count whole days back from now, by the
 *   database's clock in SQL and this machine's in `matches`, so a saved "last
 *   7 days" view keeps rolling: a datetime is in the last 7 days when it is at
 *   or after the moment 7 days ago, a date when it is on or after that
 *   moment's day (in UTC).
 * - Only null, or [] on a many field, is empty: '' and 0 are values.
 * - `isMe` holds when the row's value is the person viewing it (a many
 *   field's, when it holds them), so a saved view's "Mine" means whoever opens
 *   it; with no one signed in, it holds for no row.
 */
export const baseOperators = operators.register({
  equals: operator({ name: 'equals', label: 'is', operand: one, matches: (a, b) => a === b }),
  notEquals: operator({
    name: 'notEquals',
    label: 'is not',
    operand: one,
    matches: (a, b) => a !== b,
  }),
  in: operator({
    name: 'in',
    label: 'is any of',
    labels: { many: 'has any of' },
    operand: some,
    matches: holdsAny,
  }),
  notIn: operator({
    name: 'notIn',
    label: 'is none of',
    labels: { many: 'has none of' },
    operand: some,
    matches: (a, b) => !holdsAny(a, b),
  }),
  contains: operator({
    name: 'contains',
    label: 'contains',
    operand: term,
    matches: (a, b) => text(a, b, (value, looked) => value.includes(looked)),
  }),
  startsWith: operator({
    name: 'startsWith',
    label: 'starts with',
    operand: term,
    matches: (a, b) => text(a, b, (value, looked) => value.startsWith(looked)),
  }),
  lt: operator({
    name: 'lt',
    label: 'is less than',
    labels: onDates('is before'),
    operand: one,
    matches: (a, b) => sits(a, b, (at) => at < 0),
  }),
  lte: operator({
    name: 'lte',
    label: 'is at most',
    labels: onDates('is on or before'),
    operand: one,
    matches: (a, b) => sits(a, b, (at) => at <= 0),
  }),
  gt: operator({
    name: 'gt',
    label: 'is more than',
    labels: onDates('is after'),
    operand: one,
    matches: (a, b) => sits(a, b, (at) => at > 0),
  }),
  gte: operator({
    name: 'gte',
    label: 'is at least',
    labels: onDates('is on or after'),
    operand: one,
    matches: (a, b) => sits(a, b, (at) => at >= 0),
  }),
  inLast: operator({
    name: 'inLast',
    label: 'is in the last',
    operand: days,
    matches: (a, b) => listOf(a).some((each) => within(each, b) === true),
  }),
  notInLast: operator({
    name: 'notInLast',
    label: 'is not in the last',
    operand: days,
    // No value, or none in the last days: [] and null pass as `every` of none.
    matches: (a, b) => listOf(a).every((each) => within(each, b) === false),
  }),
  empty: operator({ name: 'empty', label: 'is empty', matches: (a) => listOf(a).length === 0 }),
  notEmpty: operator({
    name: 'notEmpty',
    label: 'is not empty',
    matches: (a) => listOf(a).length > 0,
  }),
  isMe: operator({
    name: 'isMe',
    label: 'is me',
    matches: (a, _, viewer) => viewer !== undefined && listOf(a).includes(viewer),
  }),
});

/**
 * How a filter reads an operator on a field of this type: its words for the
 * field's kind, else for a field holding a list, else its label. `lt` on a
 * date reads 'is before', `in` on a many field 'has any of', `in` on a status
 * 'is any of'.
 */
export function operatorLabel(spec: OperatorSpec, type: Pick<FieldType, 'kind' | 'many'>): string {
  const many = type.many ? spec.labels?.many : undefined;
  return spec.labels?.kinds?.[type.kind] ?? many ?? spec.label;
}
