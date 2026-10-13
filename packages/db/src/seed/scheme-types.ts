export type StatusKind = 'todo' | 'active' | 'blocked' | 'done' | 'dropped';

export type OptionDef = {
  value: string;
  label: string;
  kind?: StatusKind;          // workflow options only
  config?: Record<string, unknown>; // color (one of bh's hue names: "purple"), icon
};

export type OptionSetDef = {
  key: string;
  name: string;
  options: OptionDef[];
};

export type FieldDef = {
  key: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'datetime' | 'option' | 'user' | 'json';
  system?: boolean;
  config?: Record<string, unknown>; // { multiple, format, workflow }
  optionSetKey?: string;            // required when type === 'option'
};

// Placement of a field on a type.
export type PlacementDef = {
  fieldKey: string;
  required?: boolean;
  // For the workflow field: the subset of the shared status set this type uses.
  allowedOptionValues?: string[];
};

export type TransitionDef = {
  fieldKey: string;
  fromValue: string | null; // null = a valid starting option
  toValue: string;
  typeKey?: string;         // omitted = applies to every type using the field
};

export type TypeLinkDef = { key: string; targetTypeKeys: string[] };

export type TypeDef = {
  key: string;
  label: string;
  config?: Record<string, unknown>; // color (one of bh's hue names: "purple"), icon
  placements: PlacementDef[];
  allowedChildTypes?: string[];
  linkKeys?: TypeLinkDef[];
};

export type LinkTypeDef = {
  key: string;
  label: string;
  inverseLabel: string;
  directional: boolean;
  ownerTypeKey: string;
  targetTypeKeys: string[];
};

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
  // schemes.config. `plan: true` makes every project on the scheme a plan
  // project: its items take the plans' keys and never move to another parent.
  config?: { plan?: boolean } & Record<string, unknown>;
  optionSets: OptionSetDef[];
  fields: FieldDef[];
  types: TypeDef[];
  transitions: TransitionDef[];
  linkTypes: LinkTypeDef[];
  defaultView: ViewDef;
};
