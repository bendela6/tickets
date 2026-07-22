# Claude Design prompt — RichTextEditor

Paste the block below into the Instrument design project (claude.ai/design).

---

Design the **RichTextEditor** — the rich text writing surface for the tickets
app, replacing the current markdown write/preview editor.

It is a single WYSIWYG surface used in three places: the ticket description on
the detail pane, the comment composer, and rich-text custom fields. Use
existing Instrument vocabulary throughout — raised surface, hairline borders,
control border on focus, ink/ink-2/ink-3 text scale, accent, meta-size sans
for chrome, 10px-radius container.

**Important constraint:** the toolbar is assembled from a per-surface feature
config — different surfaces show different subsets of controls. Design the
toolbar as composable groups that still look right when some groups are
absent, not as one fixed strip.

Design these pieces:

1. **Container + toolbar.** A rounded raised container with a slim top
   toolbar, organized as groups: text marks (bold, italic, underline,
   strikethrough, inline code, highlight, text color) · link · blocks
   (heading level, bullet/ordered list, task list, blockquote, callout,
   collapsible section, code block, divider) · insert (image upload).
   Decide what's always visible vs. tucked into an overflow "+" menu.
   Show two configurations: **full** (description) and **compact** (comment
   composer: marks, lists, code, link, mentions, image — no headings/
   collapsible/align).
2. **States.** Empty with placeholder, focused (control-border ring),
   disabled, and the read-only rendered view (as a comment body appears —
   no container chrome).
3. **Mention & ticket-ref suggestion popover.** Typing `@` lists users
   (avatar dot + name); typing `#` searches tickets (ID chip like TIX-123,
   title, status dot). Show the popover with hover and selected rows, and
   the resulting inline chips sitting in body text: a user-mention chip and
   a ticket-ref chip (ID + subtle status color).
4. **Rich blocks in context.** One composed example doc showing: an h2, a
   paragraph with bold + inline code + a ticket-ref chip, a task list with
   mixed checked states, a callout (design info/warning/success/danger
   variants), a collapsed and an expanded collapsible section, an inline
   image, and a code block.
5. **Image states.** Uploading (progress), uploaded, failed (retry
   affordance).
6. **Link editing.** The small popover when the cursor sits on a link:
   URL, edit, remove.

Show the full editor at description width and the compact comment-composer
variant, both light and dark.
