# 3 — User journeys (whole process)

Each journey is a **process**: actors, steps, API calls, data written. Implement UI and MCP to satisfy these, not random screens.

---

## J1 — Enter workspace

1. Open app → list **projects** (name, key, item counts optional).
2. Pick project → land on **default view** (first view by position, or scheme default).
3. Shell shows: project switcher, nav (Views, Items, Settings), current user.

**API:** `GET /api/projects` → `GET /api/projects/:key/board` (or split vocab + items queries).

---

## J2 — Browse a view (board / table / list)

1. Select a **view** (saved config: filters, columns, sort, layout).
2. See **items** matching filters (all types or type-filtered).
3. Change filter/sort → may patch view or use local draft (product choice: v1 = patch view or ephemeral).
4. Click row → **item detail** (route change or split pane).

**API:** board payload includes `views`, `items`, structure vocab.  
**Perf:** filter server-side when item volume grows; v1 may filter client-side on full project set.

---

## J3 — Create item

1. “New” → pick **type** (task / bug / document / …).
2. Form = fields attached to type (required enforced).
3. Optional parent (if type allows).
4. Submit → item number assigned → open detail or stay on board.

**API:** `POST /api/projects/:key/items`  
**Events:** `item.created` + N × `item.field_changed` (same `correlationId`).

---

## J4 — Edit item

1. Open item (`/p/:project/i/:id` or equivalent).
2. Edit fields inline or form; optional parent; archive.
3. Save / autosave with **optimistic lock** (`expectedUpdatedAt`).
4. Conflict 409 → reload and retry.
5. Activity panel shows field diffs grouped by correlation.

**API:** `PATCH /api/items/:id`  
**Events:** `item.field_changed` / `item.reparented` / `item.archived` …

---

## J5 — Comment and react

1. On item, write comment (thread optional).
2. React with emoji.
3. Activity + comment list update.

**API:** comment/reaction endpoints  
**Events:** `item.comment_*`, `item.reaction_*`

---

## J6 — Link items

1. From item A, add link type + target B.
2. Both items show the edge (directional labels).
3. Remove link from either side.

**API:** create/delete link  
**Events:** `item.link_added` / `removed` on **both** streams.

---

## J7 — Hierarchy (sub-items)

1. Create child with `parentId` or “Add sub-item” on parent.
2. Parent detail lists children; board may indent or filter `parentId`.
3. Reparent via patch.

**Domain:** `checkParent` + child-type graph.

---

## J8 — Configure structure (settings)

1. Settings → scheme / types / fields / workflow / link types (scope: project’s scheme).
2. Attach field to types; reorder; options.
3. Changes affect forms and boards immediately.

**API:** vocabulary + scheme routes  
**Events (later):** `field.*`, `item_type.*` audit stream.

---

## J9 — Agent assists

1. Agent lists projects / board / search.
2. Creates or updates items, comments, links with same validation.
3. Lists item events for context.

**Surface:** MCP tools = thin wrappers over API.

---

## J10 — Automation (later slice)

1. Rule: when `item.field_changed` on workflow field to Done → comment or webhook.
2. Outbox delivers event → rule engine → command path as agent actor.

---

## Process principles

| Principle | Application |
| --------- | ------------- |
| Single write pipeline | UI and MCP never bypass validation |
| Correlation | One user save = one command = many events |
| Read models | Board DTO assembled for UI; not raw EAV dumps |
| Deep links | Every primary object has a URL (project, view, item) |
