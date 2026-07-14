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
import { formatType, parseType } from '../pg-types';
import { serializeModel } from '../serialize-model';
import type { Column, Constraint, Entity, FkAction, IndexColumn, Model, TableIndex } from '../types';

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

// Key order doesn't matter here: identity/generated always compare a value
// built by describe-drizzle's normaliser against one built by load-model's —
// two independent call sites — so a naive JSON.stringify would be one
// re-ordered key away from a false CHANGED row forever. Sorting first makes
// the comparison actually structural.
function stableStringify(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  if (v && typeof v === 'object') {
    const keys = Object.keys(v).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify((v as Record<string, unknown>)[k])}`).join(',')}}`;
  }
  return JSON.stringify(v);
}

// `Column.type` is already codec-normalised (loadModel runs every type through
// parseType/formatType); `sqlType` is raw off drizzle. Comparing them as bare
// strings works only by coincidence — go through the same codec on both sides
// so an alias (`int4` vs `integer`) can never masquerade as a real change.
function normalizeTypeText(s: string): string {
  const p = parseType(s);
  return formatType(p.base, p.params, p.arrays);
}

function columnChangeNote(old: Column, c: ColumnDescription): string | null {
  if (normalizeTypeText(old.type) !== normalizeTypeText(c.sqlType)) return `${c.name} ${old.type} → ${c.sqlType}`;
  const newNullable = !c.notNull;
  if (old.nullable !== newNullable) {
    return `${c.name} ${old.nullable ? 'nullable' : 'not null'} → ${newNullable ? 'nullable' : 'not null'}`;
  }
  if ((old.default ?? null) !== (c.default ?? null)) {
    return `${c.name} default ${old.default ?? 'none'} → ${c.default ?? 'none'}`;
  }
  if (stableStringify(old.identity) !== stableStringify(c.identity)) {
    return `${c.name} identity changed`;
  }
  if (stableStringify(old.generated) !== stableStringify(c.generated)) {
    return `${c.name} generated expression changed`;
  }
  return null;
}

// ---- constraint / index facts ----
// The SQL-fact half of a constraint/index — everything EXCEPT the `id`,
// which is regenerated on every rebuild (see buildConstraintsJson /
// buildIndexesJson) and so can never be part of an equality check: comparing
// by id would report every constraint/index as changed, forever. Matched
// instead by kind + name + columns (constraints) or name + columns (indexes,
// which have no `kind`) — the parts of a constraint/index that identify it as
// "the same one" across two schema snapshots.

type ConstraintFact =
  | { kind: 'pk'; name: string | null; columns: string[] }
  | { kind: 'unique'; name: string | null; columns: string[]; nullsNotDistinct: boolean }
  | { kind: 'check'; name: string | null; expression: string }
  | {
      kind: 'fk';
      name: string | null;
      columns: string[];
      refSchema: string | null;
      refTable: string;
      refColumns: string[];
      onDelete: FkAction | null;
      onUpdate: FkAction | null;
    };

function describeConstraintFacts(t: TableDescription): ConstraintFact[] {
  const out: ConstraintFact[] = [];
  if (t.primaryKey) out.push({ kind: 'pk', name: t.primaryKey.name, columns: t.primaryKey.columns });
  for (const u of t.uniques) {
    out.push({ kind: 'unique', name: u.name, columns: u.columns, nullsNotDistinct: u.nullsNotDistinct });
  }
  for (const c of t.checks) out.push({ kind: 'check', name: c.name, expression: c.expression });
  for (const fk of t.foreignKeys) {
    out.push({
      kind: 'fk',
      name: fk.name,
      columns: fk.columns,
      refSchema: fk.refSchema,
      refTable: tableId(fk.refSchema, fk.refTable),
      refColumns: fk.refColumns,
      onDelete: fk.onDelete,
      onUpdate: fk.onUpdate,
    });
  }
  return out;
}

function constraintFactFromExisting(c: Constraint): ConstraintFact {
  switch (c.kind) {
    case 'pk':
      return { kind: 'pk', name: c.name, columns: c.columns };
    case 'unique':
      return { kind: 'unique', name: c.name, columns: c.columns, nullsNotDistinct: c.nullsNotDistinct };
    case 'check':
      return { kind: 'check', name: c.name, expression: c.expression };
    case 'fk':
      return {
        kind: 'fk',
        name: c.name,
        columns: c.columns,
        refSchema: c.refSchema,
        refTable: c.refTable,
        refColumns: c.refColumns,
        onDelete: c.onDelete,
        onUpdate: c.onUpdate,
      };
  }
}

function constraintColumns(c: ConstraintFact): string[] {
  return c.kind === 'check' ? [] : c.columns;
}

function constraintKey(c: ConstraintFact): string {
  return `${c.kind}:${c.name ?? ''}:${constraintColumns(c).join(',')}`;
}

function constraintLabel(c: ConstraintFact): string {
  return c.name ?? `${c.kind} (${constraintColumns(c).join(', ')})`;
}

interface IndexFact {
  name: string;
  columns: IndexColumn[];
  unique: boolean;
  method: string | null;
  only: boolean;
  where: string | null;
}

function describeIndexFacts(t: TableDescription): IndexFact[] {
  return t.indexes.map((ix) => ({
    name: ix.name,
    columns: ix.columns,
    unique: ix.unique,
    method: ix.method,
    only: ix.only,
    where: ix.where,
  }));
}

function indexFactFromExisting(ix: TableIndex): IndexFact {
  return { name: ix.name, columns: ix.columns, unique: ix.unique, method: ix.method, only: ix.only, where: ix.where };
}

function indexKey(ix: IndexFact): string {
  return `${ix.name}:${ix.columns.map((c) => c.expression).join(',')}`;
}

interface FactDiff {
  added: string[];
  removed: string[];
  changed: string[];
}

function diffFacts<T>(oldList: T[], newList: T[], keyOf: (t: T) => string, labelOf: (t: T) => string): FactDiff {
  const oldByKey = new Map(oldList.map((x) => [keyOf(x), x]));
  const newByKey = new Map(newList.map((x) => [keyOf(x), x]));
  const added = newList.filter((x) => !oldByKey.has(keyOf(x))).map(labelOf);
  const removed = oldList.filter((x) => !newByKey.has(keyOf(x))).map(labelOf);
  const changed: string[] = [];
  for (const x of newList) {
    const old = oldByKey.get(keyOf(x));
    if (old === undefined) continue;
    if (stableStringify(old) !== stableStringify(x)) changed.push(labelOf(x));
  }
  return { added, removed, changed };
}

function diffConstraints(t: TableDescription, existingEntity: Entity): FactDiff {
  return diffFacts(existingEntity.constraints.map(constraintFactFromExisting), describeConstraintFacts(t), constraintKey, constraintLabel);
}

function diffIndexes(t: TableDescription, existingEntity: Entity): FactDiff {
  return diffFacts(existingEntity.indexes.map(indexFactFromExisting), describeIndexFacts(t), indexKey, (ix) => ix.name);
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

function factDiffParts(kind: string, { added, removed, changed }: FactDiff): string[] {
  const parts: string[] = [];
  if (added.length) parts.push(`+${plural(added.length, kind)} (${added.join(', ')})`);
  if (removed.length) parts.push(`-${plural(removed.length, kind)} (${removed.join(', ')})`);
  for (const name of changed) parts.push(`${kind} ${name} changed`);
  return parts;
}

function changeDetail(columns: ColumnDiff, constraints: FactDiff, indexes: FactDiff): string {
  const parts: string[] = [];
  if (columns.added.length) parts.push(`+${plural(columns.added.length, 'column')} (${columns.added.map((c) => c.name).join(', ')})`);
  if (columns.removed.length) parts.push(`-${plural(columns.removed.length, 'column')} (${columns.removed.map((c) => c.name).join(', ')})`);
  parts.push(...columns.changed);
  parts.push(...factDiffParts('constraint', constraints));
  parts.push(...factDiffParts('index', indexes));
  return parts.join(' · ');
}

function hasFactChange(d: FactDiff): boolean {
  return d.added.length > 0 || d.removed.length > 0 || d.changed.length > 0;
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
    const columnDiff = diffColumns(t, existingEntity);
    const constraintDiff = diffConstraints(t, existingEntity);
    const indexDiff = diffIndexes(t, existingEntity);
    const columnsChanged = columnDiff.added.length > 0 || columnDiff.removed.length > 0 || columnDiff.changed.length > 0;
    if (columnsChanged || hasFactChange(constraintDiff) || hasFactChange(indexDiff)) {
      changedTables.push({
        table: t.name,
        detail: changeDetail(columnDiff, constraintDiff, indexDiff),
        canvasEffect: changeCanvasEffect(columnDiff),
      });
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

  // A colour override is keyed by entity id or group id. Once a table (or,
  // in principle, a group) stops existing, its override must go with it —
  // otherwise it survives forever, re-serialized on every save, and — worse —
  // silently reattaches to an unrelated table if that id is ever reused (a
  // drop+recreate, or the "added" half of a rename landing on a stale name).
  const liveColorIds = new Set<string>([...finalEntityIds, ...groupsOut.keys()]);
  for (const key of [...colorsOut.keys()]) {
    if (!liveColorIds.has(key)) colorsOut.delete(key);
  }

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
