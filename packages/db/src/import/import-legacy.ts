// packages/db/src/import/import-legacy.ts
// Writes the real legacy records (items, values, comments, links, projects)
// into the freshly-migrated items* schema, inside one transaction. Pure
// structural transform lives in map-structure.ts — this file only does I/O
// and id bookkeeping. See .superpowers/sdd/task-10-brief.md.
import { sql as raw } from 'drizzle-orm';
import type { Db } from '../client';
import {
  comments, commentReactions, fields, itemLinks, itemTypeChildTypes, itemTypeFields, itemTypes,
  itemValues, items, linkTypeTargetTypes, linkTypes, optionSets, optionTransitions, options,
  projects, schemes, users, views,
} from '../schema';
import { mapStructure } from './map-structure';
import type { Legacy } from './read-legacy';

export type ImportResult = {
  schemeId: number;
  fieldIdByLegacyId: Map<number, number>;
  optionIdByLegacyOptionId: Map<number, number>;
  optionIdByLegacyStatusId: Map<number, number>;
  userIdByAgentName: Map<string, number>;
};

// Every id-bearing table this import writes into. Reset after the explicit-id
// inserts so the next ordinary insert (fields/options included, whose ids
// *are* fresh from serial here) never collides with a preserved legacy id.
const SEQUENCED = [
  'users', 'projects', 'schemes', 'item_types', 'fields', 'option_sets',
  'options', 'option_transitions', 'link_types', 'items', 'item_values', 'comments',
  'comment_reactions', 'item_links', 'views',
];

// Legacy view configs may (in principle) carry a numeric fieldId reference
// (apps/web/src/utils/view-config.ts still supports that pre-fieldKey shape
// as a fallback). Remap any such reference to the new field id; fieldKey
// strings pass through untouched since field keys are stable across the
// rebuild (map-structure.ts preserves them 1:1).
// read-legacy.ts's Legacy* types declare timestamp columns as `string`, but
// postgres.js parses timestamp/timestamptz/date columns into JS Date objects
// at runtime by default — the type annotation describes the post-transform
// shape Task 9 assumed, not what the driver actually hands back. drizzle's
// `mode: 'string'` timestamp columns need a real string, so normalize here
// rather than widen the Legacy types (every other reader — map-structure —
// never touches these columns).
function toIso(v: unknown): string {
  return v instanceof Date ? v.toISOString() : String(v);
}
function toIsoOrNull(v: unknown): string | null {
  return v === null || v === undefined ? null : toIso(v);
}

function remapViewConfigFieldIds(value: unknown, fieldIdByLegacyId: Map<number, number>): unknown {
  if (Array.isArray(value)) {
    return value.map((v) => remapViewConfigFieldIds(v, fieldIdByLegacyId));
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = k === 'fieldId' && typeof v === 'number' ? (fieldIdByLegacyId.get(v) ?? v) : remapViewConfigFieldIds(v, fieldIdByLegacyId);
    }
    return out;
  }
  return value;
}

export async function importLegacy(db: Db, legacy: Legacy): Promise<ImportResult> {
  const plan = mapStructure(legacy);

  return db.transaction(async (tx) => {
    // --- 1. users: legacy users keep their ids; agent users are new rows,
    // explicitly numbered past the legacy max (never rely on the serial
    // sequence here — it hasn't been advanced past the explicit ids yet). ---
    if (legacy.users.length) {
      await tx.insert(users).values(
        legacy.users.map((u) => ({ id: u.id, name: u.name, kind: u.kind })),
      );
    }
    const nextUserId = legacy.users.reduce((max, u) => Math.max(max, u.id), 0) + 1;
    const userIdByAgentName = new Map<string, number>();
    if (plan.agentUserNames.length) {
      const agentRows = plan.agentUserNames.map((name, i) => ({
        id: nextUserId + i,
        name,
        kind: 'agent' as const,
      }));
      await tx.insert(users).values(agentRows);
      for (const r of agentRows) userIdByAgentName.set(r.name, r.id);
    }

    // --- 2. scheme: one row. The legacy `schemes` table isn't part of the
    // Legacy read shape (single fixed row) — key/name match it directly. ---
    const [scheme] = await tx.insert(schemes).values({ key: 'software', name: 'Software' }).returning();
    if (!scheme) throw new Error('scheme insert returned no row');
    const schemeId = scheme.id;

    // --- 3. option_sets + options: new ids (restructured — shared, not
    // type-owned). Build the key -> id maps, then resolve every legacy
    // option/status id through them. ---
    const optionSetIdByKey = new Map<string, number>();
    const optionIdByKey = new Map<string, number>();
    for (const set of plan.optionSets) {
      const [row] = await tx.insert(optionSets).values({ schemeId, key: set.key, name: set.name }).returning();
      if (!row) throw new Error(`option_set insert returned no row for "${set.key}"`);
      optionSetIdByKey.set(set.key, row.id);
      if (!set.options.length) continue; // labels/component start empty
      const inserted = await tx
        .insert(options)
        .values(
          set.options.map((o) => ({
            optionSetId: row.id,
            value: o.value,
            label: o.label,
            position: o.position,
            kind: o.kind,
            config: o.config,
          })),
        )
        .returning();
      for (const o of inserted) optionIdByKey.set(`${set.key}:${o.value}`, o.id);
    }

    const optionIdByLegacyOptionId = new Map<number, number>();
    for (const [legacyId, key] of plan.optionKeyByLegacyOptionId) {
      const id = optionIdByKey.get(key);
      if (id === undefined) throw new Error(`no option resolves for key "${key}" (legacy option id ${legacyId})`);
      optionIdByLegacyOptionId.set(legacyId, id);
    }
    const optionIdByLegacyStatusId = new Map<number, number>();
    for (const [legacyId, key] of plan.optionKeyByLegacyStatusId) {
      const id = optionIdByKey.get(key);
      if (id === undefined) throw new Error(`no option resolves for key "${key}" (legacy status id ${legacyId})`);
      optionIdByLegacyStatusId.set(legacyId, id);
    }

    // --- 4. fields: new ids (restructured — shared, not type-owned). ---
    const fieldIdByKey = new Map<string, number>();
    for (const f of plan.fields) {
      const [row] = await tx
        .insert(fields)
        .values({
          schemeId,
          key: f.key,
          label: f.label,
          type: f.type,
          system: f.system,
          config: f.config,
          optionSetId: f.optionSetKey ? (optionSetIdByKey.get(f.optionSetKey) ?? null) : null,
        })
        .returning();
      if (!row) throw new Error(`field insert returned no row for "${f.key}"`);
      fieldIdByKey.set(f.key, row.id);
    }
    const fieldIdByLegacyId = new Map<number, number>();
    for (const [legacyId, key] of plan.fieldKeyByLegacyId) {
      const id = fieldIdByKey.get(key);
      if (id === undefined) throw new Error(`no field resolves for key "${key}" (legacy field id ${legacyId})`);
      fieldIdByLegacyId.set(legacyId, id);
    }
    const fieldByKey = new Map(plan.fields.map((f) => [f.key, f]));

    // --- 5. item_types (explicit ids) + item_type_child_types +
    // item_type_fields. Ticket type ids are preserved, so legacy
    // ticket_type_id references (link_types, placements' typeKey) resolve
    // directly against the new item_types ids. ---
    if (legacy.ticketTypes.length) {
      await tx.insert(itemTypes).values(
        legacy.ticketTypes.map((t) => ({
          id: t.id,
          schemeId,
          key: t.key,
          label: t.label,
          position: t.position,
          config: (t.config ?? {}) as Record<string, unknown>,
          archivedAt: toIsoOrNull(t.archivedAt),
        })),
      );
    }
    const typeIdByKey = new Map(legacy.ticketTypes.map((t) => [t.key, t.id]));

    if (legacy.ticketTypeChildTypes.length) {
      await tx.insert(itemTypeChildTypes).values(
        legacy.ticketTypeChildTypes.map((c) => ({ parentTypeId: c.parentTypeId, childTypeId: c.childTypeId })),
      );
    }

    if (plan.placements.length) {
      await tx.insert(itemTypeFields).values(
        plan.placements.map((p) => {
          const itemTypeId = typeIdByKey.get(p.typeKey);
          const fieldId = fieldIdByKey.get(p.fieldKey);
          if (itemTypeId === undefined) throw new Error(`placement references unknown type key "${p.typeKey}"`);
          if (fieldId === undefined) throw new Error(`placement references unknown field key "${p.fieldKey}"`);
          const field = fieldByKey.get(p.fieldKey);
          const allowed = p.allowedOptionValues?.map((v) => {
            const id = optionIdByKey.get(`${field?.optionSetKey}:${v}`);
            if (id === undefined) throw new Error(`placement allowlist references unknown option "${field?.optionSetKey}:${v}"`);
            return id;
          });
          return {
            itemTypeId,
            fieldId,
            position: p.position,
            required: p.required,
            configOverride: allowed ? { allowedOptionIds: allowed } : null,
          };
        }),
      );
    }

    // --- 6. option_transitions: new ids (fine — nothing references them). ---
    if (plan.transitions.length) {
      await tx.insert(optionTransitions).values(
        plan.transitions.map((tr) => {
          const field = fieldByKey.get(tr.fieldKey);
          if (!field) throw new Error(`transition references unknown field key "${tr.fieldKey}"`);
          const toOptionId = optionIdByKey.get(`${field.optionSetKey}:${tr.toValue}`);
          if (toOptionId === undefined) throw new Error(`transition references unknown option "${field.optionSetKey}:${tr.toValue}"`);
          const fromOptionId = tr.fromValue ? optionIdByKey.get(`${field.optionSetKey}:${tr.fromValue}`) : null;
          if (tr.fromValue && fromOptionId === undefined) throw new Error(`transition references unknown option "${field.optionSetKey}:${tr.fromValue}"`);
          return {
            fieldId: fieldIdByKey.get(tr.fieldKey)!,
            fromOptionId: fromOptionId ?? null,
            toOptionId,
            itemTypeId: tr.typeKey ? (typeIdByKey.get(tr.typeKey) ?? null) : null,
          };
        }),
      );
    }

    // --- 7. link_types (explicit ids, ticketTypeId -> itemTypeId is a
    // no-op since ids are preserved) + link_type_target_types. ---
    if (legacy.linkTypes.length) {
      await tx.insert(linkTypes).values(
        legacy.linkTypes.map((lt) => ({
          id: lt.id,
          itemTypeId: lt.ticketTypeId,
          key: lt.key,
          label: lt.label,
          inverseLabel: lt.inverseLabel,
          directional: lt.directional,
          position: lt.position,
          archivedAt: toIsoOrNull(lt.archivedAt),
        })),
      );
    }
    if (legacy.linkTypeTargetTypes.length) {
      await tx.insert(linkTypeTargetTypes).values(
        legacy.linkTypeTargetTypes.map((r) => ({ linkTypeId: r.linkTypeId, targetTypeId: r.targetTypeId })),
      );
    }

    // --- 8. projects (explicit ids). schemeId is the *new* scheme's id —
    // the legacy schemeId column is not carried over. ---
    if (legacy.projects.length) {
      await tx.insert(projects).values(
        legacy.projects.map((p) => ({
          id: p.id,
          key: p.key,
          name: p.name,
          itemPrefix: p.ticketPrefix,
          schemeId,
          createdAt: toIso(p.createdAt),
        })),
      );
    }

    // --- 9. items (explicit ids). Parents before children: sort by
    // parentId NULLS FIRST. Since a ticket can only reference a parent that
    // already existed (lower id), sorting by (parentId, id-implicit) this
    // way guarantees every parent is inserted before its children even
    // across multi-level chains. ---
    const orderedTickets = legacy.tickets
      .slice()
      .sort((a, b) => (a.parentId ?? -1) - (b.parentId ?? -1));
    if (orderedTickets.length) {
      await tx.insert(items).values(
        orderedTickets.map((t) => ({
          id: t.id,
          projectId: t.projectId,
          typeId: t.typeId,
          parentId: t.parentId,
          number: t.number,
          createdBy: t.createdBy,
          archivedAt: toIsoOrNull(t.archivedAt),
          createdAt: toIso(t.createdAt),
          updatedAt: toIso(t.updatedAt),
        })),
      );
    }

    // --- 10. item_values (explicit ids). status_id -> option_id; the
    // assignee's option_id -> value_user_id; every other option_id -> the
    // remapped option_id; scalars pass through untouched. Exactly one of
    // (scalar columns, option_id, value_user_id) ends up non-null per row —
    // the DB's iv_one_value CHECK is the final word on that. ---
    if (legacy.ticketValues.length) {
      await tx.insert(itemValues).values(
        legacy.ticketValues.map((v) => {
          const fieldId = fieldIdByLegacyId.get(v.fieldId);
          if (fieldId === undefined) {
            throw new Error(`ticket_value ${v.id} references unknown field id ${v.fieldId}`);
          }

          const base = {
            id: v.id,
            itemId: v.ticketId,
            fieldId,
            valueText: null as string | null,
            valueNumber: null as string | null,
            valueDate: null as string | null,
            valueBool: null as boolean | null,
            valueJson: null as unknown,
            optionId: null as number | null,
            valueUserId: null as number | null,
          };

          if (v.statusId !== null) {
            const optionId = optionIdByLegacyStatusId.get(v.statusId);
            if (optionId === undefined) {
              throw new Error(`ticket_value ${v.id} references unknown status id ${v.statusId}`);
            }
            return { ...base, optionId };
          }

          if (v.optionId !== null) {
            const agentName = plan.agentNameByLegacyOptionId.get(v.optionId);
            if (agentName !== undefined) {
              const valueUserId = userIdByAgentName.get(agentName);
              if (valueUserId === undefined) {
                throw new Error(`ticket_value ${v.id} references unknown agent "${agentName}"`);
              }
              return { ...base, valueUserId };
            }
            const optionId = optionIdByLegacyOptionId.get(v.optionId);
            if (optionId === undefined) {
              throw new Error(`ticket_value ${v.id} references unknown option id ${v.optionId}`);
            }
            return { ...base, optionId };
          }

          return {
            ...base,
            valueText: v.valueText,
            valueNumber: v.valueNumber,
            valueDate: toIsoOrNull(v.valueDate),
            valueBool: v.valueBool,
            valueJson: v.valueJson,
          };
        }),
      );
    }

    // --- 11. comments (explicit ids, parents first — same proof as items),
    // comment_reactions, item_links (all explicit ids). ---
    const orderedComments = legacy.comments
      .slice()
      .sort((a, b) => (a.parentId ?? -1) - (b.parentId ?? -1));
    if (orderedComments.length) {
      await tx.insert(comments).values(
        orderedComments.map((c) => ({
          id: c.id,
          itemId: c.ticketId,
          authorId: c.authorId,
          parentId: c.parentId,
          body: c.body,
          createdAt: toIso(c.createdAt),
        })),
      );
    }
    if (legacy.commentReactions.length) {
      await tx.insert(commentReactions).values(
        legacy.commentReactions.map((r) => ({
          id: r.id,
          commentId: r.commentId,
          userId: r.userId,
          emoji: r.emoji,
          createdAt: toIso(r.createdAt),
        })),
      );
    }
    if (legacy.ticketLinks.length) {
      await tx.insert(itemLinks).values(
        legacy.ticketLinks.map((l) => ({
          id: l.id,
          linkTypeId: l.linkTypeId,
          sourceItemId: l.sourceTicketId,
          targetItemId: l.targetTicketId,
          createdAt: toIso(l.createdAt),
        })),
      );
    }

    // --- 12. views (explicit ids); remap any numeric fieldId in config. ---
    if (legacy.views.length) {
      await tx.insert(views).values(
        legacy.views.map((v) => ({
          id: v.id,
          projectId: v.projectId,
          name: v.name,
          position: v.position,
          config: remapViewConfigFieldIds(v.config, fieldIdByLegacyId) as Record<string, unknown>,
          archivedAt: toIsoOrNull(v.archivedAt),
        })),
      );
    }

    // --- 13. reset every serial sequence so the next ordinary insert never
    // collides with a preserved (or freshly-serial-assigned) id. ---
    for (const table of SEQUENCED) {
      await tx.execute(raw`
        SELECT setval(pg_get_serial_sequence(${table}, 'id'),
                      COALESCE((SELECT MAX(id) FROM ${raw.identifier(table)}), 0) + 1, false)
      `);
    }

    return { schemeId, fieldIdByLegacyId, optionIdByLegacyOptionId, optionIdByLegacyStatusId, userIdByAgentName };
  });
}
