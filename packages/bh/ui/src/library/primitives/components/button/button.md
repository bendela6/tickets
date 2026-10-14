---
title: Button
summary: 'Starts an action: save, open a dialog, run a job.'
related: [useCopy, Menu, SegmentedControl, Tooltip]
---

[//]: # 'written from button.doc.yaml by pnpm docs:sync; edit that file, not this one'

# Button

Starts an action: save, open a dialog, run a job.

`variant` is how much of its tone a button spends and `tone` is which
colour, so a destructive button is `variant="solid" tone="danger"`, not a
variant of its own. Given `icon` in place of words, it is an icon-only
button: square, and named by its `label`, which is also its tooltip.

## Import

```tsx
import { Button } from '@bh/ui';
```

## Examples

Tones and variants mean little alone, so they are shown together:
[Tones](../../../../../docs/foundations/tones.md) has what each variant spends.

Every combination of `Button`'s `tone` and `variant`, with `children="Save"`:

- `tone` (rows): `primary`, `secondary`, `success`, `warning`, `danger`, `neutral`
- `variant` (columns): `subtle`, `solid`, `outline`, `ghost`

`size` sets the height, padding, radius and type together: 28, 36 and 44
pixels.

**Sizes**

```tsx
import { Button } from '@bh/ui';

export function Sizes() {
  return (
    <div className="flex items-center gap-8">
      <Button size="sm">Small</Button>
      <Button size="md">Medium</Button>
      <Button size="lg">Large</Button>
    </div>
  );
}
```

`loading` puts a spinner before the label and disables the button, keeping
its fill, so it keeps its width and its look.

**Loading**

```tsx
import { Button } from '@bh/ui';

export function Loading() {
  return (
    <div className="flex gap-8">
      <Button loading>Saving</Button>
      <Button variant="outline" loading>
        Uploading
      </Button>
    </div>
  );
}
```

A destructive action takes the `danger` tone.

**Danger**

```tsx
import { Button } from '@bh/ui';

export function Danger() {
  return (
    <Button variant="solid" tone="danger">
      Delete
    </Button>
  );
}
```

`chevron` marks a button that opens a menu or a popover.

**Opening a menu**

```tsx
import { Button, Menu, MenuContent, MenuItem, MenuTrigger } from '@bh/ui';

export function OpeningAMenu() {
  return (
    <Menu>
      <MenuTrigger asChild>
        <Button chevron>Sort</Button>
      </MenuTrigger>
      <MenuContent>
        <MenuItem>Newest first</MenuItem>
        <MenuItem>Oldest first</MenuItem>
        <MenuItem>By name</MenuItem>
      </MenuContent>
    </Menu>
  );
}
```

### Icon-only

`icon` draws a glyph alone, in place of words, and makes the button as
wide as it is high. `label` is required with it: it names the button and
shows as its tooltip, so the glyph is never the only clue. Each size
draws the glyph at about half its height, and `xs`, 24 pixels, is for
icon-only buttons alone: 24, 28, 36 and 44 pixels, with 12, 14, 16 and 20
pixel glyphs.

**Icon only**

```tsx
import { Button } from '@bh/ui';

export function IconOnly() {
  return (
    <div className="flex items-center gap-8">
      <Button icon="ellipsis" label="More actions" size="xs" />
      <Button icon="ellipsis" label="More actions" size="sm" />
      <Button icon="ellipsis" label="More actions" size="md" />
      <Button icon="ellipsis" label="More actions" size="lg" />
    </div>
  );
}
```

`icon` is a name from [Icon](../icon/icon.md)'s registry.
For a glyph the registry lacks, it takes an element instead, drawn as
given, at the size you draw it.

Every tone and variant works the same with an icon.

Every combination of `Button`'s `tone` and `variant`, with `icon="pencil" label="Rename"`:

- `tone` (rows): `primary`, `secondary`, `success`, `warning`, `danger`, `neutral`
- `variant` (columns): `subtle`, `solid`, `outline`, `ghost`

A disabled button still shows its tooltip: the button hears no pointer,
so the tooltip hangs on a span around it. Hover the first arrow.

**Icon only in a row**

```tsx
import { Button } from '@bh/ui';

export function IconOnlyInARow() {
  return (
    <div className="flex items-center gap-2">
      <Button variant="ghost" tone="neutral" size="xs" icon="arrow-up" label="Move up" disabled />
      <Button variant="ghost" tone="neutral" size="xs" icon="arrow-down" label="Move down" />
      <Button variant="ghost" tone="danger" size="xs" icon="trash" label="Remove" />
    </div>
  );
}
```

On a button with words, `label` is a tooltip alone: the words name it.

**A tooltip**

```tsx
import { Button } from '@bh/ui';

export function ATooltip() {
  return (
    <div className="flex items-center gap-8">
      <Button label="Saves the draft and keeps it open">Save</Button>
      <Button variant="solid" label="Nothing has changed since the last save" disabled>
        Publish
      </Button>
    </div>
  );
}
```

To copy a value, hold [`useCopy`](../use-copy/use-copy.md) and
let the glyph, the tone and the label say whether the copy worked.

## Keyboard and accessibility

| Key                | Does                  |
| ------------------ | --------------------- |
| `Enter` or `Space` | Activates the button. |

A Button is `type="button"`, so it never submits a form by accident; give
a form's submit button `type="submit"`. While `loading`, it sets
`aria-busy`.

An icon-only button's `label` is its `aria-label`; an `aria-label` of
your own still wins. Its glyph is hidden from assistive tech. An `icon`
without a `label` is a type error, as are words beside an `icon` and
`size="xs"` on a button with words.

The tooltip shows on hover, and at once on focus from the keyboard; a
focus that a click led to, a drawer focusing its Close button or a menu
handing focus back to its trigger, shows none. While it shows, the
button is `aria-describedby` it. A `TooltipProvider` near the app's root
gives every tooltip one delay; a Button outside one brings its own.

## When not to use it

- To go somewhere, use a link: a button does something where you are.
- For one of a few choices, use `SegmentedControl`.

## Props

| Prop        | Type                                                                                                                                                                                                        | Default     | Description                                                                                                                                       |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `variant`   | `ButtonVariant`: `'subtle'`, `'solid'`, `'outline'`, `'ghost'`                                                                                                                                              | `'outline'` | How much of the tone the button spends.                                                                                                           |
| `tone`      | `Tone`: `'primary'`, `'secondary'`, `'success'`, `'warning'`, `'danger'`, `'neutral'`, `'red'`, `'orange'`, `'yellow'`, `'green'`, `'teal'`, `'cyan'`, `'blue'`, `'indigo'`, `'purple'`, `'pink'`, `'gray'` | `'primary'` | Which ramp the variant paints from: a role, or a hue by name.                                                                                     |
| `size`      | `IconButtonSize \| ButtonSize`: `'xs'`, `'sm'`, `'md'`, `'lg'`                                                                                                                                              | `'md'`      | Height, padding, radius and type size, as one step: 24 (icon-only), 28, 36 and 44 pixels.                                                         |
| `icon`      | `IconName \| ReactElement`                                                                                                                                                                                  |             | Draws a glyph alone, in place of words: an icon's name, or an element for a glyph the registry lacks. The button is square, and `label` names it. |
| `label`     | `string`                                                                                                                                                                                                    |             | The tooltip. With `icon`, also the button's name, and required.                                                                                   |
| `chevron`   | `boolean`                                                                                                                                                                                                   | `false`     | Adds a trailing chevron, for a button that opens a menu or a popover.                                                                             |
| `children`  | `ReactNode`                                                                                                                                                                                                 |             | The label.                                                                                                                                        |
| `loading`   | `boolean`                                                                                                                                                                                                   | `false`     | Shows a spinner before the label, or in the glyph's place, and disables the button, keeping its fill. Sets `aria-busy`.                           |
| `className` | `string`                                                                                                                                                                                                    |             | Added to the button's own classes.                                                                                                                |
| `ref`       | `Ref<HTMLButtonElement>`                                                                                                                                                                                    |             | Forwarded to the `<button>`.                                                                                                                      |

Also every `<button>` attribute (`ButtonHTMLAttributes<HTMLButtonElement>`), passed through.
