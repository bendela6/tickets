# Get board

`GET /api/projects/:key/board`

The one-shot read the web app and MCP server are built on: the full project
vocabulary plus every ticket, assembled from the EAV rows into plain
`values` maps. There is no partial fetch — clients take the whole board and
work in memory.

**Source:** [`apps/api/src/routes/projects.routes.ts`](../../apps/api/src/routes/projects.routes.ts) — `getBoard`, assembly in
[`apps/api/src/tickets/assemble-tickets.ts`](../../apps/api/src/tickets/assemble-tickets.ts)

## Request

| Path param | Meaning |
| ---------- | ------- |
| `key` | Project key |

## Response

`200 OK`

```ts
{
  project: { id; key; name; ticketPrefix; createdAt };
  users: User[];                    // ALL users — not project-scoped
  types: TicketType[];              // { id, key, label, config, position, archivedAt, createdAt }
  typeFields: {                     // which fields each type shows
    ticketTypeId: number;
    fieldId: number;
    position: number;
    required: boolean;
  }[];
  statuses: Status[];               // { id, key, label, kind, config, position, ... }
  transitions: {                    // workflow edges scoped to this project
    id: number;
    fromStatusId: number | null;    // null = entry edge for new tickets
    toStatusId: number;
    ticketTypeId: number | null;    // null = applies to all types
    config: object;
  }[];
  fields: (Field & { options: FieldOption[] })[];
  linkTypes: LinkType[];            // { id, key, label, inverseLabel, directional, ... }
  views: View[];                    // { id, name, config, position, archivedAt, ... }
  tickets: AssembledTicket[];
}
```

Each assembled ticket:

```ts
{
  id: number;
  number: number;                   // display number within the project
  typeId: number;
  parentId: number | null;
  createdBy: number;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;                // pass back as expectedUpdatedAt when patching
  values: Record<string, unknown>;  // field key → rendered value:
                                    //   select → option value string
                                    //   multi_select → string[]
                                    //   status → status key
                                    //   text/number/date/boolean/json → the primitive
  comments: { id; authorId; body; createdAt }[];
  links: { id; linkTypeId; sourceTicketId; targetTicketId; createdAt }[];
}
```

Archived tickets, fields, and statuses are **included** — filtering is the
client's job.

## Errors

| Status | When |
| ------ | ---- |
| `404` | Unknown project key |

## Database

- **Reads:** `projects`, `ticket_types`, `statuses`, `status_transitions`,
  `fields`, `field_options`, `ticket_type_fields`, `link_types`, `views`,
  `tickets`, `ticket_values`, `comments`, `ticket_links`, `users`
- **Writes:** none

## Related

- [Export project](export-project.md) — this payload plus all events
- MCP tools [`get_board`](../mcp/get-board.md),
  [`get_ticket`](../mcp/get-ticket.md), and
  [`search_tickets`](../mcp/search-tickets.md) are all views over this endpoint
