import type { Db } from '../client';
import { fieldOptions, fields, linkTypeTargetTypes, linkTypes, schemes, statusTransitions, statuses, ticketTypes } from '../schema';
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

    const fieldCatalog = new Map(def.fields.map((f) => [f.key, f]));
    const linkCatalog = new Map(def.linkTypes.map((l) => [l.key, l]));

    const typeIdByKey: Record<string, number> = {};
    const statusIdByTypeKey: Record<string, Record<string, number>> = {};
    const fieldIdByTypeKey: Record<string, Record<string, number>> = {};

    // pass 1: types + statuses + transitions + per-type fields (+options)
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

      // statuses
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

      // per-type fields (materialize a copy of each referenced catalog field)
      const required = new Set(t.requiredFieldKeys ?? []);
      const byFieldKey: Record<string, number> = {};
      for (const [i, key] of t.fieldKeys.entries()) {
        const f = fieldCatalog.get(key);
        if (!f) throw new Error(`type ${t.key} references unknown field ${key}`);
        const [row] = await tx
          .insert(fields)
          .values({
            ticketTypeId: typeRow.id,
            key: f.key,
            label: f.label,
            type: f.type,
            system: f.system ?? false,
            required: required.has(key),
            position: i,
            config: f.config ?? {},
          })
          .returning();
        if (!row) throw new Error(`field insert failed: ${t.key}/${key}`);
        byFieldKey[key] = row.id;
        if (f.options && f.options.length > 0) {
          await tx.insert(fieldOptions).values(
            f.options.map((o, oi) => ({
              fieldId: row.id,
              value: o.value,
              label: o.label,
              position: oi,
              config: o.color ? { color: o.color } : {},
            })),
          );
        }
      }
      fieldIdByTypeKey[t.key] = byFieldKey;
    }

    // pass 2: per-type link types (+ target rows) — needs all type ids resolved
    const allTypeKeys = def.types.map((t) => t.key);
    for (const t of def.types) {
      const owned = t.linkKeys ?? allCatalogLinks(linkCatalog, allTypeKeys);
      for (const [i, decl] of owned.entries()) {
        const lt = linkCatalog.get(decl.key);
        if (!lt) throw new Error(`type ${t.key} references unknown link ${decl.key}`);
        const [row] = await tx
          .insert(linkTypes)
          .values({
            ticketTypeId: typeIdByKey[t.key]!,
            key: lt.key,
            label: lt.label,
            inverseLabel: lt.inverseLabel,
            directional: lt.directional,
            position: i,
          })
          .returning();
        if (!row) throw new Error(`link insert failed: ${t.key}/${decl.key}`);
        const targetIds = decl.targetTypeKeys.map((k) => {
          const id = typeIdByKey[k];
          if (id === undefined) throw new Error(`link ${t.key}/${decl.key} unknown target ${k}`);
          return id;
        });
        if (targetIds.length > 0) {
          await tx
            .insert(linkTypeTargetTypes)
            .values(targetIds.map((targetTypeId) => ({ linkTypeId: row.id, targetTypeId })));
        }
      }
    }

    // TEMP: removed in Task 4 — ensureSoftwareScheme still reads seedScheme(...).fieldIdByKey
    // (scheme-wide) to resolve seedProject's default-view field ids. Flatten the per-type map
    // (last-write-wins across types) so that caller keeps compiling until Task 4 rewires it to
    // fieldIdByTypeKey / key-based view columns.
    const fieldIdByKey: Record<string, number> = {};
    for (const byFieldKey of Object.values(fieldIdByTypeKey)) {
      Object.assign(fieldIdByKey, byFieldKey);
    }

    return { schemeId: scheme.id, typeIdByKey, fieldIdByTypeKey, statusIdByTypeKey, fieldIdByKey };
  });
}

// default: a type owns every catalog link, targeting all types
function allCatalogLinks(
  linkCatalog: Map<string, { key: string }>,
  allTypeKeys: string[],
): { key: string; targetTypeKeys: string[] }[] {
  return [...linkCatalog.keys()].map((key) => ({ key, targetTypeKeys: allTypeKeys }));
}
