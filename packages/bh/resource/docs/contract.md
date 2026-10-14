---
title: The resource contract
summary: 'What every resource route of an app answers to: its metadata, its
  query, its writes, its actions and its errors, one shape for every resource.'
order: 1
---

[//]: # 'written from contract.doc.yaml by pnpm docs:sync; edit that file, not this one'

# The resource contract

What every resource route of an app answers to: its metadata, its query,
its writes, its actions and its errors, one shape for every resource.

`@bh/resource` holds the contract. A resource is one kind of row an app
serves (items, users, stacks), and its routes take and answer the same
shapes whatever the resource, so one client, one table, one board and one
form serve them all. Its metadata says what its fields are, so a screen
is built from it rather than written for it.

Servers and browsers share the package: it imports no React and no DOM,
and no database code, which each adapter keeps. Every shape is a valibot
schema first, with a type of the same name inferred from it, so the two
can't drift; JSON Schema and OpenAPI are made from the same schemas. Every
type this page names is defined under [Types](#types).

## Routes

A resource's routes sit under `/api/<resource>`, beside one route for the
jobs its long actions run. Every error, whatever the route, is an
`ErrorBody` ([Errors](#errors)); a write answers the whole row as it is
after it, so a client puts it in its cache without reading it again; and an
`Idempotency-Key` header (a uuid) makes a write or an action safe to
repeat: the same key answers the first answer again.

**Any resource**

**`GET /api/:resource/meta`** — Its metadata, ResourceMeta.

Which fields play a part in every row, each field's kind, format,
template and what a query and a write may do with it, the
resource's own sort, and its actions.

Responses:

| Status | Description                  |
| ------ | ---------------------------- |
| 200    | ResourceMeta.                |
| 404    | not_found, no such resource. |

**`POST /api/:resource/query`** — A page of rows, or the groups and their counts.

Every part of the body is optional: `{}` answers the first 100
rows in the resource's own sort. Checked against the metadata
first: an unknown field, an operator the field doesn't allow or a
value of the wrong kind answers `invalid`, with the path to each
problem.

Parameters:

| Name   | In   | Type    | Required | Description |
| ------ | ---- | ------- | -------- | ----------- |
| `body` | body | `Query` | yes      |             |

Responses:

| Status | Description                              |
| ------ | ---------------------------------------- |
| 200    | QueryResult.                             |
| 400    | invalid, with an issue for each problem. |

**`GET /api/:resource/:id`** — One row.

Parameters:

| Name | In   | Type | Required | Description |
| ---- | ---- | ---- | -------- | ----------- |
| `id` | path | `Id` | yes      |             |

Responses:

| Status | Description             |
| ------ | ----------------------- |
| 200    | Row.                    |
| 404    | not_found, no such row. |

**`POST /api/:resource`** — Creates a row.

Parameters:

| Name              | In     | Type     | Required | Description |
| ----------------- | ------ | -------- | -------- | ----------- |
| `body`            | body   | `Create` | yes      |             |
| `Idempotency-Key` | header | `uuid`   | no       |             |

Responses:

| Status | Description                                                                         |
| ------ | ----------------------------------------------------------------------------------- |
| 201    | The new row, a Row.                                                                 |
| 400    | invalid, a field it may not set, a required one missing, a value of the wrong kind. |
| 409    | conflict, a value that must be unique is taken.                                     |

**`PATCH /api/:resource/:id`** — Changes a row's values.

Parameters:

| Name              | In     | Type    | Required | Description |
| ----------------- | ------ | ------- | -------- | ----------- |
| `id`              | path   | `Id`    | yes      |             |
| `body`            | body   | `Patch` | yes      |             |
| `Idempotency-Key` | header | `uuid`  | no       |             |

Responses:

| Status | Description                                         |
| ------ | --------------------------------------------------- |
| 200    | The row as it is after it.                          |
| 400    | invalid.                                            |
| 404    | not_found.                                          |
| 409    | conflict, the version is stale; nothing is written. |

**`DELETE /api/:resource/:id`** — Deletes a row.

Parameters:

| Name              | In     | Type     | Required | Description                                                  |
| ----------------- | ------ | -------- | -------- | ------------------------------------------------------------ |
| `id`              | path   | `Id`     | yes      |                                                              |
| `version`         | query  | `string` | no       | The row's version as the client read it; DELETE has no body. |
| `Idempotency-Key` | header | `uuid`   | no       |                                                              |

Responses:

| Status | Description                                         |
| ------ | --------------------------------------------------- |
| 204    | Deleted.                                            |
| 404    | not_found.                                          |
| 409    | conflict, the version is stale; nothing is deleted. |

**`POST /api/:resource/:id/actions/:name`** — Runs an action on a row.

Parameters:

| Name              | In     | Type          | Required | Description |
| ----------------- | ------ | ------------- | -------- | ----------- |
| `body`            | body   | `ActionInput` | yes      |             |
| `Idempotency-Key` | header | `uuid`        | no       |             |

Responses:

| Status | Description                                                 |
| ------ | ----------------------------------------------------------- |
| 200    | The row as it is after it, for an action that runs at once. |
| 202    | The job to follow, { job }, for one that runs long.         |
| 400    | invalid, its input is wrong.                                |
| 404    | not_found, no such action or row.                           |

**`POST /api/:resource/actions/:name`** — Runs an action on the whole resource.

Parameters:

| Name              | In     | Type          | Required | Description |
| ----------------- | ------ | ------------- | -------- | ----------- |
| `body`            | body   | `ActionInput` | yes      |             |
| `Idempotency-Key` | header | `uuid`        | no       |             |

Responses:

| Status | Description                                         |
| ------ | --------------------------------------------------- |
| 204    | Done, for an action that runs at once.              |
| 202    | The job to follow, { job }, for one that runs long. |
| 400    | invalid.                                            |
| 404    | not_found, no such action.                          |

**`GET /api/jobs/:id`** — A long action's job, until it is done or failed.

Parameters:

| Name | In   | Type     | Required | Description |
| ---- | ---- | -------- | -------- | ----------- |
| `id` | path | `string` | yes      |             |

Responses:

| Status | Description                                                                         |
| ------ | ----------------------------------------------------------------------------------- |
| 200    | { job }, whatever its status: a failed job's failure is its own, not the request's. |
| 404    | not_found, no such job.                                                             |

## Metadata

`GET /api/<resource>/meta` answers a `ResourceMeta`: what a row is called,
one and many (`label`), so a screen says "New item" and "12 items"; which
field plays each part in every row (`roles`: the id, the title it reads
by, its picture, its version); its fields; its own sort; and its actions.

A field (`FieldMeta`) is one shape for every kind. Its `type` names its
kind, the settings that kind takes, and whether it holds a list. Its
`format` names a registered format that takes its kind. A `template` makes
it a field the server fills on every row from the row's other fields,
`'{project}-{number} {title}'`, and never writes. `query` says which
operators filter it and whether it sorts, groups and is searched, no more
than its kind allows; `write` says whether a create sets it, a patch
changes it, a create must set it, and what a create that leaves it out
gets.

tickets' items, shortened:

```json
{
  "resource": "items",
  "label": { "one": "Item", "other": "Items" },
  "roles": { "idField": "id", "titleField": "name", "versionField": "updatedAt" },
  "fields": [
    {
      "key": "id",
      "label": "Id",
      "type": { "kind": "number" },
      "query": { "filter": ["equals", "in"], "sort": true, "group": false, "search": false },
      "write": { "create": false, "update": false, "required": false }
    },
    {
      "key": "project",
      "label": "Project",
      "type": { "kind": "ref", "settings": { "of": "projects" } },
      "query": { "filter": ["equals", "in"], "sort": true, "group": true, "search": false },
      "write": { "create": true, "update": false, "required": true }
    },
    {
      "key": "number",
      "label": "Number",
      "type": { "kind": "number" },
      "query": { "filter": ["equals"], "sort": true, "group": false, "search": false },
      "write": { "create": false, "update": false, "required": false }
    },
    {
      "key": "title",
      "label": "Title",
      "type": { "kind": "text" },
      "query": {
        "filter": ["contains", "startsWith"],
        "sort": true,
        "group": false,
        "search": true
      },
      "write": { "create": true, "update": true, "required": true }
    },
    {
      "key": "name",
      "label": "Name",
      "type": { "kind": "text" },
      "template": "{project}-{number} {title}",
      "query": { "filter": [], "sort": false, "group": false, "search": true },
      "write": { "create": false, "update": false, "required": false }
    },
    {
      "key": "status",
      "label": "Status",
      "type": {
        "kind": "option",
        "settings": {
          "options": [
            {
              "value": "backlog",
              "label": "Backlog",
              "order": 0,
              "attributes": { "kind": "todo" }
            },
            {
              "value": "in-progress",
              "label": "In progress",
              "color": "blue",
              "order": 1,
              "attributes": { "kind": "active" }
            },
            {
              "value": "in-review",
              "label": "In review",
              "color": "violet",
              "order": 2,
              "attributes": { "kind": "active" }
            },
            {
              "value": "done",
              "label": "Done",
              "color": "success",
              "order": 3,
              "attributes": { "kind": "done" }
            },
            {
              "value": "wont-fix",
              "label": "Won't fix",
              "order": 4,
              "attributes": { "kind": "dropped" }
            }
          ],
          "attributes": [
            {
              "key": "kind",
              "label": "Group",
              "kind": "option",
              "options": [
                { "value": "todo", "label": "To do", "order": 0 },
                { "value": "active", "label": "Active", "order": 1 },
                { "value": "blocked", "label": "Blocked", "order": 2 },
                { "value": "done", "label": "Done", "order": 3 },
                { "value": "dropped", "label": "Dropped", "order": 4 }
              ]
            }
          ]
        }
      },
      "query": {
        "filter": ["equals", "notEquals", "in", "notIn", "empty"],
        "sort": true,
        "group": true,
        "search": false
      },
      "write": { "create": true, "update": true, "required": true, "default": "backlog" }
    },
    {
      "key": "assignee",
      "label": "Assignee",
      "type": { "kind": "ref", "settings": { "of": "users" } },
      "query": {
        "filter": ["equals", "in", "empty", "notEmpty", "isMe"],
        "sort": true,
        "group": true,
        "search": false
      },
      "write": { "create": true, "update": true, "required": false }
    },
    {
      "key": "parent",
      "label": "Parent",
      "type": { "kind": "ref", "settings": { "of": "items" } },
      "query": {
        "filter": ["equals", "empty", "notEmpty"],
        "sort": false,
        "group": false,
        "search": false
      },
      "write": { "create": true, "update": true, "required": false }
    },
    {
      "key": "updatedAt",
      "label": "Updated",
      "type": { "kind": "datetime" },
      "query": { "filter": ["gte", "lt", "inLast"], "sort": true, "group": false, "search": false },
      "write": { "create": false, "update": false, "required": false }
    }
  ],
  "sort": [{ "field": "updatedAt", "dir": "desc" }],
  "actions": []
}
```

A status's `kind` is an attribute: what its options carry besides a
label. A path names one, `status.kind`, and filters, sorts and groups like
a field of the attribute's kind, so `status.kind in [done]` holds for
every project's finished statuses, whatever each calls them.

## Kinds

A field's kind is a name in a registry, never one of a fixed list. bh
registers nine; an app registers its own beside them (a `KindSpec`: its
settings' and its value's schemas, the operators it allows, whether it
holds a list, sorts, groups and is searched), and a field of it is checked
as one of bh's is.

|          | holds a list | sorts | groups | searched | format     | settings                   |
| -------- | ------------ | ----- | ------ | -------- | ---------- | -------------------------- |
| text     | yes          | yes   | -      | yes      | `plain`    | -                          |
| url      | yes          | yes   | -      | yes      | -          | -                          |
| number   | -            | yes   | -      | -        | `number`   | -                          |
| boolean  | -            | yes   | yes    | -        | -          | -                          |
| date     | -            | yes   | -      | -        | `date`     | -                          |
| datetime | -            | yes   | -      | -        | `datetime` | -                          |
| option   | yes          | yes   | yes    | -        | -          | `{ options, attributes? }` |
| ref      | yes          | yes   | yes    | -        | -          | `{ of }`                   |
| json     | -            | -     | -      | -        | -          | -                          |

A field holding a list doesn't sort. Each kind's table below lists the
operators it allows, how a filter reads each on it, and what each
compares with; a field may allow fewer (`query.filter`). How each kind
orders is the contract's rule, the same in every adapter, and rows
without a value come last, both ways.

### text

Its value is a `string`. It orders alphabetically, case ignored.

| Operator     | Reads                              | Compares with                     |
| ------------ | ---------------------------------- | --------------------------------- |
| `equals`     | is                                 | one text; not on a list           |
| `notEquals`  | is not                             | one text; not on a list           |
| `in`         | is any of; on a list, has any of   | 1 to 100 texts                    |
| `notIn`      | is none of; on a list, has none of | 1 to 100 texts                    |
| `contains`   | contains                           | 1 to 200 characters, case ignored |
| `startsWith` | starts with                        | 1 to 200 characters, case ignored |
| `empty`      | is empty                           | nothing                           |
| `notEmpty`   | is not empty                       | nothing                           |

### url

Its value is a `string`: absolute, with its scheme (`https://…`), or a
path from the root (`/api/users/7/avatar`), which a client resolves against
the API's address; never `//host/…`, which names another host. It orders
alphabetically, case ignored.

| Operator     | Reads                              | Compares with                     |
| ------------ | ---------------------------------- | --------------------------------- |
| `equals`     | is                                 | one url; not on a list            |
| `notEquals`  | is not                             | one url; not on a list            |
| `in`         | is any of; on a list, has any of   | 1 to 100 urls                     |
| `notIn`      | is none of; on a list, has none of | 1 to 100 urls                     |
| `contains`   | contains                           | 1 to 200 characters, case ignored |
| `startsWith` | starts with                        | 1 to 200 characters, case ignored |
| `empty`      | is empty                           | nothing                           |
| `notEmpty`   | is not empty                       | nothing                           |

### number

Its value is a finite `number`. It orders by value.

| Operator    | Reads        | Compares with    |
| ----------- | ------------ | ---------------- |
| `equals`    | is           | one number       |
| `notEquals` | is not       | one number       |
| `in`        | is any of    | 1 to 100 numbers |
| `notIn`     | is none of   | 1 to 100 numbers |
| `lt`        | is less than | one number       |
| `lte`       | is at most   | one number       |
| `gt`        | is more than | one number       |
| `gte`       | is at least  | one number       |
| `empty`     | is empty     | nothing          |
| `notEmpty`  | is not empty | nothing          |

### boolean

Its value is `true` or `false`. It orders false, then true.

| Operator   | Reads        | Compares with |
| ---------- | ------------ | ------------- |
| `equals`   | is           | true or false |
| `empty`    | is empty     | nothing       |
| `notEmpty` | is not empty | nothing       |

### date

Its value is a day, `'2026-10-12'`: no time, no zone. It orders by day,
and compares by day.

| Operator    | Reads              | Compares with                     |
| ----------- | ------------------ | --------------------------------- |
| `equals`    | is                 | one day                           |
| `notEquals` | is not             | one day                           |
| `lt`        | is before          | one day                           |
| `lte`       | is on or before    | one day                           |
| `gt`        | is after           | one day                           |
| `gte`       | is on or after     | one day                           |
| `inLast`    | is in the last     | a whole number of days, 1 or more |
| `notInLast` | is not in the last | a whole number of days, 1 or more |
| `empty`     | is empty           | nothing                           |
| `notEmpty`  | is not empty       | nothing                           |

### datetime

Its value is ISO 8601 in UTC, `'2026-10-12T09:30:00.000Z'`. It orders by
instant, and compares by instant: a month is `gte` its first moment and
`lt` the next month's.

| Operator    | Reads              | Compares with                     |
| ----------- | ------------------ | --------------------------------- |
| `lt`        | is before          | one datetime                      |
| `lte`       | is on or before    | one datetime                      |
| `gt`        | is after           | one datetime                      |
| `gte`       | is on or after     | one datetime                      |
| `inLast`    | is in the last     | a whole number of days, 1 or more |
| `notInLast` | is not in the last | a whole number of days, 1 or more |
| `empty`     | is empty           | nothing                           |
| `notEmpty`  | is not empty       | nothing                           |

### option

Its value is one of the field's options' `value`s, archived ones too,
since rows still hold them. It orders by the option's `order`, never its
label, so "by status" is the workflow's order. Its settings are its
options and the attributes they carry.

| Operator    | Reads                              | Compares with             |
| ----------- | ---------------------------------- | ------------------------- |
| `equals`    | is                                 | one option; not on a list |
| `notEquals` | is not                             | one option; not on a list |
| `in`        | is any of; on a list, has any of   | 1 to 100 options          |
| `notIn`     | is none of; on a list, has none of | 1 to 100 options          |
| `empty`     | is empty                           | nothing                   |
| `notEmpty`  | is not empty                       | nothing                   |

### ref

Its value is the `Id` of a row of the resource its settings name,
`{ of: 'users' }`: a person is a ref to users, never a kind of its own. It
orders by the title of the row it points at, as the server builds it.

| Operator    | Reads                              | Compares with                        |
| ----------- | ---------------------------------- | ------------------------------------ |
| `equals`    | is                                 | one id; not on a list                |
| `notEquals` | is not                             | one id; not on a list                |
| `in`        | is any of; on a list, has any of   | 1 to 100 ids                         |
| `notIn`     | is none of; on a list, has none of | 1 to 100 ids                         |
| `empty`     | is empty                           | nothing                              |
| `notEmpty`  | is not empty                       | nothing                              |
| `isMe`      | is me                              | nothing: the person viewing the rows |

A ref to anything but people leaves `isMe` out of its field's
`query.filter`.

### json

Its value is any JSON. It doesn't sort, group or search.

| Operator   | Reads        | Compares with |
| ---------- | ------------ | ------------- |
| `empty`    | is empty     | nothing       |
| `notEmpty` | is not empty | nothing       |

## Operators

Operators are a registry too: bh registers fifteen, and an app registers
its own (an `OperatorSpec`: its words, its operand's schema, and
`matches`, whether a row's value passes in plain JavaScript), with its SQL
for each adapter it runs on. A kind names the operators it allows, and a
registry refuses, as it is built, a kind naming one nothing registered.

A filter reads an operator by its words for the field's kind, then for a
field holding a list, then by its label: `lt` on a date reads "is
before", `in` on a list "has any of", `in` on a status "is any of".

Their rules hold for `matches` and for each adapter's SQL alike:

- On a field holding a list, `in` holds when the row holds any of the
  values, `notIn` when it holds none of them, and `empty` when it holds
  none at all; `contains` and `startsWith` hold when one of its values
  does. `equals` and `notEquals` aren't offered there.
- `notEquals`, `notIn` and `notInLast` keep the rows that have no value:
  "status is not done" keeps the items without a status.
- `lt`, `lte`, `gt` and `gte` compare a number by value, a date by day
  and a datetime by instant; a row without a value passes none of them.
- `inLast` and `notInLast` count whole days back from now, by the
  database's clock in SQL and the browser's in `matches`, so a saved
  "last 7 days" view keeps rolling.
- Only null, or `[]` on a list, is empty: `''` and `0` are values.
- `isMe` holds when the row's value is the person viewing it, so a saved
  view's "Mine" means whoever opens it; with no one signed in, it holds
  for no row.

## The query

`POST /api/<resource>/query` takes a `Query` and answers a `QueryResult`:
which rows (`filter` and `search`), in which order (`sort`), which page,
grouped or not, and which fields each row carries. Every part is
optional.

A filter is data, never code: conditions (field, operator, value) joined
by `all`, `any` and `not`, so a view stores it as it is and the server
turns it into SQL. tickets' open items, assigned to whoever looks or to no
one:

```json
{
  "filter": {
    "all": [
      { "field": "project", "op": "equals", "value": "TIX" },
      { "not": { "field": "status.kind", "op": "in", "value": ["done", "dropped"] } },
      {
        "any": [
          { "field": "assignee", "op": "isMe" },
          { "field": "assignee", "op": "empty" }
        ]
      }
    ]
  },
  "search": "login",
  "sort": [{ "field": "status", "dir": "asc" }],
  "page": { "take": 50 }
}
```

- **search** keeps the rows where a field whose `query.search` is true
  contains the term (1 to 200 characters, case ignored), matched whole;
  the filter and the search both hold.
- **sort** names fields that sort, or an attribute's path; the
  resource's own when absent. The server adds the id last, so the order is
  total and the same query answers the same pages while nothing changes.
- **page** is numbered, `{ skip, take }`, or the one after a cursor,
  `{ cursor, take }`, never both; 100 rows when absent, at most 500.
  Every answer carries the next page's cursor (`page.next`, null on the
  last) and the total, numbered or not. A cursor is opaque, and good only
  for the query that made it.
- **group** answers the groups and their counts instead of rows: one
  field at a time, an option, ref or boolean field or an attribute's
  path. `all` also answers the groups no row holds, with 0. A group's rows
  load when it is opened, by the same query with the group's `filter`
  added. A row of a list counts in each value's group, so the counts can
  add up to more than the total.
- **fields** names the keys each row carries; the id and the fields
  `roles` names always come.

## Writes

`POST /api/<resource>` creates a row from a `Create`, `PATCH
/api/<resource>/:id` changes one by a `Patch`, and `DELETE
/api/<resource>/:id?version=…` deletes one. The values sit under `values`
so that a resource may have a field called `version`.

- A create sets only fields whose `write.create` is true, and every
  required one without a default; a patch changes only fields whose
  `write.update` is true. A key a patch leaves out keeps its value; null,
  or `[]` on a list, clears it, unless the field is required.
- `version` is the row's version as the client read it: the value of the
  field `roles.versionField` names, for items their `updatedAt`. If the row
  has changed since, the write answers 409 `conflict` and nothing is
  written, so the client can show the newer row instead of silently
  replacing it ([A stale write](#a-stale-write)). Without it, the last
  write wins. DELETE takes it in its URL, as it has no body.

## Actions and jobs

A resource's operations beyond create, update and delete (deploying a
stack, pausing a torrent, re-running a crawl) are its actions, listed in
its metadata as `ActionMeta`, so a screen offers each and builds its form
from its `input` fields, as for a create, without code of its own.

An action on a row is `POST /api/<resource>/:id/actions/<name>`, one on
the whole resource `POST /api/<resource>/actions/<name>`; each takes an
`ActionInput`, checked as a create's values. One that runs at once answers
the row as it is after it (200), or nothing (204) on the whole resource.
One that runs long (`long: true`) answers 202 with a `Job` to follow, and
`GET /api/jobs/:id` answers it again until it is done or failed. A job
that is done or failed stays so.

**Job**

Starts at `queued`. Ends at `done` or `failed`.

| From      | Event    | To        |
| --------- | -------- | --------- |
| `queued`  | `start`  | `running` |
| `running` | `finish` | `done`    |
| `running` | `fail`   | `failed`  |

A failed job carries its error in `ErrorBody`'s shape, so a client shows it as any other; a done one, for an action on a row, the row as it is after it.

```http
POST /api/stacks/media/actions/deploy   { "values": {} }
→ 202 { "job": { "id": "j-41", "status": "queued" } }

GET /api/jobs/j-41
→ 200 { "job": { "id": "j-41", "status": "running" } }

GET /api/jobs/j-41
→ 200 { "job": { "id": "j-41", "status": "done",
          "row": { "id": "media", "state": "running" } } }
```

## Errors

Every route answers its errors in one shape, whatever the status,
`ErrorBody`: `{ error: { code, message, issues? } }`. A client goes by the
code, never by the message.

| code        | status | when                                                            |
| ----------- | ------ | --------------------------------------------------------------- |
| `invalid`   | 400    | the body, a parameter or a cursor is wrong; `issues` says where |
| `not_found` | 404    | no such row, or no such resource                                |
| `conflict`  | 409    | the version is stale, or a value that must be unique is taken   |
| `internal`  | 500    | nothing the caller can fix; the message says no more            |

An app may add codes of its own (`unauthorized`, `forbidden`) and type
them in, `ErrorBody<ErrorCode | 'unauthorized'>`; a client that doesn't
know a code goes by the status. An invalid answer lists every problem at
once, each at its path in the body:

```json
{
  "error": {
    "code": "invalid",
    "message": "the query is invalid",
    "issues": [
      { "path": ["filter", "all", 1, "not", "value", 0], "message": "no option \"finished\"" },
      { "path": ["group", "field"], "message": "\"title\" can't be grouped" }
    ]
  }
}
```

## Worked examples

Three of tickets' screens, each one query or write against the items
above.

### A board

A board's columns are the groups of `status`, with `all`, so a status no
item holds still has its column, empty. It asks for no rows:

```json
{
  "filter": { "field": "project", "op": "equals", "value": "TIX" },
  "group": { "field": "status", "all": true }
}
```

```json
{
  "rows": [],
  "groups": [
    {
      "key": "backlog",
      "count": 9,
      "filter": { "field": "status", "op": "equals", "value": "backlog" }
    },
    {
      "key": "in-progress",
      "count": 3,
      "filter": { "field": "status", "op": "equals", "value": "in-progress" }
    },
    {
      "key": "in-review",
      "count": 0,
      "filter": { "field": "status", "op": "equals", "value": "in-review" }
    },
    {
      "key": "done",
      "count": 41,
      "filter": { "field": "status", "op": "equals", "value": "done" }
    },
    {
      "key": "wont-fix",
      "count": 2,
      "filter": { "field": "status", "op": "equals", "value": "wont-fix" }
    },
    { "key": null, "count": 1, "filter": { "field": "status", "op": "empty" } }
  ],
  "page": { "next": null, "total": 56 }
}
```

The groups come in the field's order, the options' `order`, and their
labels and colors come from the metadata. `in-review` holds no item and
comes back with 0 because the query asked for `all`. One item has no
status, so a `null` group holds it. Each column then loads its own rows,
by the same query with its group's `filter` added and `group` left out:

```json
{
  "filter": {
    "all": [
      { "field": "project", "op": "equals", "value": "TIX" },
      { "field": "status", "op": "equals", "value": "in-progress" }
    ]
  },
  "sort": [{ "field": "updatedAt", "dir": "desc" }],
  "page": { "take": 50 }
}
```

```json
{
  "rows": [
    {
      "id": 412,
      "project": "TIX",
      "number": 412,
      "title": "Fix the login redirect",
      "name": "TIX-412 Fix the login redirect",
      "status": "in-progress",
      "assignee": 7,
      "parent": null,
      "updatedAt": "2026-10-14T00:53:56.753Z"
    },
    {
      "id": 398,
      "project": "TIX",
      "number": 398,
      "title": "Keep the board's scroll on reload",
      "name": "TIX-398 Keep the board's scroll on reload",
      "status": "in-progress",
      "assignee": 3,
      "parent": 371,
      "updatedAt": "2026-10-13T16:20:04.118Z"
    },
    {
      "id": 377,
      "project": "TIX",
      "number": 377,
      "title": "Name a new view on Enter",
      "name": "TIX-377 Name a new view on Enter",
      "status": "in-progress",
      "assignee": null,
      "parent": null,
      "updatedAt": "2026-10-11T08:02:45.900Z"
    }
  ],
  "page": { "next": null, "total": 3 }
}
```

### Project stats

A project's stats count its top-level items by what their status means,
not by which status it is: the groups of the attribute's path,
`status.kind`, with `all`, so a kind no item is in still counts 0.

```json
{
  "filter": {
    "all": [
      { "field": "project", "op": "equals", "value": "TIX" },
      { "field": "parent", "op": "empty" }
    ]
  },
  "group": { "field": "status.kind", "all": true }
}
```

```json
{
  "rows": [],
  "groups": [
    {
      "key": "todo",
      "count": 7,
      "filter": { "field": "status.kind", "op": "equals", "value": "todo" }
    },
    {
      "key": "active",
      "count": 2,
      "filter": { "field": "status.kind", "op": "equals", "value": "active" }
    },
    {
      "key": "blocked",
      "count": 0,
      "filter": { "field": "status.kind", "op": "equals", "value": "blocked" }
    },
    {
      "key": "done",
      "count": 30,
      "filter": { "field": "status.kind", "op": "equals", "value": "done" }
    },
    {
      "key": "dropped",
      "count": 2,
      "filter": { "field": "status.kind", "op": "equals", "value": "dropped" }
    }
  ],
  "page": { "next": null, "total": 41 }
}
```

The groups are the attribute's options, in their order: in progress and
in review are both `active`, so they count together, and a project whose
statuses are named otherwise counts the same way. The page's total is the
project's item count, and its done share is 30 of 41.

### A stale write

Two people open item 412. One moves it to In review; the other, still
looking at the version they loaded, marks it done:

```json
{
  "values": { "status": "done" },
  "version": "2026-10-14T00:53:56.753Z"
}
```

```json
{
  "error": {
    "code": "conflict",
    "message": "item changed since you loaded it — refresh and retry"
  }
}
```

Nothing is written. The client reads the row again (`GET
/api/items/412`), shows it as it is now, in review with its new
`updatedAt`, and the person decides again. Writing done over it then
names the new version, and answers the whole row, which the client puts in
its cache:

```json
{
  "values": { "status": "done" },
  "version": "2026-10-14T01:02:11.004Z"
}
```

```json
{
  "id": 412,
  "project": "TIX",
  "number": 412,
  "title": "Fix the login redirect",
  "name": "TIX-412 Fix the login redirect",
  "status": "done",
  "assignee": 7,
  "parent": null,
  "updatedAt": "2026-10-14T01:04:37.250Z"
}
```

## Checking a resource

An app builds one `Registry` when it starts: bh's kinds and operators,
its own beside them, and the formats, which come with `@bh/template`
(this package registers none). It is checked as it is built, so a
misspelt operator fails at start, not in a query. Each check below is the
shape's schema with one check after it, which reports every problem at
its own path:

- `metaOf(registry)`: each field's kind and format registered; its
  settings by its kind's schema; its list, query and default no more than
  its kind allows; a template only on a text or url field, over the row's
  other fields, never written; each key and action once, `roles` naming
  fields, the sort on fields that sort. A ref's `of` names a resource the
  server serves: the server checks that when it starts, once it knows
  every resource.
- `queryOf(meta, registry)`: each field or path there and allowing its
  operator, sort or group; each operand by its operator's schema for the
  field's kind; a field to search; `fields` naming keys.
- `createOf`, `patchOf` and `actionInputOf`: the fields a write may set,
  each value of its kind, every required one there and never cleared.
- `rowOf(meta, registry)`: each key a field, each value of its kind.

`matchesFilter` says whether a row passes a filter by each operator's
`matches`, so a client keeps or drops a row it just wrote from a list it
holds. `jsonSchemaOf` makes a schema's JSON Schema, and `openApiOf` a
resource's routes as an OpenAPI 3.1 document, from the same schemas.

```ts
import * as v from 'valibot';
import {
  createRegistry,
  issuesOf,
  matchesFilter,
  metaOf,
  openApiOf,
  queryOf,
  type ErrorBody,
  type Filter,
  type ResourceMeta,
  type Row,
} from '@bh/resource';

const registry = createRegistry();

/** A resource's query route, and its OpenAPI document. */
export function serve(declared: ResourceMeta) {
  // At start: metadata the registry can't serve stops the server.
  const meta = v.parse(metaOf(registry), declared);
  const query = queryOf(meta, registry);
  return {
    openApi: openApiOf(meta, '/api'),
    check(body: unknown) {
      const result = v.safeParse(query, body);
      if (result.success) {
        return { status: 200, query: result.output };
      }
      const error: ErrorBody = {
        error: {
          code: 'invalid',
          message: 'the query is invalid',
          issues: issuesOf(result.issues),
        },
      };
      return { status: 400, error };
    },
  };
}

/** In the browser: whether a row just written still belongs in a list. */
export function stays(filter: Filter, row: Row, meta: ResourceMeta, me: number) {
  return matchesFilter(filter, row, meta, registry, me);
}
```

## Types

Every type above, as the package exports it. Each shape is also a valibot
schema of the same name (`Query`, `Filter`, `ResourceMeta`…), which
`v.parse` checks a body against.

### Values

```ts
/** One value: text, a finite number, or a boolean. */
export type Scalar = string | number | boolean;

/** Any JSON value: its numbers finite, its objects of string keys. */
export type Json = null | Scalar | Json[] | { [key: string]: Json };

/** A row's id, as its table has it: a string that isn't empty, or a whole number. */
export type Id = string | number;

/** A field's value: its kind's, null when unset; on a list field, a list of them, [] when unset. */
export type FieldValue = null | Scalar | Scalar[] | Json;

/** A row: its fields' values by key; a key the query's `fields` left out is absent. */
export type Row = Record<string, FieldValue>;
```

### Fields and roles

```ts
import type { ActionMeta, FieldValue, Json, Scalar, Sort } from '@bh/resource';

/** GET /api/<resource>/meta */
export interface ResourceMeta {
  /** 'items': its path segment after /api/, a word. */
  resource: string;
  /** What a row is called, one and many: { one: 'Item', other: 'Items' }. */
  label: { one: string; other: string };
  /** Which field plays each part in every row. */
  roles: ResourceRoles;
  /** In the order a form or a table shows them at first. */
  fields: FieldMeta[];
  /** The order of a query that names none. */
  sort: Sort[];
  /** Its operations beyond create, update and delete; [] → none. */
  actions: ActionMeta[];
}

/** The fields that play a part in every row, each by its key. */
export interface ResourceRoles {
  idField: string;
  /** The field a row reads by in one line: a link, a picker, a group. */
  titleField: string;
  /** A url field holding its picture; none → no picture. */
  imageField?: string;
  /** The field a write's `version` is checked against; none → the last write wins. */
  versionField?: string;
}

/** A field, of any kind. */
export interface FieldMeta {
  /** 'status': unique in its resource, without a dot. */
  key: string;
  label: string;
  type: FieldType;
  /** A registered format that takes its kind; its kind's default when absent. */
  format?: FieldFormat;
  /** The server fills it on every row from the row's other fields; never written. */
  template?: Template;
  query: FieldQuery;
  write: FieldWrite;
}

/** What a field holds: a value of its kind, or a list of them. */
export interface FieldType {
  kind: FieldKind;
  /** What its kind takes: an option field's options, a ref's resource (KindSettings). */
  settings?: Record<string, Json>;
  /** Holds a list, where its kind allows it. */
  many?: true;
}

/** A registered kind's name: one of bh's nine (BaseKind) or an app's own. */
export type FieldKind = string;

/** A registered format, by name or with options: 'bytes', { name: 'money', options: {…} }. */
export type FieldFormat = string | { name: string; options: Record<string, Json> };

/**
 * Text with field paths in braces, '{project}-{number} {title}'; '{{' and '}}' are a
 * brace. A placeholder shows its value as text, URL-encoded in a url field.
 */
export type Template = string;

/** What a query may do with a field: no more than its kind allows. */
export interface FieldQuery {
  /** The operators it allows; [] → not filterable. */
  filter: Operator[];
  sort: boolean;
  group: boolean;
  search: boolean;
}

/** A registered operator's name: one of bh's fifteen or an app's own. */
export type Operator = string;

/** What a write may do with a field. */
export interface FieldWrite {
  create: boolean;
  update: boolean;
  /** A create must set it (unless it has a default), and a patch can't clear it. */
  required: boolean;
  /** What a create that leaves it out gets. */
  default?: FieldValue;
}

/** The settings of bh's kinds that take any. */
export interface KindSettings {
  option: { options: OptionMeta[]; attributes?: AttributeMeta[] };
  /** The resource its ids are rows of: 'users'. */
  ref: { of: string };
}

/** One of an option field's options. */
export interface OptionMeta {
  /** What a row holds and a filter names: 'in-progress'. */
  value: string;
  label: string;
  /** A bh tone: 'blue', 'success'. */
  color?: string;
  /** Its place in the list; sorting and grouping follow it. */
  order: number;
  /** Shown on the rows that hold it, offered for no new value. */
  archived?: true;
  /** By AttributeMeta key: { kind: 'active' }. */
  attributes?: Record<string, Scalar | null>;
}

/** What an option field's options carry besides a label; a path names one: 'status.kind'. */
export type AttributeMeta =
  | { key: string; label: string; kind: 'text' | 'number' | 'boolean' }
  | { key: string; label: string; kind: 'option'; options: OptionMeta[] };
```

### Kinds, operators and formats

```ts
import type * as v from 'valibot';
import type { FieldKind, FieldType, Id, Json, Operator, Scalar } from '@bh/resource';

/** A registered kind. */
export interface KindSpec {
  /** 'option' */
  name: string;
  /** Its settings' schema; none → it takes none. */
  settings?: v.GenericSchema;
  /** One value's schema, given a field's settings. */
  value: (settings?: Record<string, Json>) => v.GenericSchema;
  /** A field of it may hold a list. */
  many: boolean;
  /** The most a field of it may allow: registered operators by name. */
  operators: Operator[];
  sort: boolean;
  group: boolean;
  search: boolean;
  /** The format a field of it gets when it names none. */
  format?: string;
}

/** A registered operator. */
export interface OperatorSpec {
  /** 'in' */
  name: string;
  /** How a filter reads it: 'is any of'. */
  label: string;
  /** Its words on a kind, { kinds: { date: 'is before' } }, or a list, { many: 'has any of' }. */
  labels?: { kinds?: Record<FieldKind, string>; many?: string };
  /** Its operand's schema, given the field's value schema; none → it takes no operand. */
  operand?: (value: v.GenericSchema) => v.GenericSchema;
  /** Whether a row's value passes; `viewer` is the signed-in user's id, for isMe. */
  matches: (
    value: Scalar | Scalar[] | null,
    operand?: Scalar | Scalar[],
    viewer?: Scalar,
  ) => boolean;
}

/** A registered format: the kinds it takes and its options' schema. */
export interface FormatSpec {
  /** 'money' */
  name: string;
  kinds: FieldKind[];
  options?: v.GenericSchema;
}

/** The value of each of bh's kinds. */
export interface KindValue {
  text: string;
  url: string;
  number: number;
  boolean: boolean;
  date: string;
  datetime: string;
  option: string;
  ref: Id;
  json: Json;
}

/** bh's nine kinds' names. */
export type BaseKind = keyof KindValue;

/** What an app runs with: bh's kinds and operators, its own, and the formats it passes in. */
export interface Registry<Format extends FormatSpec = FormatSpec> {
  readonly kinds: readonly KindSpec[];
  readonly formats: readonly Format[];
  readonly operators: readonly OperatorSpec[];
}

/** What createRegistry takes: an app's own, each beside bh's. */
export interface RegistryEntries<Format extends FormatSpec = FormatSpec> {
  kinds?: readonly KindSpec[];
  formats?: readonly Format[];
  operators?: readonly OperatorSpec[];
}

/** How a filter reads an operator on a field of this type. */
export declare function operatorLabel(
  spec: OperatorSpec,
  type: Pick<FieldType, 'kind' | 'many'>,
): string;
```

### Query

```ts
import type { Row, Scalar } from '@bh/resource';

/** POST /api/<resource>/query: the body. */
export interface Query {
  filter?: Filter;
  /** 1 to 200 characters, matched whole, case ignored. */
  search?: string;
  /** The resource's own when absent. */
  sort?: Sort[];
  /** The first 100 rows when absent. */
  page?: Page;
  /** Groups and their counts instead of rows. */
  group?: GroupBy;
  /** The keys each row carries; every field when absent. */
  fields?: string[];
}

/** Which rows: conditions joined by all, any and not. */
export type Filter =
  // every one holds; { all: [] } keeps every row
  | { all: Filter[] }
  // at least one holds; { any: [] } keeps none
  | { any: Filter[] }
  | { not: Filter }
  | Condition;

/** One field, one operator, and what it compares with. */
export interface Condition {
  field: FieldPath;
  /** One the field allows: a registered operator's name. */
  op: string;
  /** Absent for an operator that takes none: empty, notEmpty, isMe. */
  value?: Scalar | Scalar[];
}

/** A field's key, or an option field's key, a dot and one of its attributes: 'status.kind'. */
export type FieldPath = string;

/** One key of an order. */
export interface Sort {
  field: FieldPath;
  dir: 'asc' | 'desc';
}

/** Numbered, by skip and take, or the one after a cursor; never both. take: 1 to 500. */
export type Page = { skip?: number; take?: number } | { cursor: string; take?: number };

/** What a query groups by: an option, ref or boolean field, or an attribute's path. */
export interface GroupBy {
  field: FieldPath;
  /** asc when absent */
  dir?: 'asc' | 'desc';
  /** Also the groups no row holds, with count 0. */
  all?: boolean;
}

/** POST /api/<resource>/query: the answer. */
export interface QueryResult {
  /** [] when the query grouped. */
  rows: Row[];
  groups?: Group[];
  page: PageResult;
}

/** One group of a grouped answer. */
export interface Group {
  /** The value its rows hold; null for the rows that hold none. */
  key: Scalar | null;
  count: number;
  /** What picks its rows, to add to the query when it is opened. */
  filter: Filter;
}

/** Where an answered page sits. */
export interface PageResult {
  /** The next page's cursor; null on the last page. */
  next: string | null;
  /** Every row the filter and search keep, on every page. */
  total: number;
}
```

### Creates and patches

```ts
import type { FieldValue } from '@bh/resource';

/** POST's body: the new row's values, by field key. */
export interface Create {
  values: Record<string, FieldValue>;
}

/** PATCH's body: the values that change; null, or [] on a list, clears one. */
export interface Patch {
  values: Record<string, FieldValue>;
  /** The row's version as the client read it; a stale one answers 409 conflict. */
  version?: string;
}
```

### Actions, inputs and jobs

```ts
import type { ErrorBody, ErrorCode, FieldMeta, FieldValue, Row } from '@bh/resource';

/** One of a resource's actions, as its metadata lists it. */
export interface ActionMeta {
  /** 'deploy': its path segment after /actions/, a word. */
  name: string;
  label: string;
  /** One row, or the whole resource. */
  on: 'row' | 'resource';
  /** What it takes, as fields, so a form is built from them; [] → nothing. */
  input: FieldMeta[];
  /** It runs long, and answers a Job to follow. */
  long: boolean;
}

/** An action's body: its input's values, by field key. */
export interface ActionInput {
  values: Record<string, FieldValue>;
}

/** What an action answers: the row (200), or the job to follow (202). */
export type ActionResult<Code extends string = ErrorCode> = Row | { job: Job<Code> };

/** A long action's run: queued, then running, then done or failed. */
export type Job<Code extends string = ErrorCode> =
  | { id: string; status: 'queued' | 'running' }
  | { id: string; status: 'done'; row?: Row }
  | { id: string; status: 'failed'; error: ErrorBody<Code>['error'] };

/** Where a job is. */
export type JobStatus = Job['status'];
```

### Error bodies

```ts
import type * as v from 'valibot';

/** Every error's body, whatever its status. */
export interface ErrorBody<Code extends string = ErrorCode> {
  error: {
    code: Code;
    /** For people: 'item changed since you loaded it — refresh and retry'. */
    message: string;
    /** An invalid answer's: one per problem. */
    issues?: Issue[];
  };
}

/** The codes bh's routes answer: 400, 404, 409 and 500. */
export type ErrorCode = 'invalid' | 'not_found' | 'conflict' | 'internal';

/** One problem with an invalid request. */
export interface Issue {
  /** Where in the body, by keys and indexes: ['filter', 'all', 1, 'value']. */
  path: (string | number)[];
  message: string;
}

/** valibot's issues as an invalid answer's, each path flattened to keys and indexes. */
export declare function issuesOf(issues: readonly v.BaseIssue<unknown>[]): Issue[];
```

### Checks, OpenAPI and the registry

```ts
import type * as v from 'valibot';
import type {
  ActionInput,
  ActionMeta,
  Create,
  Filter,
  FormatSpec,
  JsonSchema,
  KindSpec,
  OpenAPIV3_1,
  OperatorSpec,
  Patch,
  Query,
  Registry,
  RegistryEntries,
  ResourceMeta,
  Row,
  Scalar,
} from '@bh/resource';

/** bh's nine kinds and fifteen operators, in their order. */
export declare const baseKinds: readonly KindSpec[];
export declare const baseOperators: readonly OperatorSpec[];

/** The registry an app runs with, checked as it is built. */
export declare function createRegistry<Format extends FormatSpec = FormatSpec>(
  entries?: RegistryEntries<Format>,
): Registry<Format>;

type Schema<T> = v.GenericSchema<T>;

export declare function metaOf(registry: Registry): Schema<ResourceMeta>;
export declare function queryOf(meta: ResourceMeta, registry: Registry): Schema<Query>;
export declare function createOf(meta: ResourceMeta, registry: Registry): Schema<Create>;
export declare function patchOf(meta: ResourceMeta, registry: Registry): Schema<Patch>;
export declare function actionInputOf(action: ActionMeta, registry: Registry): Schema<ActionInput>;
export declare function rowOf(meta: ResourceMeta, registry: Registry): Schema<Row>;

/** Whether a row passes a filter; `viewer`, the signed-in user's id, for isMe. */
export declare function matchesFilter(
  filter: Filter,
  row: Row,
  meta: ResourceMeta,
  registry: Registry,
  viewer?: Scalar,
): boolean;

/** A schema's input as JSON Schema (draft-07), Filter and Json as a $ref to themselves. */
export declare function jsonSchemaOf(schema: v.GenericSchema): JsonSchema;

/** A resource's routes as an OpenAPI 3.1 document, under basePath ('/api'). */
export declare function openApiOf(meta: ResourceMeta, basePath: string): OpenAPIV3_1.Document;
```

Three come from the libraries the contract builds on: `v.GenericSchema<T>`
and `v.BaseIssue` are valibot's, a schema whose value is a `T` and one
problem it found; `JsonSchema` is `@valibot/to-json-schema`'s, a JSON
Schema object; and `OpenAPIV3_1.Document` is `openapi-types`', an OpenAPI
3.1 document. `@bh/resource` exports the last two's types too.
