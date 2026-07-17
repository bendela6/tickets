export type WhenClause =
  | { field: string; eq: unknown }
  | { field: string; neq: unknown }
  | { field: string; in: unknown[] }
  | { field: string; truthy: true }
  | { all: WhenClause[] }
  | { any: WhenClause[] }
  | { not: WhenClause };
