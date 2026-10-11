---
title: FileInput
summary: Takes files by drop or by browse, and lists them with their size,
  progress or error.
related: [Progress, Input]
---

[//]: # 'written from file-input.doc.yaml by pnpm docs:sync; edit that file, not this one'

# FileInput

Takes files by drop or by browse, and lists them.

It uploads nothing. `onSelect` hands over the browser's `File`s; the
caller uploads them and lists each in `value` as an `UploadFile`.
`onChange` reports a file removed.

## Import

```tsx
import { FileInput, type UploadFile } from '@bh/ui';
```

## Examples

The drop target is also a button that opens the browser's file dialog.
`id` goes on it, so a label pointing at it names it, and a click on the
label opens the dialog too. Here `onSelect`
lists each chosen file with its name and size, where an app would also
start its upload.

**Choosing files**

```tsx
import { useId, useState } from 'react';
import { FieldLabel, FileInput, type UploadFile } from '@bh/ui';

export function ChoosingFiles() {
  const id = useId();
  const [files, setFiles] = useState<UploadFile[]>([]);
  return (
    <div className="flex w-384 flex-col gap-4">
      <FieldLabel htmlFor={id}>Attachments</FieldLabel>
      <FileInput
        id={id}
        value={files}
        onChange={setFiles}
        onSelect={(chosen) => {
          setFiles((current) => {
            return [
              ...current,
              ...chosen.map((file) => {
                return { id: crypto.randomUUID(), name: file.name, size: file.size };
              }),
            ];
          });
        }}
      />
    </div>
  );
}
```

A file shows its `error` if it has one, else a progress bar while
`progress` is set, else its `size`. An error belongs to its file and
leaves the others alone. The progress bars, the focus ring and the target
under a dragged file take `tone`, `primary` by default.

**Errors per file**

```tsx
import { useId, useState } from 'react';
import { FieldLabel, FileInput, type UploadFile } from '@bh/ui';

export function ErrorsPerFile() {
  const id = useId();
  const [files, setFiles] = useState<UploadFile[]>([
    { id: '1', name: 'photo.png', size: 248_000 },
    { id: '2', name: 'notes.txt', size: 1_536 },
    { id: '3', name: 'archive.zip', error: 'Larger than 10 MB' },
  ]);
  return (
    <div className="flex w-384 flex-col gap-4">
      <FieldLabel htmlFor={id}>Attachments</FieldLabel>
      <FileInput id={id} value={files} onChange={setFiles} />
    </div>
  );
}
```

`multiple={false}` lets the dialog choose one file and takes only the
first of a drop. `accept` filters the dialog only: a dropped file is not
checked against it. `label` names the drop target where no label points
at it.

**One image**

```tsx
import { useId, useState } from 'react';
import { FieldLabel, FileInput, type UploadFile } from '@bh/ui';

export function OneImage() {
  const id = useId();
  const [photo, setPhoto] = useState<UploadFile[]>([]);
  return (
    <div className="flex w-384 flex-col gap-4">
      <FieldLabel htmlFor={id}>Photo</FieldLabel>
      <FileInput
        id={id}
        label="Photo"
        accept="image/*"
        multiple={false}
        value={photo}
        onChange={setPhoto}
        onSelect={([file]) => {
          if (file) {
            setPhoto([{ id: crypto.randomUUID(), name: file.name, size: file.size }]);
          }
        }}
      />
    </div>
  );
}
```

`readOnly` keeps the list at full contrast and drops the remove buttons;
the target takes no drop and opens no dialog. `disabled` also dims the
target and takes it out of the tab order.

**Disabled and read only**

```tsx
import { useId, useState } from 'react';
import { FieldLabel, FileInput, type UploadFile } from '@bh/ui';

export function DisabledAndReadOnly() {
  const id = useId();
  const [drafts, setDrafts] = useState<UploadFile[]>([{ id: '1', name: 'draft.pdf', size: 1_536 }]);
  const [signed, setSigned] = useState<UploadFile[]>([
    { id: '2', name: 'signed.pdf', size: 2_048 },
  ]);
  return (
    <div className="flex w-384 flex-col gap-16">
      <div className="flex flex-col gap-4">
        <FieldLabel htmlFor={`${id}-drafts`}>Drafts</FieldLabel>
        <FileInput
          id={`${id}-drafts`}
          label="Drafts"
          disabled
          value={drafts}
          onChange={setDrafts}
        />
      </div>
      <div className="flex flex-col gap-4">
        <FieldLabel htmlFor={`${id}-signed`}>Signed copies</FieldLabel>
        <FileInput
          id={`${id}-signed`}
          label="Signed copies"
          readOnly
          value={signed}
          onChange={setSigned}
        />
      </div>
    </div>
  );
}
```

## Keyboard and accessibility

| Key                | Does                                                                             |
| ------------------ | -------------------------------------------------------------------------------- |
| `Enter` or `Space` | On the drop target, opens the file dialog. On a remove button, removes its file. |

The drop target is a `button`, named by `label`, else by a `<label for>`
pointing at `id`, else by its own text. The file `<input>` behind it is
visually hidden, out of the tab order, and hidden from screen readers.
Each remove button is named "Remove" and the file's name, and a file in
progress shows a `progressbar` named "Uploading" and the file's name.

A read-only target sets `aria-disabled` and stays in the tab order.

## Props

| Prop                  | Type                                                                                                                                                                                                        | Default     | Description                                                                                                                                                                   |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `value` (required)    | `UploadFile[]`                                                                                                                                                                                              |             | The files listed under the drop target, each with its size, progress or error.                                                                                                |
| `onChange` (required) | `(value: UploadFile[]) => void`                                                                                                                                                                             |             | Removal, and any other change to the shown list.                                                                                                                              |
| `onSelect`            | `(files: File[]) => void`                                                                                                                                                                                   |             | New files chosen, by drop or by browse. The caller uploads them and feeds the result back through `value`.                                                                    |
| `accept`              | `string`                                                                                                                                                                                                    |             | The file types the browse dialog offers, as the `accept` attribute takes them: `image/*`, `.pdf`.                                                                             |
| `multiple`            | `boolean`                                                                                                                                                                                                   | `true`      | Whether several files can be chosen at once; `false` takes only the first file of a drop.                                                                                     |
| `label`               | `string`                                                                                                                                                                                                    |             | The drop target's accessible name, over a `<label htmlFor>` pointing at `id`. With neither, the target is named by its own text.                                              |
| `id`                  | `string`                                                                                                                                                                                                    |             | The control's id. Where it lands, and so what a `<label htmlFor>` names, is on each control's page.                                                                           |
| `aria-describedby`    | `string`                                                                                                                                                                                                    |             | The ids of what describes the control: its help, or its problem. It lands on the element `id` does. A form's field passes it, for the description or error its wrapper draws. |
| `size`                | `ControlSize`: `'xs'`, `'md'`, `'lg'`                                                                                                                                                                       | `'md'`      | The control's size: a field's height, padding, radius and type move together, at 30, 38 or 46 pixels.                                                                         |
| `tone`                | `Tone`: `'primary'`, `'secondary'`, `'success'`, `'warning'`, `'danger'`, `'neutral'`, `'red'`, `'orange'`, `'yellow'`, `'green'`, `'teal'`, `'cyan'`, `'blue'`, `'indigo'`, `'purple'`, `'pink'`, `'gray'` | `'primary'` | The role or scale it is coloured from.                                                                                                                                        |
| `disabled`            | `boolean`                                                                                                                                                                                                   | `false`     | Not applicable: removed from the tab order and from form submission.                                                                                                          |
| `readOnly`            | `boolean`                                                                                                                                                                                                   | `false`     | Not editable, but still focusable and still submitted.                                                                                                                        |
| `className`           | `string`                                                                                                                                                                                                    |             | Added to the control's own classes.                                                                                                                                           |

Each file in `value`:

```ts
interface UploadFile
```

A file as this control shows it — NOT the browser's `File`.

Uploading belongs to the caller: it owns the endpoint, the retries and the
abort. So the control reports what was picked and renders whatever state the
caller reports back, rather than pretending to own a transfer it cannot see.

| Member            | Type     | Default | Description                                                             |
| ----------------- | -------- | ------- | ----------------------------------------------------------------------- |
| `id` (required)   | `string` |         | Tells the files apart: a removal drops the file with this id.           |
| `name` (required) | `string` |         | Shown in the list, and in the name of its remove button.                |
| `size`            | `number` |         | Bytes. Rendered as a readable size when present.                        |
| `progress`        | `number` |         | 0–100 while a transfer is running; omit once it has settled.            |
| `error`           | `string` |         | Per file, not per control: one rejected file must not condemn the rest. |
