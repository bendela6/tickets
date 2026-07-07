import type { ProjectVocab } from '../vocab/load-project-vocab';

type FieldRow = ProjectVocab['fields'][number];
type OptionRow = NonNullable<ReturnType<ProjectVocab['optionsByFieldId']['get']>>[number];

export type LogicalField = FieldRow & { options: OptionRow[] };

// Fields are type-owned: the same key (e.g. "priority") can be a distinct row
// per ticket type. The board hands the web ONE row per key so field-driven
// UI (columns, filters, forms) doesn't see duplicates. Mirrors the
// cross-project union in apps/web/src/components/all-tickets/shared-fields.ts,
// but unions across a project's types instead of across projects.
//
// Archived rows are invisible here: a key backed only by archived rows is
// dropped entirely, and an archived row for an otherwise-live key never
// becomes the representative and never contributes options.
export function buildLogicalFields(vocab: ProjectVocab): LogicalField[] {
  const rowsByKey = new Map<string, FieldRow[]>();
  for (const field of vocab.fields) {
    if (field.archivedAt) continue;
    const bucket = rowsByKey.get(field.key) ?? [];
    bucket.push(field);
    rowsByKey.set(field.key, bucket);
  }

  const out: LogicalField[] = [];
  for (const rows of rowsByKey.values()) {
    rows.sort((a, b) => a.id - b.id);
    const representative = rows[0]!;

    const options: OptionRow[] = [];
    const seenValues = new Set<string>();
    for (const row of rows) {
      for (const option of vocab.optionsByFieldId.get(row.id) ?? []) {
        if (seenValues.has(option.value)) continue;
        seenValues.add(option.value);
        options.push(option);
      }
    }

    out.push({ ...representative, options });
  }

  out.sort((a, b) => a.id - b.id);
  return out;
}
