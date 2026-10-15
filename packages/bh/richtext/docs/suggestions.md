---
title: Suggestions
summary: What @, an app's own trigger and / offer at the caret, filled by the
  app, picked with the keys.
order: 5
related: [RichTextEditor, The core, Combobox]
---

[//]: # 'written from suggestions.doc.yaml by pnpm docs:sync; edit that file, not this one'

# Suggestions

What `@`, an app's own trigger and `/` offer at the caret, filled by the
app, picked with the keys.

Typing an inline node's trigger opens a list at the caret. The app fills
it: `suggestions`, by the node's name, `mention` for `@` and its own
nodes by theirs. A pick inserts the node's chip. `/` opens the list of
commands when `slashCommands` is on.

## Examples

People to mention. A source's `items` takes what was typed after the
trigger and gives the rows; each has a `label`, and may have a
`description` after it and a `leading` node before it, an avatar here.

**People to mention**

```tsx
import { useState } from 'react';
import { Avatar } from '@bh/ui';
import { RichTextEditor, type SuggestionItem } from '@bh/richtext/editor';

const PEOPLE = [
  { id: 1, name: 'Ana Costa', handle: 'ana' },
  { id: 2, name: 'Rui Lima', handle: 'rui' },
  { id: 3, name: 'Inês Rocha', handle: 'ines' },
  { id: 4, name: 'Tomás Reis', handle: 'tomas' },
];

function people(query: string): SuggestionItem[] {
  const typed = query.toLowerCase();
  return PEOPLE.filter((person) => {
    return person.name.toLowerCase().includes(typed) || person.handle.startsWith(typed);
  }).map((person) => {
    return {
      id: person.id,
      label: person.name,
      description: `@${person.handle}`,
      leading: <Avatar name={person.name} size="xs" />,
    };
  });
}

export function PeopleToMention() {
  const [note, setNote] = useState('Type @ and a name: ');
  return (
    <RichTextEditor
      label="Note"
      features="compact"
      suggestions={{ mention: { label: 'People', items: people } }}
      value={note}
      onChange={setNote}
    />
  );
}
```

From the server: `items` may give a promise, and the list says it is
looking until it resolves. A `label` names the list, over it and to a
screen reader.

**From the server**

```tsx
import { useState } from 'react';
import { RichTextEditor, type SuggestionItem } from '@bh/richtext/editor';

const CITIES = ['Lisbon', 'Porto', 'Braga', 'Coimbra', 'Faro', 'Évora'];

// As a request would: the list says it is looking until this resolves.
function search(query: string): Promise<SuggestionItem[]> {
  const typed = query.toLowerCase();
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(
        CITIES.filter((city) => city.toLowerCase().startsWith(typed)).map((city) => {
          return {
            id: city,
            label: city,
          };
        }),
      );
    }, 600);
  });
}

export function FromTheServer() {
  const [note, setNote] = useState('');
  return (
    <RichTextEditor
      label="Itinerary"
      features="compact"
      suggestions={{ mention: { label: 'Cities', items: search } }}
      value={note}
      onChange={setNote}
      placeholder="Type @ to name a city…"
    />
  );
}
```

`slashCommands` set to `true` offers bh's own (`SLASH_COMMANDS`): text,
headings, lists, quote, code block, callout, collapsible section, image
and divider. Only those whose `feature` the editor has are offered, and
Image only with an upload.

**Slash commands**

```tsx
import { useState } from 'react';
import { RichTextEditor } from '@bh/richtext/editor';

export function SlashCommands() {
  const [page, setPage] = useState('');
  return (
    <RichTextEditor
      label="Page"
      features="full"
      slashCommands
      value={page}
      onChange={setPage}
      placeholder="Type / for a heading, a list, a callout…"
    />
  );
}
```

An app's own list, which may spread bh's in. A command runs on Tiptap's
`Editor` (from `@tiptap/react`, which `@bh/richtext/editor` exports as
a type), where the `/` and what was typed after it were.

**Commands of your own**

```tsx
import { useState } from 'react';
import { RichTextEditor, SLASH_COMMANDS, type SlashCommand } from '@bh/richtext/editor';

const TODAY: SlashCommand = {
  id: 'today',
  label: 'Today’s date',
  keywords: ['date', 'now'],
  run: (editor) => {
    editor.chain().focus().insertContent(new Date().toDateString()).run();
  },
};

const COMMANDS = [TODAY, ...SLASH_COMMANDS];

export function CommandsOfYourOwn() {
  const [journal, setJournal] = useState('');
  return (
    <RichTextEditor
      label="Journal"
      features="full"
      slashCommands={COMMANDS}
      value={journal}
      onChange={setJournal}
      placeholder="Type /today…"
    />
  );
}
```

## An app's own nodes

A node an app adds through `createRichText` (see
[the core](core.md)) suggests by its own name, with its own
trigger, `#` for a reference say. A node with no source opens no list,
and the toolbar's `@` is there only while the app suggests people.

```tsx
import { useState } from 'react';
import type { RichText } from '@bh/richtext';
import { RichTextEditor, type SuggestionItem } from '@bh/richtext/editor';

// The app's: its rich text with a `recipeRef` node, and where both lists come from.
declare const richText: RichText;
declare function people(query: string): SuggestionItem[];
declare const api: { searchRecipes: (query: string) => Promise<SuggestionItem[]> };

export function Method() {
  const [method, setMethod] = useState('');
  return (
    <RichTextEditor
      label="Method"
      richText={richText}
      suggestions={{
        mention: { label: 'People', items: (query) => people(query) },
        recipeRef: { label: 'Recipes', items: (query) => api.searchRecipes(query) },
      }}
      value={method}
      onChange={setMethod}
    />
  );
}
```

The picked row's `id` and `label` are the chip's, and its `attrs` go on
it beside them. Sources are read as they are typed, so a new object each
render needs no new editor.

## Keyboard and accessibility

The focus stays in the text while a list is open: ↑ and ↓ move along
it, wrapping, Enter or Tab picks, and Escape closes it until the caret
moves on. The text points at the list and at the row under the cursor,
as a combobox's input does (`aria-controls`, `aria-activedescendant`),
and the list is a `listbox` named by its source's `label`.

## Types

```ts
interface SuggestionSource
```

Where a trigger's suggestions come from: the app's.

| Member             | Type                                                                                 | Default | Description                                                                   |
| ------------------ | ------------------------------------------------------------------------------------ | ------- | ----------------------------------------------------------------------------- |
| `items` (required) | `(query: string) => readonly SuggestionItem[] \| Promise<readonly SuggestionItem[]>` |         | The items for what is typed after the trigger, as a list or a promise of one. |
| `label`            | `string`                                                                             |         | The list's name, shown over it and read out: "People".                        |

```ts
interface SuggestionItem
```

One row of a suggestion list: a person, one of the app's records.

| Member             | Type                       | Default | Description                                                 |
| ------------------ | -------------------------- | ------- | ----------------------------------------------------------- |
| `id` (required)    | `string \| number \| null` |         | Stored on the chip a pick inserts, as its `id`.             |
| `label` (required) | `string`                   |         | What the row says, and the chip's `label`.                  |
| `description`      | `string`                   |         | A quieter word after the label: a handle, a title.          |
| `leading`          | `ReactNode`                |         | Drawn before the label: an avatar, a status dot.            |
| `attrs`            | `Record<string, unknown>`  |         | More of the chip's attributes, beside its `id` and `label`. |

```ts
interface SlashCommand
```

A command in the `/` list.

| Member             | Type                                                                                                                                                                                       | Default | Description                                                           |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- | --------------------------------------------------------------------- |
| `id` (required)    | `string`                                                                                                                                                                                   |         | Its key in the list.                                                  |
| `label` (required) | `string`                                                                                                                                                                                   |         | What the row says.                                                    |
| `description`      | `string`                                                                                                                                                                                   |         | A quieter word after the label.                                       |
| `leading`          | `ReactNode`                                                                                                                                                                                |         | Drawn before the label.                                               |
| `keywords`         | `readonly string[]`                                                                                                                                                                        |         | More words it is found by: `h1` for Heading 1.                        |
| `feature`          | `Feature`: `'marks'`, `'link'`, `'headings'`, `'lists'`, `'taskList'`, `'blockquote'`, `'codeBlock'`, `'table'`, `'details'`, `'callout'`, `'align'`, `'image'`, `'mentions'`, `'divider'` |         | The feature it needs; an editor without it doesn't offer it.          |
| `run` (required)   | `(editor: Editor) => void`                                                                                                                                                                 |         | Runs it at the caret, where the `/` and what was typed after it were. |

```ts
const SLASH_COMMANDS: readonly SlashCommand[];
```

bh's own `/` commands, one or more for each feature that makes a block.

```ts
type Feature = …
```

What an editor can do, switched on one by one. Apps store lists of these
(a field's config), so a name never changes.

One of `'marks'`, `'link'`, `'headings'`, `'lists'`, `'taskList'`, `'blockquote'`, `'codeBlock'`, `'table'`, `'details'`, `'callout'`, `'align'`, `'image'`, `'mentions'`, `'divider'`.
