import { count, eq } from 'drizzle-orm';
import type { Db, DbExecutor } from '@tickets/db';
import { linkTypeTargetTypes, linkTypes, ticketTypes } from '@tickets/db';
import { HttpError } from '../errors';

export type CreateLinkTypeInput = {
  key: string;
  label: string;
  inverseLabel: string;
  directional: boolean;
  targetTypeKeys: string[];
};

// Link targets are scoped to the owning type's scheme (a link type can only
// target types that live in the same scheme as the type that owns it).
// Loads that scheme via `typeId`'s `ticket_types.scheme_id`, maps
// `targetTypeKeys` -> ids among that scheme's types, and throws
// HttpError(400) on an unknown owning type or an unknown target key.
export async function resolveTargetTypeIds(
  tx: DbExecutor,
  typeId: number,
  targetTypeKeys: string[],
): Promise<number[]> {
  const ownerRows = await tx.select().from(ticketTypes).where(eq(ticketTypes.id, typeId));
  const owner = ownerRows[0];
  if (!owner) {
    throw new HttpError(400, `unknown ticket type "${typeId}"`);
  }
  const schemeTypes = await tx
    .select()
    .from(ticketTypes)
    .where(eq(ticketTypes.schemeId, owner.schemeId));
  const typeIdByKey = new Map(schemeTypes.map((t) => [t.key, t.id]));
  return targetTypeKeys.map((key) => {
    const targetTypeId = typeIdByKey.get(key);
    if (targetTypeId === undefined) {
      throw new HttpError(400, `unknown ticket type "${key}"`);
    }
    return targetTypeId;
  });
}

// Inserts a link type owned by `typeId` at the next position, plus its
// `link_type_target_types` rows, all in one transaction (targets are
// resolved and inserted, or nothing is — no half-created link type). Targets
// are resolved *before* the insert so an unknown owning type / target key
// surfaces as a clean HttpError(400) instead of a raw FK-violation error.
export async function createLinkTypeForType(db: Db, typeId: number, input: CreateLinkTypeInput) {
  return db.transaction(async (tx) => {
    const targetTypeIds = await resolveTargetTypeIds(tx, typeId, input.targetTypeKeys);
    const position =
      (await tx.select({ value: count() }).from(linkTypes).where(eq(linkTypes.ticketTypeId, typeId)))[0]
        ?.value ?? 0;
    const [linkType] = await tx
      .insert(linkTypes)
      .values({
        ticketTypeId: typeId,
        key: input.key,
        label: input.label,
        inverseLabel: input.inverseLabel,
        directional: input.directional,
        position,
      })
      .returning();
    if (!linkType) {
      throw new HttpError(500, 'link type insert returned no row');
    }
    if (targetTypeIds.length > 0) {
      await tx
        .insert(linkTypeTargetTypes)
        .values(targetTypeIds.map((targetTypeId) => ({ linkTypeId: linkType.id, targetTypeId })));
    }
    return linkType;
  });
}
