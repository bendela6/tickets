import * as v from 'valibot';
import { HttpError } from '../errors';

// `path: message; path: message`, so a 400 says which field failed.
export function describeIssues(issues: readonly v.BaseIssue<unknown>[]): string {
  return issues
    .map((issue) => {
      const path = issue.path?.map((segment) => segment.key).join('.');
      return path ? `${path}: ${issue.message}` : issue.message;
    })
    .join('; ');
}

export function parseBody<Schema extends v.GenericSchema>(
  schema: Schema,
  input: unknown,
): v.InferOutput<Schema> {
  const result = v.safeParse(schema, input);
  if (!result.success) {
    throw new HttpError(400, describeIssues(result.issues));
  }
  return result.output;
}
