import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { InputRegistry, LayoutComponentRegistry } from './registry';
import type { LayoutNode } from './layout-node';
import type { Commit } from './commit';

/** What a form knows of itself beside its nodes: where it starts, its check across fields, and when its fields commit. */
export interface FormOptions {
  /** Values to start at, by field name, over each field's own default. `<Form defaultValues>` wins over these. */
  defaultValues?: Record<string, unknown>;
  /** A check across fields, run on the visible fields' values after each field's own. `<Form schema>` wins over it. */
  schema?: StandardSchemaV1;
  /**
   * When its fields hand their values to the form: `'change'` (the default)
   * at every keystroke, `'leave'` on Enter and on leaving the field,
   * `{ after: 800 }` on those and after a pause. A field's config may say
   * otherwise; `<Form commit>` wins over it.
   */
  commit?: Commit;
}

/** A form, as data: its tree of fields, layouts and buttons, in the order they are drawn. */
export interface FormConfig<
  R extends InputRegistry,
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  L extends LayoutComponentRegistry = {},
> extends FormOptions {
  /** The top-level nodes. */
  nodes: LayoutNode<R, L>[];
}
