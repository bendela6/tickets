// The name Postgres/drizzle would actually assign a pk/unique/check/fk
// constraint left unnamed — shown GREYED as a name input's `placeholder`
// (never written to the model: a blank name stays blank, see
// apply-model-edit.ts and export-drizzle.ts) so a user can see, before ever
// typing anything, what they're about to get.
//
// This is not a guess — each branch below reproduces the ONE mechanism that
// actually decides the name at export/migration time for that exact shape,
// per export-drizzle.ts's own choice of emitted DDL (its module header: names
// are emitted VERBATIM, never re-derived, so a BLANK name has no string
// export-drizzle.ts itself computes — the convention lives one level below
// it, in whichever of Postgres or drizzle-orm ends up holding the pen):
//
//  - pk, single column: export-drizzle's `pkIsInline` emits this one INLINE
//    (`.primaryKey()` on the column itself, no table-level construct at
//    all) — so POSTGRES names it, using its own bare single-column-pk
//    convention: `<table>_pkey`.
//  - pk, composite: no inline form exists for more than one column, so this
//    is a table-level `primaryKey({ columns })` with no name key — DRIZZLE
//    computes it at schema-definition time (see
//    drizzle-orm/pg-core/primary-keys.ts PrimaryKey.getName()):
//    `<table>_<cols>_pk`.
//  - unique: always table-level (`unique().on(cols)`, no inline form at
//    all, regardless of column count) — DRIZZLE computes it
//    (unique-constraint.ts's `uniqueKeyName`, run in the UniqueConstraint
//    constructor the moment the table is defined): `<table>_<cols>_unique`.
//  - fk: always table-level (`foreignKey({ columns, foreignColumns })`) —
//    DRIZZLE computes it (foreign-keys.ts ForeignKey.getName()):
//    `<table>_<cols>_<targetTable>_<targetCols>_fk`.
//  - check: drizzle's own `check(name, expr)` builder has NO default at
//    all — `name` is a mandatory first argument (pg-core/checks.ts) — and
//    export-drizzle's `emitCheck` THROWS on a blank name rather than
//    guessing one (there is no name this pipeline will ever actually emit
//    for a blank check). The preview below is Postgres' OWN bare
//    "unnamed table constraint" fallback (`<table>_check`, `_check1`, …,
//    numbered across this table's OTHER unnamed checks) — informational
//    only, a hint of "here's roughly what a raw ALTER TABLE would pick",
//    NOT what this export pipeline emits (that path is a hard failure).
//
// Returns null when there isn't enough on the draft yet to compute anything
// meaningful (no columns ticked, or an fk with no target table/columns
// chosen) — callers fall back to a plain "name" placeholder in that case.

import type { Constraint } from '../../engine/model/types';

export function generatedConstraintName(tableId: string, constraint: Constraint, siblings: Constraint[]): string | null {
  switch (constraint.kind) {
    case 'pk':
      if (constraint.columns.length === 0) return null;
      return constraint.columns.length === 1 ? `${tableId}_pkey` : `${tableId}_${constraint.columns.join('_')}_pk`;

    case 'unique':
      if (constraint.columns.length === 0) return null;
      return `${tableId}_${constraint.columns.join('_')}_unique`;

    case 'fk':
      if (constraint.columns.length === 0 || !constraint.refTable || constraint.refColumns.length === 0) return null;
      return `${tableId}_${constraint.columns.join('_')}_${constraint.refTable}_${constraint.refColumns.join('_')}_fk`;

    case 'check': {
      const unnamedChecks = siblings.filter((c) => c.kind === 'check' && !c.name);
      const position = unnamedChecks.findIndex((c) => c.id === constraint.id);
      const index = position < 0 ? unnamedChecks.length : position;
      return index === 0 ? `${tableId}_check` : `${tableId}_check${index}`;
    }
  }
}
