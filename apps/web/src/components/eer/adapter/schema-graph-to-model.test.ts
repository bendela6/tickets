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

  // The `colors` key had zero assertions: the whole hue -> token boundary could
  // have been deleted and every other test here would still pass. It is keyed
  // by GROUP id (not table, not hue name) because that is what groupColor looks
  // up, and the value is a token rather than a hex so it flips with the theme.
  it('resolves each group hue to a theme token, keyed by group id', () => {
    const { model } = schemaGraphToModel(graph);
    expect(model!.colors.get('ws')).toBe('var(--color-blue-9)');
    expect(model!.colors.get('rc')).toBe('var(--color-orange-9)');
  });

  it('drops the override for a hue it cannot paint, rather than emitting an undefined property', () => {
    // `var(--color-chartreuse-9)` is not a declared token, and an undefined
    // custom property invalidates the whole declaration — the group would paint
    // nothing at all. No override instead, so groupColor falls back to its own
    // palette and the zone still has a colour.
    const odd: SchemaGraph = {
      ...graph,
      groups: [{ ...graph.groups[0]!, color: 'chartreuse' }, graph.groups[1]!],
    };
    const { model } = schemaGraphToModel(odd);
    expect(model!.colors.has('ws')).toBe(false);
    expect(model!.colors.get('rc')).toBe('var(--color-orange-9)');
  });

  // `uniques` was `[]` in every fixture, so the loop that forwards it was
  // indistinguishable from deleted code. A unique on an fk COLUMN is what turns
  // a crow's foot into a 1-1 tick (deriveRelationships' cardinalityOf), so this
  // asserts both the constraint arriving and the cardinality it changes.
  it('forwards unique constraints, which is what makes an fk edge read 1-1', () => {
    const oneToOne: SchemaGraph = {
      ...graph,
      tables: graph.tables.map((t) =>
        t.name === 'items'
          ? { ...t, uniques: [{ name: 'items_project_id_key', columns: ['project_id'] }] }
          : t,
      ),
    };
    const { model } = schemaGraphToModel(oneToOne);
    const items = model!.entityById.get('records.items')!;
    const unique = items.constraints.find((c) => c.kind === 'unique')!;
    expect(unique).toBeDefined();
    expect(unique.name).toBe('items_project_id_key');
    expect(unique.columns).toEqual(['project_id']);
    // Same fixture without the unique derives '1-n' (see the fk test above).
    expect(model!.relationships[0]!.cardinality).toBe('1-1');
    expect(schemaGraphToModel(graph).model!.relationships[0]!.cardinality).toBe('1-n');
  });

  // An fk pointing at a table the graph does not carry (it lives in a schema
  // the introspection did not cover) drops its edge silently: deriveConstraint-
  // Edges skips it and loadModel only WARNS. The warning is the only trace, so
  // the adapter must forward it — and schema-route must show it, or the user
  // just sees a missing line.
  it('warns rather than silently dropping an fk whose target table is absent', () => {
    const dangling: SchemaGraph = {
      ...graph,
      tables: graph.tables.filter((t) => t.name !== 'projects'),
      groups: [graph.groups[1]!],
    };
    const { model, errors, warnings } = schemaGraphToModel(dangling);
    expect(errors).toEqual([]);
    expect(model!.relationships).toHaveLength(0); // the edge really is gone
    expect(warnings.join(' ')).toContain('core.projects');
    expect(warnings.join(' ')).toMatch(/unknown table/i);
  });

  // `name` is the enum's QUALIFIED identity (schema.name), not the bare name
  // pgEnum prints — see the "qualifies enum identity" test below for why.
  it('carries enums through with their values in order, keyed by qualified name', () => {
    const { model } = schemaGraphToModel(graph);
    const e = model!.enums.find((x) => x.name === 'structure.status_kind')!;
    expect(e).toBeDefined();
    expect(e.values).toEqual(['todo', 'active', 'done']);
    expect(e.schema).toBe('structure');
  });

  // The introspection side (describe-schema.ts) reports an enum COLUMN's type
  // as the enum's schema-qualified identity (qualifiedName(enumSchema,
  // enumName)) — deliberately, because two same-named enums in different
  // schemas (terminal.session_status vs agent.session_status) would otherwise
  // collapse into one. loadModel's unknown-type check only clears a column
  // whose type string is a KNOWN pg type OR matches a declared enum's `name`
  // exactly, so that name must carry the same qualification the column type
  // does, or every enum column false-positives as "unknown type".
  it('qualifies enum identity so a same-named enum in another schema does not false-positive an unknown-type warning', () => {
    const twoSchemas: SchemaGraph = {
      tables: [
        {
          name: 'sessions', schema: 'terminal', group: 'term',
          columns: [
            { name: 'id', type: 'integer', notNull: true, pk: true, fk: null },
            { name: 'status', type: 'terminal.session_status', notNull: true, pk: false, fk: null },
          ],
          primaryKey: ['id'], uniques: [],
        },
        {
          name: 'sessions', schema: 'agent', group: 'agt',
          columns: [
            { name: 'id', type: 'integer', notNull: true, pk: true, fk: null },
            { name: 'status', type: 'agent.session_status', notNull: true, pk: false, fk: null },
          ],
          primaryKey: ['id'], uniques: [],
        },
      ],
      groups: [
        { key: 'term', label: 'Terminal', color: 'blue', tables: ['terminal.sessions'] },
        { key: 'agt', label: 'Agent', color: 'orange', tables: ['agent.sessions'] },
      ],
      enums: [
        { name: 'session_status', schema: 'terminal', values: ['idle', 'running'] },
        { name: 'session_status', schema: 'agent', values: ['pending', 'active'] },
      ],
    };

    const { model, errors, warnings } = schemaGraphToModel(twoSchemas);
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);

    // The enum columns still display their fully qualified type, and the two
    // same-named enums stay distinct rather than collapsing into one.
    const term = model!.entityById.get('terminal.sessions')!;
    const agt = model!.entityById.get('agent.sessions')!;
    expect(term.columns.find((c) => c.name === 'status')!.type).toBe('terminal.session_status');
    expect(agt.columns.find((c) => c.name === 'status')!.type).toBe('agent.session_status');
    expect(model!.enums.map((e) => e.name).sort()).toEqual(['agent.session_status', 'terminal.session_status']);
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
