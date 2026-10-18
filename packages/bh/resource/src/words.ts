import * as v from 'valibot';

// What a kind's, an operator's and a format's names and labels must be, as
// their registries check each one.

/** Whether `name` is a word: not empty, no space around it. */
export function isName(name: unknown): name is string {
  return typeof name === 'string' && name !== '' && name === name.trim();
}

/** Whether `label` says something: text that isn't blank. */
export function says(label: unknown): label is string {
  return typeof label === 'string' && label.trim() !== '';
}

/** A name, as a registry checks it: a word. */
export const nameSchema = v.custom<string>(isName, 'is a word, with no space around it');

/** A label, as a registry checks it: text that says something. */
export const labelSchema = v.custom<string>(says, 'says something');

/** A function an entry holds: `what` is it, in the message ('its matches'). */
export function functionSchema<F>(what: string) {
  return v.custom<F>((value) => typeof value === 'function', `${what} is a function`);
}
