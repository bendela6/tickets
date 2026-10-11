# @bh/table

[//]: # 'written by pnpm docs:index from each page’s frontmatter; edit the pages, not this file'

Every page in this package, as the docs site groups them. Each link is the page’s
markdown copy: its prose, its examples’ code, and its props tables from the types.

## Tables

- [Overview](../docs/overview.md): Draw a sortable, resizable, virtualized table over an array of rows, in @bh/ui's look or one of your own.
- [Columns](../docs/columns.md): Say what each column shows, how its cells are drawn, and what it adds to the header and the foot of the table.
- [useTable](../docs/use-table.md): Hold a table's sort, widths, collapsed groups, focused cell and selection in one hook, or own any of them yourself.
- [Sorting](../docs/sorting.md): Sort by a header click, by several columns with shift-click, in the browser with sortRows or on a server.
- [Widths and resizing](../docs/widths-and-resizing.md): Size each column in pixels or with a flexible track, let the user drag or fit it, and save the widths under a key the app names.
- [Selection](../docs/selection.md): Let the user tick rows, a range of them or all of them, by mouse or keyboard, kept by row id through every sort.
- [Keyboard focus](../docs/keyboard-focus.md): Move through the table cell by cell with the arrows, sort from its headers, and step into a cell's buttons and out again.
- [Groups](../docs/groups.md): Draw the rows in bands under headers of their own, collapse a band, and keep the band in view pinned under the column header.
- [Pinning](../docs/pinning.md): Freeze columns to the left or right edge of a table wider than its frame, and scroll the rest sideways under them.
- [Virtualization and states](../docs/virtualization-and-states.md): Show ten thousand rows by drawing only those in view, load more as the user nears the end, and show loading, empty and failed tables.
- [Cell renderers](../docs/cell-renderers.md): Draw a column's values as text, numbers, dates, badges, links, pictures or row actions with @bh/ui's renderers, or write your own.
- [Writing a skin](../docs/writing-a-skin.md): Draw the table in a look of your own, or change one part of @bh/ui's, by writing the functions the table calls for each part.
