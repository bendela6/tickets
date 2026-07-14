# Grok validation: EER ↔ drizzle lossless round-trip

**Spec under review:** `docs/superpowers/specs/2026-07-14-eer-drizzle-roundtrip-design.md`  
**Date:** 2026-07-14 · **Reviewer:** Grok  
**Verdict:** **Strong directionally, not approval-ready yet.** The problem, architecture, and gate-test idea match the repo. A few claims are wrong against live drizzle objects, and several migration/UI edges are under-specified for a clean implementation.

---

## What checks out

| Claim | Evidence |
| --- | --- |
| **18 tables, 3 enums** | `registry.ts` has 18 tables; `enums.ts` has `user_kind`, `status_kind`, `field_type` |
| **Schema barrel is import-safe; package root is not** | `schema/index.ts` is pure tables; `packages/db/src/index.ts` pulls `client` + env |
| **Introspect via `getTableConfig` / `isPgEnum`, no TS parse** | Already used in `describe-schema.ts`; verified on live schema |
| **`nullsNotDistinct` is real** | `status_transitions` uses `.nullsNotDistinct()` — model gap is real |
| **Partial indexes are real** | `ticket_values_single` is `uniqueIndex(...).where(sql\`option_id IS NULL\`)` |
| **Check constraints are real** | `ticket_links_no_self` |
| **FK auto-names are real** | e.g. `ticket_links_link_type_id_link_types_id_fk` |
| **Defaults are SQL chunks** | `defaultNow()` → chunks with `now()`; jsonb defaults as `sql\`...\`` |
| **Current type catalogue ≈ 21 + `custom…`** | `pg-types.ts` lists 21; `type-cell.tsx` has the custom-mode complexity the doc describes |
| **`schema-groups.ts` can seed zones** | 4 groups with `label` + instrument color names + tables |
| **Vite plugin reader pattern** | `apps/eer/vite-plugins/models-api.ts` is the right place to hang a schema reader |
| **Semantic, not textual, equality** | Real schema uses inline `serial().primaryKey()` everywhere; normalizing to table-level PKs is correct |
| **Supersedes real-db-modelling §9** | Prior design YAGNI’d method/partial/expression indexes, namespaces, generated cols, DDL export — this correctly reopens them for round-trip |

Architecture is sound: pure `import-drizzle` / `export-drizzle`, Node-only reader, merge-not-clobber, report unsupported constructs, catalogue drift test.

---

## Must-fix before approval

### 1. `$defaultFn` detection is wrong for `serial`

Design says:

> `.$defaultFn()` is detectable (`hasDefault` with no `default`)

Live introspection on `users.id` (`serial().primaryKey()`):

```text
{ hasDefault: true, default: undefined, primary: true, type: 'serial' }
```

Almost every table in `@tickets/db` uses `serial` PKs. That heuristic would mark the whole schema as unsupported `default-fn` and break the gate test on day one.

**Fix:** Detect by column type family (`serial` / `bigserial` / `smallserial` / identity), or by drizzle entity kind — not bare `hasDefault && !default`. Document the rule in the Types / Scope section.

### 2. Gate-test SQL equality is under-specified (but feasible)

`drizzleKitSql(original) === drizzleKitSql(regenerated)` needs a concrete API.

`drizzle-kit/api` already exposes what you want, without a live DB:

- `generateDrizzleJson(imports)` → snapshot
- `generateMigration(prev, cur)` → SQL statements (empty ⇔ equivalent)

**Lock that** (or equivalent snapshot deep-equal) in the spec so implementers don’t invent a brittle CLI scrape.

### 3. `TableIndex.columns: string[] → IndexColumn[]` needs load-time migration

Today `load-model` keeps index columns as `string[]`, and files/editors assume that. The design changes the shape but only talks about type aliases for columns (`int` → `integer`).

**Required:** permanent normalizer  
`["ticket_id"]` → `[{ expression: "ticket_id", isExpression: false }]`,  
plus indexes-editor / apply-model-edit updates. Same class of work as the previous `fields` → `columns` migration.

### 4. Types section is not the real model

The doc says “existing, with this design’s additions,” but the shapes diverge from `engine/model/types`:

| Design | Actual |
| --- | --- |
| `view.routing: 'avoid' \| 'direct'` | `'curved' \| 'avoid' \| 'ortho'` |
| `Entity.color`, `Group.color` | `Model.colors: Map<id, hex>` |
| simplified `Relationship` | has `cardinalityInferred`, required fields, also `'n-1'` |
| omitted | `kinds`, `zoom`, entity `description`, layout `_w/_h`, etc. |

Per project convention, doc types must be accurate. Prefer a **delta-only** Types section (only `+` fields and new wire types), or regenerate from the real TS types.

---

## Should-fix (high value, non-blocking if explicit)

### 5. Real schema needs partial indexes **in** scope — UI not specified

Gate target includes `ticket_values_single` with a `WHERE` clause. Model field `where` is correct.

Missing decisions:

- Is method / `where` / expression-index **import-only** (preserve + export, no authoring UI)?
- Or do indexes / constraints editors grow controls?
- How is the `where` SQL chunk flattened (same as defaults/checks — currently `String(sql)` is useless)?

Without “preserve through UI rebuild,” opening the table modal and saving can strip `where` / `nullsNotDistinct`.

### 6. `mode: 'string'` is TS-only sugar (like `$type`)

Every timestamp in `@tickets/db` uses `{ withTimezone: true, mode: 'string' }`. That does not show up in `getTableConfig` SQL. Export will lose it unless you hardcode a house style.

List it under unrepresentable / export convention, next to `$type`.

### 7. Seed type `"enum"` is not in the alias map

`items-platform.json` has two columns with `"type": "enum"` (generic). After deleting `custom…`, they become invalid selections unless the one-shot seed rewrite replaces them with real names or a deliberate unknown-type story. Alias map alone is not enough.

### 8. Dual introspectors

`packages/db` already has a narrower `describeSchema()` for `/schema` ERD. This design adds a richer reader in `apps/eer`.

**Choose one:**

- extend `describeSchema` in `@tickets/db` and consume it from eer, or
- explicitly keep two layers (“live ERD stays thin; eer owns full fidelity”) so they don’t drift silently.

### 9. Catalogue: use `getPgColumnBuilders()`

Drizzle exports exactly **32** builders via `getPgColumnBuilders()` (matches “~32”), including `customType`.

Policy needed for:

- **`customType`** — meta-factory, not a fixed SQL type; don’t put it in the picker
- multi-word SQL names (`timestamp with time zone`, `double precision`)
- `decimal` as alias of `numeric` (exported from pg-core, not in `getPgColumnBuilders`)

### 10. UI gaps for “UI → drizzle with no gap”

In-scope for fidelity but not specified as authorable:

- `Model.enums` create/edit
- `UniqueConstraint.nullsNotDistinct`
- identity / generated columns
- array checkbox (mentioned) vs enum values editor (not)

Minimum for the stated ask: **import preserves + export emits**, even if authoring UI is later. Say that explicitly.

### 11. Zone colors from `SCHEMA_GROUPS`

Group colors are instrument option names (`'indigo'`, `'teal'`), while the model stores hex in `Model.colors`. Specify the mapping (or store the option name and resolve at render).

---

## Continuity with prior specs

- Correctly builds on **real-db-modelling** (constraints-derived diagram) and **model-editor** (vite models API, merge layout/colors).
- Should state: **supersedes** real-db-modelling §9 for index method/partial/expression, namespaces, generated columns, and DDL export — those are no longer YAGNI under a round-trip contract.
- Does **not** replace the live `/schema` ERD design; relationship should be one sentence.

---

## Risk section — accuracy

| Risk | Assessment |
| --- | --- |
| Unstable `getTableConfig` | Fair; gate test is the right tripwire |
| Browser `drizzle-orm` ~87 KB | Plausible; not re-measured here. Prefer importing only `pg-core` builders / `getPgColumnBuilders` |
| Semantic ≠ textual export | Correct and well framed |

Add: **serial false-positive on default-fn**, **chunk flattening for where/check**, **index column shape migration**.

---

## Suggested approval bar

Approve after the design is amended to:

1. Fix `$defaultFn` / serial detection.
2. Name the gate mechanism (`generateDrizzleJson` + empty migration, or snapshot equality).
3. Specify `string[]` → `IndexColumn[]` load normalization + editor impact.
4. Make Types a delta (or match real model).
5. State preserve-through-edit rules for `where`, `nullsNotDistinct`, identity, generated, enums.
6. Document `mode: 'string'` and `customType` policy.
7. One sentence on relationship to `describeSchema` / live ERD.

---

## Bottom line

The contract is the right product: **checkable round-trip against `@tickets/db`, merge UI chrome, delete `custom…`, no silent drops.** The shape of the work fits the monorepo.

Do **not** treat it as implementation-ready until the serial/`$defaultFn` bug and the index-shape / gate-API / Types accuracy items are written into the doc. Those are the differences between a clean build and a long debugging loop on the first green gate test.
