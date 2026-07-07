import { eq, inArray } from 'drizzle-orm';
import type { Db } from '@tickets/db';
import {
  fieldOptions,
  fields,
  linkTypes,
  projects,
  statusTransitions,
  statuses,
  ticketTypeFields,
  ticketTypes,
  views,
} from '@tickets/db';
import { HttpError } from '../errors';

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

  const [typeRows, fieldRows, linkTypeRows, viewRows] = await Promise.all([
    db.select().from(ticketTypes).where(eq(ticketTypes.schemeId, schemeId)),
    db.select().from(fields).where(eq(fields.schemeId, schemeId)),
    db.select().from(linkTypes).where(eq(linkTypes.schemeId, schemeId)),
    db.select().from(views).where(eq(views.projectId, project.id)),
  ]);

  const typeIds = typeRows.map((row) => row.id);
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
    fieldByKey: new Map(fieldRows.map((row) => [row.key, row])),
    fieldById: new Map(fieldRows.map((row) => [row.id, row])),
    optionById: new Map(optionRows.map((row) => [row.id, row])),
    optionsByFieldId: optionRows.reduce((byField, row) => {
      const bucket = byField.get(row.fieldId) ?? [];
      bucket.push(row);
      byField.set(row.fieldId, bucket);
      return byField;
    }, new Map<number, (typeof optionRows)[number][]>()),
    linkTypeByKey: new Map(linkTypeRows.map((row) => [row.key, row])),
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
