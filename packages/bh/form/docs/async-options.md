---
title: Async options
summary: Load a field's options, or any of its config, from elsewhere, and load
  them again when the fields they depend on change.
order: 7
related: [Visibility, Rendering and submitting, Building a form]
---

[//]: # 'written from async-options.doc.yaml by pnpm docs:sync; edit that file, not this one'

# Async options

Load a field's options, or any of its config, from elsewhere, and load
them again when the fields they depend on change.

## A resolver

Any key of a field's `config` may be a resolver instead of a value:
`fn`, which loads the value, and `dependsOn`, the fields it reads.
`fn` is called with those fields' values, and again whenever one of
them changes. Pick a region:

**Dependent options**

```tsx
import { defineForm, defineRegistry, Form, FormProvider } from '@bh/form';
import { baseInputs, baseLayouts, FieldWrapper, RootWrapper } from '@bh/ui';

const registry = defineRegistry({
  inputs: baseInputs,
  layouts: baseLayouts,
  field: { Component: FieldWrapper },
  root: { Component: RootWrapper },
});

const CITIES: Record<string, string[]> = {
  north: ['Bergen', 'Oulu', 'Tromsø'],
  south: ['Faro', 'Málaga', 'Palermo'],
};

// Stands in for a request: the cities of a region, after a moment.
function loadCities(region: unknown) {
  const names = typeof region === 'string' ? (CITIES[region] ?? []) : [];
  return new Promise<{ value: string; label: string }[]>((resolve) => {
    setTimeout(() => resolve(names.map((name) => ({ value: name, label: name }))), 800);
  });
}

const trip = defineForm(registry).build((b) => {
  return [
    b.radio({
      name: 'region',
      label: 'Region',
      config: {
        options: [
          { value: 'north', label: 'North' },
          { value: 'south', label: 'South' },
        ],
      },
    }),
    b.select({
      name: 'city',
      label: 'City',
      when: { field: 'region', truthy: true },
      config: {
        placeholder: 'Pick a city',
        options: { fn: ({ region }) => loadCities(region), dependsOn: ['region'] },
      },
    }),
  ];
});

export function DependentOptions() {
  return (
    <FormProvider registry={registry}>
      <div className="w-full max-w-360">
        <Form form={trip} />
      </div>
    </FormProvider>
  );
}
```

The city's `when` keeps it hidden until a region is picked, so its
options are first loaded for one. While they load, the field is given
`loading`: `@bh/ui`'s inputs with options are disabled until they come.

## What is loaded again

Each form keeps what its resolvers load, by field, by config key and by
the values they read. Going back to a region already loaded shows its
cities at once, without calling `fn`. A load that finishes after its
fields have changed is kept for the values it read, not shown for the
new ones, so a slow answer for North never replaces South's.

## When it fails

A rejected `fn` gives the field `configError`, to its input and its
wrapper, and the key stays unset. `@bh/ui`'s field wrapper draws it in
the problem's place, with the error's own message, so reject with one a
reader can act on; one with no message reads "This field could not be
loaded." The input is described by it, as by a problem.

## Submitting

A submit waits for the loads of the fields on screen, then checks and
sends. A field that is hidden doesn't hold it up. Past 30 seconds, it
stops waiting and fails.

## Rules

- When a field a resolver reads changes, the field goes back to its
  kind's empty value: a city picked for one region is cleared when the
  region changes, even while the city is hidden. The values a form starts
  with stay, so a stored record opens as it was saved.
- A field's resolvers are one load: until every one of its keys has
  loaded, its input may be given none of them.
- Inside a list's item or an object, a resolver isn't loaded: those
  fields are given their plain config keys only.
- `isAsyncResolver` tells a resolver from a value: an object with an
  `fn` function and a `dependsOn` array.

## Reference

```ts
interface AsyncResolver<T, Deps extends readonly string[] = readonly string[]>
```

A config key loaded rather than written: `fn` is called with the values of
the fields `dependsOn` names, and again whenever they change.

| Member                 | Type                                                  | Default | Description                                      |
| ---------------------- | ----------------------------------------------------- | ------- | ------------------------------------------------ |
| `fn` (required)        | `(deps: Record<Deps[number], unknown>) => Promise<T>` |         | Loads the key's value from those fields' values. |
| `dependsOn` (required) | `Deps`                                                |         | The fields it reads, by name.                    |

```ts
type MaybeAsync<T> = T | AsyncResolver<T>;
```

A config key's value, or a resolver that loads it.

```ts
type AuthorConfig<TResolved> = { [K in keyof TResolved]: MaybeAsync<TResolved[K]> };
```

An input's config as a field writes it: any key may be an `AsyncResolver`.

```ts
isAsyncResolver<T>(value: MaybeAsync<T>): value is AsyncResolver<T>
```

Whether a config key's value is a resolver to load it with.

| Parameter          | Type            | Default | Description |
| ------------------ | --------------- | ------- | ----------- |
| `value` (required) | `MaybeAsync<T>` |         |             |

Returns `value is AsyncResolver<T>`.
