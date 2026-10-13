import { and, eq } from 'drizzle-orm';
import type { DbExecutor } from '@tickets/db';
import { items } from '@tickets/db';
import { HttpError } from '../../errors';
import type { SchemeVocab } from '../../vocab/load-scheme-vocab';

// An item's key (records.items.key) is its name wherever it is written,
// unique across every project, made once, when the item is made, and never
// changed.
//
// In a numbered project it is the project's prefix and the item's number
// (`TIX-90`). In a plan project (vocab.plan) it says where the item sits:
//   - an epic: the prefix, `/E` and the next epic number (`TK/E14`);
//   - a feature: the prefix and the next feature number in the project (`TK-80`);
//   - a ticket or a subticket: its parent's key and the next number under it
//     (`TK-80.3`, `TK-11.2.1`).
// "Next" is one past the highest there is, so a cancelled item's number is
// never given again (items are archived, never deleted). The caller holds the
// project's row lock (nextItemNumber takes it), which serializes every create
// in the project, so two creates never take one number.

export type PlanKeyForm = 'epic' | 'feature' | 'child';

// The plan scheme's types by key: an epic and a feature are numbered in their
// project, every other type under its parent.
export function planKeyForm(typeKey: string): PlanKeyForm {
  return typeKey === 'epic' ? 'epic' : typeKey === 'feature' ? 'feature' : 'child';
}

function nextAfter(keys: string[], pattern: RegExp): number {
  let max = 0;
  for (const key of keys) {
    const match = pattern.exec(key);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return max + 1;
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export async function nextItemKey(
  tx: DbExecutor,
  vocab: SchemeVocab,
  input: { type: { id: number; key: string }; parentId: number | null; number: number },
): Promise<string> {
  const prefix = vocab.project.itemPrefix;
  if (!vocab.plan) return `${prefix}-${input.number}`;

  const form = planKeyForm(input.type.key);
  if (form !== 'child') {
    const rows = await tx
      .select({ key: items.key })
      .from(items)
      .where(and(eq(items.projectId, vocab.project.id), eq(items.typeId, input.type.id)));
    const keys = rows.map((r) => r.key);
    const p = escapeRegExp(prefix);
    return form === 'epic'
      ? `${prefix}/E${nextAfter(keys, new RegExp(`^${p}/E(\\d+)$`))}`
      : `${prefix}-${nextAfter(keys, new RegExp(`^${p}-(\\d+)$`))}`;
  }

  // item.create refuses a plan item without a parent before it gets here.
  const parent = input.parentId === null
    ? undefined
    : (await tx.select({ key: items.key }).from(items).where(eq(items.id, input.parentId)))[0];
  if (!parent || input.parentId === null) throw new HttpError(422, `a ${input.type.key} is made under its parent in a plan`);
  const siblings = await tx.select({ key: items.key }).from(items).where(eq(items.parentId, input.parentId));
  const n = nextAfter(siblings.map((r) => r.key), new RegExp(`^${escapeRegExp(parent.key)}\\.(\\d+)$`));
  return `${parent.key}.${n}`;
}
