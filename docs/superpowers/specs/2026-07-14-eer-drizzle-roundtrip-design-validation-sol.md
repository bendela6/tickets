# Validation: EER ↔ Drizzle lossless round-trip design

**Date:** 2026-07-14  
**Spec reviewed:** [`2026-07-14-eer-drizzle-roundtrip-design.md`](./2026-07-14-eer-drizzle-roundtrip-design.md)  
**Verdict:** Not ready for approval

The overall direction is sound, and the 18-table/3-enum baseline is correct. However, the proposed model and wire format cannot yet uphold the stated lossless round-trip contract.

## Blocking findings

### 1. Namespaces are not represented end-to-end

`Entity.schema` is added, but enums have no schema, foreign keys reference only `refTable`, and re-import matches only by table name. Two schemas containing a table with the same name, or a cross-schema foreign key, cannot round-trip without ambiguity.

Required changes:

- Use `(schema, name)` as database-object identity.
- Add a schema field to `EnumDecl`.
- Add the referenced schema to foreign-key targets.
- Match imported tables by `(schema, name)`, not only by name.
- Define how schema-qualified names become stable model/entity IDs.

### 2. Identity and index metadata remain lossy

`Identity { always: boolean }` drops Drizzle identity metadata:

- sequence name;
- increment;
- minimum and maximum values;
- starting value;
- cache;
- cycle.

The proposed `TableIndex` and `IndexColumn` types also drop Drizzle-supported index semantics:

- per-column operator class (`opClass`);
- `concurrently`;
- `only`/`onOnly`;
- `with` storage parameters.

These fields are exposed by the installed Drizzle 0.45.2 runtime configuration and affect generated SQL. They must either be represented or explicitly moved out of scope and reported during import.

### 3. The `$defaultFn()` detector is incorrect

The proposed detector—`hasDefault` with no `default`—also matches columns whose default behavior comes from their type, notably `serial`. The repository currently contains 16 `serial` primary-key columns, so the real-schema gate would produce false unsupported reports.

Drizzle exposes `column.defaultFn` and `column.onUpdateFn` directly. The reader should inspect those properties instead.

The `UnsupportedConstruct.kind` union must also include an `on-update` member because the scope promises to report `.$onUpdate()`.

Generated columns and identities must not be mistaken for runtime default functions merely because they have `hasDefault` without a literal `default`.

### 4. Retaining vanished tables breaks subsequent export

Re-import reports vanished tables but leaves them in the model. `export-drizzle(Model)` is described as exporting the whole model, so a subsequent export would recreate those vanished tables.

Unknown types create a related contradiction: the spec says they survive untouched, but also says the user must fix them before saving.

The design needs an explicit unresolved state:

- A vanished table must be marked stale until the user chooses to retain, remove, or exclude it.
- Model JSON saving may remain available while unresolved items exist.
- Drizzle export must be blocked until all stale tables and invalid types are resolved, or the exporter must accept an explicit inclusion set.
- Import reports should distinguish informational changes from export-blocking conflicts.

### 5. First-import group seeding is impossible through the declared transform

The spec says `SCHEMA_GROUPS` seeds diagram zones on first import. However, the declared `SchemaDescription` contains only tables, enums, and unsupported constructs, while the pure importer accepts only `SchemaDescription` and an optional existing model.

The importer therefore has no access to group labels or colours.

Resolve this by either:

- adding group metadata to `SchemaDescription`; or
- passing group metadata as a separate, explicitly typed importer argument.

The fallback/default zone for tables absent from `SCHEMA_GROUPS` must also be defined.

### 6. The self-contained model types do not describe the current application

The spec labels its model declarations as the existing model plus additions, but they differ materially from the current runtime types:

- The spec uses routing values `avoid | direct`; the application uses `curved | avoid | ortho`.
- The current view also contains `zoom`.
- The spec omits edge kinds, kind styles, colours, saved layout, lookup maps, group bounds, and content dimensions.
- The spec omits entity descriptions and derived width/height fields.
- Current relationship fields are required and include `cardinalityInferred`; the spec makes several optional and omits `n-1` cardinality.
- Current colours and persisted positions are not stored as the proposed `Entity.color` and optional runtime coordinates.

This violates the repository convention that documentation is self-contained on types and risks implementing the merge against a model shape that does not exist.

The Types section should either:

1. reproduce the complete, accurate resulting types; or
2. show precise TypeScript deltas while separately defining every unchanged named type required to understand them.

## Significant design gaps

### Type representation and catalogue

`ParsedType.array: boolean` cannot represent sized or nested arrays such as `integer[2][]`, even though sized arrays are explicitly in scope. Use an ordered array-dimension representation, for example:

```ts
interface ArrayDimension {
  size: number | null;
}

interface ParsedType {
  base: string;
  params: string[];
  arrays: ArrayDimension[];
  known: boolean;
}
```

The catalogue's `params: 0 | 1 | 2` is also insufficient as a code-generation contract. SQL types have different grammars and builder configurations, including:

- `timestamp(3) with time zone`;
- `time(3) with time zone`;
- `interval day to second(3)`;
- vector types whose dimensions are passed through configuration objects;
- geometry types with mode/configuration behavior.

Drizzle column builders do not themselves expose `getSQLType()`; built columns do. The design must define how each factory is instantiated and built against a dummy table before reading its SQL type.

The catalogue should use per-builder descriptors with parsing and emission behavior, rather than only SQL parameter arity. “Every builder Drizzle exports” must be defined as a concrete, authoritative export list so the drift test is deterministic.

### Default and SQL-expression representation

`default: string | null` is described as SQL text, but the exporter also promises to emit a plain literal when the default is one. Once all values have been flattened to strings, it is not always possible to distinguish:

- a SQL string literal;
- a JavaScript string default;
- a number or boolean;
- JSON;
- an arbitrary SQL expression.

Use one of these contracts:

- Always store rendered SQL text and always emit it through a safely escaped `sql.raw(...)`; or
- Use a discriminated representation such as `{ kind: 'sql', text } | { kind: 'literal', value }`.

The spec must also define escaping for defaults, checks, generated expressions, index expressions, and partial-index predicates. Directly interpolating imported text into a TypeScript template literal is unsafe and can generate invalid source.

### Gate-test definition

The contract diagram compares normalized `describe(...)` values, while the Testing section calls for `getTableConfig` deep equality. Raw Drizzle table configurations contain functions and interconnected runtime objects, so raw deep equality is not a stable semantic comparator.

Define one canonical descriptor function and use it on both schemas. It should:

- render all SQL fragments through the same PostgreSQL dialect;
- sort maps/sets where declaration order is not semantically relevant;
- preserve order where it affects semantics, such as composite key and index columns;
- include schemas, enums, identity options, generated expressions, constraints, and complete index configuration;
- exclude TypeScript object identity and functions.

The `drizzleKitSql(...)` pseudocode also needs a concrete harness. The installed `drizzle-kit/api` exports `generateDrizzleJson` and `generateMigration`. Prefer normalized Drizzle snapshot equality as the primary semantic assertion, with migration SQL from the same empty snapshot as a secondary assertion.

### Reader and writer boundary

The Vite reader loads and executes a schema path supplied through a development route. The spec must define:

- whether the path is fixed, configured, or request-supplied;
- workspace-root containment checks;
- allowed extensions and import targets;
- behavior for imports with side effects or load failures;
- response and error formats;
- whether the capability is intentionally unavailable in production builds.

The export side also needs an explicit route/method, output directory, overwrite policy, atomic-write behavior, and filename validation. Saying only that export writes a review file is insufficient to implement the browser-to-filesystem boundary.

### Package dependencies

Because `apps/eer` will directly import `drizzle-orm` in browser code and Vite middleware, `drizzle-orm` must be declared in `apps/eer/package.json`. The app must not depend on pnpm workspace hoisting to resolve a package it imports directly.

## Validated claims

- `packages/db/src/schema/registry.ts` contains exactly 18 tables.
- `packages/db/src/schema/index.ts` exports exactly three PostgreSQL enums.
- `packages/db/src/schema/index.ts` is import-safe; client and environment imports occur through the package root instead.
- Installed Drizzle 0.45.2 exposes `getTableConfig` and `isPgEnum`.
- Runtime table configuration exposes columns, foreign keys and actions, unique constraints, checks, primary keys, indexes, identities, generated columns, defaults, runtime default functions, and update functions.
- `SCHEMA_GROUPS` already provides labels and colours and is guarded by repository tests, but its data must be added to the importer boundary.

## Approval criteria

The design is ready for approval when:

1. All in-scope database objects use schema-qualified identity.
2. Identity and index representations cover every SQL-affecting field exposed by the installed Drizzle version, or omissions are moved out of scope and reported.
3. Runtime-default detection uses `defaultFn`/`onUpdateFn` without false positives.
4. Stale tables and invalid types have explicit export-blocking resolution semantics.
5. Group metadata can reach the pure importer.
6. The Types section accurately describes the resulting application model and wire format.
7. The type catalogue defines deterministic builder discovery, SQL parsing, array dimensions, and TypeScript emission.
8. SQL/default serialization and escaping are unambiguous.
9. The semantic and Drizzle Kit gate harnesses are specified using concrete APIs and normalization rules.
10. Reader/writer filesystem boundaries and the required `apps/eer` dependency changes are documented.
