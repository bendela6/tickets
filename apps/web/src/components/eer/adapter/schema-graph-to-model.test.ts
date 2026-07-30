import { describe, expect, it } from 'vitest';
import { schemaGraphToModel } from './schema-graph-to-model';
import type { SchemaGraph } from '../../schema/erd-types';

const graph: SchemaGraph = {
  tables: [
    {
      name: 'projects', schema: 'core', group: 'ws',
      columns: [{ name: 'id', type: 'integer', notNull: true, pk: true, fk: null }],
      primaryKey: ['id'], uniques: [],
    },
    {
      name: 'items', schema: 'records', group: 'rc',
      columns: [
        { name: 'id', type: 'integer', notNull: true, pk: true, fk: null },
        {
          name: 'project_id', type: 'integer', notNull: true, pk: false,
          fk: { schema: 'core', table: 'projects', column: 'id' },
        },
        { name: 'title', type: 'text', notNull: false, pk: false, fk: null },
      ],
      primaryKey: ['id'], uniques: [],
    },
  ],
  groups: [
    { key: 'ws', label: 'Workspace', color: 'blue', tables: ['core.projects'] },
    { key: 'rc', label: 'Records', color: 'orange', tables: ['records.items'] },
  ],
  enums: [{ name: 'status_kind', schema: 'structure', values: ['todo', 'active', 'done'] }],
};

describe('schemaGraphToModel', () => {
  it('produces a loadable model with no errors', () => {
    const { model, errors } = schemaGraphToModel(graph);
    expect(errors).toEqual([]);
    expect(model).not.toBeNull();
  });

  it('keys entities by qualified name so same-named tables stay distinct', () => {
    const { model } = schemaGraphToModel(graph);
    expect(model!.entityById.has('records.items')).toBe(true);
    expect(model!.entityById.has('core.projects')).toBe(true);
  });

  it('carries each table schema onto its entity', () => {
    const { model } = schemaGraphToModel(graph);
    expect(model!.entityById.get('records.items')!.schema).toBe('records');
  });

  // deriveRelationships' established convention (see derive-relationships.ts
  // and its own test suite): `source` is the REFERENCED ("one") side and
  // `target` is the fk-owning ("many") side — confirmed by infer-cardinality's
  // pk/fk tagging (source pk + target fk => '1-n'). The adapter must feed
  // constraints through unchanged rather than swap the direction to read more
  // naturally, or it would disagree with every other loader of this engine.
  it('derives one relationship per foreign key, pointing at the referenced table', () => {
    const { model } = schemaGraphToModel(graph);
    expect(model!.relationships).toHaveLength(1);
    const rel = model!.relationships[0]!;
    expect(rel.source).toBe('core.projects');
    expect(rel.sourceField).toBe('id');
    expect(rel.target).toBe('records.items');
    expect(rel.targetField).toBe('project_id');
  });

  it('marks primary key columns through a pk constraint', () => {
    const { model } = schemaGraphToModel(graph);
    const items = model!.entityById.get('records.items')!;
    const pk = items.constraints.find((c) => c.kind === 'pk');
    expect(pk).toBeDefined();
    expect(pk!.columns).toEqual(['id']);
  });

  it('maps notNull onto nullable, inverted', () => {
    const { model } = schemaGraphToModel(graph);
    const items = model!.entityById.get('records.items')!;
    expect(items.columns.find((c) => c.name === 'id')!.nullable).toBe(false);
    expect(items.columns.find((c) => c.name === 'title')!.nullable).toBe(true);
  });

  it('turns each graph group into a zone carrying its label', () => {
    const { model } = schemaGraphToModel(graph);
    expect(model!.groups.map((g) => g.id).sort()).toEqual(['rc', 'ws']);
    expect(model!.groups.find((g) => g.id === 'rc')!.label).toBe('Records');
  });

  it('assigns every entity to its declared group', () => {
    const { model } = schemaGraphToModel(graph);
    expect(model!.entityById.get('records.items')!.group).toBe('rc');
  });

  it('carries enums through with their values in order', () => {
    const { model } = schemaGraphToModel(graph);
    const e = model!.enums.find((x) => x.name === 'status_kind')!;
    expect(e.values).toEqual(['todo', 'active', 'done']);
    expect(e.schema).toBe('structure');
  });

  // loadModel treats empty groups/entities as a load ERROR ("Missing or empty
  // required key"), so the adapter reports rather than swallows it. The route
  // never gets here — it renders "No tables in this database" when
  // graph.tables is empty — but the adapter must degrade rather than throw if
  // it ever is called that way.
  it('surfaces load errors for an empty graph instead of throwing', () => {
    const result = schemaGraphToModel({ tables: [], groups: [], enums: [] });
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.join(' ')).toContain('entities');
    expect(result.model).toBeNull();
  });
});
