import * as v from 'valibot';
import { ActionInput, type ActionMeta } from './actions';
import { issuesOf } from './errors';
import { ResourceMeta, type Serves } from './meta';
import { Query, type Condition, type Filter } from './query';
import type { Registry } from './registry';
import { optionSettings, pathTo, type AttributeMeta } from './schemas';
import type { FieldMeta, FormatSpec, KindSpec, OperatorSpec } from './types';
import { Row, type FieldValue } from './values';
import { Create, Patch } from './writes';

// The shapes checked against one resource: its metadata against the
// registered kinds, formats and operators (metaOf), and a query, a write, an
// action's input and a row against its metadata (queryOf, createOf, patchOf,
// actionInputOf, rowOf). Each is the shape's schema and one check after it,
// which reports every problem at its own path, so an `invalid` answer lists
// them all at once.

type Key = string | number;

/** Reports a problem at the path its keys name, from the checked value's root. */
type Report = (message: string, ...keys: Key[]) => void;

/** A check of the whole value, after its shape, reporting through `report`. */
function checked<T>(
  shape: v.GenericSchema<T>,
  check: (value: T, report: Report) => void,
): v.GenericSchema<T> {
  return v.pipe(
    shape,
    v.rawCheck<T>(({ dataset, addIssue }) => {
      if (dataset.typed) {
        const value = dataset.value;
        check(value, (message, ...keys) => {
          addIssue({ message, path: pathTo(value, keys) });
        });
      }
    }),
  );
}

/** Reports what `schema` refuses in `input`, each issue under `keys`. */
function reportRefusals(
  schema: v.GenericSchema,
  input: unknown,
  report: Report,
  ...keys: Key[]
): void {
  const result = v.safeParse(schema, input);
  if (!result.success) {
    for (const issue of issuesOf(result.issues)) {
      report(issue.message, ...keys, ...issue.path);
    }
  }
}

function kindOf(registry: Registry, name: string): KindSpec | undefined {
  return registry.kinds.has(name) ? registry.kinds.get(name) : undefined;
}

function operatorOf(registry: Registry, name: string): OperatorSpec | undefined {
  return registry.operators.has(name) ? registry.operators.get(name) : undefined;
}

function formatOf(registry: Registry, name: string): FormatSpec | undefined {
  return registry.formats.has(name) ? registry.formats.get(name) : undefined;
}

/** The attributes an option field's options carry; [] for any other field. */
function attributesOf(field: FieldMeta): AttributeMeta[] {
  if (field.type.kind !== 'option') {
    return [];
  }
  const settings = v.safeParse(optionSettings, field.type.settings);
  return settings.success ? (settings.output.attributes ?? []) : [];
}

/**
 * What a path reaches: a field, or an attribute of an option field's
 * options, which filters, sorts and groups like a field of its own kind.
 */
interface Target {
  field: FieldMeta;
  /** The kind its values are of: the field's, or its attribute's. */
  kind: KindSpec;
  /** One of its values' schema. */
  value: v.GenericSchema;
  /** It holds a list: a many field, or an attribute of one. */
  many: boolean;
}

/** What `path` reaches among `fields`, or why it reaches nothing. */
function targetOf(fields: readonly FieldMeta[], registry: Registry, path: string): Target | string {
  const [key = '', name] = path.split('.');
  const field = fields.find((each) => each.key === key);
  if (!field) {
    return `no field "${key}"`;
  }
  const many = field.type.many === true;
  if (name === undefined) {
    const kind = kindOf(registry, field.type.kind);
    return kind
      ? { field, kind, value: kind.value(field.type.settings), many }
      : `no kind "${field.type.kind}"`;
  }
  const attribute = attributesOf(field).find((each) => each.key === name);
  if (!attribute) {
    return `"${key}" has no attribute "${name}"`;
  }
  const kind = kindOf(registry, attribute.kind);
  if (!kind) {
    return `no kind "${attribute.kind}"`;
  }
  const value =
    attribute.kind === 'option'
      ? v.picklist(
          attribute.options.map((option) => option.value),
          (issue) => `no option ${issue.received}`,
        )
      : kind.value();
  return { field, kind, value, many };
}

// bh's two operators that compare one value with one value: a field holding a
// list isn't filtered by them (`in` and `notIn` say what they would).
const ONE_TO_ONE = new Set(['equals', 'notEquals']);

/** Whether a condition on `target` may name `op`: its field and its kind both allow it. */
function filters(target: Target, op: string): boolean {
  return (
    target.field.query.filter.includes(op) &&
    target.kind.operators.includes(op) &&
    !(target.many && ONE_TO_ONE.has(op))
  );
}

/** Whether `target` sorts: its field and its kind both say so, and it holds one value. */
function sorts(target: Target): boolean {
  return target.field.query.sort && target.kind.sort && !target.many;
}

/** Whether `target` groups: its field and its kind both say so. */
function groups(target: Target): boolean {
  return target.field.query.group && target.kind.group;
}

/** The first key that comes twice in the list, at its second place. */
function twice(keys: readonly string[]): { key: string; at: number } | undefined {
  const seen = new Set<string>();
  for (const [at, key] of keys.entries()) {
    if (seen.has(key)) {
      return { key, at };
    }
    seen.add(key);
  }
  return undefined;
}

/**
 * A template's placeholders, the paths in its braces; or what is wrong with
 * its braces. '{{' and '}}' are a brace, not a placeholder.
 */
export function placeholdersOf(template: string): string[] | string {
  const paths: string[] = [];
  let at = 0;
  while (at < template.length) {
    const char = template[at];
    if ((char === '{' || char === '}') && template[at + 1] === char) {
      at += 2;
    } else if (char === '{') {
      const end = template.indexOf('}', at + 1);
      const path = end === -1 ? undefined : template.slice(at + 1, end);
      if (path === undefined || path.includes('{')) {
        return 'a "{" in a template is closed by "}", or written "{{"';
      }
      paths.push(path);
      at = end + 1;
    } else if (char === '}') {
      return 'a "}" in a template is written "}}"';
    } else {
      at += 1;
    }
  }
  return paths;
}

// The kinds a template fills: it makes text, and a url is text.
const TEMPLATED = new Set(['text', 'url']);

/** The keys a templated field reaches through the templates it names, itself among them if they loop. */
function reached(fields: readonly FieldMeta[], start: FieldMeta): Set<string> {
  const seen = new Set<string>();
  const visit = (field: FieldMeta) => {
    const paths = field.template === undefined ? [] : placeholdersOf(field.template);
    for (const path of typeof paths === 'string' ? [] : paths) {
      const key = path.split('.')[0] ?? '';
      const next = fields.find((each) => each.key === key);
      if (next && !seen.has(key)) {
        seen.add(key);
        visit(next);
      }
    }
  };
  visit(start);
  return seen;
}

/**
 * Checks one field against the registry and the fields beside it: its kind,
 * settings and list; its query no more than its kind allows; its default of
 * its kind; its format; its template.
 */
function checkField(
  field: FieldMeta,
  fields: readonly FieldMeta[],
  registry: Registry,
  report: Report,
): void {
  const kind = kindOf(registry, field.type.kind);
  if (!kind) {
    report(`no kind "${field.type.kind}"`, 'type', 'kind');
    return;
  }
  const many = field.type.many === true;
  if (kind.settings) {
    if (field.type.settings === undefined && !v.is(kind.settings, undefined)) {
      report(`the kind "${kind.name}" needs its settings`, 'type', 'settings');
    } else {
      reportRefusals(kind.settings, field.type.settings, report, 'type', 'settings');
    }
  } else if (field.type.settings !== undefined) {
    report(`the kind "${kind.name}" takes no settings`, 'type', 'settings');
  }
  if (many && !kind.many) {
    report(`the kind "${kind.name}" holds one value, never a list`, 'type', 'many');
  }

  const { query } = field;
  for (const [at, op] of query.filter.entries()) {
    if (query.filter.indexOf(op) !== at) {
      report(`"${op}" comes twice`, 'query', 'filter', at);
    } else if (!operatorOf(registry, op)) {
      report(`no operator "${op}"`, 'query', 'filter', at);
    } else if (!kind.operators.includes(op)) {
      report(`the kind "${kind.name}" can't be filtered by "${op}"`, 'query', 'filter', at);
    } else if (many && ONE_TO_ONE.has(op)) {
      report(`a field holding a list can't be filtered by "${op}"`, 'query', 'filter', at);
    }
  }
  if (query.sort && !kind.sort) {
    report(`the kind "${kind.name}" can't be sorted`, 'query', 'sort');
  } else if (query.sort && many) {
    report('a field holding a list can’t be sorted', 'query', 'sort');
  }
  if (query.group && !kind.group) {
    report(`the kind "${kind.name}" can't be grouped`, 'query', 'group');
  }
  if (query.search && !kind.search) {
    report(`the kind "${kind.name}" can't be searched`, 'query', 'search');
  }

  if (field.write.default !== undefined) {
    const value = kind.value(field.type.settings);
    reportRefusals(many ? v.array(value) : value, field.write.default, report, 'write', 'default');
  }

  if (field.format !== undefined) {
    const name = typeof field.format === 'string' ? field.format : field.format.name;
    const at: Key[] = typeof field.format === 'string' ? ['format'] : ['format', 'name'];
    const format = formatOf(registry, name);
    if (!format) {
      report(`no format "${name}"`, ...at);
    } else if (!format.kinds.includes(kind.name)) {
      report(`the format "${name}" doesn't take the kind "${kind.name}"`, ...at);
    } else if (typeof field.format !== 'string') {
      if (format.options) {
        reportRefusals(format.options, field.format.options, report, 'format', 'options');
      } else {
        report(`the format "${name}" takes no options`, 'format', 'options');
      }
    } else if (format.options && !v.is(format.options, undefined)) {
      report(`the format "${name}" needs its options`, 'format');
    }
  }

  if (field.template !== undefined) {
    checkTemplate(field, fields, registry, report);
  }
}

/**
 * Checks a templated field: of a kind a template fills, one value, never
 * written; its braces closed; each placeholder one of the row's other fields
 * (or a path through one), and no loop back to itself through theirs.
 */
function checkTemplate(
  field: FieldMeta,
  fields: readonly FieldMeta[],
  registry: Registry,
  report: Report,
): void {
  if (!TEMPLATED.has(field.type.kind)) {
    report(`a template fills a text or url field, not the kind "${field.type.kind}"`, 'template');
  } else if (field.type.many) {
    report('a templated field holds one value, never a list', 'template');
  }
  if (field.write.create || field.write.update) {
    report('a templated field is never written: the server fills it', 'write');
  }
  const paths = placeholdersOf(field.template ?? '');
  if (typeof paths === 'string') {
    report(paths, 'template');
    return;
  }
  let own = false;
  for (const path of paths) {
    const target = targetOf(fields, registry, path);
    if (path.split('.')[0] === field.key) {
      own = true;
      report(`a template names the row's other fields, not its own: "{${path}}"`, 'template');
    } else if (typeof target === 'string') {
      report(`the template's "{${path}}": ${target}`, 'template');
    }
  }
  if (!own && reached(fields, field).has(field.key)) {
    report(`"${field.key}" reaches itself through the templates it names`, 'template');
  }
}

/** Checks a list of fields: each one, and each key once. */
function checkFields(
  fields: readonly FieldMeta[],
  registry: Registry,
  report: Report,
  ...at: Key[]
): void {
  const repeated = twice(fields.map((field) => field.key));
  if (repeated) {
    report(`two fields are "${repeated.key}"`, ...at, repeated.at, 'key');
  }
  for (const [index, field] of fields.entries()) {
    checkField(field, fields, registry, (message, ...keys) => {
      report(message, ...at, index, ...keys);
    });
  }
}

/** Checks the fields `roles` names: each one there, the picture a url. */
function checkRoles(meta: ResourceMeta, report: Report): void {
  for (const [role, key] of Object.entries(meta.roles)) {
    const field = meta.fields.find((each) => each.key === key);
    if (key === undefined) {
      continue;
    }
    if (!field) {
      report(`no field "${key}"`, 'roles', role);
    } else if (role === 'imageField' && field.type.kind !== 'url') {
      report('the image field is a url field', 'roles', role);
    }
  }
}

/** What a sort naming more fields than the resource serves is told. */
function sortLimit(max: number): string {
  return max === 1
    ? 'a sort names one field here'
    : `a sort names at most ${String(max)} fields here`;
}

/**
 * Checks what the resource says it serves against its fields: no field set
 * by a write it doesn't serve, its own sort no longer than a query's may be.
 */
function checkServes(meta: ResourceMeta, report: Report): void {
  const { serves } = meta;
  for (const [index, field] of meta.fields.entries()) {
    if (field.write.create && !serves.create) {
      report('a create sets it, but the resource serves none', 'fields', index, 'write', 'create');
    }
    if (field.write.update && !serves.update) {
      report(
        'a patch changes it, but the resource serves none',
        'fields',
        index,
        'write',
        'update',
      );
    }
  }
  if (meta.sort.length > serves.sort.max) {
    report(sortLimit(serves.sort.max), 'sort');
  }
}

/** Checks a list of sort keys: each path reaches a field that sorts. */
function checkSort(
  sort: readonly { field: string }[],
  fields: readonly FieldMeta[],
  registry: Registry,
  report: Report,
  ...at: Key[]
): void {
  for (const [index, { field: path }] of sort.entries()) {
    const target = targetOf(fields, registry, path);
    if (typeof target === 'string') {
      report(target, ...at, index, 'field');
    } else if (!sorts(target)) {
      report(`"${path}" can't be sorted`, ...at, index, 'field');
    }
  }
}

/**
 * The metadata, checked against the registry: each field's kind and format
 * registered; its type's settings and many, its write's default and its query
 * no more than its kind allows; its format one that takes its kind, with
 * options its schema accepts; its template filled from the row's other
 * fields, and never written. As a whole: each key once, each of `roles` a
 * field (`imageField` a url one), its sort on fields that sort, each action's
 * name once and its input's fields checked as the resource's are.
 *
 * A ref field's `of` must name a resource the server serves: that's checked
 * when the server starts, once every resource's metadata is known.
 */
export function metaOf(registry: Registry): v.GenericSchema<ResourceMeta> {
  return checked(ResourceMeta, (meta, report) => {
    checkFields(meta.fields, registry, report, 'fields');
    checkRoles(meta, report);
    checkSort(meta.sort, meta.fields, registry, report, 'sort');
    checkServes(meta, report);
    const repeated = twice(meta.actions.map((action) => action.name));
    if (repeated) {
      report(`two actions are "${repeated.key}"`, 'actions', repeated.at, 'name');
    }
    for (const [index, action] of meta.actions.entries()) {
      checkFields(action.input, registry, report, 'actions', index, 'input');
    }
  });
}

/** Checks one condition: its field there, its operator registered and allowed, its operand. */
function checkCondition(
  condition: Condition,
  meta: ResourceMeta,
  registry: Registry,
  report: Report,
  at: Key[],
): void {
  const target = targetOf(meta.fields, registry, condition.field);
  const operator = operatorOf(registry, condition.op);
  if (typeof target === 'string') {
    report(target, ...at, 'field');
  } else if (!operator) {
    report(`no operator "${condition.op}"`, ...at, 'op');
  } else if (!filters(target, condition.op)) {
    report(`"${condition.field}" can't be filtered by "${condition.op}"`, ...at, 'op');
  } else if (!operator.operand) {
    if (condition.value !== undefined) {
      report(`"${condition.op}" takes no value`, ...at, 'value');
    }
  } else if (condition.value === undefined) {
    report(`"${condition.op}" needs a value`, ...at, 'value');
  } else {
    reportRefusals(operator.operand(target.value), condition.value, report, ...at, 'value');
  }
}

/** Checks every condition in a filter, at its own path. */
function checkFilter(
  filter: Filter,
  meta: ResourceMeta,
  registry: Registry,
  report: Report,
  at: Key[],
): void {
  if ('all' in filter) {
    for (const [index, each] of filter.all.entries()) {
      checkFilter(each, meta, registry, report, [...at, 'all', index]);
    }
  } else if ('any' in filter) {
    if (!meta.serves.filter.any) {
      report('the resource joins conditions by "all" alone, never "any"', ...at, 'any');
    }
    for (const [index, each] of filter.any.entries()) {
      checkFilter(each, meta, registry, report, [...at, 'any', index]);
    }
  } else if ('not' in filter) {
    if (!meta.serves.filter.not) {
      report('the resource joins conditions by "all" alone, never "not"', ...at, 'not');
    }
    checkFilter(filter.not, meta, registry, report, [...at, 'not']);
  } else {
    checkCondition(filter, meta, registry, report, at);
  }
}

/** Checks a page against the shapes the resource serves (ResourceMeta.serves.page). */
function checkPage(page: Query['page'], serves: Serves['page'], report: Report): void {
  if (page?.take !== undefined && page.take > serves.max) {
    report(`a page takes at most ${String(serves.max)} rows here`, 'page', 'take');
  }
  if (page?.cursor !== undefined) {
    if (!serves.cursor) {
      report('the resource pages by number, never by cursor', 'page', 'cursor');
    }
  } else if (page?.skip !== undefined && page.skip > 0) {
    const take = page.take ?? Math.min(100, serves.max);
    if (serves.numbered === 'none') {
      report('the resource pages by cursor, never by number', 'page', 'skip');
    } else if (serves.numbered === 'pages' && page.skip % take !== 0) {
      report(`the resource skips whole pages: a multiple of ${String(take)}`, 'page', 'skip');
    }
  }
}

/**
 * A query, checked against the resource's metadata: each field it names is
 * there and allows its operator, sort or group; each operator is registered,
 * and each operand passes its OperatorSpec's schema for the field's kind; a
 * search has a field to look in; `fields` names keys. It asks no more than
 * the resource serves: its filter joined as `serves.filter` allows, its sort
 * no longer than `serves.sort.max`, its page a shape `serves.page` takes.
 */
export function queryOf(meta: ResourceMeta, registry: Registry): v.GenericSchema<Query> {
  return checked(Query, (query, report) => {
    if (query.filter) {
      checkFilter(query.filter, meta, registry, report, ['filter']);
    }
    if (query.sort && query.sort.length > meta.serves.sort.max) {
      report(sortLimit(meta.serves.sort.max), 'sort');
    }
    checkPage(query.page, meta.serves.page, report);
    if (query.search !== undefined) {
      const searched = meta.fields.some((field) => {
        return field.query.search && kindOf(registry, field.type.kind)?.search === true;
      });
      if (!searched) {
        report('no field is searched', 'search');
      }
    }
    checkSort(query.sort ?? [], meta.fields, registry, report, 'sort');
    if (query.group) {
      const target = targetOf(meta.fields, registry, query.group.field);
      if (typeof target === 'string') {
        report(target, 'group', 'field');
      } else if (!groups(target)) {
        report(`"${query.group.field}" can't be grouped`, 'group', 'field');
      }
    }
    for (const [index, key] of (query.fields ?? []).entries()) {
      if (!meta.fields.some((field) => field.key === key)) {
        report(`no field "${key}"`, 'fields', index);
      }
    }
  });
}

/** A field's value as a write sets it: one of its kind or a list of them, null to clear it. */
function writable(field: FieldMeta, kind: KindSpec): v.GenericSchema {
  const value = kind.value(field.type.settings);
  return v.nullable(field.type.many ? v.array(value) : value);
}

/** Whether a written value leaves its field empty: null, or [] on a many field. */
function isEmpty(field: FieldMeta, value: FieldValue): boolean {
  return value === null || (field.type.many === true && Array.isArray(value) && value.length === 0);
}

/**
 * Checks a write's values: each key a field the write may set (`may.flag`),
 * each value of its field's kind, and a required one never emptied (null, or
 * [] on a many field). `may` says what the write is told when it does either.
 */
function checkValues(
  values: Record<string, FieldValue>,
  fields: readonly FieldMeta[],
  registry: Registry,
  report: Report,
  may: { flag: 'create' | 'update'; refused: string; emptied: string },
): void {
  for (const [key, value] of Object.entries(values)) {
    const field = fields.find((each) => each.key === key);
    const kind = field && kindOf(registry, field.type.kind);
    if (!field) {
      report(`no field "${key}"`, 'values', key);
    } else if (!field.write[may.flag]) {
      report(`"${key}" ${may.refused}`, 'values', key);
    } else if (!kind) {
      report(`no kind "${field.type.kind}"`, 'values', key);
    } else if (field.write.required && isEmpty(field, value)) {
      report(`"${key}" ${may.emptied}`, 'values', key);
    } else {
      reportRefusals(writable(field, kind), value, report, 'values', key);
    }
  }
}

/** Checks values a create sets: creatable fields only, and every required one. */
function checkCreate(
  values: Record<string, FieldValue>,
  fields: readonly FieldMeta[],
  registry: Registry,
  report: Report,
): void {
  checkValues(values, fields, registry, report, {
    flag: 'create',
    refused: "can't be set",
    emptied: 'is required',
  });
  for (const { key, write } of fields) {
    if (write.create && write.required && write.default === undefined && !(key in values)) {
      report(`"${key}" is required`, 'values', key);
    }
  }
}

/**
 * A create, checked against the resource's metadata: creatable fields only,
 * each value of its kind, and every required one without a default; a
 * required one is never null or [].
 */
export function createOf(meta: ResourceMeta, registry: Registry): v.GenericSchema<Create> {
  return checked(Create, (create, report) => {
    checkCreate(create.values, meta.fields, registry, report);
  });
}

/**
 * A patch, checked against the resource's metadata: updatable fields only,
 * each value of its kind; a required one can't be cleared.
 */
export function patchOf(meta: ResourceMeta, registry: Registry): v.GenericSchema<Patch> {
  return checked(Patch, (patch, report) => {
    checkValues(patch.values, meta.fields, registry, report, {
      flag: 'update',
      refused: "can't be changed",
      emptied: "can't be cleared",
    });
  });
}

/**
 * An action's input, checked against its fields as a create is: fields it
 * takes only, each value of its kind, and every required one without a
 * default.
 */
export function actionInputOf(
  action: ActionMeta,
  registry: Registry,
): v.GenericSchema<ActionInput> {
  return checked(ActionInput, (input, report) => {
    checkCreate(input.values, action.input, registry, report);
  });
}

/**
 * A row, checked against the resource's metadata: each key a field, each
 * value of its field's kind, null when unset; a many field's a list, [] when
 * unset. A url is absolute, with its scheme, or a path from the root: one
 * '/', never '//', which would name another host.
 */
export function rowOf(meta: ResourceMeta, registry: Registry): v.GenericSchema<Row> {
  return checked(Row, (row, report) => {
    for (const [key, value] of Object.entries(row)) {
      const field = meta.fields.find((each) => each.key === key);
      const kind = field && kindOf(registry, field.type.kind);
      if (!field) {
        report(`no field "${key}"`, key);
      } else if (!kind) {
        report(`no kind "${field.type.kind}"`, key);
      } else {
        const one = kind.value(field.type.settings);
        reportRefusals(field.type.many ? v.array(one) : v.nullable(one), value, report, key);
      }
    }
  });
}
