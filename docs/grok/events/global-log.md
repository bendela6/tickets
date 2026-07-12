# Global `events` table

## Answer

**Yes.** There is **one** append-only table named **`events`**.  
**Every** domain event goes there — not only item (formerly ticket) events.

```text
events
  aggregate_type   -- 'item' | 'field' | 'type' | 'scheme' | 'project' | 'user' | 'view' | 'option' | 'linkType' | …
  aggregate_id     -- id within that type
  seq              -- per (aggregate_type, aggregate_id)
  kind             -- e.g. item.field_changed, field.created, type.field_attached
  payload          -- jsonb
  …
```

| Stream | Example kinds | SoT? |
| ------ | ------------- | ---- |
| `item` | `item.created`, `item.field_changed`, … | tables for now; log lossless; optional Tier B later |
| `field`, `type`, `option`, … | structure audit | **tables stay SoT**; events are audit trail |
| `project`, `user`, `view` | workspace audit | same |

So: **global table, many streams** (discriminated by `aggregate_type`).  
Not “one table per domain,” and not “only item events.”

## Why global

- One outbox / consumer pipeline later  
- One cursor / retention story  
- Config audit and item history in the same infrastructure  
- Adding a new aggregate = new `aggregate_type` string, same table  

## What it is *not*

- **Not** event-sourcing every aggregate as source of truth (only item might go there later).  
- **Not** requiring every row to have `item_id` — use `aggregate_type` + `aggregate_id`.  
- **Not** a substitute for `item_activity` feed (that projection still filters `aggregate_type = 'item'`).

## Item feed query

```sql
SELECT * FROM events
WHERE aggregate_type = 'item' AND aggregate_id = $itemId
ORDER BY seq;
-- or read item_activity
```

## Rename from today

`ticket_events` (FK `ticket_id`) → **`events`** (polymorphic, no ticket-only FK).
