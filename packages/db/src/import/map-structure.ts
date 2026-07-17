// packages/db/src/import/map-structure.ts
// Pure transform: type-owned legacy fields/statuses -> shared scheme-owned
// library. No database access — Task 10 does the writes. See
// .superpowers/sdd/task-9-brief.md for the rules this implements.
import type { StatusKind } from '../seed/scheme-types';
import type { Legacy, LegacyField, LegacyStatus } from './read-legacy';

export type FieldType = 'string' | 'number' | 'boolean' | 'date' | 'datetime' | 'option' | 'user' | 'json';

export type StructurePlan = {
  optionSets: {
    key: string;
    name: string;
    options: { value: string; label: string; position: number; kind: StatusKind | null; config: Record<string, unknown> }[];
  }[];
  fields: { key: string; label: string; type: FieldType; system: boolean; config: Record<string, unknown>; optionSetKey: string | null }[];
  placements: { typeKey: string; fieldKey: string; position: number; required: boolean; allowedOptionValues: string[] | null }[];
  transitions: { fieldKey: string; fromValue: string | null; toValue: string; typeKey: string | null }[];
  agentUserNames: string[];
  // legacy field id -> new field key (for remapping event payloads + views.config)
  fieldKeyByLegacyId: Map<number, string>;
  // legacy option/status id -> `${optionSetKey}:${value}`
  optionKeyByLegacyOptionId: Map<number, string>;
  optionKeyByLegacyStatusId: Map<number, string>;
  // legacy assignee field_options id -> agent name (assignee is a `user`
  // field, not an option field — its legacy option ids resolve to a users
  // row's name instead of an option set entry).
  agentNameByLegacyOptionId: Map<number, string>;
};

const LEGACY_TYPE_TO_NEW: Record<string, FieldType> = {
  text: 'string',
  date: 'date',
  number: 'number',
  boolean: 'boolean',
  json: 'json',
  select: 'option',
  multi_select: 'option',
  status: 'option',
};

const MARKDOWN_FIELD_KEYS = new Set(['description', 'findings', 'steps']);

function humanizeLabel(key: string): string {
  return key
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function mapStructure(legacy: Legacy): StructurePlan {
  const typeKeyById = new Map(legacy.ticketTypes.map((t) => [t.id, t.key]));

  // --- Rule 1: assert invariants on fields (same key -> same type + same
  // option-value list across every ticket type that owns it) ---
  const fieldsByKey = new Map<string, LegacyField[]>();
  for (const f of legacy.fields) {
    const list = fieldsByKey.get(f.key) ?? [];
    list.push(f);
    fieldsByKey.set(f.key, list);
  }

  const optionsByFieldId = new Map<number, typeof legacy.fieldOptions>();
  for (const o of legacy.fieldOptions) {
    const list = optionsByFieldId.get(o.fieldId) ?? [];
    list.push(o);
    optionsByFieldId.set(o.fieldId, list);
  }

  for (const [key, rows] of fieldsByKey) {
    const types = new Set(rows.map((r) => r.type));
    if (types.size > 1) {
      throw new Error(
        `Field key "${key}" has more than one type across ticket types: ${[...types].join(', ')}`,
      );
    }
    const valueLists = rows.map((r) =>
      (optionsByFieldId.get(r.id) ?? [])
        .slice()
        .sort((a, b) => a.position - b.position)
        .map((o) => o.value)
        .join(','),
    );
    const distinctValueLists = new Set(valueLists);
    if (distinctValueLists.size > 1) {
      throw new Error(
        `Field key "${key}" has differing option-value lists across ticket types: ${[...distinctValueLists].join(' | ')}`,
      );
    }
    const labels = new Set(rows.map((r) => r.label));
    if (labels.size > 1) {
      throw new Error(
        `Field key "${key}" has differing labels across ticket types: ${[...labels].join(' | ')}`,
      );
    }
    const configs = new Set(rows.map((r) => JSON.stringify(r.config ?? {})));
    if (configs.size > 1) {
      throw new Error(
        `Field key "${key}" has differing config across ticket types: ${[...configs].join(' | ')}`,
      );
    }
  }

  // --- Rule 1: assert invariants on statuses (same key -> same kind everywhere) ---
  const statusesByKey = new Map<string, LegacyStatus[]>();
  for (const s of legacy.statuses) {
    const list = statusesByKey.get(s.key) ?? [];
    list.push(s);
    statusesByKey.set(s.key, list);
  }
  for (const [key, rows] of statusesByKey) {
    const kinds = new Set(rows.map((r) => r.kind));
    if (kinds.size > 1) {
      throw new Error(
        `Status key "${key}" has more than one lifecycle kind across ticket types: ${[...kinds].join(', ')}`,
      );
    }
  }

  // --- Rule 4/8: one option set per option-typed field key, from the first
  // type's field_options (identical across types per the assertion above). ---
  const optionSets: StructurePlan['optionSets'] = [];
  const optionKeyByLegacyOptionId = new Map<number, string>();
  const agentNameByLegacyOptionId = new Map<number, string>();
  const agentUserNames: string[] = [];

  for (const [key, rows] of fieldsByKey) {
    const legacyType = rows[0]!.type;
    if (legacyType !== 'select' && legacyType !== 'multi_select') continue;
    if (key === 'assignee') {
      // Rule 2: assignee is upgraded to a `user` field — its option values
      // become agent user names to create in Task 10, not an option set.
      // The legacy schema is type-owned: every ticket type has its own
      // `assignee` field row with its own field_options ids (same 4 values,
      // 5 distinct id sets — asserted equal above). A ticket_values row can
      // reference any type's copy, so every row's ids must resolve, not just
      // one type's.
      for (const r of rows) {
        const opts = (optionsByFieldId.get(r.id) ?? []).slice().sort((a, b) => a.position - b.position);
        for (const o of opts) {
          if (!agentUserNames.includes(o.value)) agentUserNames.push(o.value);
          agentNameByLegacyOptionId.set(o.id, o.value);
        }
      }
      continue;
    }

    // The option *set*'s contents come from a single representative row —
    // the values are identical across every type-owned row for this key
    // (asserted above), so building from one row is correct and intentional.
    const first = rows.slice().sort((a, b) => a.id - b.id)[0]!;
    const opts = (optionsByFieldId.get(first.id) ?? []).slice().sort((a, b) => a.position - b.position);
    optionSets.push({
      key,
      name: humanizeLabel(key),
      options: opts.map((o, position) => ({
        value: o.value,
        label: o.label,
        position,
        kind: null,
        config: o.config ?? {},
      })),
    });
    // But the id -> key map must cover every type-owned row's field_options
    // ids, not just the representative row's — each type owns distinct
    // option ids for the same values, and ticket_values rows reference
    // whichever type's copy they were created under.
    for (const r of rows) {
      const rowOpts = optionsByFieldId.get(r.id) ?? [];
      for (const o of rowOpts) {
        optionKeyByLegacyOptionId.set(o.id, `${key}:${o.value}`);
      }
    }
  }

  // --- Rule 5: the shared status set — union of all 34 statuses keyed by
  // `key`, ordered by first appearance, each carrying its lifecycle kind. ---
  const statusOptions: StructurePlan['optionSets'][number]['options'] = [];
  const statusKeyOrder: string[] = [];
  for (const s of legacy.statuses) {
    if (!statusKeyOrder.includes(s.key)) statusKeyOrder.push(s.key);
  }
  for (const [position, key] of statusKeyOrder.entries()) {
    const rows = statusesByKey.get(key)!;
    const rep = rows[0]!;
    statusOptions.push({
      value: key,
      label: rep.label,
      position,
      kind: rep.kind,
      config: rep.config ?? {},
    });
  }
  optionSets.push({ key: 'status', name: 'Status', options: statusOptions });

  const optionKeyByLegacyStatusId = new Map<number, string>();
  const statusKeyByLegacyId = new Map<number, string>();
  for (const s of legacy.statuses) {
    optionKeyByLegacyStatusId.set(s.id, `status:${s.key}`);
    statusKeyByLegacyId.set(s.id, s.key);
  }

  // --- Rule 2/3: field defs ---
  const fields: StructurePlan['fields'] = [];
  const fieldKeyByLegacyId = new Map<number, string>();
  for (const [key, rows] of fieldsByKey) {
    for (const r of rows) fieldKeyByLegacyId.set(r.id, key);

    const rep = rows[0]!;
    const legacyType = rep.type;

    if (key === 'assignee') {
      fields.push({
        key,
        label: rep.label,
        type: 'user',
        system: rep.system,
        config: { multiple: false },
        optionSetKey: null,
      });
      continue;
    }

    const type = LEGACY_TYPE_TO_NEW[legacyType];
    if (!type) {
      throw new Error(`Field key "${key}" has an unrecognized legacy type "${legacyType}"`);
    }

    const config: Record<string, unknown> = { ...rep.config };
    if (legacyType === 'select') config.multiple = false;
    if (legacyType === 'multi_select') config.multiple = true;
    if (legacyType === 'status') {
      config.multiple = false;
      config.workflow = true;
    }
    if (MARKDOWN_FIELD_KEYS.has(key)) config.format = 'markdown';

    fields.push({
      key,
      label: rep.label,
      type,
      system: rep.system,
      config,
      optionSetKey: type === 'option' ? key : null,
    });
  }

  // --- Rule 6: placements — one per legacy field row ---
  const placements: StructurePlan['placements'] = [];
  for (const [key, rows] of fieldsByKey) {
    for (const r of rows) {
      const typeKey = typeKeyById.get(r.ticketTypeId);
      if (!typeKey) {
        throw new Error(`Field id ${r.id} ("${key}") references unknown ticket type id ${r.ticketTypeId}`);
      }
      let allowedOptionValues: string[] | null = null;
      if (key === 'status') {
        const typeStatuses = legacy.statuses
          .filter((s) => s.ticketTypeId === r.ticketTypeId)
          .sort((a, b) => a.position - b.position)
          .map((s) => s.key);
        allowedOptionValues = typeStatuses;
      }
      placements.push({
        typeKey,
        fieldKey: key,
        position: r.position,
        required: r.required,
        allowedOptionValues,
      });
    }
  }

  // --- Rule 7: transitions ---
  const transitions: StructurePlan['transitions'] = legacy.statusTransitions.map((t) => {
    const toValue = statusKeyByLegacyId.get(t.toStatusId);
    if (!toValue) {
      throw new Error(`Status transition ${t.id} references unknown to_status_id ${t.toStatusId}`);
    }
    let fromValue: string | null = null;
    if (t.fromStatusId !== null) {
      fromValue = statusKeyByLegacyId.get(t.fromStatusId) ?? null;
      if (fromValue === null) {
        throw new Error(`Status transition ${t.id} references unknown from_status_id ${t.fromStatusId}`);
      }
    }
    let typeKey: string | null = null;
    if (t.ticketTypeId !== null) {
      typeKey = typeKeyById.get(t.ticketTypeId) ?? null;
      if (typeKey === null) {
        throw new Error(`Status transition ${t.id} references unknown ticket_type_id ${t.ticketTypeId}`);
      }
    }

    return {
      fieldKey: 'status',
      fromValue,
      toValue,
      typeKey,
    };
  });

  return {
    optionSets,
    fields,
    placements,
    transitions,
    agentUserNames,
    fieldKeyByLegacyId,
    optionKeyByLegacyOptionId,
    optionKeyByLegacyStatusId,
    agentNameByLegacyOptionId,
  };
}
