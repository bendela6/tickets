import type { WhenClause } from './when';

/** What a form's button does: submit the form, or put its values back where they started. */
export type FormAction = 'submit' | 'reset';

/**
 * Where a reset puts the values: `'submitted'`, to what was last submitted,
 * else to where the form started; `'start'`, always to where it started.
 */
export type ResetTo = 'start' | 'submitted';

/** What a reset takes: where it puts the values. */
export interface ResetOptions {
  /** `'submitted'` (the default) or `'start'`. */
  to?: ResetTo;
}

/** A button: drawn where it sits in the tree by the registry's `action`, or as a plain `<button>`. */
export interface ActionNode {
  kind: 'action';
  action: FormAction;
  /** Its text. */
  label: string;
  /** Shown only while this holds. */
  when?: WhenClause;
  /**
   * A reset's: where it puts the values. `'submitted'` (the default) to what
   * was last submitted, else to where the form started; `'start'` always to
   * where it started, after a submit too: a filter form's Clear.
   */
  to?: ResetTo;
}
