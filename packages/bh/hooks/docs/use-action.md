---
title: useAction
summary: An async action run from the page, a save or a send, with whether it is
  going, what went wrong, and what it gave back.
order: 3
related: [Writing a hook, useDebouncedCallback]
---

[//]: # 'written from use-action.doc.yaml by pnpm docs:sync; edit that file, not this one'

# useAction

An async action run from the page, a save or a send: `isPending` while
it is going, `error` for what went wrong, and `result` for what it gave
back, with `run` to start it and `reset` to forget the last one. It
takes the place of a `busy` and an `error` state set by hand around a
`try`, and draws nothing: the caller shows the three.

## Import

```tsx
import { useAction } from '@bh/hooks';
```

## Examples

**Saved or told why not**

```tsx
import { useState } from 'react';
import { useAction } from '@bh/hooks';

// A name saved to a pretend server that takes a moment and refuses "admin":
// a plain form, no component of bh's, with the hook's three states shown.

const BUTTON = 'rounded-8 border-gray-6 border-1 px-12 py-6 disabled:opacity-50';

/** The pretend server: three quarters of a second, then the name or a refusal. */
function saveName(name: string): Promise<string> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (name.trim().toLowerCase() === 'admin') {
        reject(new Error('“admin” is taken: pick another name.'));
      } else {
        resolve(name.trim());
      }
    }, 750);
  });
}

export function SavedOrToldWhyNot() {
  const [name, setName] = useState('admin');
  const save = useAction(saveName);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void save.run(name);
      }}
      className="flex w-320 flex-col gap-8"
    >
      <label className="text-12/17 text-gray-11 flex flex-col gap-4">
        Name
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="border-gray-6 rounded-6 text-gray-12 border-1 px-8 py-4"
        />
      </label>
      <div className="flex items-center gap-8">
        <button type="submit" className={BUTTON} disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Save'}
        </button>
        {save.result === undefined ? null : (
          <span className="text-12/17 text-gray-10">Saved as {save.result}.</span>
        )}
      </div>
      {save.error ? (
        <p role="alert" className="text-12/17 text-red-11">
          {save.error.message}
        </p>
      ) : null}
    </form>
  );
}
```

Press **Save**: the pretend server takes a moment, during which the
button is disabled and says so, then refuses `admin`, and the message
shows under the field. Change the name and save again: the message
goes as the run starts, and the saved name shows when it is done. The
action goes first, as `useCallback` takes its function first; it is
read when `run` is called, so it needs no `useCallback` of its own.

## Going on afterwards

`run` never rejects: it resolves to how the run went, `{ ok: true,
result }` or `{ ok: false, error }`. An event handler that only starts
it calls it with `void`, and one that goes on afterwards, to close a
dialog or clear a field, awaits it and reads `ok`:

```tsx
import { useAction } from '@bh/hooks';

declare function archive(id: string): Promise<void>;

export function ArchiveButton({ id, onDone }: { id: string; onDone: () => void }) {
  const archiving = useAction(archive);
  const onClick = async () => {
    const { ok } = await archiving.run(id);
    if (ok) {
      onDone();
    }
  };
  return (
    <button type="button" disabled={archiving.isPending} onClick={() => void onClick()}>
      {archiving.isPending ? 'Archiving…' : 'Archive'}
    </button>
  );
}
```

A view with more than one action, a save and a build, takes one hook
for each, so each button says its own.

## Rules

- **Its server value** is idle: `isPending` false, no `error` and no
  `result`.
- **`error` is an `Error`**, so `error.message` is what to show; a
  thrown value that isn't one comes wrapped in one, with the value as
  its `cause`. It goes as the next run starts, or on `reset`.
- **`result` is the last run that worked**, kept through a run that
  fails, until the next one works or `reset`.
- **A run started while one is going supersedes it**: only the latest
  run's error or result is kept, and `isPending` holds until it
  settles. Each run's own promise still resolves to how it went. A
  button disabled while `isPending` starts no second run.
- **`run` and `reset` are the same functions** for the hook's life.
- **Cleaning up**: a run that settles after the component has gone
  changes nothing, and its promise still resolves. Nothing is
  cancelled: the action runs to its end.

## Reference

```ts
useAction<Args extends unknown[], Result>(action): UseActionResult<Args, Result>
```

An async action run from the page, a save or a send, with whether it is
going and what went wrong: `isPending` to disable the button and say so,
`error` to show, and `result` for what the last run gave back. It draws
nothing: the caller shows the three and calls `run`.

`run` never rejects, so an event handler calls it with `void` and nothing
goes unhandled; a caller that goes on afterwards, to close a dialog or
clear a field, awaits it and reads `ok`. The action is read when `run`
is called, so it needs no `useCallback`.

A run started while one is going supersedes it: only the latest run's
error or result is kept, and `isPending` holds until it settles. Its
server value is idle, with no error and no result. A run that settles
after the component has gone changes nothing, and its promise still
resolves.

| Parameter           | Type                                           | Default | Description                                                 |
| ------------------- | ---------------------------------------------- | ------- | ----------------------------------------------------------- |
| `action` (required) | `(...args: Args) => Promise<Result> \| Result` |         | What to run: a function that returns a promise, or a value. |

Returns `UseActionResult<Args, Result>`.

```ts
interface UseActionResult<Args extends unknown[], Result>
```

What `useAction` gives back: state, then actions.

| Member                 | Type                                                | Default | Description                                                                                                                                                                   |
| ---------------------- | --------------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `isPending` (required) | `boolean`                                           |         | Whether a run is going: from the call until it settles.                                                                                                                       |
| `error` (required)     | `Error`                                             |         | What the last run threw, until the next run starts or `reset`. A thrown value that isn't an `Error` comes as one, with the value as its `cause`.                              |
| `result` (required)    | `Result`                                            |         | What the last run that worked resolved to, until `reset`: a run that fails leaves it as it was.                                                                               |
| `run` (required)       | `(...args: Args) => Promise<ActionOutcome<Result>>` |         | Runs the action with these arguments. It never rejects: it resolves to how the run went, which a caller that goes on afterwards reads. The same function for the hook's life. |
| `reset` (required)     | `() => void`                                        |         | Forgets the last error and result. A run still going keeps going. The same function for the hook's life.                                                                      |

```ts
type ActionOutcome<Result> = { ok: true; result: Result } | { ok: false; error: Error };
```

How a run went: what the action resolved to, or the error it threw.
