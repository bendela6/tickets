import type { itemValues } from '@tickets/db';
import type { SchemeVocab } from '../vocab/load-scheme-vocab';

type ValueRow = typeof itemValues.$inferSelect;

export function renderValue(vocab: SchemeVocab, row: ValueRow): unknown {
  if (row.optionId !== null) return vocab.optionById.get(row.optionId)?.value ?? null;
  if (row.valueUserId !== null) {
    const u = vocab.usersById.get(row.valueUserId);
    return u ? { id: u.id, name: u.name } : null;
  }
  if (row.valueText !== null) return row.valueText;
  if (row.valueNumber !== null) return Number(row.valueNumber);
  if (row.valueDate !== null) return row.valueDate;
  if (row.valueBool !== null) return row.valueBool;
  if (row.valueJson !== null) return row.valueJson;
  return null;
}
