// Type-owned fields & links migration verifier (Plan C, Task 2).
//
// Run against a copy that `run.ts` has already migrated (Task 3). Prints an
// all-zero JSON summary; mirrors the plain-select-then-JS-filter style of
// `packages/db/src/migrate-to-scheme/verify.ts` rather than issuing SQL joins.
//
// NOT run as part of Task 2 — write + compile only.

import { createDbClient } from '../client';
import { fields, linkTypeTargetTypes, linkTypes, ticketLinks, ticketValues, tickets, views } from '../schema';

const { db, sql } = createDbClient({ max: 1 });

// fields: every row (including any not-yet-migrated scheme-owned ones, so a
// value still pointing at one is caught as a mismatch, not miscounted as
// orphaned) — plus the distinct key set of type-owned fields, for view checks.
const allFields = await db.select().from(fields);
const ownerTypeIdByFieldId = new Map(allFields.map((f) => [f.id, f.ticketTypeId]));
const typeOwnedFieldKeys = new Set(
  allFields.filter((f) => f.ticketTypeId !== null).map((f) => f.key),
);

const allTickets = await db.select({ id: tickets.id, typeId: tickets.typeId }).from(tickets);
const typeByTicketId = new Map(allTickets.map((t) => [t.id, t.typeId]));

const allLinkTypes = await db.select().from(linkTypes);
const ownerTypeIdByLinkTypeId = new Map(allLinkTypes.map((l) => [l.id, l.ticketTypeId]));

const allTargets = await db.select().from(linkTypeTargetTypes);
const targetTypeIdsByLinkTypeId = new Map<number, Set<number>>();
for (const t of allTargets) {
  const set = targetTypeIdsByLinkTypeId.get(t.linkTypeId) ?? new Set<number>();
  set.add(t.targetTypeId);
  targetTypeIdsByLinkTypeId.set(t.linkTypeId, set);
}

// badValueField: value whose field's ticket_type_id !== the value's ticket's type.
// orphanValue:   value whose field_id has no row at all in `fields`.
let badValueField = 0;
let orphanValue = 0;
const allValues = await db.select().from(ticketValues);
for (const v of allValues) {
  if (!ownerTypeIdByFieldId.has(v.fieldId)) {
    orphanValue++;
    continue;
  }
  const ownerTypeId = ownerTypeIdByFieldId.get(v.fieldId);
  const ticketTypeId = typeByTicketId.get(v.ticketId);
  if (ticketTypeId === undefined || ownerTypeId !== ticketTypeId) {
    badValueField++;
  }
}

// badLinkOwner:  link whose link_type's ticket_type_id !== source ticket's type.
// badLinkTarget: link whose target ticket's type is not an allowed target of its link_type.
let badLinkOwner = 0;
let badLinkTarget = 0;
const allLinks = await db.select().from(ticketLinks);
for (const l of allLinks) {
  const sourceTypeId = typeByTicketId.get(l.sourceTicketId);
  const targetTypeId = typeByTicketId.get(l.targetTicketId);
  const ownerTypeId = ownerTypeIdByLinkTypeId.get(l.linkTypeId);
  if (ownerTypeId === undefined || sourceTypeId === undefined || ownerTypeId !== sourceTypeId) {
    badLinkOwner++;
  }
  const allowedTargets = targetTypeIdsByLinkTypeId.get(l.linkTypeId);
  if (targetTypeId === undefined || !allowedTargets?.has(targetTypeId)) {
    badLinkTarget++;
  }
}

// badViewKey: a view config fieldKey not present on any type-owned field.
let badViewKey = 0;
const allViews = await db.select({ id: views.id, config: views.config }).from(views);
for (const v of allViews) {
  for (const key of collectFieldKeys(v.config as Record<string, unknown>)) {
    if (!typeOwnedFieldKeys.has(key)) badViewKey++;
  }
}

console.log(JSON.stringify({ badValueField, orphanValue, badLinkOwner, badLinkTarget, badViewKey }));
await sql.end();

// Mirrors the walk shape in `./derive`'s remapViewConfig, but collects
// `fieldKey` occurrences instead of rewriting `fieldId` ones.
function collectFieldKeys(node: unknown, out: string[] = []): string[] {
  if (Array.isArray(node)) {
    for (const item of node) collectFieldKeys(item, out);
    return out;
  }
  if (node === null || typeof node !== 'object') {
    return out;
  }
  const obj = node as Record<string, unknown>;
  if (typeof obj.fieldKey === 'string') {
    out.push(obj.fieldKey);
  }
  for (const value of Object.values(obj)) {
    collectFieldKeys(value, out);
  }
  return out;
}
