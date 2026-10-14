---
title: useCopy
summary: Copies text to the clipboard and says whether it worked, for a button
  of your own.
related: [Button, JsonViewer]
---

[//]: # 'written from use-copy.doc.yaml by pnpm docs:sync; edit that file, not this one'

# useCopy

Copies text to the clipboard and says whether it worked, for a button of
your own.

`copy(text)` writes the text. Then `copied` is true, or `failed` when the
browser refuses the write, until `resetMs` passes: 1.5 seconds unless
given. `copy` also resolves to whether it wrote.

## Import

```tsx
import { copyText, useCopy } from '@bh/ui';
```

## Examples

Beside the value it copies, an icon-only
[`Button`](../button/button.md#icon-only) says enough. Its
glyph, tone and label follow the copy: a check in green, or a cross in
red when the browser refused, and the label, which is its name and its
tooltip, says the same.

**Beside the value**

```tsx
import { Button, useCopy } from '@bh/ui';

const LINK = 'https://example.com/files/report.pdf';

export function BesideTheValue() {
  const { copy, copied, failed } = useCopy();
  return (
    <div className="flex items-center gap-8">
      <code className="text-13 text-gray-12 font-mono">{LINK}</code>
      <Button
        variant="ghost"
        tone={copied ? 'success' : failed ? 'danger' : 'neutral'}
        size="xs"
        icon={copied ? 'check' : failed ? 'x' : 'copy'}
        label={copied ? 'Copied' : failed ? 'Could not copy' : 'Copy the link'}
        onClick={() => void copy(LINK)}
      />
    </div>
  );
}
```

Away from the value, name what it copies in words.

**Naming what it copies**

```tsx
import { Button, Icon, useCopy } from '@bh/ui';

function CopyWithWords({ value, what }: { value: string; what: string }) {
  const { copy, copied, failed } = useCopy();
  return (
    <Button
      variant="outline"
      tone={copied ? 'success' : failed ? 'danger' : 'neutral'}
      size="sm"
      onClick={() => void copy(value)}
    >
      <Icon name={copied ? 'check' : failed ? 'x' : 'copy'} />
      {copied ? 'Copied' : failed ? 'Could not copy' : `Copy ${what}`}
    </Button>
  );
}

export function NamingWhatItCopies() {
  return (
    <div className="flex flex-wrap items-center gap-12">
      <CopyWithWords value="npm install @bh/ui" what="the install command" />
      <CopyWithWords value="https://example.com/files/report.pdf" what="the link" />
    </div>
  );
}
```

Any control can hold it: here a button's words alone say which happened.

**A button of your own**

```tsx
import { Button, useCopy } from '@bh/ui';

function labelFor(copied: boolean, failed: boolean) {
  if (copied) {
    return 'Copied';
  }
  return failed ? 'Could not copy' : 'Copy the city';
}

export function AButtonOfYourOwn() {
  const { copy, copied, failed } = useCopy();
  return (
    <Button variant="subtle" onClick={() => void copy('Lisbon')}>
      {labelFor(copied, failed)}
    </Button>
  );
}
```

```ts
useCopy(resetMs?: number): CopyState
```

Copies text to the clipboard and holds whether it worked, for a button of
your own: `copy(text)`, then `copied` or `failed` until `resetMs` passes.

| Parameter | Type     | Default | Description                                           |
| --------- | -------- | ------- | ----------------------------------------------------- |
| `resetMs` | `number` | `1500`  | How long `copied` or `failed` holds, in milliseconds. |

Returns `CopyState`.

```ts
interface CopyState
```

What `useCopy` returns: the copy, and whether the last one worked.

| Member              | Type                                 | Default | Description                                                         |
| ------------------- | ------------------------------------ | ------- | ------------------------------------------------------------------- |
| `copied` (required) | `boolean`                            |         | True from a copy that worked until `resetMs` passes.                |
| `failed` (required) | `boolean`                            |         | True from a copy the browser refused until `resetMs` passes.        |
| `copy` (required)   | `(text: string) => Promise<boolean>` |         | Writes `text` to the clipboard; resolves to whether it was written. |

## Outside React

`copyText(text)` is the write alone, for a caller with no component to
hold the state: a table's cell copy, a keyboard shortcut, a menu
item's action. It never throws. It resolves to `false` when the browser
refuses the write, or has no clipboard, as on a page that is not served
over HTTPS.

```tsx
import { copyText } from '@bh/ui';

export async function copyLink(url: string, say: (text: string) => void) {
  say((await copyText(url)) ? 'Link copied' : 'Could not copy the link');
}
```

```ts
copyText(text: string): Promise<boolean>
```

Writes text to the clipboard, for a caller outside React: a table's cell
copy, a menu item's action. It never throws: a browser that refuses the
write (no permission, no clipboard, a page that isn't secure) resolves to
`false`.

| Parameter         | Type     | Default | Description               |
| ----------------- | -------- | ------- | ------------------------- |
| `text` (required) | `string` |         | The exact string written. |

Returns `Promise<boolean>`: Whether the clipboard took it.
