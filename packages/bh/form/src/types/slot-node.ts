import type { WhenClause } from './when';

/**
 * A place in the form the app fills, holding no value: `<Form slots>` draws
 * what it's given under the slot's `name` where the node sits, and nothing
 * when it's given none. A filter form's count and its app's "Save to view"
 * are slots.
 */
export interface SlotNode {
  kind: 'slot';
  /** Its key in `<Form slots>`. */
  name: string;
  /** Shown only while this holds. */
  when?: WhenClause;
}
