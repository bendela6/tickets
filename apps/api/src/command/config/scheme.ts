import * as v from 'valibot';
import { eq, inArray } from 'drizzle-orm';
import {
  fields, itemTypeChildTypes, itemTypeFields, itemTypes, linkTypeTargetTypes, linkTypes,
  optionSets, optionTransitions, options, schemes,
} from '@tickets/db';
import { HttpError } from '../../errors';
import { defineCommand } from '../registry';
import { schemeForked } from './events';

export const schemeForkInput = v.object({
  sourceSchemeId: v.pipe(v.number(), v.integer()),
  key: v.pipe(v.string(), v.minLength(1)),
  name: v.pipe(v.string(), v.minLength(1)),
});

// item_type_fields.configOverride can carry `allowedOptionIds`, a per-type
// status/option allowlist expressed as SOURCE option ids. Options are
// re-inserted under fresh ids during a fork (see optionMap below), so this
// must be remapped too — otherwise the forked placement's allowlist points
// at options that don't exist in the destination scheme, and
// optionsForField() intersects to an empty set at item-create time.
function remapConfigOverride(co: unknown, optionMap: Map<number, number>): unknown {
  if (co && typeof co === 'object' && Array.isArray((co as { allowedOptionIds?: unknown }).allowedOptionIds)) {
    const src = co as { allowedOptionIds: number[] };
    return { ...src, allowedOptionIds: src.allowedOptionIds.map((id) => optionMap.get(id) ?? id) };
  }
  return co;
}

export const schemeFork = defineCommand({
  kind: 'scheme.fork',
  input: schemeForkInput,
  aggregate: () => ({ type: 'scheme' }),
  async handler(tx, input, ctx) {
    const src = (await tx.select().from(schemes).where(eq(schemes.id, input.sourceSchemeId)))[0];
    if (!src) throw new HttpError(400, 'source scheme not found');
    const dst = (await tx.insert(schemes).values({ key: input.key, name: input.name, config: src.config }).returning())[0]!;
    ctx.aggregateId = dst.id;

    // item_types
    const srcTypes = await tx.select().from(itemTypes).where(eq(itemTypes.schemeId, src.id));
    const typeMap = new Map<number, number>();
    for (const t of srcTypes) {
      const n = (await tx.insert(itemTypes).values({ schemeId: dst.id, key: t.key, label: t.label, position: t.position, config: t.config }).returning())[0]!;
      typeMap.set(t.id, n.id);
    }
    // option_sets → options
    const srcSets = await tx.select().from(optionSets).where(eq(optionSets.schemeId, src.id));
    const setMap = new Map<number, number>();
    for (const s of srcSets) {
      const n = (await tx.insert(optionSets).values({ schemeId: dst.id, key: s.key, name: s.name }).returning())[0]!;
      setMap.set(s.id, n.id);
    }
    const setIds = srcSets.map((s) => s.id);
    const srcOptions = setIds.length ? await tx.select().from(options).where(inArray(options.optionSetId, setIds)) : [];
    const optionMap = new Map<number, number>();
    for (const o of srcOptions) {
      const n = (await tx.insert(options).values({ optionSetId: setMap.get(o.optionSetId)!, value: o.value, label: o.label, position: o.position, kind: o.kind, config: o.config }).returning())[0]!;
      optionMap.set(o.id, n.id);
    }
    // fields (scheme-scoped) with remapped optionSetId
    const srcFields = await tx.select().from(fields).where(eq(fields.schemeId, src.id));
    const fieldMap = new Map<number, number>();
    for (const f of srcFields) {
      const n = (await tx.insert(fields).values({ schemeId: dst.id, key: f.key, label: f.label, type: f.type, system: f.system, config: f.config, optionSetId: f.optionSetId == null ? null : setMap.get(f.optionSetId)! }).returning())[0]!;
      fieldMap.set(f.id, n.id);
    }
    // item_type_fields placements
    const typeIds = srcTypes.map((t) => t.id);
    const srcPlacements = typeIds.length ? await tx.select().from(itemTypeFields).where(inArray(itemTypeFields.itemTypeId, typeIds)) : [];
    if (srcPlacements.length) {
      await tx.insert(itemTypeFields).values(srcPlacements.map((p) => ({ itemTypeId: typeMap.get(p.itemTypeId)!, fieldId: fieldMap.get(p.fieldId)!, position: p.position, required: p.required, configOverride: remapConfigOverride(p.configOverride, optionMap) })));
    }
    // item_type_child_types
    const srcChildren = typeIds.length ? await tx.select().from(itemTypeChildTypes).where(inArray(itemTypeChildTypes.parentTypeId, typeIds)) : [];
    if (srcChildren.length) {
      await tx.insert(itemTypeChildTypes).values(srcChildren.map((c) => ({ parentTypeId: typeMap.get(c.parentTypeId)!, childTypeId: typeMap.get(c.childTypeId)! })));
    }
    // link_types → targets
    const srcLinks = typeIds.length ? await tx.select().from(linkTypes).where(inArray(linkTypes.itemTypeId, typeIds)) : [];
    const linkMap = new Map<number, number>();
    for (const l of srcLinks) {
      const n = (await tx.insert(linkTypes).values({ itemTypeId: typeMap.get(l.itemTypeId)!, key: l.key, label: l.label, inverseLabel: l.inverseLabel, directional: l.directional, position: l.position }).returning())[0]!;
      linkMap.set(l.id, n.id);
    }
    const linkIds = srcLinks.map((l) => l.id);
    const srcTargets = linkIds.length ? await tx.select().from(linkTypeTargetTypes).where(inArray(linkTypeTargetTypes.linkTypeId, linkIds)) : [];
    if (srcTargets.length) {
      await tx.insert(linkTypeTargetTypes).values(srcTargets.map((r) => ({ linkTypeId: linkMap.get(r.linkTypeId)!, targetTypeId: typeMap.get(r.targetTypeId)! })));
    }
    // option_transitions (remap field, options, type)
    const fieldIds = srcFields.map((f) => f.id);
    const srcTransitions = fieldIds.length ? await tx.select().from(optionTransitions).where(inArray(optionTransitions.fieldId, fieldIds)) : [];
    if (srcTransitions.length) {
      await tx.insert(optionTransitions).values(srcTransitions.map((e) => ({ fieldId: fieldMap.get(e.fieldId)!, fromOptionId: e.fromOptionId == null ? null : optionMap.get(e.fromOptionId)!, toOptionId: optionMap.get(e.toOptionId)!, itemTypeId: e.itemTypeId == null ? null : typeMap.get(e.itemTypeId)!, config: e.config })));
    }

    await ctx.emit(schemeForked, { sourceSchemeId: src.id, key: dst.key, name: dst.name });
    return { schemeId: dst.id };
  },
});
