# Rich Text Editor & Content System — Design

**Date:** 2026-07-22
**Status:** Approved (visual design pending in the Claude Design project)

## Goal

Replace the markdown write/preview editor and hand-rolled renderer with a
WYSIWYG rich text system across all three content surfaces — ticket
descriptions, comments, and rich-text custom fields — supporting content
richer than markdown: inline images/attachments, @user mentions, #ticket
refs, text styling (highlight, color, underline, strikethrough, alignment),
task lists, callouts, and collapsible sections.

## Decisions (locked)

| Decision | Choice |
|---|---|
| Editor library | **Tiptap v3** (`@tiptap/react` + official extensions) — headless, MIT, chosen over BlockNote/Lexical/Plate via comparison |
| Stored format | **Tiptap JSON doc serialized into the existing text columns** (`comments.body`, `item_values.value_text`) |
| Migration | **Lazy** — detect by shape; legacy markdown converts on display/edit, persists as JSON on first save. No schema or data migration |
| MCP boundary | Markdown default both ways, **plus optional raw doc JSON** via a `format` option |
| Editor UX | Single WYSIWYG surface, no write/preview tabs; visual spec from the Claude Design project |
| Attachments | **Postgres bytea** table + API endpoints |

## Architecture

### 1. Storage & format detection

- Canonical format: Tiptap JSON document (`{"type":"doc",...}`), stored as a
  serialized string in the same columns used today. No new columns.
- Detection rule (shared helper `isRichDoc(text)`): value starts with
  `{"type":"doc"` and parses as JSON → rich doc; otherwise legacy markdown.
- Legacy markdown is converted with `markdownToDoc` whenever displayed or
  loaded into the editor; the first save writes JSON. Old and new formats
  coexist indefinitely; migrated tickets' legacy-ID headings keep working.
- Field config: seed's description-style fields move to
  `config.format: 'rich'`; `'markdown'` remains a recognized alias mapping to
  the same widget.

### 2. `@tickets/richtext` (new workspace package)

Single source of truth for the document schema and all conversions. Used by
web, api, and mcp. Node-safe (no browser DOM assumption — server-side
conversion uses `@tiptap/html`-style generation).

- **Extension set (the schema):** StarterKit, TaskList/TaskItem, Details
  (collapsible), custom **Callout** node (`info | warning | success | danger`),
  Highlight, TextStyle + Color, Underline, TextAlign, Link, Image, and two
  Mention configurations — `@` → user mention node, `#` → **TicketRef** custom
  node (stores item id + display key, e.g. TIX-123).
- **Extension registry, built for custom additions.** The set is not a flat
  hardcoded array: each feature is a registry entry bundling its Tiptap
  extension(s), its `docToMarkdown` degradation rule, its `markdownToDoc`
  parse rule (if any), and its toolbar control descriptor. Adding a future
  custom node (embed, vote block, …) = one new entry; converters, editor,
  and view pick it up without consumer changes.
- **`buildExtensions(features)`** assembles a schema from a feature list —
  the same list the editor toolbar renders from (see §3).
- **`markdownToDoc(md): doc`** — markdown → Tiptap JSON. Covers the current
  renderer's subset (h1–h3, lists, tables, code fences, bold/italic/inline
  code, links) plus `- [ ]` task lists, `![](url)` images, and recognizes
  `#TIX-123` / `@name` patterns as chips where resolvable.
- **`docToMarkdown(doc): string`** — inverse; rich-only constructs degrade
  gracefully: callout → blockquote (`> **⚠ Warning:** …`), details →
  heading + body, ticket-ref → `#TIX-123`, mention → `@name`, styling marks
  (color/highlight/underline/align) → dropped, task list → `- [ ]` / `- [x]`.
- **`docToText(doc): string`** — plain-text extraction for search previews,
  activity snippets, and card excerpts.
- Round-trip guarantee: for the markdown subset, `docToMarkdown(markdownToDoc(md))`
  is stable (idempotent after one pass).

### 3. Web components (`apps/web`)

- **`RichTextEditor`** — replaces `MarkdownEditor` at all three call sites
  (`item-detail.tsx`, `detail-comments.tsx`, `registry/field-widget.tsx`).
  Same contract: `value`/`disabled`/`placeholder`/`onSave` (save on blur),
  where `value` may be markdown or serialized doc (detected).
- **Per-surface feature config:** the editor takes `features` — a preset
  (`'full'` | `'compact'`) or an explicit feature list — which drives both
  the loaded extensions and the rendered toolbar controls via the registry.
  Descriptions use `full`; the comment composer uses `compact` (marks,
  lists, code, link, mentions/refs, image — no headings/details/align);
  rich-text fields read an optional feature list from the field's `config`.
- **Superset rendering rule:** `RichTextView` always loads the *full*
  extension set, so any stored doc renders correctly even on surfaces whose
  editor has that feature disabled.
- **`RichTextView`** — read-only renderer from the same extension set
  (replaces `renderMarkdown` + `dangerouslySetInnerHTML`). Ticket-ref and
  mention chips are clickable links; task-list checkboxes are read-only in
  views, interactive in the editor.
- **Suggestions:** `@` queries the users list; `#` queries the existing
  ticket search endpoint; popover per the design-project spec.
- **Images:** paste/drop/toolbar → upload to the attachments API → insert
  image node with the returned URL; uploading/failed states per design.
- Styling: Instrument tokens only, no third-party editor theme. Visual
  details (toolbar composition, popovers, chips, callout variants) come from
  the Claude Design project iteration; sync via DesignSync.
- **Deletions when all three surfaces are ported:** `markdown-editor.tsx`,
  `render-markdown.ts`, their tests, and the `.md` CSS block.

### 4. Attachments (`apps/api` + `@tickets/db`)

- New table `attachments` (records schema): `id`, `filename`, `mime`,
  `size`, `data` (bytea), `created_at`. Item linkage is implicit via the doc
  that references it (no FK — attachments may be referenced from any doc).
- `POST /api/attachments` (multipart, images only initially, size cap
  ~10 MB) → `{ id, url }`; `GET /api/attachments/:id` streams bytes with
  `content-type` and long-lived cache headers.

### 5. MCP boundary (`apps/mcp`)

- Write tools (`create_ticket`, `update_ticket`, `add_comment`): accept
  markdown by default → `markdownToDoc` on write. Optional
  `format: 'rich'` accepts raw doc JSON for full fidelity.
- Read tools (`get_ticket`, `search_tickets`, …): return markdown via
  `docToMarkdown` by default; `format: 'rich'` returns the raw doc.
- Agents that never pass `format` see no behavior change.

## Error handling

- `markdownToDoc` never throws on arbitrary text — worst case yields
  paragraphs of plain text.
- A stored value that looks like a doc but fails to parse falls back to
  plain-text paragraph rendering (and logs via signals).
- Attachment upload failures surface in-editor (failed state, retry); the
  doc is not left with dangling placeholder nodes on cancel.
- `GET /api/attachments/:id` for a missing id → 404.

## Testing

- `@tickets/richtext`: round-trip stability over the markdown subset;
  degradation table for every rich-only construct; `docToText` extraction;
  malformed-input fuzz (never throws).
- Web: editor mounts with markdown and with doc JSON; save emits doc JSON;
  suggestion popovers query and insert chips; `RichTextView` renders chips
  as links; task checkbox interactivity (editable vs. read-only); feature
  config — a disabled feature's toolbar control is absent, and a doc using
  it still renders in `RichTextView`.
- API: attachment upload/download, mime/size validation, 404.
- MCP: markdown default round-trip through tools; `format: 'rich'`
  passthrough.

## Out of scope

- Real-time collaborative editing (Yjs).
- Non-image attachments (PDFs etc.) — table design permits later.
- One-shot bulk migration of existing markdown (lazy only).
- Markdown source-editing toggle in the web UI.
