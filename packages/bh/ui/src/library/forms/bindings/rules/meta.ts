import {
  operatorLabel,
  type AttributeMeta,
  type Condition,
  type FieldMeta,
  type Filter,
  type KindRegistry,
  type OperatorRegistry,
  type OperatorSpec,
  type OptionMeta,
} from '@bh/resource';
import type { InputKind } from '../../registry';

// What the rules input knows of a resource: its filterable fields, the
// operators and kinds they're of, and how a ref's rows are named. Pure, so
// the words and the steps can be tested without drawing anything.

/** A row a field may hold, as a filter offers it: a ref's row by its title. */
export interface RuleOption {
  value: string;
  label: string;
  /** A bh tone, as an option's: 'blue', 'success'. */
  color?: string;
}

/** The metadata the rules input reads, as a filter form gives it. */
export interface RulesMeta {
  /** The fields a rule may name: the resource's, those whose `query.filter` isn't empty. */
  fields: readonly FieldMeta[];
  /** The operators they're filtered by: bh's and the app's own. */
  operators: OperatorRegistry;
  /** The kinds they're of: bh's and the app's own. */
  kinds: KindRegistry;
  /** The input an app's own operator's value is drawn with, by the operator's name. */
  operatorInputs?: Readonly<Record<string, InputKind>>;
  /** The rows a ref field may hold, by their titles; any field's options, when given. */
  optionsFor?: (field: FieldMeta) => Promise<RuleOption[]>;
}

/** Whether an entry is one condition rather than a group. */
export function isCondition(entry: Filter): entry is Condition {
  return 'field' in entry;
}

/** A field a path names: the field, and the attribute after its dot ('status.kind'). */
export interface PathField {
  field: FieldMeta;
  attribute?: AttributeMeta;
}

/** The field and attribute a path names; undefined when the metadata has neither. */
export function fieldAt(meta: RulesMeta, path: string): PathField | undefined {
  const [key, attributeKey] = path.split('.');
  const field = meta.fields.find((each) => each.key === key);
  if (!field) {
    return undefined;
  }
  if (attributeKey === undefined) {
    return { field };
  }
  const attributes = field.type.settings?.attributes as AttributeMeta[] | undefined;
  const attribute = attributes?.find((each) => each.key === attributeKey);
  return attribute ? { field, attribute } : undefined;
}

/** How a path reads: the field's label, and its attribute's after a dot ("Status · Group"). */
export function pathLabel(at: PathField): string {
  return at.attribute ? `${at.field.label} · ${at.attribute.label}` : at.field.label;
}

/**
 * The operators a field allows, in its kind's order: those its kind names
 * that its `query.filter` lists too, registered, and on a field holding a
 * list never `equals` or `notEquals`, which a list doesn't offer.
 */
export function operatorsFor(meta: RulesMeta, field: FieldMeta): OperatorSpec[] {
  const kind = meta.kinds.has(field.type.kind) ? meta.kinds.get(field.type.kind) : undefined;
  if (!kind) {
    return [];
  }
  const allowed = new Set(field.query.filter);
  return kind.operators
    .filter((name) => allowed.has(name))
    .filter((name) => !(field.type.many && (name === 'equals' || name === 'notEquals')))
    .filter((name) => meta.operators.has(name))
    .map((name) => meta.operators.get(name));
}

/** The fields a rule may name: those with an operator to offer. */
export function filterable(meta: RulesMeta): FieldMeta[] {
  return meta.fields.filter((field) => operatorsFor(meta, field).length > 0);
}

/** How an operator reads on a field: "is before" on a date, "has any of" on a list. */
export function wordsFor(spec: OperatorSpec, field: FieldMeta): string {
  return operatorLabel(spec, field.type);
}

/** Whether an operator takes a value to compare with: `empty` and `isMe` don't. */
export function takesOperand(spec: OperatorSpec): boolean {
  return spec.operand !== undefined;
}

/** A field's kind as the field list shows it: "option", "ref · users", "option, many". */
export function kindLabel(field: FieldMeta): string {
  const of = field.type.kind === 'ref' ? field.type.settings?.of : undefined;
  const kind = typeof of === 'string' ? `ref · ${of}` : field.type.kind;
  return field.type.many ? `${kind}, many` : kind;
}

/** The options an option field offers, or an option attribute's: archived ones too. */
export function optionsOf(at: PathField): OptionMeta[] {
  if (at.attribute) {
    return at.attribute.kind === 'option' ? at.attribute.options : [];
  }
  if (at.field.type.kind !== 'option') {
    return [];
  }
  return (at.field.type.settings?.options as OptionMeta[] | undefined) ?? [];
}
