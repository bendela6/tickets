import type { FieldMeta, ResourceRoles, Sort } from '@bh/resource';

/** A field as the app declares it: what it is, never what an operation may do with it. */
export type FieldDefinition = Omit<FieldMeta, 'query' | 'write'>;

/** A resource as the app declares it: its fields in our structure, apart from where they live. */
export interface ResourceDefinition {
  /** 'issues': the path segment after /api/. */
  resource: string;
  label: { one: string; other: string };
  roles: ResourceRoles;
  fields: readonly FieldDefinition[];
  /** The order of a query that names none; [] → the source's own. */
  sort: readonly Sort[];
}
