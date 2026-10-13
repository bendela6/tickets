// A field's caption, as it looks. FieldLabel draws it as the `<label>` of one
// control; Field draws it as the name of a group of controls, which no
// `<label>` can be, since `for` names one control. One class, so the two
// cannot drift apart.
export const CAPTION_CLASS =
  'text-11/13 font-500 text-gray-11 block font-sans tracking-wider uppercase';

/** The asterisk after a required field's caption. It is part of the caption's text. */
export function RequiredMark() {
  return <span className="text-red-9"> *</span>;
}
