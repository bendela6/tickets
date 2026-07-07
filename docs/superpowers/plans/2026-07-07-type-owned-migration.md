# Type-owned Fields & Links — Plan C: Migration + Promotion

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the **live** ticket data (561 tickets across 4 projects) from scheme-owned shared fields/links to the type-owned model, then **contract** the schema (drop `scheme_id`, drop `ticket_type_fields`, set NOT NULL, swap uniques), and promote to the live docker DB.

**Architecture:** In-place expand→migrate→contract, driven by the existing `ticket_type_fields` attachments. Validate on a **dev copy** of the live DB first (all-zero verify), then promote to docker via the dump-copy-migrate-contract-swap-back playbook used for the prior scheme migration, and rebuild the api image.

**Tech Stack:** tsx one-shot scripts against Postgres via postgres-js; drizzle-kit for the contract migration; `docker compose` for promotion.

## Global Constraints

- **Do Plans A & B first.** This plan assumes the type-owned schema columns exist (nullable, from Plan A) and the API/board read-path already resolves by key (Plan B). Contracting before Plan B ships would break the running api.
- **Two Postgres DBs.** Dev = host **5532** (`.env`); docker = unpublished (live). Node tooling only ever runs against dev/scratch DBs. The live docker DB is changed **only** by restoring a migrated dump into it (the swap), never by pointing tsx/drizzle at it.
- **Auto-mode blocks raw mass SQL against the live DB.** All live writes go through the dump-swap, not ad-hoc `UPDATE`/`DELETE`.
- **Back up first.** `pg_dump` the live docker `tickets` DB to a gitignored `backup-docker-*.dump` before promotion.
- **The 2026-07-07 field backfill must survive.** `priority`/`assignee`/`kind` values are remapped like any other value; verify their counts post-migration.
- Conventional commits `feat(db): …` / `chore(deploy): …`; commit the migration scripts, then a separate commit for the contract migration.

## File Structure

- `packages/db/src/migrate-fields-links/derive.ts` — **pure** helpers: `deriveTypeFields`, `remapValueFieldId`, `deriveTypeLinks`, `remapViewConfig`. Unit-tested.
- `packages/db/src/migrate-fields-links/derive.test.ts` — unit tests for the pure helpers.
- `packages/db/src/migrate-fields-links/run.ts` — one-shot: reads current rows, writes per-type fields/links + target rows, remaps `ticket_values`/`ticket_links`/`views`. Idempotency guard on re-run.
- `packages/db/src/migrate-fields-links/verify.ts` — all-zero checks.
- `packages/db/drizzle/00NN_*.sql` — the **contract** migration (generated after tightening schema in Task 4).

---

### Task 1: Pure derivation helpers

**Files:**
- Create: `packages/db/src/migrate-fields-links/derive.ts`, `derive.test.ts`

**Interfaces:**
- Produces:
  - `deriveTypeFields(sharedFields, ttf) → { typeId, fromFieldId, key, label, type, system, config, required, position }[]` — one per `(type, attached field)`.
  - `remapViewConfig(config, keyByOldFieldId) → config'` — rewrites every `fieldId` (columns, sort, filters, forward-compat extras) to `fieldKey`, dropping the numeric id.
  - `deriveTypeLinks(sharedLinks, linkUsage) → { sourceTypeId, fromLinkId, key, label, inverseLabel, directional, targetTypeIds }[]` where `linkUsage` = observed `(sourceTypeId, targetTypeId, oldLinkTypeId)` triples; unused links fan out to every type with all-type targets.

- [ ] **Step 1: Write failing tests** for the three pure helpers. Example for `remapViewConfig`:
```ts
test('remapViewConfig rewrites field ids to keys everywhere', () => {
  const out = remapViewConfig(
    { columns: [{ source: 'number' }, { source: 'field', fieldId: 35, width: 80 }],
      sort: { source: 'field', fieldId: 35, dir: 'desc' },
      filters: { rules: [{ fieldId: 34, op: 'eq', value: 'x' }] } },
    new Map([[35, 'priority'], [34, 'status']]),
  );
  expect(out.columns[1]).toEqual({ source: 'field', fieldKey: 'priority', width: 80 });
  expect(out.sort).toEqual({ source: 'field', fieldKey: 'priority', dir: 'desc' });
  expect((out.filters as any).rules[0]).toEqual({ fieldKey: 'status', op: 'eq', value: 'x' });
});
```
Add tests: `deriveTypeFields` produces one row per attachment with `required`/`position` from the junction; `deriveTypeLinks` fans unused links to all types.

- [ ] **Step 2: Run — fails** (`pnpm --filter @tickets/db test derive`).

- [ ] **Step 3: Implement `derive.ts`** — pure functions, no DB. `remapViewConfig` deep-walks and replaces any object carrying a numeric `fieldId` with `{ ...rest, fieldKey: keyByOldFieldId.get(fieldId) }` (delete `fieldId`); mirror the walk shape used by `validate-view-config`.

- [ ] **Step 4: Run — passes.**

- [ ] **Step 5: Commit**
```bash
git add packages/db/src/migrate-fields-links/derive.ts packages/db/src/migrate-fields-links/derive.test.ts
git commit -m "feat(db): pure derivation helpers for type-owned migration"
```

---

### Task 2: Migration runner + verifier

**Files:**
- Create: `packages/db/src/migrate-fields-links/run.ts`, `verify.ts`

**Interfaces:**
- Consumes the pure helpers from Task 1. Mutates the target DB (dev/scratch only).

- [ ] **Step 1: Implement `run.ts`** in one transaction:
  1. Load `schemes` (software), its `ticketTypes`, current `fields` (scheme-owned), `fieldOptions`, `ticketTypeFields`, `linkTypes`, `ticketLinks` (join source ticket → type), `ticketValues` (join ticket → type), `views`.
  2. **Idempotency guard:** if any `fields.ticket_type_id IS NOT NULL` already, abort with a message (migration already ran).
  3. For each `(type T, attached field F)` via `deriveTypeFields`: insert a per-type field row (set `ticket_type_id`, `position`, `required`), copy `F`'s options into it. Build `map(T.id, key) → newFieldId` and `keyByOldFieldId(F.id) → F.key`.
  4. **Remap `ticket_values`:** for each value on a ticket of type `T` whose current field id has key `k`, `UPDATE ticket_values SET field_id = map(T.id, k)`. (Batch by old field id.)
  5. **Links:** via `deriveTypeLinks`, insert per-source-type link rows + `link_type_target_types` (targets from observed usage; unused links → all types). Build `map(sourceTypeId, key) → newLinkId`; remap `ticket_links.link_type_id` by each link's source ticket type.
  6. **Views:** for each view, `UPDATE views SET config = remapViewConfig(config, keyByOldFieldId)`.
  7. Leave old `scheme_id` values and `ticket_type_fields` rows in place (Task 4 drops them).

- [ ] **Step 2: Implement `verify.ts`** (mirror `migrate-to-scheme/verify.ts`) printing all-zero JSON:
```ts
// badValueField: value whose field.ticket_type_id !== value's ticket.type_id
// orphanValue:   value whose field_id has no row
// badLinkOwner:  link whose link_type.ticket_type_id !== source ticket.type_id
// badLinkTarget: link whose target ticket.type_id ∉ link_type_target_types(link_type_id)
// badViewKey:    view config fieldKey not present on any type field
// counts: totalValues, totalLinks unchanged vs a pre-migration snapshot
console.log(JSON.stringify({ badValueField, orphanValue, badLinkOwner, badLinkTarget, badViewKey }));
```

- [ ] **Step 3: Commit** (scripts only; run in Task 3)
```bash
git add packages/db/src/migrate-fields-links/run.ts packages/db/src/migrate-fields-links/verify.ts
git commit -m "feat(db): type-owned migration runner + verifier"
```

---

### Task 3: Dry run on a dev copy of the live DB

**Files:** none (operational).

- [ ] **Step 1: Dump the live docker DB to a scratch dev DB**
```bash
# from repo root
docker compose exec -T postgres pg_dump -U postgres tickets > "$SCRATCH/live.sql"
cd packages/db
POSTGRES_DATABASE=postgres pnpm exec tsx -e "import {createDbClient} from './src/client'; const {sql}=createDbClient({max:1}); await sql\`DROP DATABASE IF EXISTS tickets_tozf\`; await sql\`CREATE DATABASE tickets_tozf\`; await sql.end();"
PGPASSWORD=... psql -h localhost -p 5532 -U postgres tickets_tozf < "$SCRATCH/live.sql"
```

- [ ] **Step 2: Apply the Plan A expand migration to the copy** (it predates this branch's migrations if the dump is old): `POSTGRES_DATABASE=tickets_tozf pnpm db:migrate`. Expected: the expand migration adds the nullable columns + target table.

- [ ] **Step 3: Run the migration + verify**
```bash
POSTGRES_DATABASE=tickets_tozf pnpm exec tsx src/migrate-fields-links/run.ts
POSTGRES_DATABASE=tickets_tozf pnpm exec tsx src/migrate-fields-links/verify.ts
```
Expected verify: `{ badValueField:0, orphanValue:0, badLinkOwner:0, badLinkTarget:0, badViewKey:0 }`.

- [ ] **Step 4: Spot-check the backfilled fields survived**
```bash
POSTGRES_DATABASE=tickets_tozf pnpm exec tsx -e "
import {createDbClient} from './src/client'; import {fields,ticketValues} from './src/schema'; import {eq,inArray} from 'drizzle-orm';
const {db,sql}=createDbClient({max:1});
const prio=await db.select().from(fields).where(eq(fields.key,'priority'));
const n=(await db.select().from(ticketValues).where(inArray(ticketValues.fieldId,prio.map(f=>f.id)))).length;
console.log('priority values after migrate:',n); await sql.end();"
```
Expected: `347` (matches the active-ticket backfill; archived may add more).

- [ ] **Step 5: If any verify count is non-zero**, fix `derive.ts`/`run.ts`, drop `tickets_tozf`, and repeat from Step 1. Do not proceed to contract until all-zero.

---

### Task 4: Contract migration

**Files:**
- Modify: `packages/db/src/schema/fields.ts`, `link-types.ts` (tighten to final)
- Migration: `packages/db/drizzle/00NN_*.sql` (generated)

**Interfaces:** Produces the final schema: `fields.ticket_type_id NOT NULL`, `fields.position NOT NULL`, no `fields.scheme_id`, unique `(ticket_type_id, key)`; `link_types.ticket_type_id NOT NULL`, no `scheme_id`, unique `(ticket_type_id, key)`; `ticket_type_fields` dropped.

- [ ] **Step 1: Tighten `fields.ts`** — remove `schemeId`; `ticketTypeId` `.notNull()`; `position` `.notNull()`; swap unique to `(ticketTypeId, key)`; remove the `schemes` import if unused.
- [ ] **Step 2: Tighten `link-types.ts`** — remove `schemeId`; `ticketTypeId` `.notNull()`; swap unique to `(ticketTypeId, key)`.
- [ ] **Step 3: Delete `ticket-type-fields.ts`** and its export in `schema/index.ts`. Grep for remaining importers (`git grep -n ticketTypeFields`) — after Plans A/B there should be none except historical migrations.
- [ ] **Step 4: Generate the contract migration**

Run: `pnpm --filter @tickets/db exec drizzle-kit generate`
Open the SQL and confirm it: drops `fields.scheme_id`, `link_types.scheme_id`; `ALTER … SET NOT NULL` on the type-owned columns; `DROP TABLE ticket_type_fields`; swaps the uniques. **Because the live copy already has the columns populated (Task 3), the NOT NULL will succeed.**

- [ ] **Step 5: Pre-check no duplicate `(ticket_type_id, key)` before applying the contract.** During Plans A/B the new unique isn't enforced yet (rows have `scheme_id = NULL` under the old `(scheme_id, key)` unique), so a stray double-seed/double-run could have created duplicate `(ticket_type_id, key)` fields or link types that would make the constraint swap fail. Assert zero duplicates on the migrated copy first:
```bash
POSTGRES_DATABASE=tickets_tozf pnpm exec tsx -e "import {createDbClient} from './src/client'; const {sql}=createDbClient({max:1}); const f=await sql\`select ticket_type_id,key,count(*) from fields group by 1,2 having count(*)>1\`; const l=await sql\`select ticket_type_id,key,count(*) from link_types group by 1,2 having count(*)>1\`; console.log(JSON.stringify({dupFields:f.length,dupLinks:l.length})); await sql.end();"
```
Expected: `{ dupFields:0, dupLinks:0 }`. If non-zero, stop and de-dup before contracting.

- [ ] **Step 6: Verify the contract on the migrated dev copy**
```bash
POSTGRES_DATABASE=tickets_tozf pnpm db:migrate      # applies the contract
POSTGRES_DATABASE=tickets_tozf pnpm exec tsx src/migrate-fields-links/verify.ts
```
Expected: migration applies with no NOT NULL violation; verify still all-zero.

- [ ] **Step 6: Typecheck + full suite on the final schema**
Run: `pnpm typecheck && pnpm --filter @tickets/db test && pnpm --filter @tickets/api test`
Expected: green (Plans A/B already updated all consumers).

- [ ] **Step 7: Commit**
```bash
git add packages/db/src/schema packages/db/drizzle
git commit -m "feat(db)!: contract to type-owned fields & links — drop scheme_id + ticket_type_fields"
```

---

### Task 5: Promote to live docker + merge

**Files:** none (operational).

- [ ] **Step 1: Back up the live DB**
```bash
docker compose exec -T postgres pg_dump -U postgres -Fc tickets > "backup-docker-type-owned-$(git rev-parse --short HEAD).dump"
```

- [ ] **Step 2: Produce the fully-migrated dump.** Re-derive on a clean copy to avoid promoting a hand-poked DB: repeat Task 3 Steps 1–3 and Task 4 Step 5 on a fresh `tickets_promote` DB (dump live → migrate expand → run.ts → verify all-zero → apply contract → verify). Then `pg_dump -Fc tickets_promote > "$SCRATCH/promote.dump"`.

- [ ] **Step 3: Swap into docker** (drop+recreate the docker `tickets`, restore the migrated dump):
```bash
docker compose exec -T postgres psql -U postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='tickets' AND pid<>pg_backend_pid();"
docker compose exec -T postgres psql -U postgres -c "DROP DATABASE tickets;"
docker compose exec -T postgres psql -U postgres -c "CREATE DATABASE tickets;"
docker compose exec -T postgres pg_restore -U postgres -d tickets < "$SCRATCH/promote.dump"
```

- [ ] **Step 4: Rebuild the api image so deployed code matches the final schema**

**ORDERING GATE (mandatory):** this rebuild MUST happen only AFTER the migrated dump is restored into docker (Step 3). The Plan-A vocab loads fields/links exclusively via `ticket_type_id`, so an api built on this code against un-migrated (scheme-owned) data would return **zero** fields/links — every board blank. Migrate-then-rebuild, never rebuild-then-migrate.
```bash
docker compose up -d --build api
```

- [ ] **Step 5: Smoke-test the live board endpoint**
```bash
curl -s http://localhost:4600/api/projects/items-core/board | head -c 400
```
Expected: HTTP 200 JSON with `fields` (logical, one per key) and tickets whose `values` carry `priority`/`assignee`/`status`.

- [ ] **Step 6: Redeploy web + eyeball**
```bash
sh scripts/deploy-web.sh
```
Open http://localhost:4610 — every project board renders proper columns (Title/Priority/Assignee/Status) across Epic/Task/Subtask.

- [ ] **Step 7: Merge to main**
```bash
git checkout main && git merge --ff-only redesign && git checkout redesign
```
(No remote; fast-forward only, matching prior scheme merges.)

- [ ] **Step 8: Optionally delete consumed migration scripts** (`migrate-fields-links/run.ts`, `derive.ts`+test, `verify.ts`) in a follow-up `chore(db)` commit — git history keeps them. Keep them until the promotion is confirmed stable.

## Self-Review (author checklist)

- Spec coverage: migration §5 → Tasks 1–4; promotion → Task 5. Verify checks match the spec's all-zero list (value ownership, link owner/target, view keys).
- Ordering: contract (Task 4) only after all-zero dry run (Task 3); promotion (Task 5) only after Plans A/B shipped so the running api tolerates the final schema.
- Data safety: back up before swap; re-derive on a clean copy for the promoted dump; no raw mass SQL against live.
