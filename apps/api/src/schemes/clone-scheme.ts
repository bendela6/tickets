import { eq, inArray } from 'drizzle-orm';
import type { Db } from '@tickets/db';
import {
  fieldOptions,
  fields,
  linkTypeTargetTypes,
  linkTypes,
  schemes,
  statusTransitions,
  statuses,
  ticketTypes,
} from '@tickets/db';

// pure: strip `id`, remap one FK column via the id map, keep the rest
export function remapClonedRows<T extends { id: number }>(
  rows: T[],
  fkColumn: keyof T,
  idMap: Map<number, number>,
): Array<Omit<T, 'id'>> {
  return rows.map((row) => {
    const { id: _id, ...rest } = row;
    const oldFk = row[fkColumn] as unknown as number;
    return { ...rest, [fkColumn]: idMap.get(oldFk) } as unknown as Omit<T, 'id'>;
  });
}

// Deep-copies a scheme and all its child rows with fresh ids (fork-and-modify).
export async function cloneScheme(db: Db, sourceSchemeId: number, input: { key: string; name: string }) {
  return db.transaction(async (tx) => {
    const [src] = await tx.select().from(schemes).where(eq(schemes.id, sourceSchemeId));
    if (!src) throw new Error('source scheme not found');
    const [dst] = await tx
      .insert(schemes)
      .values({ key: input.key, name: input.name, description: src.description, config: src.config })
      .returning();
    if (!dst) throw new Error('clone insert returned no row');

    // types
    const srcTypes = await tx.select().from(ticketTypes).where(eq(ticketTypes.schemeId, sourceSchemeId));
    const typeIdMap = new Map<number, number>();
    for (const t of srcTypes) {
      const [n] = await tx
        .insert(ticketTypes)
        .values({ schemeId: dst.id, key: t.key, label: t.label, position: t.position, config: t.config })
        .returning();
      typeIdMap.set(t.id, n!.id);
    }

    // statuses (per type)
    const srcStatuses = srcTypes.length
      ? await tx.select().from(statuses).where(inArray(statuses.ticketTypeId, srcTypes.map((t) => t.id)))
      : [];
    const statusIdMap = new Map<number, number>();
    for (const s of srcStatuses) {
      const [n] = await tx
        .insert(statuses)
        .values({
          ticketTypeId: typeIdMap.get(s.ticketTypeId!)!,
          key: s.key,
          label: s.label,
          kind: s.kind,
          position: s.position,
          config: s.config,
        })
        .returning();
      statusIdMap.set(s.id, n!.id);
    }

    // transitions
    const srcTransitions = srcStatuses.length
      ? await tx
          .select()
          .from(statusTransitions)
          .where(inArray(statusTransitions.toStatusId, srcStatuses.map((s) => s.id)))
      : [];
    if (srcTransitions.length) {
      await tx.insert(statusTransitions).values(
        srcTransitions.map((e) => ({
          fromStatusId: e.fromStatusId === null ? null : statusIdMap.get(e.fromStatusId)!,
          toStatusId: statusIdMap.get(e.toStatusId)!,
          ticketTypeId: e.ticketTypeId === null ? null : typeIdMap.get(e.ticketTypeId)!,
          config: e.config,
        })),
      );
    }

    // fields (per type) → options
    const srcFields = srcTypes.length
      ? await tx.select().from(fields).where(inArray(fields.ticketTypeId, srcTypes.map((t) => t.id)))
      : [];
    const fieldIdMap = new Map<number, number>();
    for (const f of srcFields) {
      const [n] = await tx
        .insert(fields)
        .values({
          ticketTypeId: typeIdMap.get(f.ticketTypeId!)!,
          key: f.key,
          label: f.label,
          type: f.type,
          system: f.system,
          required: f.required,
          position: f.position,
          config: f.config,
        })
        .returning();
      fieldIdMap.set(f.id, n!.id);
    }
    const srcOptions = srcFields.length
      ? await tx.select().from(fieldOptions).where(inArray(fieldOptions.fieldId, srcFields.map((f) => f.id)))
      : [];
    if (srcOptions.length) {
      await tx.insert(fieldOptions).values(remapClonedRows(srcOptions, 'fieldId', fieldIdMap));
    }

    // link types (per type) + targets
    const srcLinks = srcTypes.length
      ? await tx.select().from(linkTypes).where(inArray(linkTypes.ticketTypeId, srcTypes.map((t) => t.id)))
      : [];
    const linkIdMap = new Map<number, number>();
    for (const l of srcLinks) {
      const [n] = await tx
        .insert(linkTypes)
        .values({
          ticketTypeId: typeIdMap.get(l.ticketTypeId!)!,
          key: l.key,
          label: l.label,
          inverseLabel: l.inverseLabel,
          directional: l.directional,
          position: l.position,
        })
        .returning();
      linkIdMap.set(l.id, n!.id);
    }
    const srcTargets = srcLinks.length
      ? await tx.select().from(linkTypeTargetTypes).where(inArray(linkTypeTargetTypes.linkTypeId, srcLinks.map((l) => l.id)))
      : [];
    if (srcTargets.length) {
      await tx.insert(linkTypeTargetTypes).values(
        srcTargets.map((r) => ({
          linkTypeId: linkIdMap.get(r.linkTypeId)!,
          targetTypeId: typeIdMap.get(r.targetTypeId)!,
        })),
      );
    }

    return { schemeId: dst.id };
  });
}
