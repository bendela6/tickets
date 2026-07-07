// Type-owned fields & links migration runner (Plan C, Task 2).
//
// One-shot script: converts the `software` scheme's shared fields/links
// (scheme-owned, attached to types via `ticket_type_fields`) into per-type
// -owned fields/links, remapping every `ticket_values`/`ticket_links`/
// `views` reference along the way. Uses the pure helpers from `./derive`
// for the actual derivation; this file only does DB I/O.
//
// NOT run as part of Task 2 — write + compile only. Task 3
// (docs/superpowers/plans/2026-07-07-type-owned-migration.md) runs it
// against a dev copy of the live DB via `pnpm exec tsx src/migrate-fields-links/run.ts`.
//
// Deletes the old scheme-owned `fields`/`link_types` rows (and their
// `ticket_type_fields`/`field_options` dependents) once every reference has
// been remapped onto the new per-type rows — see Step 7. This is what lets
// Task 4's contract migration (`ticket_type_id SET NOT NULL`) succeed: no
// NULL rows are left behind.

import { eq, inArray, isNotNull, isNull } from 'drizzle-orm';
import { createDbClient } from '../client';
import {
  fieldOptions,
  fields,
  linkTypeTargetTypes,
  linkTypes,
  projects,
  schemes,
  ticketLinks,
  ticketTypeFields,
  ticketTypes,
  ticketValues,
  tickets,
  views,
} from '../schema';
import {
  deriveTypeFields,
  deriveTypeLinks,
  remapViewConfig,
  type LinkUsageRow,
  type SharedFieldRow,
  type SharedLinkRow,
  type TicketTypeFieldRow,
} from './derive';

// "typeId:key" / "fieldId:value" composite lookup key — used for the
// per-type field map, the per-type link map, and the per-field option map.
function compositeKey(a: number, b: string): string {
  return `${a}:${b}`;
}

const { db, sql } = createDbClient({ max: 1 });

const summary = await db.transaction(async (tx) => {
  // --- Step 1: load ------------------------------------------------------
  const [software] = await tx.select().from(schemes).where(eq(schemes.key, 'software'));
  if (!software) {
    throw new Error('migrate-fields-links: no scheme with key "software" found — nothing to migrate');
  }

  // --- Step 2: idempotency guard -----------------------------------------
  const alreadyMigrated = await tx
    .select({ id: fields.id })
    .from(fields)
    .where(isNotNull(fields.ticketTypeId))
    .limit(1);
  if (alreadyMigrated.length > 0) {
    throw new Error(
      'migrate-fields-links: migration already ran — fields.ticket_type_id is already populated on at least one row',
    );
  }

  const schemeTypes = await tx.select().from(ticketTypes).where(eq(ticketTypes.schemeId, software.id));
  const allTypeIds = schemeTypes.map((t) => t.id);
  if (allTypeIds.length === 0) {
    throw new Error(`migrate-fields-links: scheme "software" (#${software.id}) has no ticket types`);
  }

  const sharedFieldRows = await tx
    .select()
    .from(fields)
    .where(eq(fields.schemeId, software.id))
    .orderBy(fields.id);
  const sharedFields: SharedFieldRow[] = sharedFieldRows.map((f) => ({
    id: f.id,
    key: f.key,
    label: f.label,
    type: f.type,
    system: f.system,
    config: f.config as Record<string, unknown>,
    archivedAt: f.archivedAt,
  }));
  const sharedFieldIds = sharedFields.map((f) => f.id);

  const optionRows = sharedFieldIds.length
    ? await tx
        .select()
        .from(fieldOptions)
        .where(inArray(fieldOptions.fieldId, sharedFieldIds))
        .orderBy(fieldOptions.position)
    : [];
  const optionsByFieldId = new Map<number, (typeof optionRows)[number][]>();
  const optionValueByOldOptionId = new Map<number, string>();
  for (const o of optionRows) {
    const bucket = optionsByFieldId.get(o.fieldId) ?? [];
    bucket.push(o);
    optionsByFieldId.set(o.fieldId, bucket);
    optionValueByOldOptionId.set(o.id, o.value);
  }

  const ttfRows = await tx.select().from(ticketTypeFields).where(inArray(ticketTypeFields.ticketTypeId, allTypeIds));
  const ticketTypeFieldRows: TicketTypeFieldRow[] = ttfRows.map((r) => ({
    ticketTypeId: r.ticketTypeId,
    fieldId: r.fieldId,
    position: r.position,
    required: r.required,
  }));

  const sharedLinkRows = await tx
    .select()
    .from(linkTypes)
    .where(eq(linkTypes.schemeId, software.id))
    .orderBy(linkTypes.position);
  const sharedLinks: SharedLinkRow[] = sharedLinkRows.map((l) => ({
    id: l.id,
    key: l.key,
    label: l.label,
    inverseLabel: l.inverseLabel,
    directional: l.directional,
    archivedAt: l.archivedAt,
  }));
  const sharedLinkIds = new Set(sharedLinks.map((l) => l.id));

  // Every ticket's type, for joining ticket_links/ticket_values → type.
  const allTickets = await tx.select({ id: tickets.id, typeId: tickets.typeId }).from(tickets);
  const typeByTicketId = new Map(allTickets.map((t) => [t.id, t.typeId]));

  const allTicketLinks = await tx.select().from(ticketLinks);
  const scopedTicketLinks = allTicketLinks.filter((l) => sharedLinkIds.has(l.linkTypeId));

  const allTicketValues = await tx.select().from(ticketValues);

  // Views on projects bound to this scheme (config field ids are only ever
  // meaningful relative to their own scheme's fields).
  const scopedViews = await tx
    .select({ id: views.id, config: views.config })
    .from(views)
    .innerJoin(projects, eq(views.projectId, projects.id))
    .where(eq(projects.schemeId, software.id));

  // --- Step 3: derive + insert per-type fields (+ options) ---------------
  const derivedFields = deriveTypeFields(sharedFields, ticketTypeFieldRows);
  const keyByOldFieldId = new Map(sharedFields.map((f) => [f.id, f.key]));
  const newFieldIdByTypeKey = new Map<string, number>();
  // "newFieldId:value" -> new field_options.id, populated while copying each
  // per-type field's options — needed to remap ticket_values.option_id below
  // (the read path only loads options for type-owned fields, so a value left
  // pointing at the old shared option row would silently render as null).
  const newOptionIdByFieldValue = new Map<string, number>();

  for (const df of derivedFields) {
    const [row] = await tx
      .insert(fields)
      .values({
        ticketTypeId: df.typeId,
        key: df.key,
        label: df.label,
        type: df.type,
        system: df.system,
        required: df.required,
        position: df.position,
        config: df.config,
        archivedAt: df.archivedAt,
      })
      .returning();
    if (!row) throw new Error(`migrate-fields-links: field insert failed for type ${df.typeId}/${df.key}`);
    newFieldIdByTypeKey.set(compositeKey(df.typeId, df.key), row.id);

    const opts = optionsByFieldId.get(df.fromFieldId) ?? [];
    if (opts.length > 0) {
      const insertedOptions = await tx
        .insert(fieldOptions)
        .values(
          opts.map((o) => ({
            fieldId: row.id,
            value: o.value,
            label: o.label,
            config: o.config,
            position: o.position,
            archivedAt: o.archivedAt,
          })),
        )
        .returning();
      // Rekey off each returned row's own `value` rather than zipping by
      // index against the input `opts` array — correct regardless of
      // whether INSERT ... RETURNING preserves VALUES-list order.
      for (const inserted of insertedOptions) {
        newOptionIdByFieldValue.set(compositeKey(row.id, inserted.value), inserted.id);
      }
    }
  }

  // --- Step 4: remap ticket_values ----------------------------------------
  type ValueGroup = { fieldId: number; optionId: number | null; ids: number[] };
  const valueGroups = new Map<string, ValueGroup>();
  // Orphan values: a value whose ticket type does not own the value's field
  // (legacy data — e.g. `severity` on task, `component` on subtask). Those
  // types deliberately exclude the field, so the value is dropped (logged in
  // the summary). Must be deleted here so step 7's old-field DELETE doesn't
  // hit an FK from a still-pointing value row.
  const orphanValueIds: number[] = [];
  const droppedOrphans = new Map<string, number>();

  for (const v of allTicketValues) {
    const key = keyByOldFieldId.get(v.fieldId);
    if (key === undefined) continue; // value on a field outside this scheme — untouched

    const typeId = typeByTicketId.get(v.ticketId);
    if (typeId === undefined) {
      throw new Error(`migrate-fields-links: ticket_values row ${v.id} references unknown ticket ${v.ticketId}`);
    }
    const newFieldId = newFieldIdByTypeKey.get(compositeKey(typeId, key));
    if (newFieldId === undefined) {
      orphanValueIds.push(v.id);
      const dk = `${typeId}:${key}`;
      droppedOrphans.set(dk, (droppedOrphans.get(dk) ?? 0) + 1);
      continue;
    }

    let newOptionId: number | null = null;
    if (v.optionId !== null) {
      const optionValue = optionValueByOldOptionId.get(v.optionId);
      if (optionValue === undefined) {
        throw new Error(`migrate-fields-links: ticket_values row ${v.id} references unknown option ${v.optionId}`);
      }
      const mapped = newOptionIdByFieldValue.get(compositeKey(newFieldId, optionValue));
      if (mapped === undefined) {
        throw new Error(
          `migrate-fields-links: no per-type option "${optionValue}" for field ${newFieldId} (ticket_values row ${v.id})`,
        );
      }
      newOptionId = mapped;
    }

    const groupKey = `${newFieldId}:${newOptionId ?? 'null'}`;
    const group = valueGroups.get(groupKey) ?? { fieldId: newFieldId, optionId: newOptionId, ids: [] };
    group.ids.push(v.id);
    valueGroups.set(groupKey, group);
  }

  if (orphanValueIds.length > 0) {
    await tx.delete(ticketValues).where(inArray(ticketValues.id, orphanValueIds));
  }

  for (const group of valueGroups.values()) {
    if (group.optionId === null) {
      await tx.update(ticketValues).set({ fieldId: group.fieldId }).where(inArray(ticketValues.id, group.ids));
    } else {
      await tx
        .update(ticketValues)
        .set({ fieldId: group.fieldId, optionId: group.optionId })
        .where(inArray(ticketValues.id, group.ids));
    }
  }

  // --- Step 5: derive + insert per-source-type links ----------------------
  const linkUsage: LinkUsageRow[] = [];
  for (const l of scopedTicketLinks) {
    const sourceTypeId = typeByTicketId.get(l.sourceTicketId);
    const targetTypeId = typeByTicketId.get(l.targetTicketId);
    if (sourceTypeId === undefined || targetTypeId === undefined) {
      throw new Error(`migrate-fields-links: ticket_links row ${l.id} references an unknown ticket`);
    }
    linkUsage.push({ sourceTypeId, targetTypeId, oldLinkTypeId: l.linkTypeId });
  }

  const derivedLinks = deriveTypeLinks(sharedLinks, linkUsage, allTypeIds);
  const keyByOldLinkId = new Map(sharedLinks.map((l) => [l.id, l.key]));
  const newLinkIdByTypeKey = new Map<string, number>();
  const positionBySourceType = new Map<number, number>();

  for (const dl of derivedLinks) {
    const position = positionBySourceType.get(dl.sourceTypeId) ?? 0;
    positionBySourceType.set(dl.sourceTypeId, position + 1);

    const [row] = await tx
      .insert(linkTypes)
      .values({
        ticketTypeId: dl.sourceTypeId,
        key: dl.key,
        label: dl.label,
        inverseLabel: dl.inverseLabel,
        directional: dl.directional,
        position,
        archivedAt: dl.archivedAt,
      })
      .returning();
    if (!row) throw new Error(`migrate-fields-links: link insert failed for type ${dl.sourceTypeId}/${dl.key}`);
    newLinkIdByTypeKey.set(compositeKey(dl.sourceTypeId, dl.key), row.id);

    if (dl.targetTypeIds.length > 0) {
      await tx
        .insert(linkTypeTargetTypes)
        .values(dl.targetTypeIds.map((targetTypeId) => ({ linkTypeId: row.id, targetTypeId })));
    }
  }

  // Remap ticket_links.link_type_id by each link's *source* ticket type.
  const linkIdsByNewLinkTypeId = new Map<number, number[]>();
  for (const l of scopedTicketLinks) {
    const sourceTypeId = typeByTicketId.get(l.sourceTicketId)!;
    const key = keyByOldLinkId.get(l.linkTypeId);
    if (key === undefined) continue; // defensive: scopedTicketLinks is already filtered to sharedLinkIds
    const newLinkTypeId = newLinkIdByTypeKey.get(compositeKey(sourceTypeId, key));
    if (newLinkTypeId === undefined) {
      throw new Error(
        `migrate-fields-links: no per-type link for source type ${sourceTypeId} key "${key}" (ticket_links row ${l.id})`,
      );
    }
    const ids = linkIdsByNewLinkTypeId.get(newLinkTypeId) ?? [];
    ids.push(l.id);
    linkIdsByNewLinkTypeId.set(newLinkTypeId, ids);
  }
  for (const [newLinkTypeId, ids] of linkIdsByNewLinkTypeId) {
    await tx.update(ticketLinks).set({ linkTypeId: newLinkTypeId }).where(inArray(ticketLinks.id, ids));
  }

  // --- Step 6: remap views -------------------------------------------------
  for (const v of scopedViews) {
    const remapped = remapViewConfig(v.config as Record<string, unknown>, keyByOldFieldId);
    await tx.update(views).set({ config: remapped }).where(eq(views.id, v.id));
  }

  // --- Step 7: delete the now-unreferenced old scheme-owned rows ----------
  // Every ticket_values/ticket_links/views reference has been remapped onto
  // the new per-type fields/links above, so the old shared rows are safe to
  // drop. This makes Task 4's contract migration (`ticket_type_id SET NOT
  // NULL` on `fields`/`link_types`) succeed — no NULL rows remain. FK order:
  // junction/dependent rows first, then the shared rows they pointed at.
  // (Intentionally deviates from the original brief, which left these for
  // Task 4 to drop in a DDL-only migration — deleting *data* belongs in this
  // data-migration script, keeping Task 4 pure-DDL.)

  // 1. ticket_type_fields: the new per-type model doesn't use this junction
  //    at all (each field now belongs to exactly one type) — clear it so it
  //    no longer FKs to the shared `fields` rows being dropped in step 3.
  await tx.delete(ticketTypeFields);

  // 2. field_options belonging to the old shared fields (ticket_type_id IS
  //    NULL) — must go before step 3 drops the fields they FK to. Scoped by
  //    the same `ticket_type_id IS NULL` subquery as step 3 (not
  //    `sharedFieldIds`) so the two stay FK-consistent no matter how many
  //    schemes' shared fields this predicate ends up covering.
  await tx.delete(fieldOptions).where(
    inArray(
      fieldOptions.fieldId,
      tx.select({ id: fields.id }).from(fields).where(isNull(fields.ticketTypeId)),
    ),
  );

  // 3. The old shared fields themselves — safe: every ticket_values row that
  //    pointed at one was remapped to a per-type field in step 4.
  await tx.delete(fields).where(isNull(fields.ticketTypeId));

  // 4. The old shared link types — safe: every ticket_links row that pointed
  //    at one was remapped to a per-source-type link in step 5.
  await tx.delete(linkTypes).where(isNull(linkTypes.ticketTypeId));

  return {
    fieldsInserted: derivedFields.length,
    linksInserted: derivedLinks.length,
    valuesRemapped:
      allTicketValues.filter((v) => keyByOldFieldId.has(v.fieldId)).length - orphanValueIds.length,
    valuesDropped: orphanValueIds.length,
    droppedOrphansByTypeKey: Object.fromEntries(droppedOrphans),
    linksRemapped: scopedTicketLinks.length,
    viewsRewritten: scopedViews.length,
  };
});

await sql.end();
console.log(JSON.stringify({ status: 'migrated', ...summary }));
