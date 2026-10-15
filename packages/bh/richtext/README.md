# @bh/richtext

Rich text, edited with Tiptap and stored as its JSON document. Two entries:

- **`@bh/richtext`**, the core. It imports no React, so a server converts and
  searches the same text the editor writes: the **features** an editor
  switches on (`PRESETS.full` for a document, `compact` for a comment), the
  Tiptap extensions and toolbar controls they make (`buildExtensions`,
  `toolbarControls`), the callout and mention nodes, markdown to a document
  and back (`markdownToDoc`, `docToMarkdown`), a document's plain text for
  search and excerpts (`docToText`), and telling a stored document from
  markdown (`parseDoc`, `toDisplayDoc`).
- **`@bh/richtext/editor`**, the editor, drawn with React: `RichTextEditor`.

Its look, `.rt`, is its own sheet, `@bh/richtext/prose.css`, which
`@bh/markdown`'s `Prose` wears too, so a text reads as it edits.

## The editor

`RichTextEditor` is a bh control (`ControlProps<string>`, as `Textarea` is):
it wears a field's floor, `tone` colours it (`danger` is `aria-invalid`),
`disabled` fades it and takes it out of the tab order, and `readOnly` shows
the text as a printed row that keeps its tab stop.

```tsx
import { RichTextEditor } from '@bh/richtext/editor';

<RichTextEditor
  label="Description"
  features="full"
  value={description}
  onChange={setDescription}
  placeholder="Add a description…"
/>;
```

Its `value` is text: a document as the editor writes it (its JSON, starting
`{"type":"doc"`), or markdown, which it reads as a document. Each edit comes
back through `onChange` as the document's JSON, and an editor holding nothing
gives `''`. A new `value` from the page replaces the document and isn't
reported as an edit; one the editor reported itself, even a late one, is its
own edit coming back. A document holding what the editor's features leave out
(a heading in a `compact` comment) loads as its plain text, rather than empty.

The editable area is a multi-line `textbox`, named by `label` or by the
element `labelledBy` points at; `id` and `aria-describedby` land on it. A
`<label htmlFor>` can't name it, since it's no form control.

Above the text sits its toolbar, the controls its features make, while the
text can be edited (not while disabled or read-only). A mark or a block is a
toggle, pressed while it is on at the selection; a command with several kinds
is a `Menu`: the text style (paragraph or a heading), the list, and "More
formatting", whose text colour and callout are submenus. The toolbar is one tab
stop, before the text; the arrow keys, Home and End move along it. A control
pressed with the pointer leaves the focus in the text; pressed with the keys,
it keeps it.

With the `link` feature, the toolbar's Link and ⌘K (Ctrl+K) open the link
popup, a `Popover` anchored at the selection, or at the whole link the caret is
in: Enter applies the address (`example.com` becomes `https://example.com`),
an empty one takes the link away, and with nothing selected the address goes
in as its own linked text. Escape closes it, and the focus goes back to the
text. While the caret sits in a link, a small popover under it shows where it
goes, with Edit and Remove, and leaves the focus in the text.

An app with nodes of its own hands the editor its rich text, `richText`
below. Make it once, outside the component: another one, or another feature
list, makes the editor again (from the text it holds).

An app imports `@bh/richtext/styles.css` after `@bh/ui/tokens.css`, so its
Tailwind builds the editor's classes; it brings the look, `.rt`, with it
(`@bh/markdown/styles.css` brings the look alone, for `Prose`). The look is
element by element and by the data attributes bh's nodes carry
(`data-callout`, `data-mention`); an app's own nodes bring their own rules, as
tickets does for its ticket reference's chip (`[data-ticket-ref]`).

## An app's own nodes

A chip naming one of the app's records is an `InlineNode`: its Tiptap
extension, the feature it comes with, how markdown writes it and the words it
stands for. The app makes its rich text once with them, and imports the
functions from there, so the editor, the markdown round trip and search all
know them:

```ts
import { createRichText, type InlineNode } from '@bh/richtext';

const ticketRef: InlineNode = {
  name: 'ticketRef',
  feature: 'mentions',
  extensions: (suggestion) => [TicketRef.configure({ suggestion: { char: '#', ...suggestion } })],
  markdown: {
    pattern: /(?<![\w#])#([A-Z][A-Z0-9]*-\d+)/,
    parse: (match) => ({ type: 'ticketRef', attrs: { id: null, label: match[1] ?? '' } }),
    serialize: (node) => `#${String(node.attrs?.['label'] ?? '')}`,
  },
};

// The editor takes it whole: <RichTextEditor richText={richText} … />.
export const richText = createRichText({ nodes: [ticketRef] });

export const {
  buildExtensions,
  markdownToDoc,
  docToMarkdown,
  docToText,
  isDocEmpty,
  toDisplayDoc,
} = richText;
```

The functions the package exports itself are the same with mentions alone.
Where the people to mention come from, and what a `#` looks up, stay the
app's: the editor's `suggestions`, below, or, outside it, its
`SuggestionHooks`, by node name, handed to `buildExtensions`.

## Suggestions

Typing an inline node's trigger opens a list at the caret, filled by the app:
`suggestions`, by the node's name (`mention` for `@`, the app's own by theirs).
A source's `items` takes what was typed after the trigger and gives the rows,
at once or as a promise (the list says it is looking meanwhile); a picked row
inserts the node's chip with its `id` and `label`, and any `attrs` beside them.
A node with no source opens no list, and the toolbar's `@` is there while the
app suggests people.

```tsx
<RichTextEditor
  richText={richText}
  suggestions={{
    mention: { label: 'People', items: (query) => people(query) },
    ticketRef: { label: 'Tickets', items: (query) => api.searchTickets(query) },
  }}
  slashCommands
  …
/>
```

Each row has a `label`, and may have a `description` after it and a `leading`
node before it (an avatar, a status dot). `/` opens the list of commands when
`slashCommands` is on: `true` for bh's own (`SLASH_COMMANDS`: text, headings,
lists, quote, code block, callout, collapsible section, image, divider), or the app's
list, which may spread bh's in. A command runs on Tiptap's `Editor`, and only
those whose `feature` the editor has are offered.

The focus stays in the text while a list is open: ↑ and ↓ move along it,
wrapping, Enter or Tab picks, and Escape closes it until the caret moves on.
The text points at the list and at the row under the cursor
(`aria-controls`, `aria-activedescendant`).

## Images

With the `image` feature, the app's `uploadImage` takes images in: it gets a
file and a `progress` callback (0 to 100), and resolves to the address the
image is shown from.

```tsx
<RichTextEditor
  features="full"
  uploadImage={(file, progress) => api.upload(file, { onProgress: progress })}
  …
/>
```

An image pasted, dropped, or picked with the toolbar's Image (or `/` Image)
goes up through it. While it does, a card in its place shows its name and
progress; the text around it can be edited, and the image goes in where its
place has moved to, leaving the caret where it is. A rejected upload leaves a
card saying it failed, with the error's message, Retry and Remove, and the
text untouched. With no `uploadImage`, nothing offers an image: no toolbar
button, no `/` Image, and a pasted or dropped image file goes nowhere.

## The composer

A comment box is the editor with `composer`: its toolbar moves to a row under
the text, beside a submit button and a ⌘↩ hint (`Kbd`), and ⌘↩ (Ctrl+Enter
elsewhere) sends the text rather than breaking the line.

```tsx
<RichTextEditor
  label="Comment"
  features="compact"
  value={draft}
  onChange={setDraft}
  composer={{
    onSubmit: (body) => post.mutate(body, { onSuccess: () => setDraft('') }),
    submitLabel: 'Comment',
    submitPending: post.isPending,
    submitDisabled: !signedIn,
  }}
/>
```

`onSubmit` gets the live document's JSON, read at the press, so it never waits
for the page to catch up; the page clears the box by setting `value` to `''`.
Nothing is sent while the text holds nothing, while `submitPending` or
`submitDisabled` (the button shows both), nor again on a held key's repeats:
once sent, the text goes again only after it changes or the page's pending
send is over. A read-only composer shows no row.

## Showing text

Text that is only read is drawn by `@bh/markdown`'s `Prose`, not by an
editor: it takes the stored value (a document, or markdown) and walks a
document itself, as plain React, so showing text never loads Tiptap. It draws
bh's nodes (a callout, a mention, an image) as the editor does, and an app's
own nodes with the renderers it hands it, by node name:

```tsx
import { Prose } from '@bh/markdown';

// Made once, outside the component, as the app's rich text is.
const NODES = { ticketRef: TicketChip };

<Prose nodes={NODES}>{comment.body}</Prose>;
```

## Docs

The guide is in [`docs/`](docs/INDEX.md): the overview, the core, the editor,
the toolbar, suggestions, images and the composer, each with its examples and
its types; `Prose`, which shows a document, is on `@bh/markdown`'s. Each page is
a `.doc.yaml` with its `.md` copy beside it; an app reads them in its copy of
the package, `packages/bh/richtext/docs/`. The docs site (`pnpm docs:dev` in
bh) shows them at `/richtext/overview`.

## Layer

The core needs no other bh package. It depends on Tiptap (`@tiptap/core`,
`pm`, `starter-kit`, `suggestion` and the extensions it switches on), and
imports no React, which a test holds it to. The editor entry sits on
`@bh/ui`, whose field it wears, and on `@tiptap/react`, with `react`,
`react-dom` and `tailwindcss` as peers; the lint lets only it import `ui`. The
core's tests run in Node and the editor's in jsdom; each has its own
TypeScript project (`tsconfig.json`, `src/editor/tsconfig.json`).
