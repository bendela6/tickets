---
title: Avatar
summary: Shows a name as its initials in a coloured disc or square.
related: [Pill, Dropdown, UserPicker]
---

[//]: # 'written from avatar.doc.yaml by pnpm docs:sync; edit that file, not this one'

# Avatar

Shows a name as its initials in a coloured disc or square.

The initials are the first letters of the first two words of `name`,
split at spaces and hyphens, and the whole name is the avatar's `title`.
`shape`, `font` and `tone` are separate axes: any combination works.

## Import

```tsx
import { Avatar } from '@bh/ui';
```

## Examples

`tone` picks the scale and `shape` the corners, and neither changes the
other.

Every combination of `Avatar`'s `shape` and `tone`, with `name="Mara Kowalski" size="xl"`:

- `shape` (rows): `round`, `square`
- `tone` (columns): `primary`, `secondary`, `success`, `warning`, `danger`, `neutral`

`size` runs 16, 18, 22, 28 and 36 pixels and defaults to `sm`, 18: an
avatar's own ladder, not the 28, 36 and 44 of the controls.

**Sizes**

```tsx
import { Avatar } from '@bh/ui';

export function Sizes() {
  return (
    <div className="flex items-center gap-8">
      <Avatar name="Mara Kowalski" size="xs" />
      <Avatar name="Mara Kowalski" size="sm" />
      <Avatar name="Mara Kowalski" size="md" />
      <Avatar name="Mara Kowalski" size="lg" />
      <Avatar name="Mara Kowalski" size="xl" />
    </div>
  );
}
```

`font` sets the typeface of the initials, whatever the shape.

**Typefaces**

```tsx
import { Avatar } from '@bh/ui';

export function Typefaces() {
  return (
    <div className="flex items-center gap-8">
      <Avatar name="Mara Kowalski" size="lg" />
      <Avatar name="Mara Kowalski" size="lg" font="mono" />
      <Avatar name="Data import" size="lg" shape="square" font="mono" tone="teal" />
    </div>
  );
}
```

Given an `onClick`, an avatar is a `<button>`. A
[Dropdown](../../../overlays/components/dropdown/dropdown.md) gives its trigger one, and the
avatar forwards its ref and passes its other props on, which the dropdown
needs to place its panel.

**Opening a dropdown**

```tsx
import { Avatar, Dropdown } from '@bh/ui';

export function OpeningADropdown() {
  return (
    <Dropdown trigger={<Avatar name="Mara Kowalski" size="lg" />} padding="md">
      <div className="flex flex-col gap-4">
        <span className="text-13 text-gray-12">Mara Kowalski</span>
        <span className="text-12 text-gray-11">mara@example.com</span>
      </div>
    </Dropdown>
  );
}
```

## Keyboard and accessibility

Without `onClick`, an avatar is a `<span>` outside the tab order. With
one, it is a `<button type="button">`: Enter and Space activate it, and
its name is its initials unless an `aria-label` gives it another.

## Props

| Prop              | Type                                                                                                                                                                                                        | Default     | Description                                                                                |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------ |
| `name` (required) | `string`                                                                                                                                                                                                    |             | The name it stands for: the initials come from its first two words, and it is the `title`. |
| `shape`           | `AvatarShape`: `'round'`, `'square'`                                                                                                                                                                        | `'round'`   | Round or square corners.                                                                   |
| `font`            | `AvatarFont`: `'sans'`, `'mono'`                                                                                                                                                                            | `'sans'`    | Typeface for the initials.                                                                 |
| `size`            | `AvatarSize`: `'xs'`, `'sm'`, `'md'`, `'lg'`, `'xl'`                                                                                                                                                        | `'sm'`      | A rung of the avatar's own ladder: 16, 18, 22, 28 and 36 pixels.                           |
| `tone`            | `Tone`: `'primary'`, `'secondary'`, `'success'`, `'warning'`, `'danger'`, `'neutral'`, `'red'`, `'orange'`, `'yellow'`, `'green'`, `'teal'`, `'cyan'`, `'blue'`, `'indigo'`, `'purple'`, `'pink'`, `'gray'` | `'primary'` | Which ramp it paints from: a role, or a hue by name.                                       |
| `onClick`         | `MouseEventHandler<HTMLElement>`                                                                                                                                                                            |             | Makes the avatar a `<button>`. Without it, the avatar is a `<span>` outside the tab order. |
| `className`       | `string`                                                                                                                                                                                                    |             | Added to the avatar's own classes.                                                         |
| `ref`             | `Ref<HTMLElement>`                                                                                                                                                                                          |             | Forwarded to the element it renders.                                                       |

Also every element attribute (`HTMLAttributes<HTMLElement>`), passed through.
