// A registry: entries by name, defined once with what its entries are and how
// each is checked, and extended by registering more, which gives a new one.
// bh's renderers, layouts and formats are registries, and an app's own of
// anything can be. It imports nothing: an entry is checked by any schema that
// implements Standard Schema (valibot, zod, arktype).
export {
  defineRegistry,
  type EntriesOf,
  type Registry,
  type RegistryOf,
  type RegistrySpec,
} from './registry';
export type { StandardIssue, StandardResult, StandardSchema } from './standard-schema';
