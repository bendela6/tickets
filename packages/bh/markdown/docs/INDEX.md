# @bh/markdown

[//]: # 'written by pnpm docs:index from each page’s frontmatter; edit the pages, not this file'

Every page in this package, as the docs site groups them. Each link is the page’s
markdown copy: its prose, its examples’ code, and its props tables from the types.

## Markdown

- [Overview](../docs/overview.md): Write a page as data, check it against the blocks you register, and draw it with your own components.
- [Writing a page](../docs/writing-a-page.md): Write a docs page in YAML, its frontmatter then a body of prose, headings and blocks, and keep its markdown copy beside it.
- [Markdown documents](../docs/markdown-documents.md): Write blocks inside markdown, as fences and directives, for documents kept outside the docs site.
- [Rendering a document](../docs/rendering.md): Draw a parsed page or a markdown document with your own component for each element, for code, and for a block that fails.
- [Prose](../docs/prose.md): Draws markdown, or a document the rich text editor stores, as prose in the editor's look.
- [The block registry](../docs/registry.md): Register the blocks a page may use, write a block of your own, and find the page of each block there is.
- [Live examples](../docs/live-examples.md): Show a TSX file beside the page as a live example the reader can edit, with the demo block.
- [The page editor](../docs/page-editor.md): Edit a page on the site while pnpm docs:dev runs, and save it to its file with its comments and layout kept.
- [toPrompt](../docs/to-prompt.md): Write the block reference a model reads before it writes a page or a document, and each block's own page.
