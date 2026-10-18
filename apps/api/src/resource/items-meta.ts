import {
  baseKinds,
  type AttributeMeta,
  type FieldMeta,
  type FieldQuery,
  type FieldType,
  type FieldWrite,
  type Json,
  type OptionMeta,
  type ResourceMeta,
  type Serves,
} from '@bh/resource';
import type { fields, itemTypeFields, itemTypes, options } from '@tickets/db';

// The items resource's metadata (bh's ResourceMeta, `GET /api/items/meta`),
// built from tickets' scheme: its types, fields and options. It reads rows as
// the database holds them and touches no database itself, so the routes
// (TK-13.3) load the rows and the adapter over item_values (TK-13.2) reads
// each field's kind and option order from what this gives.

type FieldRow = Pick<
  typeof fields.$inferSelect,
  'id' | 'schemeId' | 'key' | 'label' | 'type' | 'config' | 'optionSetId' | 'archivedAt'
>;
type TypeRow = Pick<
  typeof itemTypes.$inferSelect,
  'id' | 'schemeId' | 'key' | 'label' | 'position' | 'config' | 'archivedAt'
>;
type PlacementRow = Pick<
  typeof itemTypeFields.$inferSelect,
  'itemTypeId' | 'fieldId' | 'position' | 'required'
>;
type OptionRow = Pick<
  typeof options.$inferSelect,
  'id' | 'optionSetId' | 'value' | 'label' | 'position' | 'kind' | 'config' | 'archivedAt'
>;

/**
 * The schemes items live in, as their rows: every type, every field, where
 * each type places its fields, and the options of the fields' option sets.
 * Rows of several schemes may sit together; each row says its own.
 */
export interface ItemsScheme {
  types: readonly TypeRow[];
  fields: readonly FieldRow[];
  placements: readonly PlacementRow[];
  options: readonly OptionRow[];
}

// What the items resource serves (ResourceMeta.serves), as TK-13 plans it:
// queries over item_values (TK-13.2, TK-13.3) and the item commands behind
// the contract's writes (TK-13.4). tickets deletes no item (it archives one),
// and its adapter pages by number only.
const SERVES: Serves = {
  read: true,
  create: true,
  update: true,
  delete: false,
  filter: { any: true, not: true },
  sort: { max: 10 },
  page: { numbered: 'any', cursor: false, total: true, max: 500 },
};

// A status's group: options.kind, the one workflow meaning code knows. The
// labels are the web's (STATUS_KIND_GROUPS), in the order work moves.
const STATUS_GROUP: AttributeMeta = {
  key: 'kind',
  label: 'Group',
  kind: 'option',
  options: [
    { value: 'todo', label: 'To do', order: 0 },
    { value: 'active', label: 'Active', order: 1 },
    { value: 'blocked', label: 'Blocked', order: 2 },
    { value: 'done', label: 'Done', order: 3 },
    { value: 'dropped', label: 'Dropped', order: 4 },
  ],
};

// The kinds whose values are text: a field one scheme keeps as rich text and
// another as plain text is text to both.
const TEXTUAL = new Set(['text', 'richtext']);

// bh's two operators that compare one value with one value: a field holding a
// list isn't filtered by them.
const ONE_TO_ONE = new Set(['equals', 'notEquals']);

const READ_ONLY: FieldWrite = { create: false, update: false, required: false };

/**
 * What a query may do with a field of this type: everything its kind allows,
 * since an item is queryable by any of its fields (TK-13). A list isn't
 * compared one to one and doesn't sort; `isMe` only on a ref to users.
 */
function everything(type: FieldType): FieldQuery {
  const kind = baseKinds.has(type.kind) ? baseKinds.get(type.kind) : undefined;
  if (!kind) {
    throw new Error(`bh registers no kind "${type.kind}"`);
  }
  const many = type.many === true;
  const people = type.kind !== 'ref' || type.settings?.['of'] === 'users';
  return {
    filter: kind.operators.filter((op) => {
      return !(many && ONE_TO_ONE.has(op)) && (op !== 'isMe' || people);
    }),
    sort: kind.sort && !many,
    group: kind.group,
    search: kind.search,
  };
}

function field(key: string, label: string, type: FieldType, write = READ_ONLY): FieldMeta {
  return { key, label, type, query: everything(type), write };
}

/** An option field's settings as a field's type holds them. */
function optionSettings(options: OptionMeta[], attributes?: AttributeMeta[]): Record<string, Json> {
  // OptionMeta leaves an absent key out, never undefined, so it is JSON.
  return (attributes ? { options, attributes } : { options }) as unknown as Record<string, Json>;
}

/** A row's config, read as an object: config is jsonb, unknown to drizzle. */
function configOf(row: { config: unknown }): Record<string, unknown> {
  return typeof row.config === 'object' && row.config !== null
    ? (row.config as Record<string, unknown>)
    : {};
}

/** A stored color: one of bh's hue names in config.color (TK-5.21). */
function colorOf(row: { config: unknown }): { color?: string } {
  const color = configOf(row)['color'];
  return typeof color === 'string' && color !== '' ? { color } : {};
}

/** bh's kind for one of tickets' value kinds. */
function kindOf(row: FieldRow): string {
  switch (row.type) {
    case 'string': {
      // One editor writes both formats: its document's JSON, or markdown
      // through the API, which it reads as well.
      const format = configOf(row)['format'];
      return format === 'markdown' || format === 'rich' ? 'richtext' : 'text';
    }
    case 'user':
      return 'ref';
    default:
      return row.type;
  }
}

/** One option, merged across schemes: the first one's words, archived only where every one is. */
interface Merged {
  option: Omit<OptionMeta, 'order' | 'archived'>;
  archived: boolean;
}

/** Options by value, in the order met: the first one's label, color and group win. */
function mergeOptions(rows: readonly (OptionRow | TypeRow)[]): OptionMeta[] {
  const byValue = new Map<string, Merged>();
  for (const row of rows) {
    const value = 'value' in row ? row.value : row.key;
    const archived = row.archivedAt !== null;
    const met = byValue.get(value);
    if (met) {
      met.archived &&= archived;
      continue;
    }
    if (value === '') {
      continue;
    }
    const group = 'kind' in row && row.kind !== null ? { attributes: { kind: row.kind } } : {};
    byValue.set(value, {
      option: { value, label: row.label, ...colorOf(row), ...group },
      archived,
    });
  }
  return [...byValue.values()].map(({ option, archived }, order) => ({
    ...option,
    order,
    ...(archived ? { archived: true as const } : {}),
  }));
}

/** The scheme ids, in order: the first scheme's words win where two say different things. */
function schemeIds(scheme: ItemsScheme): number[] {
  const ids = new Set([...scheme.types, ...scheme.fields].map((row) => row.schemeId));
  return [...ids].sort((a, b) => a - b);
}

/**
 * Each scheme's fields, scheme by scheme, each in the order its types place
 * them (types by position, then their placements), then the ones no type
 * places, by id.
 */
function fieldsInOrder(scheme: ItemsScheme): FieldRow[] {
  const byPosition = <T extends { position: number }>(a: T, b: T) => a.position - b.position;
  const ordered: FieldRow[] = [];
  for (const schemeId of schemeIds(scheme)) {
    const own = scheme.fields.filter((row) => row.schemeId === schemeId);
    const seen = new Set<number>();
    const types = scheme.types.filter((row) => row.schemeId === schemeId).sort(byPosition);
    for (const type of types) {
      const placed = scheme.placements.filter((row) => row.itemTypeId === type.id).sort(byPosition);
      for (const placement of placed) {
        const row = own.find((each) => each.id === placement.fieldId);
        if (row && !seen.has(row.id)) {
          seen.add(row.id);
          ordered.push(row);
        }
      }
    }
    ordered.push(...own.filter((row) => !seen.has(row.id)).sort((a, b) => a.id - b.id));
  }
  return ordered;
}

/**
 * Whether every type items may be made of places a field of this key and
 * requires it: a create of any type must then set it.
 */
function requiredEverywhere(key: string, scheme: ItemsScheme): boolean {
  const types = scheme.types.filter((row) => row.archivedAt === null);
  return (
    types.length > 0 &&
    types.every((type) => {
      return scheme.placements.some((placement) => {
        const row = scheme.fields.find((each) => each.id === placement.fieldId);
        return (
          placement.itemTypeId === type.id &&
          placement.required &&
          row?.key === key &&
          row.archivedAt === null
        );
      });
    })
  );
}

/** One field of every scheme's fields of one key. */
function schemeField(rows: FieldRow[], scheme: ItemsScheme): FieldMeta {
  const [first] = rows as [FieldRow, ...FieldRow[]];
  const kinds = rows.map(kindOf);
  const same = kinds.every((kind) => kind === kinds[0]);
  const kind = same ? kindOf(first) : kinds.every((each) => TEXTUAL.has(each)) ? 'text' : 'json';
  const many = rows.some((row) => configOf(row)['multiple'] === true);
  let settings: Record<string, Json> | undefined;
  if (kind === 'option') {
    const sets = rows.map((row) => {
      return scheme.options
        .filter((option) => option.optionSetId === row.optionSetId)
        .sort((a, b) => a.position - b.position);
    });
    const options = mergeOptions(sets.flat());
    const grouped = options.some((option) => option.attributes !== undefined);
    settings = optionSettings(options, grouped ? [STATUS_GROUP] : undefined);
  } else if (kind === 'ref') {
    settings = { of: 'users' };
  }
  const type: FieldType = {
    kind,
    ...(settings ? { settings } : {}),
    ...(many ? { many: true as const } : {}),
  };
  return field(first.key, first.label, type, {
    create: true,
    update: true,
    required: requiredEverywhere(first.key, scheme),
  });
}

// The keys the item's own columns take. A scheme's field of one of them, or
// with a dot (which starts a path, 'status.kind'), can't be named in the
// contract, so it is left out.
const BUILT_IN = new Set([
  'id',
  'key',
  'number',
  'name',
  'project',
  'type',
  'parent',
  'createdBy',
  'createdAt',
  'updatedAt',
  'archived',
]);

/**
 * The items resource's metadata, built from the schemes items live in.
 *
 * Choices where tickets' model and the contract part ways:
 * - One resource, every item across projects, so one field per key across
 *   schemes: an option field's options join by value, in scheme order
 *   (lowest id first), then each set's position, the first scheme's label,
 *   color and group winning, archived only where every scheme has it
 *   archived. Kinds that differ widen to one that holds them all: text for
 *   text and rich text, json for any other mix; a list when any scheme's is.
 * - Fields are the scheme's, placed per type; the metadata is per resource,
 *   so a field is required only when every type requires it, and which type
 *   places which field, and its status subset, stay the commands' checks.
 * - The `markdown` and `rich` formats are one editor in tickets, writing its
 *   document's JSON (or markdown, through the API): both are bh's richtext.
 * - The title is `name`, '{key} {title}': an item's key is its name wherever
 *   it's written ('TIX-12', and a plan's 'TK-13.1'), where
 *   '{project}-{number}' would show the project's title and miss plan keys.
 * - project, parent and createdBy hold ids (items.project_id, parent_id,
 *   created_by); type holds the type's key, an option across schemes.
 * - archived is a boolean a patch sets, as item.update takes it.
 * - A scheme's field whose key is a built-in's, or holds a dot, or that is
 *   archived, is left out.
 */
export function buildItemsMeta(scheme: ItemsScheme): ResourceMeta {
  const byKey = new Map<string, FieldRow[]>();
  for (const row of fieldsInOrder(scheme)) {
    if (
      row.archivedAt !== null ||
      BUILT_IN.has(row.key) ||
      row.key.includes('.') ||
      row.key === ''
    ) {
      continue;
    }
    byKey.set(row.key, [...(byKey.get(row.key) ?? []), row]);
  }
  const own = [...byKey.values()].map((rows) => schemeField(rows, scheme));

  const types = schemeIds(scheme).flatMap((schemeId) => {
    return scheme.types
      .filter((row) => row.schemeId === schemeId)
      .sort((a, b) => a.position - b.position);
  });
  const titled = own.some((each) => each.key === 'title');
  const name: FieldMeta = {
    ...field('name', 'Name', { kind: 'text' }),
    template: titled ? '{key} {title}' : '{key}',
    // key and title each filter and sort; their join is searched.
    query: { filter: [], sort: false, group: false, search: true },
  };

  return {
    resource: 'items',
    label: { one: 'Item', other: 'Items' },
    roles: { idField: 'id', titleField: 'name', versionField: 'updatedAt' },
    fields: [
      field('id', 'Id', { kind: 'number', settings: { integer: true } }),
      field('key', 'Key', { kind: 'text' }),
      field('number', 'Number', { kind: 'number', settings: { integer: true } }),
      name,
      field(
        'project',
        'Project',
        { kind: 'ref', settings: { of: 'projects' } },
        { create: true, update: false, required: true },
      ),
      field(
        'type',
        'Type',
        { kind: 'option', settings: optionSettings(mergeOptions(types)) },
        { create: true, update: false, required: true },
      ),
      field(
        'parent',
        'Parent',
        { kind: 'ref', settings: { of: 'items' } },
        { create: true, update: true, required: false },
      ),
      ...own,
      field('createdBy', 'Created by', { kind: 'ref', settings: { of: 'users' } }),
      field('createdAt', 'Created', { kind: 'datetime' }),
      field('updatedAt', 'Updated', { kind: 'datetime' }),
      field(
        'archived',
        'Archived',
        { kind: 'boolean' },
        { create: false, update: true, required: true },
      ),
    ],
    sort: [{ field: 'updatedAt', dir: 'desc' }],
    actions: [],
    serves: SERVES,
  };
}
