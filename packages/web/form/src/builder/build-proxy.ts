import type {
  InputRegistry,
  InferConfig,
  InferValue,
  LayoutComponentRegistry,
  InferLayoutComponentProps,
} from '../types/registry';
import type { LayoutNode } from '../types/layout-node';
import type { FieldNode } from '../types/field-node';
import type { WhenClause } from '../types/when';
import type { AuthorConfig } from '../types/async-config';

export interface FieldOptions<R extends InputRegistry, K extends keyof R> {
  name: string;
  label?: string;
  description?: string;
  required?: boolean;
  defaultValue?: InferValue<R[K]>;
  config: AuthorConfig<InferConfig<R[K]>>;
  when?: WhenClause;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type Builder<R extends InputRegistry, L extends LayoutComponentRegistry = {}> = {
  [K in keyof R]: (opts: FieldOptions<R, K>) => FieldNode<R> & { type: K };
} & {
  [K in keyof L]: (
    opts: InferLayoutComponentProps<L[K]> & { when?: WhenClause },
    children: LayoutNode<R, L>[],
  ) => LayoutNode<R, L> & { kind: K };
};

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export function createBuilder<R extends InputRegistry, L extends LayoutComponentRegistry = {}>(
  registry: R,
  layoutRegistry: L = {} as L,
): Builder<R, L> {
  return new Proxy({} as Builder<R, L>, {
    get(_t, prop) {
      if (typeof prop !== 'string') {
        return undefined;
      }
      if (prop in registry) {
        return (opts: FieldOptions<R, keyof R>) => {
          return {
            kind: 'field' as const,
            name: opts.name,
            type: prop as keyof R,
            label: opts.label,
            description: opts.description,
            required: opts.required,
            defaultValue: opts.defaultValue,
            config: opts.config,
            when: opts.when,
          };
        };
      }
      if (prop in layoutRegistry) {
        return (
          opts: { when?: WhenClause } & Record<string, unknown>,
          children: LayoutNode<R, L>[],
        ) => {
          const { when, ...props } = opts;
          return {
            kind: prop as keyof L,
            when,
            props,
            children,
          };
        };
      }
      throw new Error(
        `builder: no input type "${prop}" in registry and no layout kind "${prop}" in layoutRegistry`,
      );
    },
  });
}
