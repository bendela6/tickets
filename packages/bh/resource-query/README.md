# @bh/resource-query

React Query's hooks for the resource contract's routes, on
`@bh/resource/client`'s fetcher. A `ResourceProvider` gives them the client,
the registry the server runs with and who is viewing; each hook reads a
resource by its name or writes one:

| Hook                       | Route                                                              |
| -------------------------- | ------------------------------------------------------------------ |
| `useResourceMeta`          | `GET /meta`                                                        |
| `useResourceQuery`         | `POST /query`: one page, numbered or after a cursor, or its groups |
| `useResourceInfiniteQuery` | `POST /query` page after page, each after the last's cursor        |
| `useResourceRow`           | `GET /:id`                                                         |
| `useCreateRow`             | `POST`                                                             |
| `useUpdateRow`             | `PATCH /:id`                                                       |
| `useDeleteRow`             | `DELETE /:id?version=…`                                            |

A write answers the row after it. Its own entry in the cache becomes that
row, and every list of the resource the cache holds keeps it or drops it by
its query's filter and search, in its place by its query's order, without
asking the server again (`answerAfterWrite` and `pagesAfterWrite`, in
`@bh/resource/client`). Only what the client can't work out goes back to the
server: a grouped query's counts, and a list whose order it can't make here.

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { resourceClient } from '@bh/resource/client';
import { ResourceProvider, useResourceQuery } from '@bh/resource-query';

const api = resourceClient({ base: '/api' });

<QueryClientProvider client={new QueryClient()}>
  <ResourceProvider client={api} viewer={me.id}>
    <App />
  </ResourceProvider>
</QueryClientProvider>;

const open = useResourceQuery('items', {
  filter: { field: 'status.kind', op: 'in', value: ['todo', 'active'] },
});
```

Each read is also React Query's options (`resourceQueryOptions` and the
rest), so a route's loader prefetches what a hook then reads, and
`resourceKeys` names every key, so an app refreshes a resource's answers by
its prefix.

## Docs

The page is [`docs/hooks.md`](docs/INDEX.md), at `/resources/hooks` on the
docs site; the fetcher it builds on is `@bh/resource`'s
[client page](../../shared/resource/docs/client.md).

## Layer

It depends on `@bh/resource`, with React and `@tanstack/react-query` as
peers, and lives under `packages/web/` because `@bh/resource`, which servers
take too, imports no React. Its tests run the hooks against `@bh/source`'s
router serving resources in memory, so it takes `@bh/source` as a dev
dependency, and only the folder its tests share (`src/test/`) may import it;
the lint holds the rest to `@bh/resource`.
