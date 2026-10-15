---
title: FilterChanges
summary: 'Says a filter form holds changes not applied yet: "1 change waiting".'
related: [FilterCount, FormButton]
---

[//]: # 'written from filter-changes.doc.yaml by pnpm docs:sync; edit that file, not this one'

# FilterChanges

Says a filter form holds changes its Apply hasn't applied yet: "1
change waiting", and nothing while there are none. It is the
registry's `filter.changes` ([The registry](../../../../../../form/docs/registry.md)), drawn
in the `changes` slot of a filter form that applies with a button,
which gives it how many of its fields differ from the value applied.

## Import

```tsx
import { FilterChanges } from '@bh/ui';
```

## Examples

It sits before the form's Clear and Apply, in the muted text of a
bar's labels.

**A change waiting**

```tsx
import { Button, FilterChanges } from '@bh/ui';

export function AChangeWaiting() {
  return (
    <div className="flex items-center gap-8">
      <FilterChanges count={1} />
      <Button variant="ghost" size="sm">
        Clear
      </Button>
      <Button variant="solid" size="sm">
        Apply
      </Button>
    </div>
  );
}
```

## Keyboard and accessibility

It is an `<output aria-live="polite">`, a `status`, there while it is
empty too, so a screen reader hears the first change as it is made.

## Props

| Prop               | Type     | Default | Description                                                                    |
| ------------------ | -------- | ------- | ------------------------------------------------------------------------------ |
| `count` (required) | `number` |         | How many of its fields hold a change its Apply hasn't applied yet; 0 for none. |
