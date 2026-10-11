---
title: SectionHeader
summary: "A section's caption row: an uppercase title, an optional count, and an
  action on the right."
related: [Card, Row, FieldLabel]
---

[//]: # 'written from section-header.doc.yaml by pnpm docs:sync; edit that file, not this one'

# SectionHeader

A section's caption row: an uppercase title, an optional count, and an
action on the right.

## Import

```tsx
import { SectionHeader } from '@bh/ui';
```

## Examples

`count` sits beside the title, a gap away. It takes the caption's small
type unless it sets its own.

**With count**

```tsx
import { SectionHeader } from '@bh/ui';

export function WithCount() {
  return <SectionHeader title="Files" count={<span className="text-gray-9 font-mono">12</span>} />;
}
```

`action` is pinned to the right end of the row.

**With an action**

```tsx
import { Button, SectionHeader } from '@bh/ui';

export function WithAnAction() {
  return (
    <SectionHeader
      title="Links"
      count={<span className="text-gray-9 font-mono">3</span>}
      action={
        <Button size="sm" variant="ghost">
          Add link
        </Button>
      }
    />
  );
}
```

Something that must touch the title, like a required mark, goes inside
`title` rather than in `count`. To restyle the title, use
`titleClassName`: `className` lands on the row and can't reach it.

**Required mark**

```tsx
import { SectionHeader } from '@bh/ui';

export function RequiredMark() {
  return (
    <SectionHeader
      title={
        <>
          Name<span className="text-red-9"> *</span>
        </>
      }
    />
  );
}
```

`as="h2"` or `as="h3"` makes the title a real heading.

**As heading**

```tsx
import { SectionHeader } from '@bh/ui';

export function AsHeading() {
  return <SectionHeader as="h2" title="Recent files" />;
}
```

## Keyboard and accessibility

By default the title is a `div`, which a screen reader doesn't list as a
heading. Give `as` when the section needs one.

## Props

| Prop               | Type                                             | Default | Description                                                                            |
| ------------------ | ------------------------------------------------ | ------- | -------------------------------------------------------------------------------------- |
| `title` (required) | `ReactNode`                                      |         | The section's name, shown in uppercase.                                                |
| `count`            | `ReactNode`                                      |         | Beside the title, a gap away, in the caption's size unless it sets its own.            |
| `action`           | `ReactNode`                                      |         | Pinned to the right end of the row.                                                    |
| `className`        | `string`                                         |         | Added to the row's classes. It doesn't reach the title: use `titleClassName` for that. |
| `titleClassName`   | `string`                                         |         | Added to the title's classes, where it wins over the defaults.                         |
| `as`               | `'div' \| 'h2' \| 'h3'`: `'div'`, `'h2'`, `'h3'` | `'div'` | The title's element: a `div`, or `h2` or `h3` for a real heading.                      |
