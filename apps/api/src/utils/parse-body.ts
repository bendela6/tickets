import * as v from 'valibot';
import { HttpError } from '../errors';

export function parseBody<Schema extends v.GenericSchema>(
  schema: Schema,
  input: unknown,
): v.InferOutput<Schema> {
  const result = v.safeParse(schema, input);
  if (!result.success) {
    const detail = result.issues
      .map((issue) => {
        const path = issue.path?.map((segment) => segment.key).join('.');
        return path ? `${path}: ${issue.message}` : issue.message;
      })
      .join('; ');
    throw new HttpError(400, detail);
  }
  return result.output;
}
