export type StatusDef = {
  key: string;
  label: string;
  kind: 'todo' | 'active' | 'blocked' | 'done' | 'dropped';
  initial?: boolean;
};

export type TypeDef = {
  key: string;
  label: string;
  color: string;
  statuses: StatusDef[];
  fieldKeys: string[];
  requiredFieldKeys?: string[];
  allowedChildTypes?: string[];
};

export type OptionDef = { value: string; label: string; color?: string };

export type FieldDef = {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'boolean' | 'json' | 'select' | 'multi_select' | 'status';
  system?: boolean;
  config?: Record<string, unknown>;
  options?: OptionDef[];
};

export type LinkTypeDef = { key: string; label: string; inverseLabel: string; directional: boolean };

export type ViewColumnDef =
  | { source: 'number' | 'type' | 'progress' }
  | { source: 'field'; fieldKey: string };

export type ViewDef = {
  name: string;
  columns: ViewColumnDef[];
  sort: { source: 'number' | 'field'; fieldKey?: string; dir: 'asc' | 'desc' };
};

export type SchemeDef = {
  key: string;
  name: string;
  description: string;
  types: TypeDef[];
  fields: FieldDef[];
  linkTypes: LinkTypeDef[];
  defaultView: ViewDef;
};
