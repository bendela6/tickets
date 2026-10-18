import { noLayouts } from './registries';
import type {
  AnyInputs,
  AnyLayouts,
  InputRegistry,
  InferConfig,
  InferValue,
  LayoutComponentRegistry,
  InferLayoutComponentProps,
} from '../types/registry';
import type { LayoutNode } from '../types/layout-node';
import type { ActionNode, FormAction, ResetTo } from '../types/action-node';
import type { FieldNode } from '../types/field-node';
import type { WhenClause } from '../types/when';
import type { AuthorConfig } from '../types/async-config';
import type { FieldFilter } from '../types/field-filter';
import type { SlotNode } from '../types/slot-node';

/** What a builder's input method takes: the field, less its `kind` and `type`. */
export interface FieldOptions<R extends InputRegistry, K extends keyof R> {
  /** Its key in the form's values; unique across the whole form. */
  name: string;
  /** Its label, drawn by the field wrapper. */
  label?: string;
  /** Its help text, drawn by the field wrapper. */
  description?: string;
  /** Marks the label. It checks nothing: a `validate` schema does. */
  required?: boolean;
  /** Shown and submitted, but changed neither by the reader nor by a reset. */
  readOnly?: boolean;
  /** What it starts at, unless the form's `defaultValues` names it. */
  defaultValue?: InferValue<R[K]>;
  /** Its input's config, typed by the kind; any key may be an `AsyncResolver`. */
  config: AuthorConfig<InferConfig<R[K]>>;
  /** Shown only while this holds. */
  when?: WhenClause;
  /** Which part of the query's filter it holds, in a filter form. */
  filter?: FieldFilter;
}

/** What a builder's `slot` takes. */
export interface SlotOptions {
  /** Its key in `<Form slots>`. */
  name: string;
  /** Shown only while this holds. */
  when?: WhenClause;
}

/** What a builder's `submit` and `reset` take. */
export interface ActionOptions {
  /** The button's text. */
  label: string;
  /** Shown only while this holds. */
  when?: WhenClause;
  /** A reset's: `'submitted'` (the default) or `'start'`, where it puts the values. */
  to?: ResetTo;
}

/**
 * `defineForm`'s builder: per input kind, a method taking `FieldOptions` that
 * returns a field; per layout kind, one taking its props (and `when`) and its
 * children that returns a layout node; `submit` and `reset`, which return the
 * form's buttons, drawn where they sit; and `slot`, a place the app fills.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type Builder<R extends InputRegistry, L extends LayoutComponentRegistry = {}> = {
  [K in keyof R]: (opts: FieldOptions<R, K>) => FieldNode<R> & { type: K };
} & {
  [K in keyof L]: (
    opts: InferLayoutComponentProps<L[K]> & { when?: WhenClause },
    children: LayoutNode<R, L>[],
  ) => LayoutNode<R, L> & { kind: K };
} & {
  /** A button that submits the form: checks the values, then calls `onSubmit`. */
  submit: (opts: ActionOptions) => ActionNode;
  /** A button that puts the values back where they started. */
  reset: (opts: ActionOptions) => ActionNode;
  /** A place the app fills with `<Form slots>`, holding no value. */
  slot: (opts: SlotOptions) => SlotNode;
};

const ACTIONS: readonly string[] = ['submit', 'reset'] satisfies FormAction[];

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export function createBuilder<R extends InputRegistry, L extends LayoutComponentRegistry = {}>(
  inputs: AnyInputs,
  layouts: AnyLayouts = noLayouts,
): Builder<R, L> {
  return new Proxy({} as Builder<R, L>, {
    get(_t, prop) {
      if (typeof prop !== 'string') {
        return undefined;
      }
      if (prop === 'slot') {
        return (opts: SlotOptions): SlotNode => {
          return { kind: 'slot', name: opts.name, ...(opts.when ? { when: opts.when } : {}) };
        };
      }
      if (ACTIONS.includes(prop)) {
        return (opts: ActionOptions): ActionNode => {
          const to = prop === 'reset' && opts.to ? { to: opts.to } : {};
          return {
            kind: 'action',
            action: prop as FormAction,
            label: opts.label,
            when: opts.when,
            ...to,
          };
        };
      }
      if (inputs.has(prop)) {
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
            // Only when given, so a field without them stays as it was.
            ...(opts.readOnly ? { readOnly: true } : {}),
            ...(opts.filter ? { filter: opts.filter } : {}),
          };
        };
      }
      if (layouts.has(prop)) {
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
