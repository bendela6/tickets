import { eq, inArray } from 'drizzle-orm';
import type { Db } from '@tickets/db';
import {
  fieldOptions,
  fields,
  linkTypes,
  linkTypeTargetTypes,
  projects,
  statusTransitions,
  statuses,
  ticketTypeFields,
  ticketTypes,
  views,
} from '@tickets/db';
import { HttpError } from '../errors';

// The logical field-column list across all types, one row per key: first
// non-archived row wins (an archived row only stands in if nothing else for
// that key was seen yet). Used where callers need "the" field for a key
// without regard to which type owns it (e.g. picking a display column).
function dedupeByKey<T extends { key: string; archivedAt: string | null }>(rows: T[]): T[] {
  const byKey = new Map<string, T>();
  for (const row of rows) {
    const existing = byKey.get(row.key);
    if (!existing) {
      byKey.set(row.key, row);
    } else if (existing.archivedAt != null && row.archivedAt == null) {
      byKey.set(row.key, row);
    }
  }
  return [...byKey.values()];
}

// One cheap load of everything vocabulary-shaped for a project; used by the
// board, export, and every mutation that needs to validate values.
export async function loadProjectVocab(db: Db, selector: { key?: string; id?: number }) {
  const projectRows = selector.key
    ? await db.select().from(projects).where(eq(projects.key, selector.key))
    : await db
        .select()
        .from(projects)
        .where(eq(projects.id, selector.id ?? -1));
  const project = projectRows[0];
  if (!project) {
    throw new HttpError(404, `unknown project "${selector.key ?? selector.id}"`);
  }

  // Config lives on the bound scheme; statuses are owned by their type.
  const schemeId = project.schemeId;

  const [typeRows, viewRows] = await Promise.all([
    db.select().from(ticketTypes).where(eq(ticketTypes.schemeId, schemeId)),
    db.select().from(views).where(eq(views.projectId, project.id)),
  ]);

  const typeIds = typeRows.map((row) => row.id);

  // Fields and link types are owned per type now, not the scheme.
  const fieldRows =
    typeIds.length > 0
      ? await db.select().from(fields).where(inArray(fields.ticketTypeId, typeIds))
      : [];
  const linkTypeRows =
    typeIds.length > 0
      ? await db.select().from(linkTypes).where(inArray(linkTypes.ticketTypeId, typeIds))
      : [];
  const linkTargetRows =
    linkTypeRows.length > 0
      ? await db
          .select()
          .from(linkTypeTargetTypes)
          .where(
            inArray(
              linkTypeTargetTypes.linkTypeId,
              linkTypeRows.map((row) => row.id),
            ),
          )
      : [];

  const statusRows =
    typeIds.length > 0
      ? await db.select().from(statuses).where(inArray(statuses.ticketTypeId, typeIds))
      : [];

  const transitionRows = await db.select().from(statusTransitions);

  const fieldIds = fieldRows.map((row) => row.id);
  const [optionRows, typeFieldRows] = await Promise.all([
    fieldIds.length > 0
      ? db.select().from(fieldOptions).where(inArray(fieldOptions.fieldId, fieldIds))
      : Promise.resolve([]),
    typeRows.length > 0
      ? db
          .select()
          .from(ticketTypeFields)
          .where(
            inArray(
              ticketTypeFields.ticketTypeId,
              typeRows.map((row) => row.id),
            ),
          )
      : Promise.resolve([]),
  ]);

  const statusIds = new Set(statusRows.map((row) => row.id));
  const projectTransitions = transitionRows.filter((row) => statusIds.has(row.toStatusId));

  const fieldsByTypeMap = new Map<number, typeof fieldRows>();
  for (const row of fieldRows) {
    if (row.ticketTypeId == null) continue;
    const bucket = fieldsByTypeMap.get(row.ticketTypeId) ?? [];
    bucket.push(row);
    fieldsByTypeMap.set(row.ticketTypeId, bucket);
  }
  for (const bucket of fieldsByTypeMap.values()) {
    bucket.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  }

  const linkTypesByTypeMap = new Map<number, typeof linkTypeRows>();
  for (const row of linkTypeRows) {
    if (row.ticketTypeId == null) continue;
    const bucket = linkTypesByTypeMap.get(row.ticketTypeId) ?? [];
    bucket.push(row);
    linkTypesByTypeMap.set(row.ticketTypeId, bucket);
  }

  const linkTypeTargetsMap = new Map<number, Set<number>>();
  for (const row of linkTargetRows) {
    const set = linkTypeTargetsMap.get(row.linkTypeId) ?? new Set<number>();
    set.add(row.targetTypeId);
    linkTypeTargetsMap.set(row.linkTypeId, set);
  }

  return {
    project,
    types: typeRows,
    statuses: statusRows,
    transitions: projectTransitions,
    fields: fieldRows,
    options: optionRows,
    typeFields: typeFieldRows,
    linkTypes: linkTypeRows,
    views: viewRows,
    typeByKey: new Map(typeRows.map((row) => [row.key, row])),
    typeById: new Map(typeRows.map((row) => [row.id, row])),
    statusByKey: new Map(statusRows.map((row) => [row.key, row])),
    statusById: new Map(statusRows.map((row) => [row.id, row])),
    statusByTypeKey: new Map(
      statusRows
        .filter((row) => row.ticketTypeId != null)
        .map((row) => [`${row.ticketTypeId}:${row.key}`, row]),
    ),
    initialStatusByTypeId: new Map(
      statusRows
        .filter(
          (row) =>
            row.ticketTypeId != null && (row.config as { initial?: boolean }).initial === true,
        )
        .map((row) => [row.ticketTypeId as number, row]),
    ),
    // Deprecated: ambiguous now that fields/link types are type-owned (the
    // same key can repeat across types) — last-write-wins across type rows.
    // Kept only so today's consumers keep compiling; Plan B moves them onto
    // `fieldByTypeKey`/`linkTypesByType` and then deletes these two maps.
    fieldByKey: new Map(fieldRows.map((row) => [row.key, row])),
    linkTypeByKey: new Map(linkTypeRows.map((row) => [row.key, row])),
    fieldById: new Map(fieldRows.map((row) => [row.id, row])),
    optionById: new Map(optionRows.map((row) => [row.id, row])),
    optionsByFieldId: optionRows.reduce((byField, row) => {
      const bucket = byField.get(row.fieldId) ?? [];
      bucket.push(row);
      byField.set(row.fieldId, bucket);
      return byField;
    }, new Map<number, (typeof optionRows)[number][]>()),
    // Per-type field/link-type ownership (Plan A foundation).
    fieldByTypeKey: new Map(fieldRows.map((row) => [`${row.ticketTypeId}:${row.key}`, row])),
    fieldsByType: fieldsByTypeMap,
    fieldKeys: dedupeByKey(fieldRows).map((row) => ({
      key: row.key,
      label: row.label,
      type: row.type,
    })),
    linkTypesByType: linkTypesByTypeMap,
    linkTypeTargets: linkTypeTargetsMap,
  };
}

export type ProjectVocab = Awaited<ReturnType<typeof loadProjectVocab>>;

// The workflow edge matching a from→to move for a type (null fromStatusId =
// entry). Carries `config.guard`, consulted by the guard check on the write path.
export function transitionEdge(
  vocab: ProjectVocab,
  input: { fromStatusId: number | null; toStatusId: number; typeId: number },
) {
  return vocab.transitions.find(
    (e) =>
      (e.ticketTypeId === null || e.ticketTypeId === input.typeId) &&
      e.fromStatusId === input.fromStatusId &&
      e.toStatusId === input.toStatusId,
  );
}
