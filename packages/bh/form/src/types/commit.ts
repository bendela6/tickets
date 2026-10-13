/**
 * When a field hands its value to the form: `'change'` at every keystroke,
 * `'leave'` on Enter and on leaving the field or the window, `{ after: 800 }`
 * on those and after 800 ms without typing.
 *
 * Until then, what you type is a draft the field's control holds. It's data
 * rather than a callback so a form, or a field's config, can carry it
 * (`{ commit: 'leave' }`).
 */
export type Commit = 'change' | 'leave' | { after: number };

/** What changed when a field committed: `onCommit`'s first argument. */
export interface CommitChange {
  /** The field's name. */
  field: string;
  /** Its value now: what it committed. */
  value: unknown;
  /** Its value before. */
  previous: unknown;
}
