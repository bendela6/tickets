# @bh/resource

The resource contract: what every resource endpoint of an app answers to, and
the metadata that describes its fields. Servers and browsers share it, so it
imports no React and no DOM, only valibot and its JSON Schema converter;
that's why it sits under
`packages/shared/`, beside `@bh/config`, as items-core keeps its wire
contracts.

So far it holds the metadata, `GET /api/<resource>/meta` → `ResourceMeta`:
which fields play a part in every row (`roles`: the id, the title, the
picture, the version), and per field (`FieldMeta`) its key and label; its type
(its kind, the settings that kind takes, whether it holds a list); its format;
a template, for a field the server fills from the row's other fields; and
what a query and a write may do with it (`query`, and `write`, which holds its
default). It holds the query, `POST /api/<resource>/query`: a `Query` in, a
`QueryResult` out; the writes, `Create` and `Patch`; the actions, with the
jobs a long one answers; and the one shape of every error, `ErrorBody`.

Every shape is a valibot schema first, and a type of the same name inferred
from it (`v.InferOutput`), so the two can't drift: `ResourceMeta`, `Query`,
`QueryResult`, `Filter`, `Create`, `Patch`, `ErrorBody`, `ActionMeta`, `Job`
and the parts they're made of. One import gives both:

```ts
import * as v from 'valibot';
import { Query } from '@bh/resource';

const query: Query = v.parse(Query, body); // the type, and the schema that checks it
```

These check a body's shape for any resource. Where TypeScript can't infer a
type (`Filter` and `Json` hold themselves; `ErrorBody`, `Job` and
`ActionResult` take an app's codes), the type is written by hand and a test
holds it equal to its schema's.

## Kinds

A field's kind is a name in a registry, not one of a fixed list. bh registers
nine (`baseKinds`): text, url, number, boolean, date, datetime, option, ref
and json. Each is a `KindSpec`: its settings' valibot schema (only option and
ref take any), its value's schema given a field's settings, whether a field of
it may hold a list, the operators it allows (registered ones, by name), and
whether it sorts, groups and is searched.

|          | many | sort | group | search | format   |
| -------- | ---- | ---- | ----- | ------ | -------- |
| text     | yes  | yes  | -     | yes    | plain    |
| url      | yes  | yes  | -     | yes    | -        |
| number   | -    | yes  | -     | -      | number   |
| boolean  | -    | yes  | yes   | -      | -        |
| date     | -    | yes  | -     | -      | date     |
| datetime | -    | yes  | -     | -      | datetime |
| option   | yes  | yes  | yes   | -      | -        |
| ref      | yes  | yes  | yes   | -      | -        |
| json     | -    | -    | -     | -      | -        |

They are a registry (`@bh/registry`): an app registers its own beside them,
which gives a new registry and leaves bh's as they are, and looks every kind
up by name there:

```ts
import * as v from 'valibot';
import { baseKinds, type KindSpec } from '@bh/resource';

const color: KindSpec = {
  name: 'color',
  value: () => v.pipe(v.string(), v.hexColor()),
  many: false,
  operators: ['equals', 'notEquals', 'in', 'notIn', 'empty', 'notEmpty'],
  sort: false,
  group: true,
  search: false,
};

export const kinds = baseKinds.register({ color });

kinds.get('option').value({ options: [{ value: 'todo', label: 'To do', order: 0 }] });
```

`get` throws for a kind nothing registered; `has` asks first. A kind named as
one taken already throws, so none is replaced unseen, and so does one without
a word for its name, a value schema, or with an operator named twice
(`kindData`). A kind allowing an operator nothing registered throws when the
registry is built (`createRegistry`), so a misspelt name fails at start, not
in a query. bh's own are frozen.

## Operators

A filter's operators are a registry too. bh registers fifteen
(`baseOperators`), entries like an app's own: equals, notEquals, in, notIn,
contains, startsWith, lt, lte, gt, gte, inLast, notInLast, empty, notEmpty
and isMe. Each is an `OperatorSpec`: its name; its label (`'is any of'`), and
its `labels` where that doesn't fit, on a kind or on a field holding a list;
its operand's valibot schema given the field's value schema (`in` takes 1 to
100 values, `inLast` a number of days, `empty` none); and `matches(value,
operand, viewer)`, whether a row's value passes, in plain JavaScript,
`viewer` being the signed-in user's id. Each database adapter keeps its SQL
for it, by the same rules:

- On a many field, `in` holds when the row holds any of the values, `notIn`
  when it holds none of them, `empty` when it holds none at all, and
  `contains` and `startsWith` when one of its values does.
- `notEquals`, `notIn` and `notInLast` keep the rows that have no value.
- `contains` and `startsWith` ignore case.
- The ranges compare a number by value, a date by day and a datetime by
  instant; a row without a value passes none of them.
- `inLast` and `notInLast` count days back from now, by the database's clock
  in SQL and the browser's in `matches`, so a saved "last 7 days" keeps
  rolling: a datetime from the moment 7 days ago, a date from that moment's
  day.
- Only null, or [] on a many field, is empty.
- `isMe` holds when the row's value is the person viewing it, so a saved
  view's "Mine" means whoever opens it; with no one signed in, for no row.

Each kind names the operators it allows in its own entry:

| kind      | operators                                                               |
| --------- | ----------------------------------------------------------------------- |
| text, url | equals, notEquals, in, notIn, contains, startsWith, empty, notEmpty     |
| number    | equals, notEquals, in, notIn, lt, lte, gt, gte, empty, notEmpty         |
| date      | equals, notEquals, lt, lte, gt, gte, inLast, notInLast, empty, notEmpty |
| datetime  | lt, lte, gt, gte, inLast, notInLast, empty, notEmpty                    |
| boolean   | equals, empty, notEmpty                                                 |
| option    | equals, notEquals, in, notIn, empty, notEmpty                           |
| ref       | equals, notEquals, in, notIn, empty, notEmpty, isMe                     |
| json      | empty, notEmpty                                                         |

A ref to anything but people leaves `isMe` out of its field's `query.filter`.
`operatorLabel(spec, type)` reads an operator as a filter shows it: a kind's
words first (`lt` on a date is "is before"), then a list's (`in` on a many
field is "has any of"), then its label.

An app registers its own operators beside bh's, as it does its kinds (`color`
as above):

```ts
import * as v from 'valibot';
import { baseKinds, baseOperators, type OperatorSpec } from '@bh/resource';

const between: OperatorSpec = {
  name: 'between',
  label: 'is between',
  operand: (value) => v.tuple([value, value]),
  // a number between two, both included: [low, high]
  matches: (a, b) =>
    Array.isArray(b) && typeof a === 'number' && Number(b[0]) <= a && a <= Number(b[1]),
};

export const operators = baseOperators.register({ between });
export const kinds = baseKinds.register({ color });
```

An operator named as one taken already throws, and so does one without a
word for its name, a label that says something, or its `matches`
(`operatorData`).

## The query

`POST /api/<resource>/query` takes a `Query`, every part of it optional: `{}`
answers the first page of every row, in the resource's own sort.

- `filter`: a tree of conditions, joined by `all`, `any` and `not`; each
  condition a field's path, a registered operator its field allows, and the
  value its operand schema takes (none for `empty`). A filter is data, never
  code, so a view stores it as it is. A path is a field's key, or an option
  field's key, a dot and one of its attributes (`status.kind`), one level
  deep: it reaches what an option means rather than which option it is.
- `sort`: `[{field, dir}]`, by fields whose `query.sort` is true or
  attributes' paths; the resource's own (`ResourceMeta.sort`) when absent. How
  each kind orders is the contract's rule, the same in every adapter: text and
  url alphabetically, case ignored; number, date and datetime by value;
  boolean false, then true; an option by its `order`, never its label; a ref
  by the title of the row it points at; json and many fields don't sort. Rows
  without a value come last, both ways, and the id breaks ties, so the order
  is total.
- `search`: 1 to 200 characters, kept where a field whose `query.search` is
  true contains it, case ignored. The term is matched whole: "login fix"
  doesn't find "fix login".
- `page`: numbered, by `skip` and `take`, or the one after a `cursor`; two
  shapes that never mix. `take` is 1 to 500, 100 when absent.
- `group`: groups and their counts instead of rows, by an option, ref or
  boolean field or an attribute's path, in the field's order; `all` asks for
  the groups no row holds too, with count 0, as a board's empty columns. A
  group's rows load when it opens, by the same query with the group's
  `filter` added.
- `fields`: the keys each row carries; every field when absent. The id and
  the fields `roles` names always come, so a row can be named.

It answers a `QueryResult`: the page's `rows` (none when it grouped), its
`groups` when it grouped, and `page: {next, total}`, the next page's cursor
(null on the last) and every row the filter and search keep, on every page,
numbered or not. A cursor is opaque, and good only for the query that made
it.

One project's open items, most urgent first:

```json
{
  "filter": {
    "all": [
      { "field": "project", "op": "equals", "value": "TIX" },
      { "field": "status.kind", "op": "in", "value": ["todo", "active", "blocked"] }
    ]
  },
  "sort": [{ "field": "priority", "dir": "asc" }],
  "page": { "take": 100 }
}
```

## Writes

```http
GET    /api/<resource>/:id                   → 200 Row
POST   /api/<resource>             Create    → 201 Row
PATCH  /api/<resource>/:id         Patch     → 200 Row
DELETE /api/<resource>/:id?version=…         → 204
```

A `Create` holds the new row's values under `values`: fields a create may
set, and every required one without a default. A `Patch` holds the values
that change (a key left out keeps its value; null, or [] on a many field,
clears it) and, optionally, the `version` the client read: the value of the
field `roles.versionField` names, an item's `updatedAt`. If the row changed
since, the write answers 409 `conflict` and nothing is written; without it,
the last write wins. DELETE takes its version in the URL.

A write answers the whole row after it, so a client caches it without
reading it again; an `Idempotency-Key` header (a uuid) makes it safe to
repeat. It's checked like a query: a field it may not set, a required one
missing or a value of the wrong kind answers `invalid`.

## Actions

A resource's operations beyond create, update and delete (deploying a stack,
pausing a torrent, re-running a crawl) take one shape too:

```http
POST /api/<resource>/:id/actions/<name>   ActionInput → ActionResult   on a row
POST /api/<resource>/actions/<name>       ActionInput → ActionResult   on the resource
GET  /api/jobs/:id                                    → { job: Job }   one that runs long
```

`ResourceMeta.actions` lists each as an `ActionMeta`: its `name` (its path
segment) and `label`; `on`, a row or the whole resource; its `input`, as
`FieldMeta`s, so a form is built from them as for a create; and `long`,
whether it runs long. Its body, `ActionInput`, holds the input's values
under `values`, as a create's are.

| it runs | on a row              | on the resource |
| ------- | --------------------- | --------------- |
| at once | 200, the row after it | 204, no body    |
| long    | 202, `{job}`          | 202, `{job}`    |

A `Job` is queued, then running, then done or failed, and stays so once
done or failed. `GET /api/jobs/:id` answers 200 `{job}` whatever its status,
since a job's failure is its own, not the request's; 404 `not_found` for a
job there isn't. A done job carries the row after it, for an action on a
row; a failed one its `error`, in `ErrorBody`'s shape. Its input is checked
like a write's, its errors are `ErrorBody`s, and an `Idempotency-Key` makes
it safe to repeat.

## Errors

Every route answers its errors in one shape, whatever the status,
`ErrorBody`: `{error: {code, message, issues?}}`. A client goes by `code`,
never by the message.

| code        | status | when                                                            |
| ----------- | ------ | --------------------------------------------------------------- |
| `invalid`   | 400    | the body, a parameter or a cursor is wrong; `issues` says where |
| `not_found` | 404    | no such row, or no such resource                                |
| `conflict`  | 409    | the version is stale, or a value that must be unique is taken   |
| `internal`  | 500    | nothing the caller can fix; the message says no more            |

An app may add codes (`unauthorized`, `forbidden`) and type them in,
`ErrorBody<ErrorCode | 'unauthorized'>`; a client that doesn't know a code
goes by the status. An invalid answer's `issues` are valibot's, one per
problem, each path flattened to keys and indexes by `issuesOf`:

```ts
const result = v.safeParse(schema, body);
if (!result.success) {
  reply.status(400).send({
    error: { code: 'invalid', message: 'the query is invalid', issues: issuesOf(result.issues) },
  } satisfies ErrorBody);
}
// issues: [{ path: ['filter', 'all', 1, 'value'], message: 'no option "doing"' }]
```

## Checked against a resource

An app builds one `Registry` at start: the kinds, the operators and the
formats, each a registry, bh's kinds and operators when it leaves them out.
`createRegistry` checks them against each other as it builds it, so a
misspelt operator or a format for a kind nothing registered fails at start,
not in a query. bh's formats come with `@bh/template` (`baseFormats`), which
builds on this package, so this one registers none: an app passes them in
(`baseFormats.register({ rate })`), its own beside them, and gets them back
typed as it gave them (`Registry<Format extends FormatSpec>`).

```ts
import * as v from 'valibot';
import { createRegistry, metaOf, queryOf } from '@bh/resource';

export const registry = createRegistry({ kinds, operators, formats });

v.parse(metaOf(registry), items); // at start: throws on metadata the registry can't serve
const query = v.safeParse(queryOf(items, registry), body); // on each request
```

Each check is the shape's schema with one check after it, which reports
every problem at once, each at its own path:

- `metaOf(registry)`: each field's kind and format registered; its settings
  by its kind's schema; its `many`, its query and its default no more than
  its kind allows; a format that takes its kind, with options its schema
  takes; a template only on a text or url field, over the row's other fields,
  never looping back, and never written. Each key and action name once,
  `roles` naming fields (the picture a url one), the sort on fields that sort,
  and each action's input checked as the fields are. A ref field's `of` must
  name a resource the server serves: the server checks that when it starts,
  once it knows every resource's metadata.
- `queryOf(meta, registry)`: each field or path there and allowing its
  operator, sort or group; each operator registered, each operand by its
  schema for the field's kind; a field to search; `fields` naming keys.
- `createOf(meta, registry)`: creatable fields only, each value of its kind;
  every required one without a default, never null or [].
- `patchOf(meta, registry)`: updatable fields only, each value of its kind; a
  required one never cleared.
- `actionInputOf(action, registry)`: an action's input against its fields, as
  a create's values.
- `rowOf(meta, registry)`: each key a field, each value of its kind; null when
  unset, [] on a many field.

`matchesFilter(filter, row, meta, registry, viewer?)` says whether a row
passes a filter, by each operator's `matches`: a client keeps or drops a row
it just wrote from a list it holds, a template shows a part while its `when`
holds, and the adapters' tests compare their SQL with it. It takes the
metadata to read a path through an option's attributes (`status.kind`), and
reads a path one key into an object value (`services.name`, inside a
template's `repeat`); `viewer` is the signed-in user's id, for `isMe`.
`matchesSearch(term, row, meta, registry)` says whether a query's `search`
keeps a row, by the same rule as the server: a searched field holds the
term, case ignored, read by its kind's `searchText`.

`rowOrder(sort, meta, registry, { titleOf })` is the contract's order as a
comparator of rows: each key by its kind's `compare`, an attribute's path by
its attribute's, a ref by the title of the row it points at (`titleOf`), rows
without a value last both ways, then the id (a number by value, text by code
point, as the adapters break a tie). It answers undefined for a sort it can't
order here: a kind without `compare`, or a ref without `titleOf`.

## The client

`@bh/resource/client`, an entry of its own beside the contract, holds what a
client of the routes needs, with no React and no DOM, so a browser and a
server calling another app's API take the same one:

- `resourceClient({ base, fetch, headers })`: a typed fetcher for the routes,
  `meta`, `query`, `read`, `create`, `update` and `delete`, each write with an
  `Idempotency-Key` (a fresh uuid, or the one given). Every error answer
  throws a `ResourceRequestError`: its status, and its ErrorBody's `code`,
  `message` and `issues`; a code from the status when the body isn't one.
- What a list the client holds does with a row it just wrote, without asking
  the server again: `answerAfterWrite` and `answerAfterDelete` for one page,
  `pagesAfterWrite` and `pagesAfterDelete` for the pages a cursor brought.
  The list keeps or drops the row by its query's filter and search
  (`keepsRow`), puts a kept one in its place by its order (`rowOrder`), and
  moves its total by what entered or left. They answer undefined where the
  client can't tell (a grouped answer's counts, an order it can't make here),
  and the caller asks the server again.

`@bh/resource-query` builds React Query's hooks on it.

## JSON Schema and OpenAPI

Made from the valibot schemas, so they can't drift, as items-core's
`to-fastify-schema` makes its routes':

- `jsonSchemaOf(schema)`: a schema's input as JSON Schema (draft-07), through
  `@valibot/to-json-schema`, typed by its `JsonSchema`. `Filter` and `Json`,
  which hold themselves, come out as a `$ref` to their own definition, and
  `$defs` holds only what the schema refers to.
- `openApiOf(meta, basePath)`: a resource's routes as an OpenAPI 3.1
  document: its metadata, query, read, create, patch and delete, each action,
  and `GET <basePath>/jobs/{id}` when one runs long; each with its body, its
  answer and `ErrorBody` at the statuses it may fail with, an
  `Idempotency-Key` header on the writes and actions, and `version` on DELETE
  when the resource keeps one. Every shape is a component, the same for every
  resource: what a field holds is the metadata's to say, at `GET /meta`.

A check JSON Schema can't say (a date's day, a url's host, what metaOf and
queryOf check) is left out of both; the server still runs it, and answers
`invalid`.

## Docs

Two pages on the docs site: [The resource contract](docs/contract.md)
(`/resources/contract`): the routes, every type, a table per kind, the errors,
the actions and jobs, and three worked examples from tickets; and [The
client](docs/client.md) (`/resources/client`): the fetcher, its errors, and
what a held list does with a written row. Each source is a `.doc.yaml` beside
it; `pnpm docs:sync` writes the markdown copies.

## Layer

It needs no other bh package. It depends on valibot, on
`@valibot/to-json-schema` for JSON Schema, and on `openapi-types` for the
OpenAPI document's types. A test holds the main entry to importing those
alone, and the client's (`@bh/resource/client`) to valibot alone, the
platform's `fetch`, `Headers` and `crypto` beside it; its tests run in Node.
