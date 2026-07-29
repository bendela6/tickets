import type { InputProps } from '@tickets/form';
import { FieldError } from '../../../components/field-error';
import { Textarea } from '../../../components/textarea';
import { Stack } from '../../../components/stack';

export type JsonInputConfig = {
  rows?: number;
  placeholder?: string;
};

/** Parse result for the current text. Empty and whitespace-only count as unset
 *  — an author clearing the field is not authoring bad JSON. */
function parseError(value: string | undefined): string | null {
  if (!value || value.trim() === '') return null;
  try {
    JSON.parse(value);
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}

/**
 * The value channel is the raw text, not the parsed object, so a half-typed
 * document survives a re-render and the author can fix it in place.
 *
 * The parse runs during render rather than in an effect: it is a pure function
 * of the current value, so an effect would only add a frame where the message
 * disagrees with the text on screen — including after an external reset.
 */
export function JsonInput(p: InputProps<JsonInputConfig, string>) {
  const error = parseError(p.value);
  return (
    <Stack gap={1}>
      <Textarea
        id={p.name}
        name={p.name}
        rows={p.config.rows ?? 12}
        spellCheck={false}
        value={p.value ?? ''}
        placeholder={p.config.placeholder}
        disabled={p.disabled}
        tone={error || p.error ? 'danger' : undefined}
        onChange={(e) => p.onChange(e.target.value)}
        onBlur={p.onBlur}
        className="font-mono"
      />
      {error ? <FieldError>Invalid JSON: {error}</FieldError> : null}
    </Stack>
  );
}
