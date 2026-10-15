import type { FieldValue, Id, Issue } from '@bh/resource';
import type { Context } from './context';

// A source's operations on one row: read it, and the writes, each field a
// write takes said as the source's body holds it.

/** How a field is written: what it is in the source's body, and whether a write must set it. */
export interface WriteField<Body> {
  /** A create must set it (unless it has a default), and a patch can't clear it. */
  required?: boolean;
  /** What a create that leaves it out sets: a create's alone. */
  default?: FieldValue;
  /** Its value, as the source's body holds it: { assignees: [login] }. */
  to: (value: FieldValue) => Partial<Body>;
}

export interface ReadOperation<R> {
  /** The record, or null when there's none. */
  run: (id: Id, ctx: Context) => Promise<R | null>;
}

export interface CreateOperation<R, Body> {
  /** By field key: what a create may set. */
  fields: Readonly<Partial<Record<string, WriteField<Body>>>>;
  /** What a declaration can't say: an end after its start, a name not taken. */
  check?: (
    values: Readonly<Record<string, FieldValue>>,
    ctx: Context,
  ) => Issue[] | Promise<Issue[]>;
  run: (body: Body, ctx: Context) => Promise<R>;
}

export interface UpdateOperation<R, Body> {
  /** By field key: what a patch may change. */
  fields: Readonly<Partial<Record<string, Omit<WriteField<Body>, 'default'>>>>;
  /** It checks a patch's version against the row's (roles.versionField), answering conflict when stale. */
  version?: boolean;
  check?: (
    id: Id,
    values: Readonly<Record<string, FieldValue>>,
    ctx: Context,
  ) => Issue[] | Promise<Issue[]>;
  /** The record after it; null when there's no such row. */
  run: (id: Id, body: Body, version: string | undefined, ctx: Context) => Promise<R | null>;
}

export interface DeleteOperation {
  /** It checks the version against the row's (roles.versionField), answering conflict when stale. */
  version?: boolean;
  /** Whether there was such a row. */
  run: (id: Id, version: string | undefined, ctx: Context) => Promise<boolean>;
}
