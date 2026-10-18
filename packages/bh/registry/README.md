# @bh/registry

Entries by name, which code looks up by the name a template, a view or a
request gives. bh's renderers, layouts and formats are each one, and so is an
app's own of anything. It imports none of bh's packages and nothing at
runtime, so a server and a browser hold the same registry.

```ts
import * as v from 'valibot';
import { defineRegistry } from '@bh/registry';

const jobs = defineRegistry({
  name: 'job',
  schema: v.object({ label: v.pipe(v.string(), v.nonEmpty()) }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  define: <O>(job: Job<O>): Job<any> => job,
});

const backup = jobs.define({ label: 'Back up', options, run: ({ keep }) => … });
export const baseJobs = jobs.register({ backup });
```

`defineRegistry` says once what its entries are and how each is checked.
`define` checks one entry and types it, by its own type parameters when the
entry has them (a renderer's options). `register` gives a new registry with
entries beside its own, each named by its key; `override` gives one with
entries in place of its own. Neither changes the registry it is called on, so
bh's stays as it is and an app's is bh's and more, and nothing registers by
side effect.

`get(name)` gives the entry, typed by the name it was registered as, and
throws for a name it doesn't hold, saying which it does; `has(name)` asks
first, for a name from stored data. `names`, `values()` and `entries()` give
them all, in the order they were registered. A name is never taken twice, and
an entry with a `name` of its own is registered by it.

`schema` is any Standard Schema (valibot, zod, arktype), checking each entry
as it is defined and registered; `check` runs across the entries of every
registry built. A function that looks entries up takes `RegistryOf<T>`, any
registry holding `T`, whatever its names; a type read off a registry's
entries takes `EntriesOf<typeof registry>`.

The pages: [Overview](docs/overview.md).
