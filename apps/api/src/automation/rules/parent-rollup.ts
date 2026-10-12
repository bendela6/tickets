import { and, eq, inArray } from 'drizzle-orm';
import type { DbExecutor } from '@tickets/db';
import { itemValues, items } from '@tickets/db';
import { automationCommandId, type AutomationContext } from '../context';
import { defineAutomation, type StoredEvent } from '../registry';
import { loadSchemeVocab, type SchemeVocab } from '../../vocab/load-scheme-vocab';
import { itemUpdate } from '../../command/item/update';
import { statusChain } from '../../command/item/helpers';

const ID = 'parent-rollup';
const RESOLVED = new Set(['done', 'dropped']);
// The keys this rule dispatches a parent's update under: the item's own
// parent, and the parent a moved item left.
const KEYS = ['parent', 'old-parent'] as const;
type Key = (typeof KEYS)[number];

// A parent's status follows its children. Done once every child is done or
// dropped and at least one is done; dropped (its first dropped option) when
// every child is; a parent with no option of that kind is left as it is.
//
// Only a status the rule set itself is undone: when the rule no longer holds
// for a parent it closed (a child restored, reopened or added), the parent
// returns to the status it had before the rule closed it, the `from` of that
// change. A parent a person closed is left alone. The rule's own writes are
// told apart by their command id, which it derives from the event that caused
// them (automationCommandId), so no person's write can pass for one.
// A reopened parent's own change runs the rule for its parent in turn, so a
// grandparent the rule closed reopens too.

// An event this rule wrote.
function madeByRollup(change: { commandId: string; causedBy: number | null }): boolean {
  const cause = change.causedBy;
  return cause !== null && KEYS.some((key) => automationCommandId(cause, ID, key) === change.commandId);
}

// The workflow option currently set on an item (undefined if unset).
async function statusOf(db: DbExecutor, vocab: SchemeVocab, itemId: number, wfId: number) {
  const rows = await db.select().from(itemValues).where(and(eq(itemValues.itemId, itemId), eq(itemValues.fieldId, wfId)));
  const optId = rows[0]?.optionId ?? null;
  return optId === null ? undefined : vocab.optionById.get(optId);
}

// The status a parent had before this rule closed it, walking back past the
// rule moving it from one closed status to the other; null when its status
// isn't the rule's (a person set it, or the history doesn't say).
async function statusBeforeRollup(
  db: DbExecutor,
  vocab: SchemeVocab,
  input: { itemId: number; typeId: number; field: { id: number; key: string }; current: string },
): Promise<string | null> {
  const kindOf = (value: string) =>
    vocab.optionsForField(input.typeId, input.field.id).find((o) => o.value === value)?.kind ?? null;
  for (const change of await statusChain(db, { itemId: input.itemId, fieldKey: input.field.key, current: input.current })) {
    if (!madeByRollup(change)) return null;
    if (change.from === null) return vocab.initialOption(input.typeId)?.value ?? null;
    if (!RESOLVED.has(kindOf(change.from) ?? '')) return change.from;
  }
  return null;
}

// What the rule says a parent's status is now: done, dropped, or nothing.
async function ruleFor(db: DbExecutor, vocab: SchemeVocab, parentId: number): Promise<'done' | 'dropped' | null> {
  const children = await db.select().from(items).where(eq(items.parentId, parentId));
  if (children.length === 0) return null;
  const values = await db.select().from(itemValues).where(inArray(itemValues.itemId, children.map((c) => c.id)));
  const kinds = children.map((child) => {
    const wf = vocab.workflowField(child.typeId);
    const value = wf ? values.find((v) => v.itemId === child.id && v.fieldId === wf.id) : undefined;
    return value?.optionId != null ? (vocab.optionById.get(value.optionId)?.kind ?? null) : null;
  });
  if (!kinds.every((k) => k !== null && RESOLVED.has(k))) return null;
  return kinds.includes('done') ? 'done' : 'dropped';
}

async function rollUp(ctx: AutomationContext, parentId: number, key: Key) {
  const db = ctx.db;
  const parent = (await db.select().from(items).where(eq(items.id, parentId)))[0];
  if (!parent) return;
  const vocab = await loadSchemeVocab(db, { id: parent.projectId });
  const wf = vocab.workflowField(parent.typeId);
  if (!wf) return;
  const current = await statusOf(db, vocab, parent.id, wf.id);
  const rule = await ruleFor(db, vocab, parent.id);
  const optionOf = (kind: string) =>
    vocab.optionsForField(parent.typeId, wf.id).find((o) => o.kind === kind && !o.archivedAt)?.value;

  let next: string | undefined;
  if (!current || !RESOLVED.has(current.kind ?? '')) {
    // an open parent: closed when the rule says so
    next = rule ? optionOf(rule) : undefined;
  } else if (current.kind !== rule) {
    // a closed parent the rule no longer holds for, if the rule closed it:
    // closed the other way, or back to what it was
    const before = await statusBeforeRollup(db, vocab, {
      itemId: parent.id, typeId: parent.typeId, field: wf, current: current.value,
    });
    if (before === null) return;
    next = (rule ? optionOf(rule) : undefined) ?? before;
  }
  if (next === undefined || next === current?.value) return;
  await ctx.dispatch(itemUpdate, {
    id: parent.id, expectedUpdatedAt: parent.updatedAt, values: { [wf.key]: next },
  }, key);
}

// The parents an event may change the rule for, each with its dispatch key:
// a child's status changing, a child made, a child moved in or out.
async function parentsOf(event: StoredEvent, db: DbExecutor): Promise<[number, Key][]> {
  if (event.kind === 'item.reparented') {
    const { from, to } = event.payload as { from?: number | null; to?: number | null };
    const parents: [number, Key][] = [];
    if (typeof to === 'number') parents.push([to, 'parent']);
    if (typeof from === 'number') parents.push([from, 'old-parent']);
    return parents;
  }
  const item = (await db.select().from(items).where(eq(items.id, event.aggregateId)))[0];
  if (!item || item.parentId === null) return [];
  if (event.kind === 'item.field_changed') {
    const vocab = await loadSchemeVocab(db, { id: item.projectId });
    const wf = vocab.workflowField(item.typeId);
    if (!wf || (event.payload as { fieldKey?: string }).fieldKey !== wf.key) return [];
  }
  return [[item.parentId, 'parent']];
}

export const parentRollup = defineAutomation({
  id: ID,
  on: ['item.field_changed', 'item.created', 'item.reparented'],
  async when(event, tx) {
    return (await parentsOf(event, tx)).length > 0;
  },
  async run(event, ctx) {
    for (const [parentId, key] of await parentsOf(event, ctx.db)) {
      await rollUp(ctx, parentId, key);
    }
  },
});
