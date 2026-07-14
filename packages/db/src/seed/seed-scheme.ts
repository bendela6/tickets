import { eq, inArray } from 'drizzle-orm';
import type { Db } from '../client';
import {
  fields, itemTypeChildTypes, itemTypeFields, itemTypes, linkTypeTargetTypes, linkTypes,
  optionSets, optionTransitions, options, schemes,
} from '../schema';
import type { SchemeDef } from './scheme-types';

export type SeededScheme = {
  schemeId: number;
  typeIdByKey: Map<string, number>;
  fieldIdByKey: Map<string, number>;
  optionSetIdByKey: Map<string, number>;
  // key is `${optionSetKey}:${optionValue}`
  optionIdByKey: Map<string, number>;
};

export async function seedScheme(db: Db, def: SchemeDef): Promise<SeededScheme> {
  const [scheme] = await db
    .insert(schemes)
    .values({ key: def.key, name: def.name })
    .returning();
  const schemeId = scheme!.id;

  const optionSetIdByKey = new Map<string, number>();
  const optionIdByKey = new Map<string, number>();
  for (const set of def.optionSets) {
    const [row] = await db
      .insert(optionSets)
      .values({ schemeId, key: set.key, name: set.name })
      .returning();
    optionSetIdByKey.set(set.key, row!.id);
    if (set.options.length === 0) continue;              // labels/component start empty
    const inserted = await db
      .insert(options)
      .values(
        set.options.map((o, position) => ({
          optionSetId: row!.id,
          value: o.value,
          label: o.label,
          position,
          kind: o.kind ?? null,
          config: o.config ?? {},
        })),
      )
      .returning();
    inserted.forEach((o) => optionIdByKey.set(`${set.key}:${o.value}`, o.id));
  }

  const fieldIdByKey = new Map<string, number>();
  for (const f of def.fields) {
    const [row] = await db
      .insert(fields)
      .values({
        schemeId,
        key: f.key,
        label: f.label,
        type: f.type,
        system: f.system ?? false,
        config: f.config ?? {},
        optionSetId: f.optionSetKey ? optionSetIdByKey.get(f.optionSetKey)! : null,
      })
      .returning();
    fieldIdByKey.set(f.key, row!.id);
  }

  const typeIdByKey = new Map<string, number>();
  for (const [position, t] of def.types.entries()) {
    const [row] = await db
      .insert(itemTypes)
      .values({ schemeId, key: t.key, label: t.label, position, config: t.config ?? {} })
      .returning();
    typeIdByKey.set(t.key, row!.id);
  }

  for (const t of def.types) {
    const itemTypeId = typeIdByKey.get(t.key)!;
    await db.insert(itemTypeFields).values(
      t.placements.map((p, position) => {
        const field = def.fields.find((f) => f.key === p.fieldKey)!;
        const allowed = p.allowedOptionValues?.map(
          (v) => optionIdByKey.get(`${field.optionSetKey}:${v}`)!,
        );
        return {
          itemTypeId,
          fieldId: fieldIdByKey.get(p.fieldKey)!,
          position,
          required: p.required ?? false,
          configOverride: allowed ? { allowedOptionIds: allowed } : null,
        };
      }),
    );
    if (t.allowedChildTypes?.length) {
      await db.insert(itemTypeChildTypes).values(
        t.allowedChildTypes.map((childKey) => ({
          parentTypeId: itemTypeId,
          childTypeId: typeIdByKey.get(childKey)!,
        })),
      );
    }
  }

  if (def.transitions.length) {
    await db.insert(optionTransitions).values(
      def.transitions.map((tr) => {
        const field = def.fields.find((f) => f.key === tr.fieldKey)!;
        return {
          fieldId: fieldIdByKey.get(tr.fieldKey)!,
          fromOptionId: tr.fromValue
            ? optionIdByKey.get(`${field.optionSetKey}:${tr.fromValue}`)!
            : null,
          toOptionId: optionIdByKey.get(`${field.optionSetKey}:${tr.toValue}`)!,
          itemTypeId: tr.typeKey ? typeIdByKey.get(tr.typeKey)! : null,
        };
      }),
    );
  }

  for (const [position, lt] of def.linkTypes.entries()) {
    const [row] = await db
      .insert(linkTypes)
      .values({
        itemTypeId: typeIdByKey.get(lt.ownerTypeKey)!,
        key: lt.key,
        label: lt.label,
        inverseLabel: lt.inverseLabel,
        directional: lt.directional,
        position,
      })
      .returning();
    await db.insert(linkTypeTargetTypes).values(
      lt.targetTypeKeys.map((k) => ({
        linkTypeId: row!.id,
        targetTypeId: typeIdByKey.get(k)!,
      })),
    );
  }

  return { schemeId, typeIdByKey, fieldIdByKey, optionSetIdByKey, optionIdByKey };
}

// Removes exactly what seedScheme() created, in FK-safe order (children
// before the parents they reference). Lets tests re-seed the same fixed
// scheme key on every run without needing a database reset between them.
export async function deleteSeededScheme(db: Db, seeded: SeededScheme): Promise<void> {
  const typeIds = [...seeded.typeIdByKey.values()];
  const fieldIds = [...seeded.fieldIdByKey.values()];
  const optionSetIds = [...seeded.optionSetIdByKey.values()];

  const linkTypeIds = typeIds.length
    ? (
        await db
          .select({ id: linkTypes.id })
          .from(linkTypes)
          .where(inArray(linkTypes.itemTypeId, typeIds))
      ).map((r) => r.id)
    : [];

  if (linkTypeIds.length) {
    await db.delete(linkTypeTargetTypes).where(inArray(linkTypeTargetTypes.linkTypeId, linkTypeIds));
    await db.delete(linkTypes).where(inArray(linkTypes.id, linkTypeIds));
  }
  if (fieldIds.length) {
    await db.delete(optionTransitions).where(inArray(optionTransitions.fieldId, fieldIds));
  }
  if (typeIds.length) {
    await db.delete(itemTypeChildTypes).where(inArray(itemTypeChildTypes.parentTypeId, typeIds));
    await db.delete(itemTypeFields).where(inArray(itemTypeFields.itemTypeId, typeIds));
  }
  await db.delete(itemTypes).where(eq(itemTypes.schemeId, seeded.schemeId));
  await db.delete(fields).where(eq(fields.schemeId, seeded.schemeId));
  if (optionSetIds.length) {
    await db.delete(options).where(inArray(options.optionSetId, optionSetIds));
  }
  await db.delete(optionSets).where(eq(optionSets.schemeId, seeded.schemeId));
  await db.delete(schemes).where(eq(schemes.id, seeded.schemeId));
}
