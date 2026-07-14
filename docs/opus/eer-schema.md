# EER model JSON schema

The EER viewer ([`apps/eer`](../../apps/eer)) is driven **entirely** by a JSON file. Nothing about the
diagram — entities, fields, edges, groups — is hardcoded in the renderer. Author a model by
writing this shape; reload the page to see it. Point the viewer at a different file with
`?model=<path-or-url>` (default: [`eer-model.json`](eer-model.json)).

## Top-level

```jsonc
{
  "meta":          { "title": "…", "description": "…" },   // optional
  "view":          { "zoom": 1, "routing": "curved" },      // optional
  "kinds":         [ /* EdgeKind */ ],                       // optional
  "groups":        [ /* Group */ ],                          // required, ≥ 1
  "entities":      [ /* Entity */ ],                         // required, ≥ 1
  "relationships": [ /* Relationship */ ]                    // required (may be [])
}
```

| Key | Required | Notes |
| --- | --- | --- |
| `meta` | no | `title` shows in the header; `description` is informational. |
| `view` | no | `zoom` initial scale (default `1`); `routing` = `"curved"` \| `"avoid"` \| `"ortho"` (default `"curved"`). `curved` = direct béziers; `avoid` = curves routed around cards; `ortho` = horizontal/vertical, routed around cards. |
| `kinds` | no | Declares edge kinds and their line style. If omitted, kinds seen on edges render solid. |
| `groups` | **yes** | Zones/regions entities are packed into. |
| `entities` | **yes** | The tables/nodes. |
| `relationships` | **yes** | Field-to-field edges. Empty array is valid. |

## Group

```jsonc
{ "id": "log", "label": "Event log & idempotency", "order": 1 }
```

| Field | Required | Notes |
| --- | --- | --- |
| `id` | **yes** | Unique. Referenced by `entity.group`. |
| `label` | no | Shown on the zone; defaults to `id`. |
| `order` | no | Left-to-right placement order; defaults to array order. |

## Entity

```jsonc
{
  "id": "events",
  "label": "events",
  "group": "log",
  "description": "The log …",         // optional; shown in the detail panel
  "fields": [ /* Field */ ]
}
```

| Field | Required | Notes |
| --- | --- | --- |
| `id` | **yes** | Unique across entities. Referenced by relationships and `field.ref`. |
| `label` | no | Header text; defaults to `id`. |
| `group` | **yes** | Must match a `groups[].id`. |
| `description` | no | Long text for the detail panel. |
| `fields` | **yes** | Ordered; render order = array order. |

## Field

```jsonc
{ "name": "actor_id", "type": "integer", "role": "fk",
  "ref": "users", "refField": "id",
  "title": "…", "description": "…" }
```

| Field | Required | Notes |
| --- | --- | --- |
| `name` | **yes** | Unique within the entity. Referenced by `relationship.sourceField` / `targetField`. |
| `type` | **yes** | Free text (`integer`, `text`, `jsonb`, `uuid`, an enum name, …). Display only. |
| `role` | no | `"pk"` \| `"fk"` \| omitted. Drives the badge and colour. Composite PK = mark each part `"pk"`. |
| `ref` | no | For `fk` fields: the target entity `id` (documentation; the edge itself lives in `relationships`). |
| `refField` | no | The target field `name` (defaults to the target's PK). |
| `title` | no | Short human title for the detail panel. |
| `description` | no | Long text for the detail panel. |

## Relationship

```jsonc
{ "id": "ev_actor",
  "source": "events", "sourceField": "actor_id",
  "target": "users",  "targetField": "id",
  "cardinality": "n-1", "kind": "fk", "label": "trace" }
```

| Field | Required | Notes |
| --- | --- | --- |
| `id` | no | Unique; auto-generated from endpoints if omitted. |
| `source` | **yes** | Source entity `id`. Must exist. |
| `sourceField` | **yes** | Field `name` on the source. Must exist. |
| `target` | **yes** | Target entity `id`. Must exist. |
| `targetField` | **yes** | Field `name` on the target. Must exist. |
| `cardinality` | no | `"1-1"` \| `"1-n"` \| `"n-1"` \| `"n-m"`. Inferred when omitted (see below). |
| `kind` | no | Matches a `kinds[].id`; controls solid vs dashed. Defaults to solid. |
| `label` | no | Extra label. The line itself always shows **cardinality only**. |

### EdgeKind

```jsonc
{ "id": "soft", "label": "Denormalized / no constraint", "style": "dashed" }
```

`style` is `"solid"` (default) or `"dashed"`. Kinds also appear as filter toggles.

## Cardinality inference

When `cardinality` is omitted it is inferred from the endpoints' roles:

| Source field role | Target field role | Inferred |
| --- | --- | --- |
| `pk` | `fk` | `1-n` |
| `fk` | `pk` | `n-1` |
| `fk` | `fk` | `n-m` |
| anything else | | `1-n` (with a warning) |

Prefer explicit `cardinality` when you know it (e.g. a `UNIQUE` FK is `1-1`, not `n-1`).

## Validation

On load the model is validated. Any of these render a **visible error banner** listing every problem:

- Missing `groups`, `entities`, or `relationships`.
- An `entity.group` that matches no group.
- Duplicate entity ids, or duplicate field names within an entity.
- A relationship whose `source`/`target` entity does not exist.
- A relationship whose `sourceField`/`targetField` does not exist on its entity.

`field.ref` that points at a missing entity/field is reported as a **warning** (the field still renders;
only the documented reference is dangling).
