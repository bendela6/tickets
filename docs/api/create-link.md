# Create link

`POST /api/links`

Relates two tickets in the same project. A link reads as
"source *label* target" — e.g. with the `blocks` type, source blocks target.
Directional link types are checked for cycles before insert.

In a plan project (its scheme's `config.plan` is `true`) every type owns a
`blocks` link type that targets every type, epics included: a link from B to
X says X waits on B, and its `why` says why. A plan's blocker needs a why,
and keeps the plans' rules (`scripts/tasks-check.mjs`), each refused with
`422` and the rule's message:

| Rule | Message |
| ---- | ------- |
| not the item itself | `TK-80.3 waits on itself` |
| not its own parent, at any height | `TK-80.3 waits on TK-80, its own parent: a parent is done after its children` |
| not its own child, at any depth | `TK-80 waits on TK-80.3, its own child: a parent waits on its children already` |
| not the same one twice | `TK-80.5 lists TK-80.3 twice in blockedBy` |
| not one a parent of it waits on (children inherit those) | `TK-80.5 waits on TK-82, as its parent TK-80 does: children inherit that` |
| not one a child of it waits on already | `TK-80.5 waits on TK-82 already, and children inherit their parents' blockers: take it off TK-80.5 before TK-80 waits on it` |
| no cycle through blockers, children and parents' blockers | `TK-80.5 waits on itself: TK-80.5 → TK-82.1 → TK-80.5` |
| a why | `a blocker says why: why does TK-80.5 wait on TK-80.3?` |

Plan blockers are written one at a time (a transaction-scoped advisory lock),
so two can't close a cycle between them.

**Source:** [`apps/api/src/routes/links.routes.ts`](../../apps/api/src/routes/links.routes.ts) — `createLink`, cycle check in
[`apps/api/src/links/check-link-cycle.ts`](../../apps/api/src/links/check-link-cycle.ts); a plan's blocker rules in
[`apps/api/src/command/item/blockers.ts`](../../apps/api/src/command/item/blockers.ts)

## Request

Body:

```ts
{
  actorId: number;         // int — attributed on BOTH tickets' audit trails
  linkTypeKey: string;     // must be a live link type of the tickets' project
  sourceTicketId: number;  // internal ticket id
  targetTicketId: number;  // internal ticket id
  why?: string | null;     // why the link is there; required on a plan's blocker
}
```

## Response

`201 Created` — the link row:

```ts
{
  id: number;
  linkTypeId: number;
  sourceTicketId: number;
  targetTicketId: number;
  why: string | null;
  createdAt: string;
}
```

## Errors

| Status | When |
| ------ | ---- |
| `400` | Body fails validation; unknown/archived link type |
| `404` | Source or target ticket not found |
| `409` | Exact same link already exists |
| `422` | Self-link; tickets in different projects; the edge would close a cycle in a directional type; a plan blocker that breaks a rule above, or has no why |

## Database

- **Reads:** `tickets` (both endpoints), vocabulary tables (`link_types` via
  project vocab), `ticket_links` (duplicate check; full edge set of the link
  type for BFS cycle detection)
- **Writes** (one transaction): `ticket_links`, `ticket_events` — one
  `link-added` event **per endpoint ticket** (`{ linkId, linkTypeKey }`)

## Related

- [Delete link](delete-link.md) · [Create link type](create-link-type.md)
- MCP tool [`link_tickets`](../mcp/link-tickets.md) wraps this endpoint
