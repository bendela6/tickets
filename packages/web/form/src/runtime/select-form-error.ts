// Selector for the current form-level error message off tanstack's form state.
//
// When the form-level validator returns `{ form: 'msg', fields }`, tanstack
// stores the message at `state.errorMap[<trigger>]` (e.g. `onSubmit`). We
// prefer `onSubmit` (user-facing), then `onBlur`, then `onChange`. Anything
// non-string is ignored — we only surface plain strings.
export function selectFormError(s: { errorMap?: Record<string, unknown> }): string | undefined {
  const map = s.errorMap;
  if (!map) {
    return undefined;
  }
  const candidates = ['onSubmit', 'onBlur', 'onChange'] as const;
  for (const key of candidates) {
    const v = map[key];
    if (typeof v === 'string') {
      return v;
    }
  }
  return undefined;
}
