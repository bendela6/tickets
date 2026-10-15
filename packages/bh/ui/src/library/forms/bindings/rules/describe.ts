import type { Condition, Filter, Scalar } from '@bh/resource';
import {
  fieldAt,
  isCondition,
  optionsOf,
  pathLabel,
  wordsFor,
  type PathField,
  type RuleOption,
  type RulesMeta,
} from './meta';

// How a rule reads: on its chip, in the × button's name, and for a group, in
// words. "Priority is any of High, Urgent"; "Due is before 31 Oct".

/** One value a chip shows: its words, and its option's color. */
export interface ValuePart {
  label: string;
  /** A bh tone, as an option's. */
  color?: string;
}

/** Each ref field's rows, by the field's key, then by the row's id, as `optionsFor` named them. */
export type RefTitles = ReadonlyMap<string, ReadonlyMap<string, RuleOption>>;

const DAY = /^\d{4}-\d{2}-\d{2}/;

/** A day as a chip shows it: "31 Oct", and its year when it isn't this one's. */
export function dayLabel(text: string, now = new Date()): string {
  const day = DAY.exec(text)?.[0];
  if (!day) {
    return text;
  }
  const date = new Date(`${day}T00:00:00Z`);
  const sameYear = date.getUTCFullYear() === now.getUTCFullYear();
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
    timeZone: 'UTC',
  });
}

/** The operand's values as a list: one value as a list of one, none as []. */
function listOf(value: Condition['value']): Scalar[] {
  if (value === undefined) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

/** One value in the words its field gives it. */
function partOf(at: PathField | undefined, op: string, value: Scalar, refs: RefTitles): ValuePart {
  if (op === 'inLast' || op === 'notInLast') {
    return { label: value === 1 ? '1 day' : `${String(value)} days` };
  }
  if (typeof value === 'boolean') {
    return { label: value ? 'Yes' : 'No' };
  }
  if (!at) {
    return { label: String(value) };
  }
  const option = optionsOf(at).find((each) => each.value === value);
  if (option) {
    return { label: option.label, ...(option.color ? { color: option.color } : {}) };
  }
  const ref = at.attribute ? undefined : refs.get(at.field.key)?.get(String(value));
  if (ref) {
    return { label: ref.label, ...(ref.color ? { color: ref.color } : {}) };
  }
  const kind = at.attribute ? at.attribute.kind : at.field.type.kind;
  if ((kind === 'date' || kind === 'datetime') && typeof value === 'string') {
    return { label: dayLabel(value) };
  }
  return { label: String(value) };
}

/** A condition's parts: the field's label, the operator in its words, and its values. */
export function partsOf(
  meta: RulesMeta,
  condition: Condition,
  refs: RefTitles = new Map(),
): { field: string; op: string; values: ValuePart[] } {
  const at = fieldAt(meta, condition.field);
  const spec = meta.operators.get(condition.op);
  return {
    field: at ? pathLabel(at) : condition.field,
    op: spec && at ? wordsFor(spec, at.field) : (spec?.label ?? condition.op),
    values: listOf(condition.value).map((value) => partOf(at, condition.op, value, refs)),
  };
}

/** A condition in words: "Priority is any of High, Urgent". */
export function conditionWords(
  meta: RulesMeta,
  condition: Condition,
  refs: RefTitles = new Map(),
): string {
  const { field, op, values } = partsOf(meta, condition, refs);
  const said = values.map((value) => value.label).join(', ');
  return said ? `${field} ${op} ${said}` : `${field} ${op}`;
}

/**
 * Any entry in words: a condition as its chip reads; a group's own joined by
 * "and" or "or", in brackets inside another; `not` before what it turns
 * round. "Assignee is me or Assignee is empty", "not: Status is Done".
 */
export function entryWords(
  meta: RulesMeta,
  entry: Filter,
  refs: RefTitles = new Map(),
  nested = false,
): string {
  if (isCondition(entry)) {
    return conditionWords(meta, entry, refs);
  }
  if ('not' in entry) {
    return `not: ${entryWords(meta, entry.not, refs, true)}`;
  }
  const [list, joint] = 'any' in entry ? [entry.any, ' or '] : [entry.all, ' and '];
  const words = list.map((each) => entryWords(meta, each, refs, true)).join(joint);
  return nested && list.length > 1 ? `(${words})` : words;
}

/** A group read in its parts: what it holds in words, and the word between them. */
export interface GroupParts {
  /** `or` between an `any` group's entries, `and` between an `all` group's, `not` before the one it turns round. */
  joint: 'or' | 'and' | 'not';
  /** Each entry it holds in words, a group inside it in brackets. */
  parts: string[];
}

/** An `any`, `all` or `not` group in its parts, as its chip draws it. */
export function groupParts(
  meta: RulesMeta,
  group: Exclude<Filter, Condition>,
  refs: RefTitles = new Map(),
): GroupParts {
  if ('not' in group) {
    return { joint: 'not', parts: [entryWords(meta, group.not, refs, true)] };
  }
  const [list, joint] = 'any' in group ? [group.any, 'or' as const] : [group.all, 'and' as const];
  return { joint, parts: list.map((each) => entryWords(meta, each, refs, true)) };
}
