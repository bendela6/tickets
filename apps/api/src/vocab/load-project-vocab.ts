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

  const [typeRows, statusRows, transitionRows, fieldRows, linkTypeRows, viewRows] =
    await Promise.all([
      db.select().from(ticketTypes).where(eq(ticketTypes.projectId, project.id)),
      db.select().from(statuses).where(eq(statuses.projectId, project.id)),
      db.select().from(statusTransitions),
      db.select().from(fields).where(eq(fields.projectId, project.id)),
      db.select().from(linkTypes).where(eq(linkTypes.projectId, project.id)),
      db.select().from(views).where(eq(views.projectId, project.id)),
    ]);

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
