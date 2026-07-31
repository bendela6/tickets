// packages/db/src/schema/model.ts
// Reads packages/db/src/schema/items-platform.json — the schema SSOT. The
// conformance test (model-conformance.test.ts) diffs the drizzle schema
// against this.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export type EerColumn = {
  name: string;
  type: string;
  nullable: boolean;
  default?: string | null;
  title?: string;
  description?: string;
};

export type EerConstraint =
  | { id: string; kind: 'pk'; name?: string | null; columns: string[] }
  | { id: string; kind: 'unique'; name?: string | null; columns: string[]; nullsNotDistinct?: boolean }
  | { id: string; kind: 'check'; name?: string | null; expression: string }
  | {
      id: string;
      kind: 'fk';
      name?: string | null;
      columns: string[];
      refTable: string;
      refColumns: string[];
    };

export type EerIndexColumn = { expression: string; isExpression?: boolean };
export type EerIndex = {
  id: string;
  name: string;
  columns: EerIndexColumn[];
  unique: boolean;
  method?: string | null;
  where?: string | null;
};

export type EerEntity = {
  id: string;
  label: string;
  group: string;
  // The Postgres schema, mirroring the SSOT model's Entity.schema. Absent or
  // null means public — the field is only serialised once it has been set,
  // so conformance reads it as `entity.schema ?? null`.
  schema?: string | null;
  columns: EerColumn[];
  constraints: EerConstraint[];
  indexes: EerIndex[];
};

export type EerEnum = { name: string; values: string[]; schema?: string | null };
export type EerGroup = { id: string; label: string; order: number; parent?: string };

export type EerModel = {
  entities: EerEntity[];
  groups: EerGroup[];
  enums: EerEnum[];
};

const MODEL_PATH = resolve(import.meta.dirname, './items-platform.json');

export function loadModel(): EerModel {
  const raw = JSON.parse(readFileSync(MODEL_PATH, 'utf8')) as {
    entities: EerEntity[];
    groups: EerGroup[];
    enums?: EerEnum[];
  };
  return {
    entities: raw.entities,
    groups: raw.groups,
    enums: raw.enums ?? [],
  };
}

// Resolves a model group id to its top-level zone (the model nests one level).
export function topLevelGroup(model: EerModel, groupId: string): string {
  const group = model.groups.find((g) => g.id === groupId);
  if (!group) throw new Error(`unknown group "${groupId}"`);
  return group.parent ?? group.id;
}
