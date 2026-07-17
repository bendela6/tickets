import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { InputRegistry, InferConfig, InferValue } from './registry';
import type { AuthorConfig } from './async-config';
import type { WhenClause } from './when';

export type FieldNode<R extends InputRegistry> = {
  [K in keyof R]: {
    kind: 'field';
    name: string;
    type: K;
    label?: string;
    description?: string;
    required?: boolean;
    defaultValue?: InferValue<R[K]>;
    config: AuthorConfig<InferConfig<R[K]>>;
    when?: WhenClause;
    validate?: StandardSchemaV1;
  };
}[keyof R];
