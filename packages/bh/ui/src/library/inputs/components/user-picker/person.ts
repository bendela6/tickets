/** Someone a UserPicker offers. */
export interface Person {
  /** What `value` holds for this person. */
  id: string;
  /** Shown in the list, and on the field when only this person is chosen; the avatar takes its initials. */
  name: string;
  /** Secondary line in the list — a handle, a team, a role. */
  detail?: string;
  /** Shown, but neither the cursor nor a click can pick them. */
  disabled?: boolean;
  /**
   * Why a `disabled` person can't be picked, e.g. "Away until Monday." The
   * list prints it under the greyed row and makes it the row's description.
   */
  disabledReason?: string;
}
