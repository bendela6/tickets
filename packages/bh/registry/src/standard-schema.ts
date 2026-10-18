// Standard Schema v1 (standardschema.dev): the one interface valibot (1.0+),
// zod (3.24+) and arktype each implement, so a registry checks its entries
// with whichever an app uses. Copied rather than imported, as the spec asks:
// only these types, and nothing at runtime.

/** One problem a schema found: what is wrong, and where in the value. */
export interface StandardIssue {
  readonly message: string;
  /** The keys down to it: ['kinds', 0]. */
  readonly path?: readonly (PropertyKey | { readonly key: PropertyKey })[] | undefined;
}

/** What a schema answers: the value it accepted, or its issues. */
export type StandardResult<Output> =
  | { readonly value: Output; readonly issues?: undefined }
  | { readonly issues: readonly StandardIssue[] };

/** A schema of any library that implements Standard Schema v1. */
export interface StandardSchema<Input = unknown, Output = Input> {
  readonly '~standard': {
    readonly version: 1;
    /** The library: 'valibot', 'zod'. */
    readonly vendor: string;
    readonly validate: (value: unknown) => StandardResult<Output> | Promise<StandardResult<Output>>;
    readonly types?: { readonly input: Input; readonly output: Output } | undefined;
  };
}
