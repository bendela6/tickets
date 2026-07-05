# Shared contracts: single-source validation for API + MCP

**Date:** 2026-07-05
**Status:** Approved

## Purpose

The API (Fastify + valibot) and the MCP server (zod) each define their own
request validation. When an endpoint or a validation rule changes, both must
be edited by hand, and they can drift. Worse, the rules that matter most —
which fields a ticket has, their types, and which option values are legal —
are **not in any schema at all**: they live as imperative code in
`apps/api/src/tickets/build-value-rows.ts`, driven by per-project vocabulary
rows in the database.

This project establishes a single source of truth for request validation,
shared by the API and MCP, covering both:

- **Static request structure** (fields that do not come from the DB:
  `actorId`, `typeKey`, `parentId`, comment/link/project/user/view/vocabulary
  bodies), and
- **Dynamic field values** (the per-project `values` map), generated from the
  live vocabulary so a field or option added in the DB propagates to
  validation everywhere with zero code change.

## Decisions made during brainstorming

- **Goal:** one shared source for schemas/types; MCP keeps its ergonomic
  adapters (ticket numbers, actor injection, curated tool set) thin on top.
- **Schema library:** consolidate on **zod** (the MCP SDK is zod-native);
  migrate the API's ~14 valibot schemas to zod and drop valibot.
- **Breadth:** all API endpoints move to the shared package.
- **Read side:** response/read types are **out of scope** (documented
  follow-up); this is request-validation only.
- **Dynamic fields:** value validation is generated from the DB vocabulary by
  a shared generator. The generator is the **authoritative** value validator
  on the API; `build-value-rows.ts` is reduced to value→row resolution.
- **MCP dynamic surfacing:** MCP advertises *static* tool input schemas, so
  the tool's `values` stays an open record at the boundary. The generated
  per-project schema reaches the agent via `get_board` (as JSON Schema) and is
  enforced by validating `values` inside the tool before calling the API.
- **Spec shape:** one phased spec (Phase 1 static, Phase 2 dynamic).

Rejected: per-project typed MCP tools (tool-list explosion, client caching);
JSON-Schema `if/then` conditionals on `projectKey` (zod can't express cleanly,
poor client support); keeping valibot with a valibot→JSON-Schema converter for
MCP (two libraries, less-proven SDK path); sharing response types now (the API
has no response-schema layer — larger, separate effort).

## Architecture

New package `packages/contracts` (`@tickets/contracts`), mirroring
`@tickets/db`'s setup (ESM, `exports: { ".": "./src/index.ts" }`, consumed via
`workspace:*`, extends `tsconfig.base.json`). It depends on `zod@^4.4.3` — the
exact version the MCP SDK expects — so API, MCP, and contracts resolve to a
single zod instance (required for `.shape` typing and SDK compatibility).

```
@tickets/contracts
├── static request schemas  ──▶ apps/api  (route validation via parseBody)
│                            └▶ apps/mcp  (tool inputSchema, derived per tool)
└── buildValuesSchema()      ──▶ apps/api  (authoritative `values` validation)
    + FieldSpec type         └▶ apps/mcp  (fail-fast validation + get_board JSON Schema)
```

The package exports:
- `src/primitives.ts` — leaf validators: `intId = z.number().int()`,
  `nonEmptyString = z.string().min(1)`, `fieldValues = z.record(z.string(), z.unknown())`,
  `configObject = z.record(z.string(), z.unknown())`,
  `userKind = z.enum(['human', 'agent'])`, `nullableString = z.string().nullable()`.
- `src/tickets.ts`, `comments.ts`, `links.ts`, `projects.ts`, `users.ts`,
  `views.ts` (incl. the view-config schema), `vocabulary.ts` — the API request
  body schemas, built from primitives.
- `src/values-schema.ts` — the dynamic generator and `FieldSpec` type.
- `src/index.ts` — re-exports every schema, the generator, and `z.infer` types.

## Phase 1 — static contracts + valibot → zod

### Contracts

Port each valibot schema to zod (mechanical 1:1). Full mapping table:

| valibot | zod |
| ------- | --- |
| `v.object({...})` | `z.object({...})` |
| `v.strictObject({...})` | `z.strictObject({...})` |
| `v.looseObject({...})` | `z.looseObject({...})` |
| `v.pipe(v.number(), v.integer())` | `z.number().int()` |
| `v.pipe(v.string(), v.minLength(1))` | `z.string().min(1)` |
| `v.optional(x)` | `x.optional()` |
| `v.nullable(x)` | `x.nullable()` |
| `v.record(v.string(), v.unknown())` | `z.record(z.string(), z.unknown())` |
| `v.array(x)` | `z.array(x)` |
| `v.boolean()` | `z.boolean()` |
| `v.picklist([...])` | `z.enum([...])` |
| `v.literal(x)` | `z.literal(x)` |
| `v.variant('source', [a, b])` | `z.discriminatedUnion('source', [a, b])` |
| `v.unknown()` | `z.unknown()` |

The nontrivial migration is `apps/api/src/views/validate-view-config.ts`
(`looseObject` + `variant` + `literal`); its `fieldId`-walking logic is
unchanged — only the schema definition moves to the contracts package and the
`variant` becomes `discriminatedUnion`.

Schemas to define (one per current valibot schema): `createTicketBody`,
`patchTicketBody` (strict), `createCommentBody`, `createLinkBody`,
`createProjectBody`, `createUserBody`, `createViewBody`, `patchViewBody`,
`viewConfigSchema`, `createFieldBody`, `patchArchivableBody`,
`createOptionBody`, `createStatusBody`, `createTransitionBody`,
`createLinkTypeBody`. Each also exports its `z.infer` type.

### API

- `apps/api/src/utils/parse-body.ts`: swap valibot for zod. Signature becomes
  `parseBody<S extends z.ZodType>(schema: S, input: unknown): z.infer<S>`,
  using `schema.safeParse`. Format `result.error.issues` as
  `issue.path.join('.') + ': ' + issue.message`, joined by `'; '`, thrown as
  `HttpError(400, detail)` — the **same 400 message contract** the docs
  promise (path-prefixed, semicolon-joined).
- Every route file deletes its inline valibot schema and imports from
  `@tickets/contracts`.
- `apps/api/package.json`: remove `valibot`, add `zod@^4.4.3` and
  `@tickets/contracts: workspace:*`.

### MCP

- Each write tool derives its structural `inputSchema` from the shared static
  schema, e.g.:
  ```ts
  inputSchema: createTicketBody
    .omit({ actorId: true, parentId: true })   // server-injected, hidden from the agent
    .extend({ projectKey: nonEmptyString, parentNumber: intId.optional() })
    .shape
  ```
  Read tools with no API body (`search_tickets`, `get_ticket`, etc.) compose
  their shape from shared **primitives** so leaf rules stay shared.
- Tool `description` strings and per-field `.describe()` stay in MCP
  (agent-facing, not part of the contract).
- `apps/mcp/package.json`: add `@tickets/contracts: workspace:*` (zod already
  present; align to `^4.4.3`).

### Phase 1 verification

- `pnpm typecheck` passes for all packages.
- Dev API: `POST /api/projects/TASK/tickets` with a missing `typeKey` returns
  400 with a `typeKey: ...` message; a valid body returns 201.
- MCP stdio: `tools/call create_ticket` with a bad structural arg is rejected
  by the SDK; a valid one succeeds.

## Phase 2 — dynamic values-schema generator

### The generator

`src/values-schema.ts` exports:

```ts
export type FieldSpec = {
  key: string;
  type: 'text' | 'number' | 'date' | 'boolean' | 'json' | 'select' | 'multi_select' | 'status';
  required: boolean;          // from ticket_type_fields.required, per type
  options?: string[];         // select/multi_select option values; status keys
  description?: string;       // field config.description, surfaced to agents
};

export function buildValuesSchema(
  fields: FieldSpec[],
  options: { mode: 'create' | 'update' },
): z.ZodObject;
```

Per-field mapping:

| field type | zod |
| ---------- | --- |
| `text` | `z.string()` |
| `number` | `z.number()` |
| `date` | `z.string()` refined to `!Number.isNaN(Date.parse(v))` |
| `boolean` | `z.boolean()` |
| `json` | `z.unknown()` |
| `select` | `z.enum(options)` |
| `multi_select` | `z.array(z.enum(options))` |
| `status` | `z.enum(statusKeys)` |

Rules:
- `mode: 'create'` — fields with `required: true` are required; others
  `.optional()`. (Status is not `required` in the seed, so it stays optional
  and the handler's initial-status default still applies.)
- `mode: 'update'` — every field `.optional()` and `.nullable()` (null
  clears, matching current semantics).
- Each field carries `.describe(description)` when present.
- Unknown keys are rejected (`z.strictObject`) so a typo'd field key is a
  validation error — matching the current `unknown field "x"` behavior.
- Field-aware error messages via zod's error customization keep messages close
  to today's (e.g. `field "severity" has no option "urgent"`).

**Covered by the generator:** field existence, per-field type, option/status
membership, required-ness. **Stays imperative** (not per-field-value schema
concerns): status-transition legality (`check-transition.ts`), parent
hierarchy (`check-parent.ts`), optimistic locking.

### API wiring

- Create/update handlers build a `FieldSpec[]` from `loadProjectVocab` (for
  the ticket's type) and validate `body.values` with
  `buildValuesSchema(specs, { mode })` before writing. This is the
  authoritative value check.
- `build-value-rows.ts` keeps its option/status → id **resolution** (it needs
  the id); its now-redundant type/membership throws remain as backstops. The
  create handler's required-field loop is removed (the generated schema
  enforces it).
- **Behavior notes (two intentional changes):**
  1. Value-validation error *messages* change from the current hand-written
     strings to generator-produced ones; the field-aware messages above keep
     them close, but exact wording differs.
  2. The generated schema is **type-scoped**, so a value for a project field
     that is *not attached to the ticket's type* becomes a 400. Today
     `build-value-rows.ts` checks only that the field exists in the project,
     so such a value is silently accepted and written. This is a deliberate
     tightening (that input is almost always a mistake); it is called out here
     because it is a behavior change, not a pure refactor.

### MCP wiring

- A shared helper builds `FieldSpec[]` from the board (fields + options +
  `typeFields.required` per type).
- Each write tool validates `values` with `buildValuesSchema(specs, { mode })`
  before calling the API — fail-fast with precise messages; the API remains
  the final authority.
- `get_board` returns, per ticket type, the generated JSON Schema for `values`
  via `z.toJSONSchema(buildValuesSchema(specs, { mode: 'create' }))`, carrying
  field types, required-ness, enum option values, and descriptions.
  **This replaces the assignee plan's Task 3** — the assignee field's options
  and its planning `config.description` reach the agent through this schema,
  no bespoke reshaping.

### Phase 2 verification

- `pnpm typecheck` passes.
- API: `POST` a ticket with `severity: "urgent"` (not an option) → 400 naming
  the field/option; a valid `severity: "high"` → 201.
- MCP: `get_board TASK` returns a `values` JSON Schema per type whose
  `severity` is an enum of the real option values; after the assignee field
  exists, its enum lists the four model ids and carries the planning
  description.
- MCP: `create_ticket` with a bad option value is rejected **before** the API
  call (fail-fast).
- Drift demo: add an option to a select field in the DB, call `get_board`
  again → the schema's enum updates with **zero code change**.

## Data flow (Phase 2, create)

1. Agent calls `get_board` → receives, per type, a JSON Schema for `values`
   (real field types, enums with option values, descriptions).
2. Agent calls `create_ticket`; the tool validates `values` against the
   locally-generated schema (fail-fast), then POSTs to the API.
3. The API re-generates the schema from `loadProjectVocab`, validates
   `body.values` (authoritative), resolves option/status ids via
   `build-value-rows.ts`, checks transitions/hierarchy imperatively, and
   writes rows + a `ticket_events` entry.

## Error handling

- Static-schema failures: `parseBody` → 400, same path-prefixed message
  format as today.
- Dynamic-value failures: generated-schema `safeParse` → 400 with field-aware
  messages.
- MCP fail-fast surfaces the same class of message before the network call;
  the API stays the final authority.

## Testing

No test framework exists in the repo; do not add one. Verification is
`pnpm typecheck` plus the executable Phase 1 and Phase 2 checks above
(dev API on `http://127.0.0.1:4600`, MCP over stdio JSON-RPC). The drift demo
is the key acceptance check: a DB-only vocabulary change must change validation
and the agent-visible schema with no code edit.

## Out of scope

- Response/read types (the API returns raw Drizzle rows; no response-schema
  layer exists — separate, larger effort).
- Path-param parsing (`parse-id.ts`) stays as-is.
- Status-transition legality, parent hierarchy, optimistic locking stay
  imperative.
- Per-project typed MCP tools; JSON-Schema conditional subschemas.

## Relationship to the assignee field

The assignee field (`docs/superpowers/specs/2026-07-05-assignee-field-design.md`)
seed + backfill still stand. Its MCP change (surface `config.description` in
`get_board`) is **subsumed** by Phase 2's generated-schema surfacing.
Recommended order: land this contracts work, then the assignee field's options
and description reach the agent automatically through the generated schema.
