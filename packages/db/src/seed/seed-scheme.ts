import type { Db } from '../client';
import {
  fieldOptions,
  fields,
  linkTypes,
  schemes,
  statusTransitions,
  statuses,
  ticketTypeFields,
  ticketTypes,
} from '../schema';
import { buildTransitions } from './build-transitions';
import type { SchemeDef } from './scheme-types';
import { KIND_COLORS } from './software-scheme';

export async function seedScheme(db: Db, def: SchemeDef) {
  return db.transaction(async (tx) => {
    const [scheme] = await tx
      .insert(schemes)
      .values({ key: def.key, name: def.name, description: def.description })
      .returning();
    if (!scheme) throw new Error('scheme insert returned no row');

    // fields (+ options)
    const fieldIdByKey: Record<string, number> = {};
    for (const f of def.fields) {
      const [row] = await tx
        .insert(fields)
        .values({
          schemeId: scheme.id,
          key: f.key,
          label: f.label,
          type: f.type,
          system: f.system ?? false,
          config: f.config ?? {},
        })
        .returning();
      if (!row) throw new Error(`field insert failed: ${f.key}`);
      fieldIdByKey[f.key] = row.id;
      if (f.options && f.options.length > 0) {
        await tx.insert(fieldOptions).values(
          f.options.map((o, i) => ({
            fieldId: row.id,
            value: o.value,
            label: o.label,
            position: i,
            config: o.color ? { color: o.color } : {},
          })),
        );
      }
    }

    // types + per-type statuses + attachments
    const typeIdByKey: Record<string, number> = {};
    const statusIdByTypeKey: Record<string, Record<string, number>> = {};
    for (const [position, t] of def.types.entries()) {
      const [typeRow] = await tx
        .insert(ticketTypes)
        .values({
          schemeId: scheme.id,
          key: t.key,
          label: t.label,
          position,
          config: { color: t.color, allowedChildTypes: t.allowedChildTypes ?? [] },
        })
        .returning();
      if (!typeRow) throw new Error(`type insert failed: ${t.key}`);
      typeIdByKey[t.key] = typeRow.id;

      const byStatusKey: Record<string, number> = {};
      for (const [sPos, st] of t.statuses.entries()) {
        const [statusRow] = await tx
          .insert(statuses)
          .values({
            ticketTypeId: typeRow.id,
            key: st.key,
            label: st.label,
            kind: st.kind,
            position: sPos,
            config: { color: KIND_COLORS[st.kind], ...(st.initial ? { initial: true } : {}) },
          })
          .returning();
        if (!statusRow) throw new Error(`status insert failed: ${t.key}/${st.key}`);
        byStatusKey[st.key] = statusRow.id;
      }
      statusIdByTypeKey[t.key] = byStatusKey;

      const edgeDefs = buildTransitions(t);
      if (edgeDefs.length > 0) {
        await tx.insert(statusTransitions).values(
          edgeDefs.map((e) => ({
            fromStatusId: e.fromKey === null ? null : byStatusKey[e.fromKey]!,
            toStatusId: byStatusKey[e.toKey]!,
            ticketTypeId: typeRow.id,
            config: e.config ?? {},
          })),
        );
      }

      const required = new Set(t.requiredFieldKeys ?? []);
      await tx.insert(ticketTypeFields).values(
        t.fieldKeys.map((key, i) => {
          const fieldId = fieldIdByKey[key];
          if (fieldId === undefined) throw new Error(`type ${t.key} references unknown field ${key}`);
          return { ticketTypeId: typeRow.id, fieldId, position: i, required: required.has(key) };
        }),
      );
    }

    // link types
    await tx.insert(linkTypes).values(
      def.linkTypes.map((lt, i) => ({
        schemeId: scheme.id,
        key: lt.key,
        label: lt.label,
        inverseLabel: lt.inverseLabel,
        directional: lt.directional,
        position: i,
      })),
    );

    return { schemeId: scheme.id, typeIdByKey, fieldIdByKey, statusIdByTypeKey };
  });
}
