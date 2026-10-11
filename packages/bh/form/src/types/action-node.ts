import type { WhenClause } from './when';

/** What a form's button does: submit the form, or put its values back where they started. */
export type FormAction = 'submit' | 'reset';

/** A button: drawn where it sits in the tree by the registry's `action`, or as a plain `<button>`. */
export interface ActionNode {
  kind: 'action';
  action: FormAction;
  /** Its text. */
  label: string;
  /** Shown only while this holds. */
  when?: WhenClause;
}
