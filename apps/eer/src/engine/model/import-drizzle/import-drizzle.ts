// Pure transform: a drizzle schema (introspected on the Node side into a
// SchemaDescription) plus the current Model (or null, on a first import) ->
// a merged Model plus a dry-run ImportReport. No DOM, no drizzle import, no
// filesystem — the only import from `src/node` anywhere in this file is a
// TYPE-ONLY one (the wire types), which `verbatimModuleSyntax` guarantees is
// erased at compile time and never pulls drizzle-orm into the engine bundle.
//
// MERGE, DON'T CLOBBER is the whole point of this module: a table already in
// the model keeps its zone, position, label, description, per-column
// title/description, and any colour override keyed by its id. Only the SQL
// facts — columns, constraints, indexes, schema — are replaced from the
// description. The merged raw JSON is handed to `loadModel` rather than a
// hand-built Model, so this module isn't a second source of truth for
// normalisation, index-column shape migration, alias folding, or (critically)
// deriving relationships from FK constraints — `loadModel` already does all
// of that. The non-derivable half of the existing model (meta, view, kinds,
// hand-authored non-fk relationships, group bounds) is recovered the same
// way: by round-tripping the existing model through `serializeModel`, the
// exact function that already knows what's safe to omit vs. must be written.
//
// Removed tables are reported AND already removed from the returned model —
// the caller (the import modal, a later task) only applies the result once
// the user confirms, so the dry-run report IS the consent. There is no
// "stale" flag: Cancel changes nothing, Apply is exactly this return value.

import { loadModel } from '../load-model';
import { parseType } from '../pg-types';
import { serializeModel } from '../serialize-model';
import type { Column, Entity, Model } from '../types';

import type {
  ColumnDescription,
  SchemaDescription,
  TableDescription,
  UnsupportedConstruct,
} from '../../../node/describe-drizzle';

export interface ChangeRow {
  table: string;
  detail: string; // e.g. '+2 columns (gift, gift_message) · total numeric(12,2) → numeric(10,2)'
  canvasEffect: string; // e.g. 'draws a new card + edge' | 'its card and 2 edges leave the canvas'
}

export interface ImportReport {
  addedTables: ChangeRow[];
  changedTables: ChangeRow[];
  removedTables: ChangeRow[]; // deleted on Apply — the report is the consent
  unknownTypes: { table: string; column: string; type: string }[];
  unsupported: UnsupportedConstruct[]; // cannot be reproduced; blocks export
  blocksExport: boolean;
}

// Identity is (schema, name): the bare name when the schema is null/public
// (every existing model file keeps working unqualified), `schema.name`
// otherwise.
function tableId(schema: string | null, name: string): string {
  return schema && schema !== 'public' ? `${schema}.${name}` : name;
}

function groupForTable(desc: SchemaDescription, tableName: string): string {
  return desc.groups.find((g) => g.tables.includes(tableName))?.key ?? 'ungrouped';
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

// ---- building the merged raw entity (file shape) for loadModel ----

function buildColumnJson(c: ColumnDescription, baseCols: Record<string, any>[] | undefined): Record<string, unknown> {
  const base = baseCols?.find((bc) => bc.name === c.name);
  return {
    name: c.name,
    type: c.sqlType,
    ...(base?.title ? { title: base.title } : {}),
    ...(base?.description ? { description: base.description } : {}),
    ...(c.notNull ? { nullable: false } : {}),
    ...(c.default != null ? { default: c.default } : {}),
    ...(c.identity ? { identity: c.identity } : {}),
    ...(c.generated ? { generated: c.generated } : {}),
  };
}

function buildConstraintsJson(t: TableDescription): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  if (t.primaryKey) {
    out.push({
      id: 'pk',
      kind: 'pk',
      ...(t.primaryKey.name ? { name: t.primaryKey.name } : {}),
      columns: t.primaryKey.columns,
    });
  }
  for (const u of t.uniques) {
    out.push({
      id: `u_${u.name}`,
      kind: 'unique',
      name: u.name,
      columns: u.columns,
      ...(u.nullsNotDistinct ? { nullsNotDistinct: true } : {}),
    });
  }
  for (const c of t.checks) {
    out.push({ id: `chk_${c.name}`, kind: 'check', name: c.name, expression: c.expression });
  }
  for (const fk of t.foreignKeys) {
    out.push({
      id: `fk_${fk.name}`,
      kind: 'fk',
      name: fk.name,
      columns: fk.columns,
      ...(fk.refSchema ? { refSchema: fk.refSchema } : {}),
      refTable: tableId(fk.refSchema, fk.refTable),
      refColumns: fk.refColumns,
      ...(fk.onDelete ? { onDelete: fk.onDelete } : {}),
      ...(fk.onUpdate ? { onUpdate: fk.onUpdate } : {}),
    });
  }
  return out;
}

function buildIndexesJson(t: TableDescription): Record<string, unknown>[] {
  return t.indexes.map((ix) => ({
    id: `ix_${ix.name}`,
    name: ix.name,
    columns: ix.columns, // already IndexColumn[] — the wire type IS the engine type
    unique: ix.unique,
    ...(ix.method ? { method: ix.method } : {}),
    ...(ix.only ? { only: true } : {}),
    ...(ix.where ? { where: ix.where } : {}),
  }));
}

// `base` is this table's PRIOR raw json (from serializeModel(existing, ...)),
// when it already existed. Every UI-only field is read off `base`; every SQL
// fact is read off `t`, the fresh description — that split IS the merge.
function buildEntityJson(t: TableDescription, base: Record<string, any> | undefined, group: string): Record<string, unknown> {
  return {
    id: tableId(t.schema, t.name),
    ...(base?.label ? { label: base.label } : {}),
    group: base?.group ?? group,
    ...(base?.description ? { description: base.description } : {}),
    ...(t.schema ? { schema: t.schema } : {}),
    ...(base ? { x: base.x, y: base.y } : {}), // omitted for a brand-new table: let layout place it
    columns: t.columns.map((c) => buildColumnJson(c, base?.columns)),
    constraints: buildConstraintsJson(t),
    indexes: buildIndexesJson(t),
  };
}

// ---- report copy ----

function columnChangeNote(old: Column, c: ColumnDescription): string | null {
  if (old.type !== c.sqlType) return `${c.name} ${old.type} → ${c.sqlType}`;
  const newNullable = !c.notNull;
  if (old.nullable !== newNullable) {
    return `${c.name} ${old.nullable ? 'nullable' : 'not null'} → ${newNullable ? 'nullable' : 'not null'}`;
  }
  if ((old.default ?? null) !== (c.default ?? null)) {
    return `${c.name} default ${old.default ?? 'none'} → ${c.default ?? 'none'}`;
  }
  return null;
}

interface ColumnDiff {
  added: ColumnDescription[];
  removed: Column[];
  changed: string[];
}

function diffColumns(t: TableDescription, existingEntity: Entity): ColumnDiff {
  const oldByName = new Map(existingEntity.columns.map((c) => [c.name, c]));
  const newNames = new Set(t.columns.map((c) => c.name));
  const added = t.columns.filter((c) => !oldByName.has(c.name));
  const removed = existingEntity.columns.filter((c) => !newNames.has(c.name));
  const changed: string[] = [];
  for (const c of t.columns) {
    const old = oldByName.get(c.name);
    if (!old) continue;
    const note = columnChangeNote(old, c);
    if (note) changed.push(note);
  }
  return { added, removed, changed };
}

function changeDetail({ added, removed, changed }: ColumnDiff): string {
  const parts: string[] = [];
  if (added.length) parts.push(`+${plural(added.length, 'column')} (${added.map((c) => c.name).join(', ')})`);
  if (removed.length) parts.push(`-${plural(removed.length, 'column')} (${removed.map((c) => c.name).join(', ')})`);
  parts.push(...changed);
  return parts.join(' · ');
}

function changeCanvasEffect({ added, removed }: ColumnDiff): string {
  if (added.length && removed.length) {
    return `its card gains ${plural(added.length, 'column')} and loses ${plural(removed.length, 'column')}`;
  }
  if (added.length) return `its card grows by ${plural(added.length, 'column')}`;
  if (removed.length) return `its card shrinks by ${plural(removed.length, 'column')}`;
  return 'its card updates in place';
}

function addedCanvasEffect(t: TableDescription): string {
  const n = t.foreignKeys.length;
  if (n === 0) return 'draws a new card';
  return `draws a new card + ${n === 1 ? 'edge' : `${n} edges`}`;
}

function removedDetail(e: Entity): string {
  return `dropped from the schema (${plural(e.columns.length, 'column')}, ${plural(e.constraints.length, 'constraint')})`;
}

function removedCanvasEffect(existing: Model, id: string): string {
  const edgeCount = existing.relationships.filter((r) => r.source === id || r.target === id).length;
  if (edgeCount === 0) return 'its card leaves the canvas';
  return `its card and ${edgeCount} edge${edgeCount === 1 ? '' : 's'} leave the canvas`;
}

// ---- the transform ----

export function importDrizzle(desc: SchemaDescription, existing: Model | null): { model: Model; report: ImportReport } {
  // Round-trip the existing model through the same function that already
  // knows what UI-only state must survive a save (meta/view/kinds, group
  // bounds, non-fk-derivable authored relationships) — reusing it here means
  // this module never re-decides what's safe to omit.
  const base = existing ? serializeModel(existing, existing.colors) : null;
  const baseEntityById = new Map(((base?.entities as Record<string, any>[]) ?? []).map((e) => [e.id as string, e]));

  const descIds = new Set(desc.tables.map((t) => tableId(t.schema, t.name)));

  const addedTables: ChangeRow[] = [];
  const changedTables: ChangeRow[] = [];
  const removedTables: ChangeRow[] = [];

  // ---- zones + colours ----
  // On a FIRST import every SCHEMA_GROUPS zone is seeded (with its colour),
  // regardless of which tables land in it. On a re-import, existing zones
  // (and their hand-arranged bounds) are kept verbatim; only a zone a NEW
  // table actually needs, and doesn't already have, gets created here.
  const colorsOut = new Map(existing ? existing.colors : []);
  const groupsOut = new Map<string, Record<string, unknown>>();
  if (existing) {
    for (const g of base!.groups as Record<string, any>[]) groupsOut.set(g.id as string, g);
  } else {
    desc.groups.forEach((g, i) => {
      groupsOut.set(g.key, { id: g.key, label: g.label, order: i });
      colorsOut.set(g.key, g.color);
    });
  }
  function ensureGroup(gid: string): void {
    if (groupsOut.has(gid)) return;
    if (gid === 'ungrouped') {
      groupsOut.set('ungrouped', { id: 'ungrouped', label: 'Ungrouped', order: groupsOut.size });
      return;
    }
    const g = desc.groups.find((x) => x.key === gid);
    groupsOut.set(gid, { id: gid, label: g?.label ?? gid, order: groupsOut.size });
    if (g && !colorsOut.has(gid)) colorsOut.set(gid, g.color);
  }

  // ---- entities: merge existing, create new ----
  const entitiesJson: Record<string, unknown>[] = [];
  for (const t of desc.tables) {
    const id = tableId(t.schema, t.name);
    const baseEntity = baseEntityById.get(id);

    if (!baseEntity) {
      const group = groupForTable(desc, t.name);
      ensureGroup(group);
      entitiesJson.push(buildEntityJson(t, undefined, group));
      addedTables.push({
        table: t.name,
        detail: `new table (${plural(t.columns.length, 'column')})`,
        canvasEffect: addedCanvasEffect(t),
      });
      continue;
    }

    entitiesJson.push(buildEntityJson(t, baseEntity, groupForTable(desc, t.name)));

    const existingEntity = existing!.entityById.get(id)!;
    const diff = diffColumns(t, existingEntity);
    if (diff.added.length || diff.removed.length || diff.changed.length) {
      changedTables.push({ table: t.name, detail: changeDetail(diff), canvasEffect: changeCanvasEffect(diff) });
    }
  }

  // ---- removed tables: reported, and simply never re-added to entitiesJson ----
  if (existing) {
    for (const e of existing.entities) {
      if (descIds.has(e.id)) continue;
      removedTables.push({ table: e.id, detail: removedDetail(e), canvasEffect: removedCanvasEffect(existing, e.id) });
    }
  }

  // ---- unknown types / export-blocking ----
  const enumNames = new Set(desc.enums.map((e) => e.name));
  const unknownTypes: ImportReport['unknownTypes'] = [];
  for (const t of desc.tables) {
    for (const c of t.columns) {
      const parsed = parseType(c.sqlType);
      if (!parsed.known && !enumNames.has(parsed.base)) {
        unknownTypes.push({ table: t.name, column: c.name, type: c.sqlType });
      }
    }
  }
  const blocksExport = unknownTypes.length > 0 || desc.unsupported.length > 0;

  // ---- relationships ----
  // Every fk-derivable edge is regenerated for free by loadModel from the
  // fresh constraints above. Only hand-authored, non-fk-derivable
  // relationships need to be carried forward — serializeModel already
  // filtered the list down to exactly those. Anything whose endpoint didn't
  // survive this import (a removed table) is dropped here rather than left
  // to trip load-model's hard error over an unresolvable endpoint.
  const finalEntityIds = new Set(entitiesJson.map((e) => e.id as string));
  const relationships = existing
    ? (base!.relationships as Record<string, any>[]).filter(
        (r) => finalEntityIds.has(r.source as string) && finalEntityIds.has(r.target as string),
      )
    : [];

  const raw = {
    meta: base?.meta ?? {},
    view: base?.view ?? {},
    kinds: base?.kinds ?? [],
    colors: Object.fromEntries(colorsOut),
    enums: desc.enums,
    groups: [...groupsOut.values()],
    entities: entitiesJson,
    relationships,
  };

  const { model, errors } = loadModel(raw);
  if (!model) throw new Error(`importDrizzle: merged model failed to load — ${errors.join('; ')}`);

  const report: ImportReport = {
    addedTables,
    changedTables,
    removedTables,
    unknownTypes,
    unsupported: desc.unsupported,
    blocksExport,
  };

  return { model, report };
}
