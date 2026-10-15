import type { FieldValue, Registry } from '@bh/resource';
import type { ResourceDefinition } from './definition';
import type {
  CreateOperation,
  DeleteOperation,
  ReadOperation,
  UpdateOperation,
} from './operations';
import type { PagedQuery, WholeQuery } from './query';

// What a source is: where a resource's rows live (a database, an external
// API, a file) and how it serves each operation, each declared apart, beside
// the code that runs it. Each capability a source declares is its
// translation: a filter's operator as the source's own request, a sort as its
// own sort name, a field as its own key in a body. The keys of those maps are
// the declaration, so nothing is claimed without being said how, and the
// metadata is made from them (serve).

/**
 * Where a resource's rows live, and how it serves each operation. An
 * operation left out isn't served, and that's the only place it's said.
 */
export interface Source<R = unknown, Request = unknown, Answer = unknown, Body = unknown> {
  /** Our fields from the source's record: its keys are the fields it reads, every one the resource has. */
  row: Readonly<Record<string, (record: R) => FieldValue>>;
  query?: PagedQuery<R, Request, Answer> | WholeQuery<R, Answer>;
  read?: ReadOperation<R>;
  create?: CreateOperation<R, Body>;
  update?: UpdateOperation<R, Body>;
  delete?: DeleteOperation;
}

/** A source made for a resource, as a database adapter makes one from its columns. */
export type SourceFactory<R = unknown, Request = unknown, Answer = unknown, Body = unknown> = (
  definition: ResourceDefinition,
  registry: Registry,
) => Source<R, Request, Answer, Body>;
