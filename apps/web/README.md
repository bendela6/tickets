# @tickets/web

tickets' web app: project boards, item pages, project settings, the database schema and the
version history. React 19 with Vite, TanStack Router and Query, Tailwind v4 and tilewise's
components.

## Run it alone

```sh
pnpm --filter @tickets/web dev     # http://localhost:4610; the root's pnpm dev runs it on 4620
pnpm --filter @tickets/web test
pnpm --filter @tickets/web build   # into dist/
```

It needs [apps/api](../api/README.md) on 127.0.0.1:4600. The workspace setup is in the
[root README](../../README.md).

## Pages

| Address                       | Shows                                                                 |
| ----------------------------- | --------------------------------------------------------------------- |
| `/`                           | The projects.                                                         |
| `/all`                        | Every project's items in one list.                                    |
| `/p/<project>`                | Opens the project's first view.                                       |
| `/p/<project>/v/<view>`       | A view of the project's items, as a board or a table.                 |
| `/p/<project>/t/<key>`        | One item's page.                                                      |
| `/i/<key>`                    | Finds an item by its key alone and opens its page.                    |
| `/p/<project>/settings/<tab>` | The project's `types`, `fields`, `links`, `workflow` or `repository`. |
| `/schema`                     | A database's tables as a diagram; `?database=` picks which.           |
| `/version`                    | The app's version and its changes.                                    |

## Configuration

| Variable           | Default                 | What it is                         |
| ------------------ | ----------------------- | ---------------------------------- |
| `WEB_DEV_PORT`     | `4610`                  | The dev server's port.             |
| `API_PROXY_TARGET` | `http://127.0.0.1:4600` | Where the dev server sends `/api`. |

## Where things live

| Folder                    | Holds                                                 |
| ------------------------- | ----------------------------------------------------- |
| `src/routes`              | One file per page address.                            |
| `src/components`          | The screens and their parts.                          |
| `src/api`                 | The API client and a TanStack Query hook per request. |
| `src/registry`            | How each kind of field shows in a cell and is edited. |
| `src/domain`, `src/utils` | Logic with no UI: statuses, filters, keys, progress.  |
| `src/state`               | The current user and each view's saved settings.      |

## Depends on

[apps/api](../api/README.md) under `/api`, and tilewise's `@tilewise/ui`, `shell`, `table`,
`hooks` and `richtext` from npm.
