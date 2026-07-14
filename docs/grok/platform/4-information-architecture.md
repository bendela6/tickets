# 4 — Information architecture & web routing

## Nav model

```text
App
├── Home                         list projects
├── Project                      project layout shell
│   ├── Views                    board/table per saved view
│   ├── Item                     detail (+ optional create)
│   ├── Search / All (optional)  cross-view item finder in project
│   └── Settings                 structure + project prefs
├── All projects items (optional)
├── Schema ERD (dev/admin)
└── Gallery (design system)
```

## URL design (target)

Stable, readable, shareable. Prefer **keys** for projects; **ids** for items/views (ids don’t change).

| URL | Screen |
| --- | ------ |
| `/` | Project list (home) |
| `/p/$projectKey` | Redirect → default view |
| `/p/$projectKey/views/$viewId` | View (board/table/list) |
| `/p/$projectKey/items/$itemId` | Item detail |
| `/p/$projectKey/items/new?type=$typeKey` | Create item |
| `/p/$projectKey/settings/*` | Settings segments |
| `/p/$projectKey/settings/types` | Item types |
| `/p/$projectKey/settings/fields` | Fields |
| `/p/$projectKey/settings/views` | Views admin |
| `/all` | Cross-project items (optional v1) |
| `/schema` | Live ERD |
| `/gallery` | Component gallery |

**Locked: full words only** (`items`, `views`, `settings`) — not `/i/` or `/v/`.

```text
/p/:projectKey
/p/:projectKey/views/:viewId
/p/:projectKey/items/:itemId
/p/:projectKey/items/new
/p/:projectKey/settings/...
```

**Rename pass:** same screens as today; replace ticket path segments with the above.

## Layouts (route tree)

```text
rootLayout
  index                          Home
  projectLayout                  /p/$projectKey
    projectIndex                 redirect default view
    viewPage                     views/$viewId
    itemPage                     items/$itemId
    itemNewPage                  items/new
    settingsLayout               settings
      settingsIndex
      settingsTypes
      settingsFields
      …
  allItemsPage                   /all
  schemaPage
  galleryPage
```

**Project layout chrome:** sidebar (views list, settings link), top bar (project switcher, user, search).

**Item page chrome:** header (key, type, workflow/option chips from fields), main fields, right or bottom: activity + links + children.

**View page chrome:** view tabs/switcher, filter bar, main grid/board, optional split preview of selected item (optional v2).

## State vs URL

| State | Lives in |
| ----- | -------- |
| Project, view, item identity | **URL** |
| Draft filters before save | local component state |
| Current user | context / localStorage |
| Board data | TanStack Query cache keyed by project/view |
| Optimistic edits | mutation lifecycle |

## Transitions

| From | To | Behavior |
| ---- | -- | -------- |
| View row click | Item page | navigate; optional `?from=viewId` for back |
| Item created | Item page | replace create URL |
| Project switch | Default view of new project | navigate |
| 404 item | Project default view + toast | |

## Mobile (later)

Same URLs; layouts stack (list → detail full screen). No separate route namespace.
