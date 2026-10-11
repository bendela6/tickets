import { errorPosition } from './error-position';

/** What a document turned out to be. Line and column are null when nothing could say where. */
export type JsonParseResult =
  | { ok: true; value: unknown }
  | { ok: false; message: string; line: number | null; column: number | null };

// The engine appends its own position to the message, and the viewer reports the position
// separately; saying it twice reads as two problems.
const POSITION_SUFFIX = /\s*(in JSON)? at position \d+.*$/;

/**
 * Parses, and on failure says where the text stopped being JSON rather than only that it did.
 * Nothing throws out of here: invalid text is a state the viewer draws, not an error it raises.
 */
export function parseJson(text: string): JsonParseResult {
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch (failure) {
    const message = failure instanceof Error ? failure.message : String(failure);
    const position = errorPosition(message, text);
    return {
      ok: false,
      message: message.replace(POSITION_SUFFIX, ''),
      line: position?.line ?? null,
      column: position?.column ?? null,
    };
  }
}
