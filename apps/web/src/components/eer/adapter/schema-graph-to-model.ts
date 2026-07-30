import { qualifiedName, type SchemaGraph } from '../../schema/erd-types';
import { loadModel } from '../engine/model/load-model';
import type { LoadResult } from '../engine/model/types';

/**
 * SchemaGraph (what GET /api/schema returns) -> the eer diagram Model.
 *
 * Builds the RAW json shape `loadModel` already accepts and hands it over,
 * rather than hand-constructing a Model. loadModel owns normalisation, legacy
 * shape migration, and — critically — deriveRelationships, which turns `fk`
 * constraints into edges. Constructing a Model directly would make this file a
 * second source of truth for edge derivation, and the two would drift.
 *
 * Identity is the QUALIFIED name throughout (`schema.table`, bare in public):
 * `terminal.sessions` and `agent.sessions` share a bare name, so a bare key
 * would collapse two independent subsystems into one card.
 */
export function schemaGraphToModel(graph: SchemaGraph): LoadResult {
  const entities = graph.tables.map((t) => {
    const id = qualifiedName(t.schema, t.name);

    const columns = t.columns.map((c) => ({
      name: c.name,
      type: c.type,
      nullable: !c.notNull,
    }));

    // A pk constraint is what draws the PK badge (columnRoles derives badges
    // from constraints, never from a stored flag), and an fk constraint is what
    // draws an edge — deriveRelationships regenerates one edge per resolvable
    // fk. Both must therefore be expressed as constraints, not as column flags.
    const constraints: Record<string, unknown>[] = [];
    if (t.primaryKey.length > 0) {
      constraints.push({ kind: 'pk', name: null, columns: [...t.primaryKey] });
    }
    for (const u of t.uniques) {
      constraints.push({ kind: 'unique', name: u.name, columns: [...u.columns] });
    }
    for (const c of t.columns) {
      if (!c.fk) continue;
      constraints.push({
        kind: 'fk',
        name: null,
        columns: [c.name],
        refSchema: c.fk.schema,
        // deriveConstraintEdges resolves the target via
        // `model.entityById.get(c.refTable)`, and entityById is keyed by the
        // QUALIFIED name (see `id` above) — a bare table name would look up
        // "projects" against a map that only has "core.projects" and silently
        // fail to resolve, dropping the edge with no error or warning.
        refTable: qualifiedName(c.fk.schema, c.fk.table),
        refColumns: [c.fk.column],
      });
    }

    return { id, label: t.name, group: t.group, schema: t.schema, columns, constraints };
  });

  const groups = graph.groups.map((g, order) => ({ id: g.key, label: g.label, order }));

  const enums = graph.enums.map((e) => ({
    name: e.name,
    schema: e.schema,
    values: [...e.values],
  }));

  // Colour overrides keyed by group id: the graph's hue NAMES resolve to token
  // values here, at the one boundary that knows both vocabularies. groupColor
  // passes these straight into color-mix() recipes, so a token value works
  // wherever a colour does — and it flips with the theme, which a hex could not.
  const colors: Record<string, string> = {};
  for (const g of graph.groups) colors[g.key] = `var(--color-${g.color}-9)`;

  const result = loadModel({
    meta: { title: 'Database schema' },
    groups,
    entities,
    enums,
    colors,
  });

  // loadModel always returns a (possibly garbage) model object even when it
  // also reports errors — errors are advisory there, left for a caller to
  // check. This adapter's contract is stricter: an errored load has no usable
  // model, so callers can do `if (result.model)` without also remembering to
  // check `errors.length`.
  if (result.errors.length > 0) return { model: null, errors: result.errors, warnings: result.warnings };
  return result;
}
