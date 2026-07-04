import type { ticketValues } from '@tickets/db';
import type { ProjectVocab } from '../vocab/load-project-vocab';

type ValueRow = typeof ticketValues.$inferSelect;

// Collapses one ticket_values row to the primitive the frontend sees:
// options/statuses render as their value/key strings, scalars as themselves.
export function renderValue(vocab: ProjectVocab, row: ValueRow): unknown {
  if (row.optionId !== null) {
    return vocab.optionById.get(row.optionId)?.value ?? null;
  }
  if (row.statusId !== null) {
    return vocab.statusById.get(row.statusId)?.key ?? null;
  }
  if (row.valueText !== null) {
    return row.valueText;
  }
  if (row.valueNumber !== null) {
    return Number(row.valueNumber);
  }
  if (row.valueDate !== null) {
    return row.valueDate;
  }
  if (row.valueBool !== null) {
    return row.valueBool;
  }
  if (row.valueJson !== null) {
    return row.valueJson;
  }
  return null;
}
