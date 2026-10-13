---
title: Draft, commit and submit
summary: Hold what's typed as a draft, save each field as it commits with
  onCommit, send the whole form on Save with onSubmit, or both.
order: 5
related: [Rendering and submitting, Input, Instrument's bindings]
---

[//]: # 'written from draft-commit-submit.doc.yaml by pnpm docs:sync; edit that file, not this one'

# Draft, commit and submit

Every form has three states. The **draft** is what's being typed, held
by the field. A field **commits** it when it hands it to the form: at
every keystroke, or on Enter, on leaving the field or the window, or
after a pause in typing. The form **submits** its values when it sends
them: on Save, or at each commit when it saves as you go.

## Three states

The form's values are committed values: a field's draft joins them when
it commits. Type in the name below, then Tab away, then Save.
`useFieldDraft` reads the draft, `useFieldValue` the committed value, and
`onSubmit` gets the submitted one. Enter commits too, and in a one-line
field it submits the form as well, as the browser's own does.

**Draft committed submitted**

```tsx
import { useState } from 'react';
import {
  defineForm,
  defineRegistry,
  Form,
  FormProvider,
  useFieldDraft,
  useFieldValue,
  useStandaloneForm,
} from '@bh/form';
import { baseInputs, baseLayouts, Button, FieldWrapper, RootWrapper } from '@bh/ui';

const registry = defineRegistry({
  inputs: baseInputs,
  layouts: baseLayouts,
  field: { Component: FieldWrapper },
  root: { Component: RootWrapper },
});

// Its fields commit on Enter and on leaving, so a draft can be seen.
const profile = defineForm(registry).build(
  (b) => {
    return [b.text({ name: 'name', label: 'Name', defaultValue: 'Ana Lima', config: {} })];
  },
  { commit: 'leave' },
);

export function DraftCommittedSubmitted() {
  return (
    <FormProvider registry={registry}>
      <Profile />
    </FormProvider>
  );
}

function Profile() {
  const [submitted, setSubmitted] = useState('Ana Lima');
  const api = useStandaloneForm({
    form: profile,
    onSubmit: (values) => setSubmitted(String(values.name)),
  });
  return (
    <div className="flex w-full max-w-480 flex-col gap-16">
      <Form formApi={api}>
        <States submitted={submitted} />
      </Form>
      <div className="border-gray-6 flex items-center gap-12 border-t-1 pt-12">
        <Button
          variant="solid"
          // A draft is worth saving too: Save commits it first.
          disabled={!api.isDirty && !api.hasDrafts}
          loading={api.isSubmitting}
          onClick={() => void api.submit()}
        >
          Save
        </Button>
        <span className="text-12/17 text-gray-11 font-sans">
          {api.isDirty ? 'Unsaved changes' : 'No changes'}
        </span>
      </div>
    </div>
  );
}

// Inside <Form>, so it can read the field's draft and its committed value.
function States({ submitted }: { submitted: string }) {
  const states = [
    { label: 'Draft', value: useFieldDraft<string>('name') },
    { label: 'Committed', value: useFieldValue<string>('name') },
    { label: 'Submitted', value: submitted },
  ];
  return (
    <dl className="mt-12 grid grid-cols-3 gap-8">
      {states.map((state) => {
        return (
          <div key={state.label} className="bg-gray-3 rounded-6 flex min-w-0 flex-col gap-4 p-8">
            <dt className="text-11/13 text-gray-11 font-sans">{state.label}</dt>
            <dd className="text-12/17 text-gray-12 truncate font-mono">{state.value}</dd>
          </div>
        );
      })}
    </dl>
  );
}
```

## When a field commits

`commit` is set per form: as `build`'s option, or on `<Form>` or
`useStandaloneForm`, which win over it. A field's config overrides it, as
data, so a stored form or a table's column can carry it. The form gives it
to each field's input, and the text controls hold what's typed until then
([Input](../../ui/src/library/inputs/components/input/input.md#when-it-commits) says how).

- `'change'`, the default: at every keystroke, as a form always has.
- `'leave'`: on Enter, and on leaving the field or the window.
- `{ after: 800 }`: on those, and after 800 ms without typing.

```tsx
import { defineForm, defineRegistry } from '@bh/form';
import { baseInputs, baseLayouts, FieldWrapper } from '@bh/ui';

const registry = defineRegistry({
  inputs: baseInputs,
  layouts: baseLayouts,
  field: { Component: FieldWrapper },
});

export const task = defineForm(registry).build(
  (b) => {
    return [
      b.text({ name: 'title', label: 'Title', config: {} }),
      // This one saves at every keystroke, whatever the form says.
      b.text({ name: 'code', label: 'Code', config: { commit: 'change' } }),
    ];
  },
  { commit: 'leave' },
);
```

## Saving as you go

`onCommit(change, values)` runs each time a field commits, with what
changed (`{ field, value, previous }`) and the visible fields' values
after it. A form that saves each field as it commits, such as an item's
detail with one request per field, needs no Save and no `onSubmit`.

`onCommit` may return a promise: while it runs, the field says it's
saving; if it fails, the field keeps the value and shows the error's
message, until it commits again. A value the field's own `validate`
rejects isn't handed over. Clear the title below to see a save fail.

**Saving as you go**

```tsx
import { useState } from 'react';
import { defineForm, defineRegistry, Form, FormProvider, type CommitChange } from '@bh/form';
import { baseInputs, baseLayouts, FieldWrapper, RootWrapper } from '@bh/ui';

const registry = defineRegistry({
  inputs: baseInputs,
  layouts: baseLayouts,
  field: { Component: FieldWrapper },
  root: { Component: RootWrapper },
});

const task = defineForm(registry).build(
  (b) => {
    return [
      b.text({ name: 'title', label: 'Title', defaultValue: 'Plan the offsite', config: {} }),
      b.number({
        name: 'estimate',
        label: 'Estimate',
        defaultValue: 3,
        config: { min: 0, suffix: 'hours' },
      }),
    ];
  },
  { commit: 'leave' },
);

/** Stands in for a server: a moment's wait, and a refusal of an empty title. */
async function patch(change: CommitChange) {
  await new Promise((resolve) => setTimeout(resolve, 700));
  if (change.field === 'title' && change.value === '') {
    throw new Error('A task needs a title.');
  }
}

export function SavingAsYouGo() {
  const [log, setLog] = useState<string[]>([]);
  return (
    <FormProvider registry={registry}>
      <div className="flex w-full max-w-400 flex-col gap-12">
        <Form
          form={task}
          onCommit={async (change) => {
            await patch(change);
            const line = `PATCH ${change.field}: ${JSON.stringify(change.value)}`;
            setLog((lines) => [line, ...lines].slice(0, 3));
          }}
        />
        <ul className="text-12/17 text-gray-11 flex flex-col gap-2 font-mono">
          {log.length === 0 ? <li>Nothing saved yet.</li> : null}
          {log.map((line, index) => {
            return <li key={`${index}-${line}`}>{line}</li>;
          })}
        </ul>
      </div>
    </FormProvider>
  );
}
```

## Saving on Save

`onSubmit(values)` runs on Save, as it always has: a create dialog sends
everything at once. A form may have both: a settings page can check each
field with `onCommit` as it commits and save on Save. A Save waits for
the commits still saving, and stops while one has failed: the field says
why.

Save while a field holds a draft commits the draft first, so it isn't
lost, even from a button that takes no focus or a keyboard shortcut.

## Dirty

Dirty means committed but not submitted: `useStandaloneForm`'s `isDirty`
is true while the values differ from what was last submitted, or from
where the form started. It's what "Unsaved changes" and a Save button go
by, and while it's true, or a field holds a draft, the form asks before
the page is left. A form with no `onSubmit` is never dirty: it saves as it
goes. `hasDrafts` says a field holds a draft, which a Save would commit.

## Rules

- A field's draft is the field's: it reaches the form's values only when
  the field commits, and `useFieldDraft` reads it.
- `onCommit` runs for a value that changed, once its field's own check
  passes.
- Only the latest commit of a field speaks for it: an older save that
  settles later neither marks it saving nor fails it.
- A reset puts the values back where they started, or to what was last
  submitted, and forgets the drafts and the failed saves.
- `commit`: a field's config, then `<Form>` or `useStandaloneForm`, then
  the form's own, then `'change'`.

## Reference

```ts
type Commit = 'change' | 'leave' | { after: number };
```

When a field hands its value to the form: `'change'` at every keystroke,
`'leave'` on Enter and on leaving the field or the window, `{ after: 800 }`
on those and after 800 ms without typing.

Until then, what you type is a draft the field's control holds. It's data
rather than a callback so a form, or a field's config, can carry it
(`{ commit: 'leave' }`).

```ts
interface CommitChange
```

What changed when a field committed: `onCommit`'s first argument.

| Member                | Type      | Default | Description                       |
| --------------------- | --------- | ------- | --------------------------------- |
| `field` (required)    | `string`  |         | The field's name.                 |
| `value` (required)    | `unknown` |         | Its value now: what it committed. |
| `previous` (required) | `unknown` |         | Its value before.                 |

```ts
type OnCommit = (change: CommitChange, values: Record<string, unknown>) => void | Promise<void>;
```

`onCommit`: a field committed, with what changed and the form's values after it.

```ts
useFieldDraft<T = unknown>(name: string): T
```

What a field shows as it's typed: its draft before it commits, else its
value. `useFieldValue` gives the committed value, which a field set to
commit on leaving only gets when it's left. For anything drawn inside
`<Form>`; throws outside one.

| Parameter         | Type     | Default | Description |
| ----------------- | -------- | ------- | ----------- |
| `name` (required) | `string` |         |             |

Returns `T`.
