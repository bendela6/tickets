import { and, count, eq, sql } from 'drizzle-orm';
import type { DbExecutor } from '@tickets/db';
import { comments, itemTypeChildTypes, itemValues, items } from '@tickets/db';
import { HttpError } from '../../errors';
import type { SchemeVocab } from '../../vocab/load-scheme-vocab';

// max+1 per project, serialized by locking the project row
export async function nextItemNumber(tx: DbExecutor, projectId: number): Promise<number> {
  await tx.execute(sql`SELECT id FROM projects WHERE id = ${projectId} FOR UPDATE`);
  const rows = await tx
    .select({ max: sql<number>`coalesce(max(${items.number}), 0)` })
    .from(items)
    .where(eq(items.projectId, projectId));
  return Number(rows[0]?.max ?? 0) + 1;
}

// compare-and-set the optimistic-lock token; 404 vs 409 distinguished
export async function lockItem(tx: DbExecutor, id: number, expectedUpdatedAt: string) {
  const touched = await tx
    .update(items)
    .set({ updatedAt: sql`clock_timestamp()` })
    .where(and(eq(items.id, id), sql`${items.updatedAt}::text = ${expectedUpdatedAt}`))
    .returning();
  const item = touched[0];
  if (item) return item;
  const exists = await tx.select({ id: items.id }).from(items).where(eq(items.id, id));
  if (!exists[0]) throw new HttpError(404, 'item not found');
  throw new HttpError(409, 'item changed since you loaded it — refresh and retry');
}

// Hierarchy policy: type-aware nesting. Allowed pairs live in item_type_child_types
// (a relational table, not itemTypes.config — the seed populates allowedChildTypes
// there, see packages/db/src/seed/seed-scheme.ts).
export async function checkParent(
  tx: DbExecutor,
  vocab: SchemeVocab,
  input: { itemId: number | null; parentId: number; childTypeId: number },
): Promise<void> {
  const parentRows = await tx.select().from(items).where(eq(items.id, input.parentId));
  const parent = parentRows[0];
  if (!parent || parent.projectId !== vocab.project.id) {
    throw new HttpError(400, 'parent item not found in this project');
  }
  if (input.itemId !== null && input.itemId === input.parentId) {
    throw new HttpError(422, 'an item cannot be its own parent');
  }
  const parentType = vocab.typeById.get(parent.typeId);
  const childType = vocab.typeById.get(input.childTypeId);
  const allowedRows = await tx
    .select({ childTypeId: itemTypeChildTypes.childTypeId })
    .from(itemTypeChildTypes)
    .where(eq(itemTypeChildTypes.parentTypeId, parent.typeId));
  const allowed = new Set(allowedRows.map((r) => r.childTypeId));
  if (!childType || !allowed.has(input.childTypeId)) {
    throw new HttpError(422, `a ${childType?.key ?? 'child'} cannot be nested under a ${parentType?.key ?? 'parent'}`);
  }
}

// Workflow-graph enforcement over option_transitions, per field. Zero edges = unrestricted.
export function checkTransition(
  vocab: SchemeVocab,
  input: { fieldId: number; typeId: number; fromOptionId: number | null; toOptionId: number },
): void {
  const edges = vocab.transitions.filter(
    (e) => e.fieldId === input.fieldId && (e.itemTypeId === null || e.itemTypeId === input.typeId),
  );
  if (edges.length === 0) return;
  if (input.fromOptionId === null) {
    const entry = edges.filter((e) => e.fromOptionId === null);
    if (entry.length === 0) return;
    if (!entry.some((e) => e.toOptionId === input.toOptionId)) {
      throw new HttpError(422, `"${vocab.optionById.get(input.toOptionId)?.value}" is not a valid starting option`);
    }
    return;
  }
  if (!edges.some((e) => e.fromOptionId === input.fromOptionId && e.toOptionId === input.toOptionId)) {
    const from = vocab.optionById.get(input.fromOptionId)?.value;
    const to = vocab.optionById.get(input.toOptionId)?.value;
    throw new HttpError(422, `transition ${from} → ${to} is not in the workflow graph`);
  }
}

export function transitionEdge(
  vocab: SchemeVocab,
  input: { fieldId: number; typeId: number; fromOptionId: number | null; toOptionId: number },
) {
  return vocab.transitions.find(
    (e) =>
      e.fieldId === input.fieldId &&
      (e.itemTypeId === null || e.itemTypeId === input.typeId) &&
      e.fromOptionId === input.fromOptionId &&
      e.toOptionId === input.toOptionId,
  );
}

type Guard = { requiresField?: string; requiresComment?: boolean };

// Consults edge.config.guard: requiresComment (>=1 comment) / requiresField (a value present).
export async function runTransitionGuard(
  tx: DbExecutor,
  vocab: SchemeVocab,
  input: { itemId: number; typeId: number; edge: { config: unknown } | undefined },
): Promise<void> {
  const guard = (input.edge?.config as { guard?: Guard } | undefined)?.guard;
  if (!guard) return;
  if (guard.requiresComment) {
    const c = await tx.select({ n: count() }).from(comments).where(eq(comments.itemId, input.itemId));
    if (Number(c[0]?.n ?? 0) < 1) {
      throw new HttpError(422, 'add a comment explaining the resolution before closing');
    }
  }
  if (guard.requiresField) {
    const field = vocab.fieldByTypeKey.get(`${input.typeId}:${guard.requiresField}`);
    if (field) {
      const rows = await tx
        .select()
        .from(itemValues)
        .where(and(eq(itemValues.itemId, input.itemId), eq(itemValues.fieldId, field.id)));
      if (rows.length === 0) throw new HttpError(422, `set "${guard.requiresField}" before this transition`);
    }
  }
}
