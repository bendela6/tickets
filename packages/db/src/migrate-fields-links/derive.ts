// Pure derivation helpers for the type-owned fields/links migration
// (Plan C, Task 1). No DB access here — `run.ts` (Task 2) loads rows and
// hands them to these functions, then writes the results back.

// --- deriveTypeFields --------------------------------------------------

// Mirrors `field_type` (packages/db/src/schema/enums.ts), duplicated locally
// so this module stays DB-import-free (per the pure/no-DB constraint).
export type FieldTypeKey = 'text' | 'number' | 'date' | 'boolean' | 'json' | 'select' | 'multi_select' | 'status';

// A scheme-owned field row, as it exists before the migration (the "F" in
// the plan: one row shared across every type that attaches it via
// `ticket_type_fields`).
export type SharedFieldRow = {
  id: number;
  key: string;
  label: string;
  type: FieldTypeKey;
  system: boolean;
  config: Record<string, unknown>;
  archivedAt: string | null;
};

// A `ticket_type_fields` junction row: which type attaches which shared
// field, in what order, and whether it's required there.
export type TicketTypeFieldRow = {
  ticketTypeId: number;
  fieldId: number;
  position: number;
  required: boolean;
};

// One per-type field descriptor, derived for a single (type, attached
// field) pair. `required`/`position` come from the junction row; everything
// else is copied from the shared field.
export type TypeFieldDerived = {
  typeId: number;
  fromFieldId: number;
  key: string;
  label: string;
  type: FieldTypeKey;
  system: boolean;
  config: Record<string, unknown>;
  required: boolean;
  position: number;
  archivedAt: string | null;
};

// For each `(type, attached field)` pair in `ticketTypeFields`, produce the
// per-type field row that migration will insert. One output row per
// junction row — a field attached to N types yields N rows.
export function deriveTypeFields(
  sharedFields: SharedFieldRow[],
  ticketTypeFields: TicketTypeFieldRow[],
): TypeFieldDerived[] {
  const byId = new Map(sharedFields.map((field) => [field.id, field]));

  return ticketTypeFields.map((attachment) => {
    const field = byId.get(attachment.fieldId);
    if (!field) {
      throw new Error(`deriveTypeFields: no shared field with id ${attachment.fieldId}`);
    }
    return {
      typeId: attachment.ticketTypeId,
      fromFieldId: field.id,
      key: field.key,
      label: field.label,
      type: field.type,
      system: field.system,
      config: field.config,
      required: attachment.required,
      position: attachment.position,
      archivedAt: field.archivedAt,
    };
  });
}

// --- remapViewConfig -----------------------------------------------------

// Deep-walks a view `config` (columns/sort/filters, plus any forward-compat
// extras) and rewrites every object that carries a numeric `fieldId` to
// `{ ...rest, fieldKey }`, dropping the numeric id. Mirrors the recursive
// walk shape used by `apps/api/src/views/validate-view-config.ts`, but
// rewrites instead of validates.
export function remapViewConfig(
  config: Record<string, unknown>,
  keyByOldFieldId: Map<number, string>,
): Record<string, unknown> {
  return walk(config, keyByOldFieldId) as Record<string, unknown>;
}

function walk(node: unknown, keyByOldFieldId: Map<number, string>): unknown {
  if (Array.isArray(node)) {
    return node.map((item) => walk(item, keyByOldFieldId));
  }
  if (node === null || typeof node !== 'object') {
    return node;
  }

  const obj = node as Record<string, unknown>;
  const { fieldId, ...rest } = obj;
  const base: Record<string, unknown> =
    typeof fieldId === 'number'
      ? { ...rest, fieldKey: mustGetFieldKey(fieldId, keyByOldFieldId) }
      : obj;

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(base)) {
    out[key] = walk(value, keyByOldFieldId);
  }
  return out;
}

function mustGetFieldKey(fieldId: number, keyByOldFieldId: Map<number, string>): string {
  const key = keyByOldFieldId.get(fieldId);
  if (key === undefined) {
    throw new Error(`remapViewConfig: no field key mapped for old field id ${fieldId}`);
  }
  return key;
}

// --- deriveTypeLinks -------------------------------------------------------

// A scheme-owned link type row, as it exists before the migration (shared
// across whichever source types happen to use it).
export type SharedLinkRow = {
  id: number;
  key: string;
  label: string;
  inverseLabel: string;
  directional: boolean;
  archivedAt: string | null;
};

// One observed `(sourceTypeId, targetTypeId, oldLinkTypeId)` triple, read
// off `ticket_links` joined to the source/target tickets' types.
export type LinkUsageRow = {
  sourceTypeId: number;
  targetTypeId: number;
  oldLinkTypeId: number;
};

// One per-source-type link descriptor, with the observed target types
// allowed for that (link, source type) pair.
export type TypeLinkDerived = {
  sourceTypeId: number;
  fromLinkId: number;
  key: string;
  label: string;
  inverseLabel: string;
  directional: boolean;
  targetTypeIds: number[];
  archivedAt: string | null;
};

// For each shared link type, derive the per-source-type link rows to
// insert: one per distinct source type observed using it, targeting the
// distinct types observed on the other end. A link type with zero observed
// usage fans out onto every type in `allTypeIds`, targeting every type —
// preserving vocabulary that just never got used.
export function deriveTypeLinks(
  sharedLinks: SharedLinkRow[],
  linkUsage: LinkUsageRow[],
  allTypeIds: number[],
): TypeLinkDerived[] {
  const sortedAllTypeIds = [...new Set(allTypeIds)].sort((a, b) => a - b);
  const out: TypeLinkDerived[] = [];

  for (const link of sharedLinks) {
    const usage = linkUsage.filter((u) => u.oldLinkTypeId === link.id);

    if (usage.length === 0) {
      for (const typeId of sortedAllTypeIds) {
        out.push({
          sourceTypeId: typeId,
          fromLinkId: link.id,
          key: link.key,
          label: link.label,
          inverseLabel: link.inverseLabel,
          directional: link.directional,
          targetTypeIds: [...sortedAllTypeIds],
          archivedAt: link.archivedAt,
        });
      }
      continue;
    }

    const targetsBySource = new Map<number, Set<number>>();
    for (const u of usage) {
      const targets = targetsBySource.get(u.sourceTypeId) ?? new Set<number>();
      targets.add(u.targetTypeId);
      targetsBySource.set(u.sourceTypeId, targets);
    }

    const sourceTypeIds = [...targetsBySource.keys()].sort((a, b) => a - b);
    for (const sourceTypeId of sourceTypeIds) {
      const targetTypeIds = [...targetsBySource.get(sourceTypeId)!].sort((a, b) => a - b);
      out.push({
        sourceTypeId,
        fromLinkId: link.id,
        key: link.key,
        label: link.label,
        inverseLabel: link.inverseLabel,
        directional: link.directional,
        targetTypeIds,
        archivedAt: link.archivedAt,
      });
    }
  }

  return out;
}
