/**
 * When a node shows, from other fields' values: one field's value compared
 * (`eq`, `neq`, `in`, `truthy`), or clauses combined (`all`, `any`, `not`).
 */
export type WhenClause =
  | { field: string; eq: unknown }
  | { field: string; neq: unknown }
  | { field: string; in: unknown[] }
  | { field: string; truthy: true }
  | { all: WhenClause[] }
  | { any: WhenClause[] }
  | { not: WhenClause };
