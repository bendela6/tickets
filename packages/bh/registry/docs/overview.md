---
title: Overview
summary: Keep entries by name, each checked as it is defined and registered, and
  add an app's own beside bh's without changing them.
order: 1
related: [Renderers, Layouts, Formats]
---

[//]: # 'written from overview.doc.yaml by pnpm docs:sync; edit that file, not this one'

# Overview

A registry holds entries by name, which code looks up by the name a
template, a view or a request gives. bh's renderers, layouts and formats
are each one, and so is an app's own of anything. `defineRegistry` says
once what its entries are and how each is checked; `define` checks one
entry and types it; `register` gives a new registry with those entries
beside its own. bh's stays as it is, and an app's is bh's and more.

```ts
import * as v from 'valibot';
import { defineRegistry } from '@bh/registry';

/** A job a schedule runs by its name, with the options it stores. */
interface Job<O> {
  label: string;
  options?: v.GenericSchema<unknown, O>;
  run: (options: O) => string;
}

const jobs = defineRegistry({
  name: 'job',
  // Any Standard Schema (valibot, zod, arktype): what each entry holds.
  schema: v.object({ label: v.pipe(v.string(), v.nonEmpty('a job has a label')) }),
  // Each entry typed by its own options; the registry holds them all.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  define: <O>(job: Job<O>): Job<any> => job,
});

// `run` is given what `options` gives.
const backup = jobs.define({
  label: 'Back up',
  options: v.object({ keep: v.number() }),
  run: ({ keep }) => `backing up, keeping ${keep}`,
});

const prune = jobs.define({ label: 'Prune', run: () => 'pruning' });

// Each named by its key.
export const baseJobs = jobs.register({ backup, prune });

baseJobs.names; // ['backup', 'prune']
baseJobs.get('backup').label; // 'Back up'
```

## Looking up

`get(name)` gives the entry, typed by the name it was registered as. For
a name it doesn't hold it throws, saying which it does, so a misspelt
name fails where it is asked for. A name from stored data, which may be
one nothing registered, is asked about first with `has(name)`. `names`,
`values()` and `entries()` give them all, in the order they were
registered.

```ts
import { baseFormats } from '@bh/template';

baseFormats.get('bytes'); // bh's bytes format
baseFormats.get('rate'); // throws: No format is registered as "rate". Registered: number, percent, …

const stored: string = 'rate';
const format = baseFormats.has(stored) ? baseFormats.get(stored) : undefined;
```

## Adding and replacing

`register` never takes a name twice: it throws on one the registry holds
already. `override` replaces entries it holds, an app's link renderer
over bh's, and throws on a name it doesn't. Both give a new registry and
leave the one they were called on as it is, so nothing registers by side
effect: what holds an app's entries is the registry it built, and passes
on. An entry with a `name` of its own, as a format, is registered by
that name or refused.

```tsx
import { baseRenderers, createLinkRenderer, type LinkAnchor } from '@bh/ui';

declare const RouterAnchor: LinkAnchor;

export const renderers = baseRenderers.override({
  link: { ...baseRenderers.get('link'), Component: createLinkRenderer(RouterAnchor) },
});
```

## Checks

`schema` checks each entry as it is defined and as it is registered, with
any library that implements Standard Schema: valibot, zod or arktype. It
checks the entry's data, as a renderer's kinds or a layout's options'
schema; the entry kept is the one given. It answers at once: a schema
that checks asynchronously is refused. `check` runs across the entries of
every registry built, for a rule no one entry can hold, as a format
taking a kind nothing registered.

```ts
interface RegistrySpec<T>
```

What a registry's entries are, and how each is checked.

| Member            | Type                                  | Default | Description                                                                                                                                                                                                              |
| ----------------- | ------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `name` (required) | `string`                              |         | What an entry is called, in messages: 'renderer', 'format'.                                                                                                                                                              |
| `schema`          | `StandardSchema<unknown, Partial<T>>` |         | Checks each entry as it is defined and registered: any Standard Schema (valibot, zod, arktype), its output part of the entry's type. It checks the entry's data (its kinds, its width); the entry kept is the one given. |
| `check`           | `(registry: RegistryOf<T>) => void`   |         | Rules across the entries, run on every registry built: throws on one that fails, as a format taking a kind nothing registered.                                                                                           |

## Taking any registry

A function that looks entries up takes `RegistryOf<T>`: any registry
holding `T`, bh's or an app's with more in it, whatever its names. A
type read off a registry's entries takes `EntriesOf<typeof registry>`,
each entry by its name as it was registered: a form's kinds, a
renderer's options.

```ts
interface RegistryOf<T>
```

What looking entries up needs, of any registry holding `T`, whatever its
`define` and its names: what a function that draws or runs by name takes,
bh's registry or an app's with more in it.

| Member               | Type                        | Default | Description                                                                     |
| -------------------- | --------------------------- | ------- | ------------------------------------------------------------------------------- |
| `name` (required)    | `string`                    |         | What an entry is called, in messages: 'renderer'.                               |
| `names` (required)   | `readonly string[]`         |         | Its entries' names, in the order they were registered.                          |
| `get` (required)     | `(name: string) => T`       |         | The entry by its name. Throws, saying which names it holds, for one it doesn't. |
| `has` (required)     | `(name: string) => boolean` |         | Whether it holds an entry by this name.                                         |
| `values` (required)  | `() => T[]`                 |         | Its entries, in the order they were registered.                                 |
| `entries` (required) | `() => [string, T][]`       |         | Its entries with their names, in the order they were registered.                |
