# @bh/form

The form engine. A form is data: a tree of field and layout nodes, each field
with an optional `when` (shown while other fields hold certain values) and an
optional `validate` schema. `<Form>` draws it with a **registry** of
components (an input per kind, a layout per kind, a wrapper around each field
and one around the form), holds its values on `@tanstack/react-form`, and
submits the fields on screen. The `./valibot` entry builds a form from a
valibot object schema.

It draws nothing itself. That is why it is its own package: the form's data
says nothing of how it looks, so a new design system is a new registry, not a
new form. `@bh/ui`'s registry is `baseInputs`, `baseLayouts`, `FieldWrapper`
and `RootWrapper`.

## Docs

The Forms guide is in [`docs/`](docs/INDEX.md): ten pages, from a first form
to writing an input, with the package's rules and its reference. Each page is a
`.doc.yaml` with its `.md` copy beside it; an app reads them in its copy of
the package, `packages/bh/form/docs/`. The docs site (`pnpm docs:dev` in bh) shows
them at `/forms/overview`, with the examples live.

## Layer

Depends on `@tanstack/react-form` and `@standard-schema/spec`, with React as a
peer; valibot only for its tests (the `./valibot` entry reads a schema's shape
without importing valibot). Of bh's packages, only `@bh/ui` depends on it.
