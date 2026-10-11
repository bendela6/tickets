import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { InputRegistry, InferConfig, InferValue } from './registry';
import type { AuthorConfig } from './async-config';
import type { WhenClause } from './when';

/**
 * A field: a value the form holds under `name`, drawn with the input its
 * `type` names in the registry.
 */
export type FieldNode<R extends InputRegistry> = {
  [K in keyof R]: {
    kind: 'field';
    /** Its key in the form's values; unique across the whole form. */
    name: string;
    /** The input kind that draws it, a key of the registry's `inputs`. */
    type: K;
    label?: string;
    description?: string;
    /** Marks the label. It checks nothing: `validate` does. */
    required?: boolean;
    /** What it starts at, unless the form's `defaultValues` names it. */
    defaultValue?: InferValue<R[K]>;
    /** Its input's config; any key may be an `AsyncResolver`. */
    config: AuthorConfig<InferConfig<R[K]>>;
    /** Shown only while this holds. */
    when?: WhenClause;
    /** Its check: any Standard Schema, run on its value. */
    validate?: StandardSchemaV1;
  };
}[keyof R];
