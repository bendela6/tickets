# 7 — Web application

## Role

SPA that implements journeys in [3-user-journeys.md](3-user-journeys.md) against the API.
No business invariants only in the client.

## Tech

- React 19 + Vite
- TanStack Router (file or code routes matching IA)
- TanStack Query
- Instrument design system / existing UI kit under `src/ui`

## Source layout

```text
apps/web/src/
  main.tsx
  app.tsx
  router.ts
  styles/
  api/                         # HTTP + query hooks
    client.ts
    types.ts
    keys.ts                    # queryKey factory
    hooks/
      use-projects.ts
      use-board.ts
      use-item.ts
      use-create-item.ts
      use-patch-item.ts
      use-item-events.ts
      use-views.ts
      use-structure.ts
      …
  routes/                      # one module per URL segment tree
    root-route.tsx
    home-route.tsx
    project/
      project-layout-route.tsx
      view-route.tsx
      item-route.tsx
      item-new-route.tsx
      settings/
        …
    all-items-route.tsx
    schema-route.tsx
    gallery-route.tsx
  features/                    # UI by capability (not by legacy ticket name)
    shell/                     # app chrome, nav, project switcher
    home/
    board/                     # view renderers: table, board, list
    item-detail/
    item-create/
    activity/
    links/
    comments/
    settings/
      types/
      fields/
      views/
    schema-erd/
  ui/                          # design-system primitives
  lib/                         # markdown, formatItemRef, …
  state/                       # current user context only (minimal global)
  test/
```

**Rule:** `features/*` compose `ui/*` and `api/hooks/*`. Routes only wire features to URLs.

## Data flow

```text
Route param (projectKey, viewId, itemId)
  → useQuery(board/item/structure)
  → Feature views
  → useMutation(patch) → invalidate keys
```

Query keys (example):

```ts
keys.projects.all
keys.project(key).board
keys.project(key).structure
keys.item(id)
keys.item(id).events
```

## Board rendering

1. Load structure + items (or view-scoped items).
2. Resolve columns from view config (field ids).
3. Cell renderer by field type (registry `getCellContent` / field widgets).
4. Row navigate to item route.

## Item detail

- Header: `item_prefix-number`, type chip, archive
- Field editors by type
- Tabs or sections: comments, links, children, activity
- Save: patch with `expectedUpdatedAt`

## Settings

Separate sub-routes; load structure endpoints; mutations for attach field / options.

## Auth UX

Current-user picker in shell → all mutations include `actorId`.

## Testing

- Route smoke tests
- Feature tests with mocked API
- No dependency on old `ticket-*` filenames
