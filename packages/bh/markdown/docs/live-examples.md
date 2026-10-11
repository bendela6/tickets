---
title: Live examples
summary: Show a TSX file beside the page as a live example the reader can edit,
  with the demo block.
order: 7
related: [Writing a page, The page editor, The block registry]
---

[//]: # 'written from live-examples.doc.yaml by pnpm docs:sync; edit that file, not this one'

# Live examples

Show a TSX file beside the page as a live example the reader can edit,
with the `demo` block.

## An example file

An example is a file in `examples/` beside its page, a whole module that
exports the one component it shows. The page names it by its path:

```yaml
- demo: examples/pages-read.tsx
  mode: split
  layout: horizontal
  collapse: 10
```

The panel draws the component on a stage, and its code, which the
reader can edit, a click away. It runs on each pause in typing; a
compile or runtime error goes to the problems strip under the code, on
its line, and the result keeps its last good render. The title is the
export's name in words: `PagesRead` is "Pages read", and `title:`
sets another.

The controls show on hover. View, Split and Source say what the panel
shows, and a split puts the code under the result or beside it. With
the code hidden they sit in the stage's corner; with it shown, in the
bar over the code, beside its file's name, Reset and Copy. Full screen,
in the header, gives the window to the result and the code (Esc leaves
it). Code longer than `collapse` lines scrolls in place. The panel's
bottom edge drags it taller or shorter, and a split's divider drags the
room between the result and the code; both take the arrow keys too.

**Pages read**

```tsx
import { useState } from 'react';
import { Button, Progress } from '@bh/ui';

const PAGES = 880;

export function PagesRead() {
  const [read, setRead] = useState(320);
  const percent = Math.round((read / PAGES) * 100);
  return (
    <div className="flex w-full max-w-320 flex-col gap-12">
      <p className="text-13/20 text-gray-11">
        Middlemarch: {read} of {PAGES} pages
      </p>
      <Progress value={percent} trailing={`${percent}%`} aria-label="Pages read" />
      <div className="flex gap-8">
        <Button onClick={() => setRead(Math.min(PAGES, read + 40))}>Read 40 more</Button>
        <Button variant="ghost" tone="neutral" onClick={() => setRead(0)}>
          Start again
        </Button>
      </div>
    </div>
  );
}
```

What a file may hold:

- **One exported component.** A helper it needs stays unexported. No
  export, or two, is a problem the panel and `docs:check` report.
- **Imports by package name**, from what the site provides: `react`,
  `react-dom`, `@bh/ui`, `@bh/form`, `@bh/form/valibot`, `@bh/table`,
  `@bh/shell`, `@bh/shell/layout`, `@bh/markdown`, `lucide-react` and
  `valibot`. An example may import its own package by name. Anything
  else is a problem on the import's line, naming what is available.
- **Any Tailwind class.** A class typed in the editor that nothing in the
  repo uses yet is built in the page as you type.

The file is code like any other: it gets the editor's autocomplete,
`tsc`, ESLint and Prettier. A component's examples sit in its package's
`src/`, which the package checks. A guide's sit in its `docs/`, which no
package's `tsc` reads, so `docs:check` type-checks them, and a
`tsconfig.json` in `docs/` gives ESLint their types. `docs:check` also
runs every example, renders it, runs axe on it, and refuses an app's
domain words in its sample data.

## Attributes

`file` is given as the item's value. The rest are keys beside it:

| Attribute  | Takes                                                                                                   | Default                    |
| ---------- | ------------------------------------------------------------------------------------------------------- | -------------------------- |
| `title`    | The panel's title.                                                                                      | The export's name in words |
| `mode`     | What the panel opens on: `view`, the result; `split`, the result and its code; or `source`, the code.   | `view`                     |
| `layout`   | Where a split puts the code: `vertical`, under the result, or `horizontal`, beside it.                  | `vertical`                 |
| `collapse` | Lines of code shown before the code scrolls.                                                            | 12                         |
| `height`   | The result stage's least height, in pixels: it grows with a taller result.                              | 200                        |
| `frame`    | Where the result runs: `inline`, in the page, or `iframe`, in a page of its own.                        | `inline`                   |
| `width`    | A framed result's width: `phone` (390), `tablet` (768), `desktop` (1280), or pixels. Implies the frame. | `desktop`                  |

## What only the viewport decides

An inline result shares the page's width, so a layout that reads the
viewport (`sm:`, `lg:`, the shell's drawer) sees the reader's window,
not the panel. `width` runs the result in a frame of that width instead,
scaled down to fit the pane, and the panel's header offers Phone, Tablet
and Desktop. A frame's `height` is its own, 560 pixels by default, since
a shell fills its viewport and has no height of its own to take.

**City cards**

```tsx
const CITIES = [
  { name: 'Tbilisi', country: 'Georgia', founded: '5th century' },
  { name: 'Lisbon', country: 'Portugal', founded: '8th century BC' },
  { name: 'Kyoto', country: 'Japan', founded: '794' },
  { name: 'Oslo', country: 'Norway', founded: '1040' },
  { name: 'Quito', country: 'Ecuador', founded: '1534' },
  { name: 'Hanoi', country: 'Vietnam', founded: '1010' },
];

// One column on a phone, two from 640 pixels, three from 1024: the
// viewport decides, so the panel runs it in a frame of the width you pick.
export function CityCards() {
  return (
    <ul className="grid w-full grid-cols-1 gap-12 p-16 sm:grid-cols-2 lg:grid-cols-3">
      {CITIES.map((city) => {
        return (
          <li key={city.name} className="rounded-8 border-gray-6 bg-surface-raised border-1 p-12">
            <p className="text-15 font-600 text-gray-12">{city.name}</p>
            <p className="text-13/20 text-gray-11">
              {city.country} · founded {city.founded}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
```

An inline result shares the page's providers and theme. A framed result
is sent the page's theme, and follows it as it changes.

## Edits

- **Kept while the site is open.** Leaving the page and coming back keeps
  an edit; a reload brings back the page's code. Reset puts it back, and
  Copy copies what is on screen.
- **Never written back.** An edit is the reader's own: to change the
  example, change its file.
- **A new file.** An example naming a file that isn't there offers
  Create in [the page editor](page-editor.md): the file is
  written with a component named from it, to start from.

## In the copy

The copy writes an example as its title in bold, then its file's code
in a `tsx` fence. It has nothing to run, so the code is what a reader of
the `.md` copies. Changing an example's code changes the copy: run
`pnpm docs:sync`.

## Rules

- An example exports one component; its name in words is the panel's
  title.
- It imports only what the site provides, by package name.
- What runs is the file's code. In `pnpm docs:dev` it runs through the
  same runtime as an edit; a built site draws it from the file as the
  site was built, and loads the runtime with the first edit.
- A problem never blanks the result: it keeps its last good render.
- `width` implies the frame, and `frame: iframe` alone is desktop.
- A missing file is a problem on the item's line.
