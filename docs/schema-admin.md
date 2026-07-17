# Schema admin (config commands)

SP4a Phase 2 adds a set of **config commands** — mutations that edit a
scheme's structure (types, field placements, link-type vocabulary, and the
project→scheme binding) — on top of the SP4a Phase 1 item/value commands.
They follow the same command path as every other mutation: `apps/api/src/command/config/*.ts`
defines each command with `defineCommand`, `apps/api/src/routes/*.routes.ts`
exposes it over HTTP via `runCommand`, and every command emits an event in
the same transaction (`apps/api/src/command/config/events.ts`). See
[database.md](database.md) for the underlying tables.

## Commands

| Command | Route | Notes |
| ------- | ----- | ----- |
| `type.create` | `POST /api/types` | Creates an `item_types` row, appended at the next position within its scheme. |
| `type.update` | `PATCH /api/types/:id` | Relabel, reconfigure, or archive a type. |
| `type.setChildTypes` | `PUT /api/types/:id/child-types` | **Replaces** the full set of `item_type_child_types` rows for that parent. |
| `field.place` | `POST /api/types/:typeId/fields/:fieldId/placement` | Attaches an existing scheme field to a type (`item_type_fields`); 422 if already placed. |
| `field.unplace` | `DELETE /api/types/:typeId/fields/:fieldId/placement` | Removes the placement row; 404 if not placed. |
| `placement.update` | `PATCH /api/types/:typeId/fields/:fieldId/placement` | Updates `required`, `position`, and/or `allowedOptionIds` (folded into `configOverride`) on an existing placement. |
| `field.create` | `POST /api/types/:typeId/fields` | Unchanged route; **extended** — for `type: "option"` with no `optionSetId`, it auto-creates an `option_sets` row (`key: "<field-key>-set"`) and points the new field at it. |
| `linkType.update` | `PATCH /api/link-types/:id` | Relabel (`label`/`inverseLabel`), change `directional`, or archive a link type. |
| `linkType.setTargetTypes` | `PUT /api/link-types/:id/target-types` | **Replaces** the full set of `link_type_target_types` rows for that link type. |
| `project.update` | `PATCH /api/projects/:id` | Updates `name` and/or `schemeId`; the fork-scheme UI flow uses the `schemeId` repoint to move a project onto a forked scheme. |

## Semantics

- **Archive is soft** for referenced entities — types, fields, options, link
  types. `archived: true` sets `archivedAt = now()`; `archived: false` clears
  it back to `null`. The row and every value/reference pointing at it stay
  intact; nothing is deleted.
- **Graph and join rows are hard-deleted/replaced**, not archived — this
  applies to `option_transitions` (workflow edges, via the pre-existing
  `transition.create` / `transition.delete`), `item_type_child_types`, and
  `link_type_target_types`. The two `*.setX` commands here,
  `type.setChildTypes` and `linkType.setTargetTypes`, **REPLACE the whole
  set**: they delete every existing row for the parent and insert the
  submitted set in the same transaction, so the request body must be the new
  complete set, not a diff. `field.place` / `field.unplace` add and remove
  single `item_type_fields` rows directly (no archive flag on placements).
- **The board read seeds the set-editors.** `GET /api/projects/:key/board`
  (`apps/api/src/read/board.ts`) now includes `childTypes` (all
  `item_type_child_types` rows for the project's types) and `targetTypes`
  (all `link_type_target_types` rows for its link types) alongside the
  existing vocabulary. The admin UI's child-type and target-type editors read
  these to pre-populate their selection before calling the `setX` commands,
  so a save always submits the current state plus the user's edit — never an
  empty set that would wipe existing rows.
