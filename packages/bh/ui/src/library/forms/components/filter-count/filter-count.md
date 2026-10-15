---
title: FilterCount
summary: 'How many rows a filter lets through: "12 of 40 items", "Counting"
  while it counts.'
related: [InlineFieldWrapper, Spinner]
---

[//]: # 'written from filter-count.doc.yaml by pnpm docs:sync; edit that file, not this one'

# FilterCount

How many rows a filter lets through: "12 of 40 items", or "40 items"
when it lets every one through. It is the registry's `filter.count`
([The registry](../../../../../../form/docs/registry.md)), drawn in a filter form's `count`
slot, which gives it the count, the total and the resource's name for
its rows.

## Import

```tsx
import { FilterCount } from '@bh/ui';
```

## Examples

The numbers are in IBM Plex Mono, and the rows' name agrees with the
total: "1 of 40 items", "1 item". With no total it gives the count
alone. While the count is asked for it says "Counting" with a spinner,
and when nothing matches the count is in the danger tone.

**Counts**

```tsx
import { FilterCount } from '@bh/ui';

const label = { one: 'crawl', other: 'crawls' };

export function Counts() {
  return (
    <div className="flex flex-col items-start gap-10">
      <FilterCount shown={38} total={1920} label={label} loading={false} />
      <FilterCount shown={1920} total={1920} label={label} loading={false} />
      <FilterCount shown={0} total={1920} label={label} loading={false} />
      <FilterCount shown={38} total={1920} label={label} loading />
    </div>
  );
}
```

## Keyboard and accessibility

It is an `<output aria-live="polite">`, a `status`: a screen reader
reads a new count when it is done with what it was saying. While it
counts it is `aria-busy`, so what is read is the count, not "Counting".

## Props

| Prop                 | Type                             | Default | Description                                                            |
| -------------------- | -------------------------------- | ------- | ---------------------------------------------------------------------- |
| `shown`              | `number`                         |         | How many rows the filter lets through; unknown while it is counted.    |
| `total`              | `number`                         |         | How many rows there are in all; unknown when the app doesn't say.      |
| `label` (required)   | `{ one: string; other: string }` |         | The resource's name for one row and for several: `ResourceMeta.label`. |
| `loading` (required) | `boolean`                        |         | The count is being asked for.                                          |
