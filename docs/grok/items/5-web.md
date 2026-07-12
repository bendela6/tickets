# 5 — Web layer

App: `apps/web`. Clean-slate naming: **item** in code; UI strings can say Ticket/Doc via type config.

## Routes (TanStack Router)

| Old path idea | New |
| ------------- | --- |
| `/` | home / project list |
| `/p/$projectKey` | project shell |
| `/p/$projectKey/v/$viewId` | board/view of **items** |
| `/p/$projectKey/items/$itemId` | item detail (was ticket page) |
| `/p/$projectKey/items/new` | create item |
| `/all` | all items (cross-project) |
| `/settings`, `/schema`, `/gallery` | unchanged roles |

Route files:

```text
apps/web/src/routes/
  item-page-route.tsx       # was ticket-page-route
  all-items-route.tsx       # was all-tickets-route
  view-route.tsx
  project-route.tsx
  …
```

## API client modules

```text
apps/web/src/api/
  types.ts                 # Item, ItemType, Board, …
  client.ts
  use-board.ts             # board.items
  use-item.ts              # optional single fetch
  use-create-item.ts
  use-patch-item.ts
  use-item-events.ts
  use-create-comment.ts
  use-create-link.ts
  use-delete-link.ts
  use-projects.ts
  use-views.ts
  …
```

### Types (sketch)

```ts
type Item = {
  id: number;
  projectId: number;
  number: number;
  typeId: number;
  typeKey: string;
  parentId: number | null;
  updatedAt: string;
  values: Record<string, unknown>;
  // …
};

type Board = {
  project: Project;
  itemTypes: ItemType[];
  fields: Field[];
  items: Item[];
  views: View[];
  // …
};
```

## Components

Rename by responsibility, not “ticket” unless UI-specific:

```text
components/
  item-detail/          # was ticket detail drawer/page pieces
  item-create/
  board/                # columns render Item rows
  all-items/
  …
```

Display helpers:

- `formatItemKey(project.ticketPrefix, item.number)` → still `TASK-42` (prefix is project’s; optional later `itemPrefix`)
- Type badge from `itemTypes` config (`Document` vs `Task`)

## State / hooks

- View config still references **field ids**
- Filters/sort operate on assembled item values
- Optimistic lock: send `expectedUpdatedAt: item.updatedAt`

## Project `ticketPrefix`

Column can stay `ticket_prefix` on projects (historical) or rename to **`item_prefix`** for consistency. Prefer **`item_prefix`** in clean slate; display “TASK-42” unchanged.

## Tests

- Smoke: board lists items  
- Item detail loads  
- No imports of `Ticket` type / `use-ticket*`  

## Copy vs code

| UI string | Code identifier |
| --------- | --------------- |
| “New ticket” (if type is task) | `CreateItemButton`, typeKey from picker |
| “All tickets” | route `all-items`, title from i18n/copy |
| Document type | same `ItemDetail` shell, different fields |
