---
title: useDebouncedCallback
summary: A callback made once its calls stop for a delay, with the last call's
  arguments, which can be made now or dropped, and says whether one is waiting.
order: 3
related: [Writing a hook, useDebouncedValue]
---

[//]: # 'written from use-debounced-callback.doc.yaml by pnpm docs:sync; edit that file, not this one'

# useDebouncedCallback

A callback made once its calls stop for a delay, with the last call's
arguments: a draft saved once the typing stops, a filter sent once a
slider rests. `run` calls it, `flush` makes the waiting call now,
`cancel` drops it, and `isPending` says whether one is waiting.

## Import

```tsx
import { useDebouncedCallback } from '@bh/hooks';
```

## Examples

**Saved once the typing stops**

```tsx
import { useState } from 'react';
import { useDebouncedCallback } from '@bh/hooks';

// A note saved once the typing stops for a second, or at once from its
// button: a plain textarea and buttons, no component of bh's.

const BUTTON = 'rounded-8 border-gray-6 border-1 px-12 py-6 disabled:opacity-50';

export function SavedOnceTheTypingStops() {
  const [text, setText] = useState('');
  const [saved, setSaved] = useState<string[]>([]);
  const save = useDebouncedCallback(
    (note: string) => {
      setSaved((before) => [...before, note].slice(-3));
    },
    { delay: 1000, onUnmount: 'flush' },
  );
  return (
    <div className="flex w-320 flex-col gap-8">
      <textarea
        aria-label="Note"
        value={text}
        rows={3}
        onChange={(event) => {
          setText(event.target.value);
          save.run(event.target.value);
        }}
        className="border-gray-6 rounded-6 border-1 px-8 py-4"
      />
      <div className="flex items-center gap-8">
        <button type="button" className={BUTTON} disabled={!save.isPending} onClick={save.flush}>
          Save now
        </button>
        <button type="button" className={BUTTON} disabled={!save.isPending} onClick={save.cancel}>
          Don’t save
        </button>
        <span className="text-12/17 text-gray-10">{save.isPending ? 'Unsaved' : 'Saved'}</span>
      </div>
      <ol className="text-12/17 text-gray-11 font-mono">
        {saved.map((note, index) => {
          return <li key={index}>{note === '' ? '(empty)' : note}</li>;
        })}
      </ol>
    </div>
  );
}
```

Type a note: each key calls `save.run(text)`, and the note is saved a
second after the last one, with the text as it was then. **Save now**
makes the waiting call at once, and **Don't save** drops it; both are
only enabled while a call waits. The callback goes first and the
options after it, as `useCallback` takes its function first.

`onUnmount: 'flush'` makes a waiting call as the component goes, so a
note typed just before the reader leaves the page is still saved;
without it, a waiting call is dropped. `leading: true` makes the first
call of a burst at once too, and `maxWait` the longest a call waits
while the calls keep coming.

## Rules

- **Its server value**: nothing waiting, `isPending` false.
- **The last call wins**: the callback is made once per burst, with
  the arguments of the burst's last `run`; with `leading`, once more at
  its start, with the first's.
- **The callback is read when it is called**, so it need not be
  memoised, and a new one starts no wait again.
- **What keeps its identity**: `run`, `flush` and `cancel`, for the
  hook's life, so `run` can be handed to a memoised child or listed as
  a dependency.
- **Cleaning up**: its timers go when the call is made or dropped, and
  with the component, which drops a waiting call unless `onUnmount` is
  `flush`.

## Reference

```ts
useDebouncedCallback<Args extends unknown[]>(callback, options): UseDebouncedCallbackResult<Args>
```

A callback made once its calls stop for `delay` milliseconds, with the
last call's arguments: a draft saved once the typing stops, a filter sent
once a slider rests. `flush` makes the waiting call now, `cancel` drops
it, and `isPending` says whether one is waiting.

The callback is read when it is called, so it need not be memoised, and
changing it starts no wait again. Its server value: nothing waiting.

| Parameter                  | Type                                         | Default    | Description                                                                                                                    |
| -------------------------- | -------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `callback` (required)      | `(...args: Args) => void`                    |            | What to call.                                                                                                                  |
| `options` (required)       | `UseDebouncedCallbackOptions`                |            |                                                                                                                                |
| `options.delay` (required) | `number`                                     |            | How long the calls must stop for, in milliseconds, before the last one is made.                                                |
| `options.maxWait`          | `number`                                     |            | The longest a call waits, in milliseconds, however long the calls keep coming. No limit unless given.                          |
| `options.leading`          | `boolean`                                    | `false`    | Make the first call of a burst at once too, not only the last one once the burst ends.                                         |
| `options.onUnmount`        | `'cancel' \| 'flush'`: `'cancel'`, `'flush'` | `'cancel'` | What a call still waiting when the component unmounts does: it is dropped (`cancel`, unless given), or made at once (`flush`). |

Returns `UseDebouncedCallbackResult<Args>`.

```ts
interface UseDebouncedCallbackOptions
```

What `useDebouncedCallback` takes after the callback.

| Member             | Type                                         | Default | Description                                                                                                                    |
| ------------------ | -------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `delay` (required) | `number`                                     |         | How long the calls must stop for, in milliseconds, before the last one is made.                                                |
| `maxWait`          | `number`                                     |         | The longest a call waits, in milliseconds, however long the calls keep coming. No limit unless given.                          |
| `leading`          | `boolean`                                    |         | Make the first call of a burst at once too, not only the last one once the burst ends.                                         |
| `onUnmount`        | `'cancel' \| 'flush'`: `'cancel'`, `'flush'` |         | What a call still waiting when the component unmounts does: it is dropped (`cancel`, unless given), or made at once (`flush`). |

```ts
interface UseDebouncedCallbackResult<Args extends unknown[]>
```

What `useDebouncedCallback` gives back: state, then actions.

| Member                 | Type                      | Default | Description                                                                                                                                    |
| ---------------------- | ------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `isPending` (required) | `boolean`                 |         | Whether a call is waiting to be made.                                                                                                          |
| `run` (required)       | `(...args: Args) => void` |         | Calls the callback once the calls stop for `delay`, with the last call's arguments. The same function for the hook's life, as every action is. |
| `flush` (required)     | `() => void`              |         | Makes the waiting call now, if there is one.                                                                                                   |
| `cancel` (required)    | `() => void`              |         | Drops the waiting call, if there is one.                                                                                                       |
