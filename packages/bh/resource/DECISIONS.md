# Kinds: decisions

2026-10-14. What a field's kind is, what changed in the contract, and how
a source serves it.

## Made (in the working tree, tests green)

- **Markdown and rich text are kinds, not only text formats.** A format only
  changes how a value shows; these need their own input, their own checks
  and their own search. A rich text's value is its Tiptap JSON, as text. Each
  kind's default format is the text format of its own name, `markdown` and
  `rich` (@bh/template, TK-79.4), which write the words of the text.
- **Six new kinds**: markdown, richtext, email, phone (E.164), time
  (`HH:mm`, no zone), file (`{ url, name, size, type }`). bh registers
  fifteen.
- **Every kind may hold a list.** On a list, the ranges and `inLast` hold
  when one value does, and `notInLast` when none does. A list still doesn't
  sort, and still isn't filtered by `equals`. boolean and date gain `in` and
  `notIn`, so a list of them can be filtered. An app's own kind may still say
  `many: false`.
- **Settings**: number takes `min`, `max`, `integer`; text takes `maxLength`
  (code points) and `pattern` (the whole value matches it). Both optional.
- **No `timestamp` kind**: `datetime` is one, an instant in UTC.
- **option and ref stay two kinds.** An option is a closed list carried in
  the metadata (color, order, attributes, `status.kind`); a ref is an open
  set of another resource's rows.
- **Kinds aren't grouped**, by data type or otherwise: each kind is its own
  entry.
- **A kind says how it orders and what a search reads** (`compare`,
  `searchText`: a rich text's words, never its JSON), so bh serves a source
  in memory with no switch on kind names.
- **This changes the contract, not only its docs.** It's a breaking change
  (`BaseKind` widens, boolean's and date's operators change, `page.total`
  may be null), so a minor version.

## Made: sources, declared per operation (@bh/source)

- **The kind is the ceiling, the source says what it can do, the metadata
  is what both allow.** A source maps its own data into our structure;
  `serve` makes `GET /meta` from its declarations and the kinds, never by
  hand.
- **Each operation is declared apart, beside the code that runs it**:
  `query`, `read`, `create`, `update`, `delete`. One left out isn't served
  (`ResourceMeta.serves`), and that's the only place it's said.
- **Each capability is its translation**: a field's operator as the
  source's request, a sort as its key, a field as its key in a body. The
  maps' keys are the declaration, and `run` gets only translated parts.
- **Only what translates whole is declared.** A word search isn't the
  contract's piece of text (GitHub's), and a sort whose ties the source
  breaks its own way isn't the contract's (GitHub's comments, Radarr's
  queue): both are left out. A finite set translates any operator, as the
  values it keeps (an issue's state, a queue's status, an option's
  attribute).
- **A source's size limits are refused when asked, not declared**: GitHub's
  256 characters and five ORs, its first 1000 rows. Every API has some.
- **Paging is in the source's words**: `none` (bh serves it in memory),
  `offset`, `page`, `cursor`, each a function. Clients see `{ skip, take }`
  and `{ cursor, take }`; a source's cursor is wrapped with the query it's
  for. An offset is never made a cursor, since a row added before it shifts
  every later page. `page.total` may be null, and `page.more` says whether
  a page follows.
- **A version is set by the source on every write, always after the one it
  replaces**, though the clock may tick coarser than two writes.
- **A kind doesn't say how it is stored**: each adapter maps the kinds to
  its own (Postgres' `baseColumns`), and an app's own kind brings its
  entry there.

## Made: validation, at four points

1. **When it's served**: the source's declarations against the kinds and
   the fields; every mistake is listed, and the server doesn't start.
2. **Each request in**: the schemas made from the metadata, then the
   operation's `check`. 400 `invalid`, with each problem's path.
3. **Each row out**: a row out of shape is a 500, logged, never passed on.
4. **In an adapter's tests**: `conformance` (@bh/source/testing) holds
   each operator to `matchesFilter` and each sort to its kind's order, over
   the rows the source holds. Postgres (on PGlite) and the arr queue (on a
   fake that answers as Radarr's controller does) pass it.

## Proposed (not built)

- **A kind is self-contained.** Adding one touches one file. Adding `time`
  touched `KindValue` and the operators' words (`labels.kinds`) besides its
  entry, and `baseDefaultRenderers` in @bh/template; email, phone and file
  still need the link renderer taught `mailto:`, `tel:` and a file's url.
- **A kind says its words too**: for each operator, and its default format,
  renderer and input, by name, as `format` already is.
- **One definition, types inferred**: `defineKind({ … })` gives the value's
  and the settings' types, so `KindValue` and `BaseKind` come from the
  definitions rather than being written beside them.
- **The metadata takes the operations' shape**: `fields` says what each
  field is; `query`, `create`, `update`, `delete` say what each allows.
  `FieldMeta.query` and `FieldMeta.write` still carry it, with `serves`
  beside them. No app imports @bh/resource yet, so it costs nothing now.

## Open

- A file's settings: the media types it takes, its largest size.
- Whether a text's `pattern` may come from an app's users: it runs on every
  write, and a pattern can be slow (ReDoS).
- `serve` doesn't fill a templated field yet: a source reads it as none.
- Postgres: a keyset cursor; a sort by a ref, by the title it points at (a
  join); an attribute of a field holding many options.
- The contract's docs (contract.doc.yaml, the resource README) still say
  nine kinds.
