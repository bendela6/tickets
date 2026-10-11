/** The ids that tie a field's input to the lines its wrapper draws under it. */
export interface FieldIds {
  /** For the field's help. */
  descriptionId: string;
  /** For the field's problem. */
  errorId: string;
  /** What describes the input now: its problem, or else its help, or nothing. */
  describedBy?: string;
}

/**
 * A field's ids, from its name, which is already its input's id.
 *
 * The problem takes the help's place, as it does under the field: a field
 * with both is described by what is wrong with it. A config that failed to
 * load is a problem too, drawn in the same place.
 */
export function fieldIds(name: string, description?: string, problem?: string | Error): FieldIds {
  const descriptionId = `${name}-description`;
  const errorId = `${name}-error`;
  const describedBy = problem ? errorId : description ? descriptionId : undefined;
  return { descriptionId, errorId, describedBy };
}
