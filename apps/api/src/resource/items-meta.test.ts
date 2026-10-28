import { describe, expect, it } from 'vitest';
import { createRegistry, metaOf, type FieldMeta, type ResourceMeta } from '@tilewise/resource';
import { planScheme, softwareScheme, type SchemeDef } from '@tickets/db';
import { buildItemsMeta, type ItemsScheme } from './items-meta';

// No database: the schemes' rows are made from the seeds' definitions the way
// seedScheme inserts them, each scheme with its own ids.
function rowsOf(...defs: SchemeDef[]): ItemsScheme {
  const rows: ItemsScheme = { types: [], fields: [], placements: [], options: [] };
  const types = rows.types as ItemsScheme['types'][number][];
  const fields = rows.fields as ItemsScheme['fields'][number][];
  const placements = rows.placements as ItemsScheme['placements'][number][];
  const options = rows.options as ItemsScheme['options'][number][];
  let id = 0;
  for (const [index, def] of defs.entries()) {
    const schemeId = index + 1;
    const setIds = new Map<string, number>();
    const optionIds = new Map<string, number>();
    for (const set of def.optionSets) {
      setIds.set(set.key, ++id);
      for (const [position, option] of set.options.entries()) {
        optionIds.set(`${set.key}:${option.value}`, ++id);
        options.push({
          id,
          optionSetId: setIds.get(set.key)!,
          value: option.value,
          label: option.label,
          position,
          kind: option.kind ?? null,
          config: option.config ?? {},
          archivedAt: null,
        });
      }
    }
    const fieldIds = new Map<string, number>();
    for (const field of def.fields) {
      fieldIds.set(field.key, ++id);
      fields.push({
        id,
        schemeId,
        key: field.key,
        label: field.label,
        type: field.type,
        config: field.config ?? {},
        optionSetId: field.optionSetKey ? setIds.get(field.optionSetKey)! : null,
        archivedAt: null,
      });
    }
    for (const [position, type] of def.types.entries()) {
      types.push({
        id: ++id,
        schemeId,
        key: type.key,
        label: type.label,
        position,
        config: type.config ?? {},
        archivedAt: null,
      });
      for (const [at, placement] of type.placements.entries()) {
        placements.push({
          itemTypeId: id,
          fieldId: fieldIds.get(placement.fieldKey)!,
          position: at,
          required: placement.required ?? false,
        });
      }
    }
  }
  return rows;
}

/** The contract's own check of the metadata: [] when it holds. */
function problemsOf(meta: ResourceMeta): string[] {
  const result = metaOf(createRegistry())['~standard'].validate(meta);
  if (result instanceof Promise) {
    throw new Error('metaOf checks synchronously');
  }
  return (result.issues ?? []).map((issue) => {
    const path = (issue.path ?? []).map((key) => (typeof key === 'object' ? key.key : key));
    return `${path.join('.')}: ${issue.message}`;
  });
}

function fieldOf(meta: ResourceMeta, key: string): FieldMeta {
  const found = meta.fields.find((field) => field.key === key);
  if (!found) {
    throw new Error(`no field "${key}"`);
  }
  return found;
}

/** An option field's options, as its type's settings hold them. */
function optionsOf(field: FieldMeta): { value: string; label: string; order: number }[] {
  return (field.type.settings?.['options'] ?? []) as never;
}

describe('the items resource built from the seeded schemes', () => {
  const meta = buildItemsMeta(rowsOf(softwareScheme, planScheme));

  it('is metadata the contract accepts, for each scheme alone and both together', () => {
    expect(problemsOf(meta)).toEqual([]);
    expect(problemsOf(buildItemsMeta(rowsOf(softwareScheme)))).toEqual([]);
    expect(problemsOf(buildItemsMeta(rowsOf(planScheme)))).toEqual([]);
  });

  it('names an item by its key and title, checks writes by updatedAt, and serves no delete', () => {
    expect(meta.resource).toBe('items');
    expect(meta.label).toEqual({ one: 'Item', other: 'Items' });
    expect(meta.roles).toEqual({ idField: 'id', titleField: 'name', versionField: 'updatedAt' });
    expect(fieldOf(meta, 'name').template).toBe('{key} {title}');
    expect(fieldOf(meta, 'name').write).toEqual({ create: false, update: false, required: false });
    expect(meta.serves.delete).toBe(false);
    expect(meta.sort).toEqual([{ field: 'updatedAt', dir: 'desc' }]);
  });

  it('makes the project, the parent and who created it refs to their resources', () => {
    expect(fieldOf(meta, 'project').type).toEqual({ kind: 'ref', settings: { of: 'projects' } });
    expect(fieldOf(meta, 'parent').type).toEqual({ kind: 'ref', settings: { of: 'items' } });
    expect(fieldOf(meta, 'createdBy').type).toEqual({ kind: 'ref', settings: { of: 'users' } });
    // a create names its project and type; neither changes after
    expect(fieldOf(meta, 'project').write).toEqual({ create: true, update: false, required: true });
    expect(fieldOf(meta, 'type').write).toEqual({ create: true, update: false, required: true });
    expect(fieldOf(meta, 'parent').write).toEqual({ create: true, update: true, required: false });
    // isMe asks whether the row points at the viewer: only a ref to users
    expect(fieldOf(meta, 'createdBy').query.filter).toContain('isMe');
    expect(fieldOf(meta, 'project').query.filter).not.toContain('isMe');
    expect(fieldOf(meta, 'parent').query.filter).not.toContain('isMe');
  });

  it('keeps the columns the server sets out of every write, and lets a patch archive', () => {
    for (const key of ['id', 'key', 'number', 'createdBy', 'createdAt', 'updatedAt']) {
      expect(fieldOf(meta, key).write, key).toEqual({
        create: false,
        update: false,
        required: false,
      });
    }
    expect(fieldOf(meta, 'archived').type).toEqual({ kind: 'boolean' });
    expect(fieldOf(meta, 'archived').write).toEqual({
      create: false,
      update: true,
      required: true,
    });
  });

  it('maps each of tickets value kinds to one of bh', () => {
    expect(fieldOf(meta, 'title').type).toEqual({ kind: 'text' });
    expect(fieldOf(meta, 'pr').type).toEqual({ kind: 'text' });
    // markdown in the plan's scheme, rich in software's: one editor, rich text
    expect(fieldOf(meta, 'description').type).toEqual({ kind: 'richtext' });
    expect(fieldOf(meta, 'findings').type).toEqual({ kind: 'richtext' });
    expect(fieldOf(meta, 'target_date').type).toEqual({ kind: 'date' });
    expect(fieldOf(meta, 'where').type).toEqual({ kind: 'json' });
    expect(fieldOf(meta, 'assignee').type).toEqual({ kind: 'ref', settings: { of: 'users' } });
    expect(fieldOf(meta, 'assignee').query.filter).toContain('isMe');
    expect(fieldOf(meta, 'labels').type).toMatchObject({ kind: 'option', many: true });
  });

  it('lists every field once, the built-in ones around the schemes own', () => {
    const keys = meta.fields.map((field) => field.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.slice(0, 7)).toEqual(['id', 'key', 'number', 'name', 'project', 'type', 'parent']);
    expect(keys.slice(-4)).toEqual(['createdBy', 'createdAt', 'updatedAt', 'archived']);
    // software's fields as its first type places them, then the plan's new ones
    expect(keys.slice(7, 10)).toEqual(['title', 'description', 'status']);
    expect(keys.indexOf('statusNote')).toBeGreaterThan(keys.indexOf('steps'));
  });

  it('joins a key across schemes: status holds both workflows, in order, each option once', () => {
    const status = optionsOf(fieldOf(meta, 'status'));
    const values = status.map((option) => option.value);
    expect(new Set(values).size).toBe(values.length);
    // software's twelve first, as positioned, then the plan's new four
    expect(values.slice(0, 3)).toEqual(['triage', 'backlog', 'todo']);
    expect(values.slice(-4)).toEqual(['not-planned', 'planning', 'planned', 'designed']);
    expect(status.map((option) => option.order)).toEqual(values.map((_, at) => at));
  });

  it('gives a status its group, so status.kind filters every project by what it means', () => {
    const status = fieldOf(meta, 'status');
    expect(optionsOf(status).find((option) => option.value === 'wont-fix')).toMatchObject({
      label: "Won't fix",
      attributes: { kind: 'dropped' },
    });
    expect(status.type.settings?.['attributes']).toEqual([
      expect.objectContaining({ key: 'kind', kind: 'option' }),
    ]);
    // priority has no workflow meaning, so no group
    expect(fieldOf(meta, 'priority').type.settings?.['attributes']).toBeUndefined();
  });

  it('makes the type an option of every scheme types, by key, in their colors', () => {
    const types = optionsOf(fieldOf(meta, 'type'));
    expect(types.map((option) => option.value)).toEqual([
      'epic',
      'task',
      'bug',
      'spike',
      'subtask',
      'feature',
      'ticket',
      'subticket',
    ]);
    expect(types[0]).toEqual({ value: 'epic', label: 'Epic', color: 'indigo', order: 0 });
  });

  it('requires a field only where every type requires it', () => {
    expect(fieldOf(meta, 'title').write.required).toBe(true);
    // the plan's features require where; its tickets and software's types don't
    expect(fieldOf(meta, 'where').write.required).toBe(false);
    expect(fieldOf(meta, 'status').write).toEqual({ create: true, update: true, required: false });
  });

  it('allows a query everything a field kind does, but no one-to-one compare or sort on a list', () => {
    expect(fieldOf(meta, 'status').query).toEqual({
      filter: ['equals', 'notEquals', 'in', 'notIn', 'empty', 'notEmpty'],
      sort: true,
      group: true,
      search: false,
    });
    expect(fieldOf(meta, 'labels').query).toEqual({
      filter: ['in', 'notIn', 'empty', 'notEmpty'],
      sort: false,
      group: true,
      search: false,
    });
    expect(fieldOf(meta, 'title').query.search).toBe(true);
    expect(fieldOf(meta, 'name').query).toEqual({
      filter: [],
      sort: false,
      group: false,
      search: true,
    });
  });
});

describe('the items resource built from rows that differ from the seeds', () => {
  it('carries an option color, and marks archived an option archived wherever it is', () => {
    const rows = rowsOf(softwareScheme, planScheme);
    const options = rows.options as ItemsScheme['options'][number][];
    const todo = options.filter((option) => option.value === 'todo');
    const high = options.find((option) => option.value === 'high')!;
    const triage = options.find((option) => option.value === 'triage')!;
    Object.assign(high, { config: { color: 'orange' } });
    Object.assign(triage, { archivedAt: '2026-10-01T00:00:00Z' });
    // archived in one scheme, in use in the other: still offered
    Object.assign(todo[0]!, { archivedAt: '2026-10-01T00:00:00Z' });
    const meta = buildItemsMeta(rows);
    expect(problemsOf(meta)).toEqual([]);
    const priority = optionsOf(fieldOf(meta, 'priority'));
    expect(priority.find((option) => option.value === 'high')).toMatchObject({ color: 'orange' });
    const status = optionsOf(fieldOf(meta, 'status'));
    expect(status.find((option) => option.value === 'triage')).toMatchObject({ archived: true });
    expect(status.find((option) => option.value === 'todo')).not.toHaveProperty('archived');
  });

  it('widens a key whose kinds differ between schemes to one kind that holds both', () => {
    const other: SchemeDef = {
      ...planScheme,
      key: 'other',
      fields: [
        { key: 'title', label: 'Title', type: 'string', system: true },
        // rich text in software, plain text here: text
        { key: 'description', label: 'Description', type: 'string' },
        // an option in software, a number here: json
        { key: 'priority', label: 'Priority', type: 'number' },
        // one user in software, several here: several
        { key: 'assignee', label: 'Assignee', type: 'user', config: { multiple: true } },
      ],
      optionSets: [],
      types: [
        { key: 'thing', label: 'Thing', placements: [{ fieldKey: 'title', required: true }] },
      ],
    };
    const meta = buildItemsMeta(rowsOf(softwareScheme, other));
    expect(problemsOf(meta)).toEqual([]);
    expect(fieldOf(meta, 'description').type).toEqual({ kind: 'text' });
    expect(fieldOf(meta, 'priority').type).toEqual({ kind: 'json' });
    expect(fieldOf(meta, 'assignee').type).toEqual({
      kind: 'ref',
      settings: { of: 'users' },
      many: true,
    });
    expect(fieldOf(meta, 'assignee').query.filter).not.toContain('equals');
  });

  it('leaves out a field the contract cant name, and an archived one', () => {
    const rows = rowsOf(softwareScheme);
    const fields = rows.fields as ItemsScheme['fields'][number][];
    const base = {
      schemeId: 1,
      label: 'X',
      type: 'string' as const,
      config: {},
      optionSetId: null,
    };
    fields.push(
      { ...base, id: 9001, key: 'project', archivedAt: null },
      { ...base, id: 9002, key: 'status.note', archivedAt: null },
      { ...base, id: 9003, key: 'gone', archivedAt: '2026-10-01T00:00:00Z' },
    );
    const meta = buildItemsMeta(rows);
    expect(problemsOf(meta)).toEqual([]);
    const keys = meta.fields.map((field) => field.key);
    expect(keys).not.toContain('status.note');
    expect(keys).not.toContain('gone');
    expect(keys.filter((key) => key === 'project')).toHaveLength(1);
    expect(fieldOf(meta, 'project').type.kind).toBe('ref');
  });

  it('names an item by its key alone when no scheme has a title', () => {
    const untitled: SchemeDef = {
      ...planScheme,
      fields: [{ key: 'summary', label: 'Summary', type: 'string' }],
      optionSets: [],
      types: [{ key: 'note', label: 'Note', placements: [{ fieldKey: 'summary' }] }],
    };
    const meta = buildItemsMeta(rowsOf(untitled));
    expect(problemsOf(meta)).toEqual([]);
    expect(fieldOf(meta, 'name').template).toBe('{key}');
  });
});
