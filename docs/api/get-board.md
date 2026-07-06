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
  project: Project;
  users: User[];                    // ALL users — not project-scoped
  types: TicketType[];
  typeFields: {                     // which fields each type shows
    ticketTypeId: number;
    fieldId: number;
    position: number;
    required: boolean;
  }[];
  statuses: Status[];
  transitions: {                    // workflow edges scoped to this project
    id: number;
    fromStatusId: number | null;    // null = entry edge for new tickets
    toStatusId: number;
    ticketTypeId: number | null;    // null = applies to all types
    config: object;
  }[];
  fields: (Field & { options: FieldOption[] })[];
  linkTypes: LinkType[];
  views: View[];
  tickets: AssembledTicket[];       // defined below
}

// All named types are defined in the Types section at the bottom of this page.
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
  comments: Comment[];
  links: TicketLink[];
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

## Types

The row shapes referenced above, exactly as returned (timestamps are ISO
strings, `config` objects are free-form JSON):

```ts
type Project = {
  id: number;
  key: string;
  name: string;
  ticketPrefix: string;
  createdAt: string;
};

type User = {
  id: number;
  name: string;
  email: string | null;
  kind: 'human' | 'agent';
  archivedAt: string | null;
  createdAt: string;
};

type TicketType = {
  id: number;
  projectId: number;
  key: string;
  label: string;
  config: object;
  position: number;
  archivedAt: string | null;
  createdAt: string;
};

type Status = {
  id: number;
  projectId: number;
  key: string;
  label: string;
  kind: 'todo' | 'active' | 'blocked' | 'done' | 'dropped';
  config: object;
  position: number;
  archivedAt: string | null;
  createdAt: string;
};

type Field = {
  id: number;
  projectId: number;
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'boolean' | 'json' | 'select' | 'multi_select' | 'status';
  system: boolean;              // seeded, cannot be archived
  config: object;
  archivedAt: string | null;
  createdAt: string;
};

type FieldOption = {
  id: number;
  fieldId: number;
  value: string;                // what ticket values store
  label: string;                // what UIs display
  config: object;
  position: number;
  archivedAt: string | null;
};

type LinkType = {
  id: number;
  projectId: number;
  key: string;
  label: string;                // e.g. "blocks"
  inverseLabel: string;         // e.g. "is blocked by"
  directional: boolean;
  position: number;
  archivedAt: string | null;
};

type View = {
  id: number;
  projectId: number;
  name: string;
  config: object;               // { columns, sort, filters }
  position: number;
  archivedAt: string | null;
  createdAt: string;
};

type Comment = {
  id: number;
  ticketId: number;
  authorId: number;
  body: string;                 // markdown
  createdAt: string;
};

type TicketLink = {
  id: number;
  linkTypeId: number;
  sourceTicketId: number;
  targetTicketId: number;
  createdAt: string;
};
```

## Related

- [Export project](export-project.md) — this payload plus all events
- MCP tools [`get_board`](../mcp/get-board.md),
  [`get_ticket`](../mcp/get-ticket.md), and
  [`search_tickets`](../mcp/search-tickets.md) are all views over this endpoint
