import { eq, inArray, isNotNull } from 'drizzle-orm';
import { createDbClient } from '../client';
import {
  fieldOptions,
  fields,
  linkTypes,
  projects,
  statuses,
  ticketLinks,
  ticketTypes,
  ticketValues,
  tickets,
} from '../schema';
import { ensureSoftwareScheme } from '../seed/ensure-software-scheme';
import { ensureUser } from '../seed/ensure-user';
import { mapOldStatusKey } from './status-map';

const KNOWN_OLD_STATUSES = new Set([
  'open',
  'investigated',
  'investigating',
  'brainstorming',
  'designing',
  'in-progress',
  'review',
  'blocked',
  'fixed',
  'dropped',
]);

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const { db, sql } = createDbClient({ max: 1 });

const actorId = await ensureUser(db, { name: 'migration', kind: 'agent' });
const { schemeId } = await ensureSoftwareScheme(db);

// new-scheme lookup maps
const newTypes = await db.select().from(ticketTypes).where(eq(ticketTypes.schemeId, schemeId));
const newTypeIdByKey = new Map(newTypes.map((t) => [t.key, t.id]));
const newStatuses = await db
  .select()
  .from(statuses)
  .where(
    inArray(
      statuses.ticketTypeId,
      newTypes.map((t) => t.id),
    ),
  );
const newStatusId = (typeKey: string, statusKey: string) => {
  const typeId = newTypeIdByKey.get(typeKey)!;
  const st = newStatuses.find((s) => s.ticketTypeId === typeId && s.key === statusKey);
  if (!st) throw new Error(`no status "${statusKey}" on type "${typeKey}"`);
  return st.id;
};
const newFields = await db.select().from(fields).where(eq(fields.schemeId, schemeId));
const newFieldIdByKey = new Map(newFields.map((f) => [f.key, f.id]));
const severityField = newFields.find((f) => f.key === 'severity')!;
const severityOptions = await db
  .select()
  .from(fieldOptions)
  .where(eq(fieldOptions.fieldId, severityField.id));
const componentField = newFields.find((f) => f.key === 'component')!;

const stats = {
  projects: 0,
  tickets: 0,
  epicsCreated: 0,
  areaMapped: 0,
  pointsDropped: 0,
  unmapped: {} as Record<string, number>,
};

const allProjects = await db.select().from(projects);
for (const project of allProjects) {
  if (project.schemeId != null) continue; // idempotent skip

  await db.transaction(async (tx) => {
    const oldTypes = await tx.select().from(ticketTypes).where(eq(ticketTypes.projectId, project.id));
    const oldTypeKeyById = new Map(oldTypes.map((t) => [t.id, t.key]));
    const oldStatusKeyById = new Map(
      (await tx.select().from(statuses).where(eq(statuses.projectId, project.id))).map((s) => [
        s.id,
        s.key,
      ]),
    );
    const oldFields = await tx.select().from(fields).where(eq(fields.projectId, project.id));
    const oldFieldKeyById = new Map(oldFields.map((f) => [f.id, f.key]));
    const epicField = oldFields.find((f) => f.key === 'epic');
    const areaField = oldFields.find((f) => f.key === 'area');
    const oldEpicOptById = epicField
      ? new Map(
          (await tx.select().from(fieldOptions).where(eq(fieldOptions.fieldId, epicField.id))).map(
            (o) => [o.id, o.value],
          ),
        )
      : new Map<number, string>();
    const oldSeverityOptById = new Map(
      (
        await tx.select().from(fieldOptions).where(
          inArray(
            fieldOptions.fieldId,
            oldFields.map((f) => f.id),
          ),
        )
      ).map((o) => [o.id, o.value]),
    );

    const projTickets = await tx.select().from(tickets).where(eq(tickets.projectId, project.id));
    let maxNumber = Math.max(0, ...projTickets.map((t) => t.number));

    // component options are scheme-owned (shared) — reload inside each project so
    // options added by an earlier project are visible.
    let componentOptions = await tx
      .select()
      .from(fieldOptions)
      .where(eq(fieldOptions.fieldId, componentField.id));

    // pass 1: epic field values -> Epic tickets
    const epicMembership: { ticketId: number; epicName: string }[] = [];
    const epicByName = new Map<string, number>();
    if (epicField) {
      const epicVals = await tx.select().from(ticketValues).where(eq(ticketValues.fieldId, epicField.id));
      for (const v of epicVals) {
        const name = v.optionId != null ? oldEpicOptById.get(v.optionId) : v.valueText;
        if (name) epicMembership.push({ ticketId: v.ticketId, epicName: name });
      }
      for (const name of [...new Set(epicMembership.map((m) => m.epicName))]) {
        maxNumber += 1;
        const [epicTicket] = await tx
          .insert(tickets)
          .values({
            projectId: project.id,
            typeId: newTypeIdByKey.get('epic')!,
            number: maxNumber,
            createdBy: actorId,
          })
          .returning();
        epicByName.set(name, epicTicket!.id);
        await tx.insert(ticketValues).values([
          { ticketId: epicTicket!.id, fieldId: newFieldIdByKey.get('title')!, valueText: name },
          {
            ticketId: epicTicket!.id,
            fieldId: newFieldIdByKey.get('status')!,
            statusId: newStatusId('epic', 'backlog'),
          },
        ]);
        stats.epicsCreated += 1;
      }
      await tx.delete(ticketValues).where(eq(ticketValues.fieldId, epicField.id));
    }

    // pass 2: area strings -> component options
    if (areaField) {
      const areaVals = await tx.select().from(ticketValues).where(eq(ticketValues.fieldId, areaField.id));
      for (const area of [...new Set(areaVals.map((v) => v.valueText).filter(Boolean) as string[])]) {
        const slug = slugify(area);
        if (slug && !componentOptions.some((o) => o.value === slug)) {
          const [opt] = await tx
            .insert(fieldOptions)
            .values({
              fieldId: componentField.id,
              value: slug,
              label: area,
              position: componentOptions.length,
              config: {},
            })
            .returning();
          componentOptions.push(opt!);
        }
      }
    }
    const componentOptIdByValue = new Map(componentOptions.map((o) => [o.value, o.id]));

    // pass 3: per-ticket remap
    for (const ticket of projTickets) {
      const newTypeKey = oldTypeKeyById.get(ticket.typeId) ?? 'task';
      await tx.update(tickets).set({ typeId: newTypeIdByKey.get(newTypeKey)! }).where(eq(tickets.id, ticket.id));

      if (newTypeKey !== 'subtask') {
        const membership = epicMembership.find((m) => m.ticketId === ticket.id);
        const epicId = membership ? epicByName.get(membership.epicName) : undefined;
        if (epicId) await tx.update(tickets).set({ parentId: epicId }).where(eq(tickets.id, ticket.id));
      }

      const vals = await tx.select().from(ticketValues).where(eq(ticketValues.ticketId, ticket.id));
      for (const val of vals) {
        const oldKey = oldFieldKeyById.get(val.fieldId);
        if (!oldKey || oldKey === 'epic') continue;

        if (oldKey === 'area') {
          const optId = componentOptIdByValue.get(slugify(val.valueText ?? ''));
          if (optId) {
            await tx
              .update(ticketValues)
              .set({ fieldId: componentField.id, valueText: null, optionId: optId })
              .where(eq(ticketValues.id, val.id));
            stats.areaMapped += 1;
          } else {
            await tx.delete(ticketValues).where(eq(ticketValues.id, val.id));
          }
          continue;
        }

        const newFieldId = newFieldIdByKey.get(oldKey);
        if (newFieldId === undefined) {
          await tx.delete(ticketValues).where(eq(ticketValues.id, val.id));
          if (oldKey === 'points') stats.pointsDropped += 1;
          continue;
        }

        if (val.statusId != null) {
          const oldStatusKey = oldStatusKeyById.get(val.statusId) ?? 'open';
          if (!KNOWN_OLD_STATUSES.has(oldStatusKey)) {
            stats.unmapped[oldStatusKey] = (stats.unmapped[oldStatusKey] ?? 0) + 1;
          }
          await tx
            .update(ticketValues)
            .set({ fieldId: newFieldId, statusId: newStatusId(newTypeKey, mapOldStatusKey(oldStatusKey, newTypeKey)) })
            .where(eq(ticketValues.id, val.id));
        } else if (val.optionId != null && oldKey === 'severity') {
          const oldVal = oldSeverityOptById.get(val.optionId);
          const newOpt =
            severityOptions.find((o) => o.value === oldVal) ??
            severityOptions.find((o) => o.value === 'medium')!;
          await tx.update(ticketValues).set({ fieldId: newFieldId, optionId: newOpt.id }).where(eq(ticketValues.id, val.id));
        } else {
          await tx.update(ticketValues).set({ fieldId: newFieldId }).where(eq(ticketValues.id, val.id));
        }
      }
      stats.tickets += 1;
    }

    await tx.update(projects).set({ schemeId }).where(eq(projects.id, project.id));
    stats.projects += 1;
  });
  console.log(`migrated project ${project.key}`);
}

// Global pass: remap ticket_links from old per-project link types to the
// scheme's link types (by key). Runs unconditionally so it also repairs links
// after the (idempotent) per-project loop is skipped on a re-run.
const newLinkIdByKey = new Map(
  (await db.select().from(linkTypes).where(eq(linkTypes.schemeId, schemeId))).map((l) => [l.key, l.id]),
);
const oldLinkTypes = await db.select().from(linkTypes).where(isNotNull(linkTypes.projectId));
let linksRemapped = 0;
for (const old of oldLinkTypes) {
  const newId = newLinkIdByKey.get(old.key);
  if (newId) {
    const updated = await db
      .update(ticketLinks)
      .set({ linkTypeId: newId })
      .where(eq(ticketLinks.linkTypeId, old.id))
      .returning();
    linksRemapped += updated.length;
  }
}

console.log('DONE', JSON.stringify({ ...stats, linksRemapped }));
await sql.end();
