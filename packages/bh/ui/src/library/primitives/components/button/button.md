---
title: Button
summary: 'Starts an action: save, open a dialog, run a job.'
related: [CopyButton, Menu, SegmentedControl]
---

[//]: # 'written from button.doc.yaml by pnpm docs:sync; edit that file, not this one'

# Button

Starts an action: save, open a dialog, run a job.

`variant` is how much of its tone a button spends and `tone` is which
colour, so a destructive button is `variant="solid" tone="danger"`, not a
variant of its own.

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

There is no icon size: pick a size, square it with a width and no padding,
and name it with `aria-label`.

**Icon only**

```tsx
import { Button, Icon } from '@bh/ui';

export function IconOnly() {
  return (
    <Button variant="ghost" aria-label="More actions" className="w-36 p-0">
      <Icon name="ellipsis" />
    </Button>
  );
}
```

## Keyboard and accessibility

| Key                | Does                  |
| ------------------ | --------------------- |
| `Enter` or `Space` | Activates the button. |

A Button is `type="button"`, so it never submits a form by accident; give
a form's submit button `type="submit"`. While `loading`, it sets
`aria-busy`.

## When not to use it

- To go somewhere, use a link: a button does something where you are.
- To copy a value, use `CopyButton`, which says when it has copied.
- For one of a few choices, use `SegmentedControl`.

## Props

| Prop        | Type                                                                                                                                                                                                        | Default     | Description                                                                                   |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------- |
| `variant`   | `ButtonVariant`: `'subtle'`, `'solid'`, `'outline'`, `'ghost'`                                                                                                                                              | `'outline'` | How much of the tone the button spends.                                                       |
| `tone`      | `Tone`: `'primary'`, `'secondary'`, `'success'`, `'warning'`, `'danger'`, `'neutral'`, `'red'`, `'orange'`, `'yellow'`, `'green'`, `'teal'`, `'cyan'`, `'blue'`, `'indigo'`, `'purple'`, `'pink'`, `'gray'` | `'primary'` | Which ramp the variant paints from: a role, or a hue by name.                                 |
| `size`      | `ButtonSize`: `'sm'`, `'md'`, `'lg'`                                                                                                                                                                        | `'md'`      | Height, padding, radius and type size, as one step.                                           |
| `loading`   | `boolean`                                                                                                                                                                                                   | `false`     | Shows a spinner before the label and disables the button, keeping its fill. Sets `aria-busy`. |
| `chevron`   | `boolean`                                                                                                                                                                                                   | `false`     | Adds a trailing chevron, for a button that opens a menu or a popover.                         |
| `children`  | `ReactNode`                                                                                                                                                                                                 |             | The label.                                                                                    |
| `className` | `string`                                                                                                                                                                                                    |             | Added to the button's own classes.                                                            |
| `ref`       | `Ref<HTMLButtonElement>`                                                                                                                                                                                    |             | Forwarded to the `<button>`.                                                                  |

Also every `<button>` attribute (`ButtonHTMLAttributes<HTMLButtonElement>`), passed through.
