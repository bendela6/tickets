# Get item by key

`GET /api/items/by-key/:key`

One item by its key, in whichever project it is: a key is unique across every
project, so it names one item wherever it is written. The web's `/i/<key>`
sends an item's key on to its page this way.

**Source:** [`apps/api/src/routes/items.routes.ts`](../../apps/api/src/routes/items.routes.ts), read in
[`apps/api/src/read/item-by-key.ts`](../../apps/api/src/read/item-by-key.ts)

## Keys

An item's key is set once, when it is made, and never changes
([`apps/api/src/command/item/keys.ts`](../../apps/api/src/command/item/keys.ts)):

| Project | Item | Key |
| ------- | ---- | --- |
| numbered (any scheme without `plan`) | any | the prefix and the item's number: `TIX-90` |
| plan (its scheme's `config.plan` is `true`) | epic | the prefix, `/E` and the next epic number: `TK/E14` |
| plan | feature | the prefix and the next feature number in the project: `TK-80` |
| plan | ticket, subticket | its parent's key and the next number under it: `TK-80.3`, `TK-11.2.1` |

"Next" is one past the highest there is, taken under the project's row lock,
so racing creates never share one and a cancelled item's number is never
given again. A plan item never moves to another parent: it is cancelled and
written anew.

## Request

| Path param | Meaning |
| ---------- | ------- |
| `key` | The item's key. An epic's slash may be sent encoded (`TK%2FE14`) or as it is (`TK/E14`). |

## Response

`200 OK` — the item as the [board](get-board.md) assembles it, with its
project's key and its type's:

```ts
{
  id: number;
  number: number;              // its place in its project
  key: string;                 // TIX-90, TK/E14, TK-80.3
  projectKey: string;
  typeId: number;
  typeKey: string | null;
  parentId: number | null;
  createdBy: number;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;           // the optimistic-lock token
  values: Record<string, unknown>;  // field key → value
  comments: Comment[];
  links: ItemLink[];
}

type Comment = { id: number; itemId: number; authorId: number; parentId: number | null; body: string; createdAt: string };
type ItemLink = { id: number; linkTypeId: number; sourceItemId: number; targetItemId: number; createdAt: string };
```

## Errors

| Status | When |
| ------ | ---- |
| `404` | `no item <key>` |
