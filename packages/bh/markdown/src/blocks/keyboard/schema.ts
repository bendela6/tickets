import * as v from 'valibot';

// Each field's title and description are what an editor's form and
// page.schema.json show for it.
const shortcutSchema = v.object({
  keys: v.pipe(
    v.array(v.pipe(v.string(), v.nonEmpty())),
    v.nonEmpty(),
    v.title('Keys'),
    v.description('The keys that do it, each on its own: [Enter, Space]. A chord is one: Ctrl+K.'),
  ),
  does: v.pipe(
    v.string(),
    v.nonEmpty(),
    v.title('Does'),
    v.description('What pressing it does, as a sentence.'),
  ),
});

/** A key table: what each key, or key chord, does. */
export const keyboardSchema = v.pipe(
  v.array(shortcutSchema),
  v.nonEmpty(),
  v.description('The keys, a row each: their keys and what they do.'),
);

export type KeyboardData = v.InferOutput<typeof keyboardSchema>;
export type Shortcut = KeyboardData[number];

/**
 * A key as its parts: `Ctrl+K` → `Ctrl`, `K`. A `+` with nothing on one side
 * is the key itself, so `+` and `Ctrl++` read as written.
 */
export function chordOf(key: string): string[] {
  return key.split(/(?<=.)\+(?=.)/);
}
