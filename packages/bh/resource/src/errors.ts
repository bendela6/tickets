import * as v from 'valibot';

// The resource contract's one error shape: what every route answers when it
// fails, whatever its status. Its schema checks the shape any app's errors
// take, whatever their codes; its type, by hand, takes the codes as a
// parameter.

/** One problem with an invalid request. */
export const Issue = v.strictObject({
  /** Where in the body, by keys and indexes: ['filter', 'all', 1, 'value']. */
  path: v.array(v.union([v.string(), v.number()])),
  /** 'status has no option "doing"' */
  message: v.string(),
});
export type Issue = v.InferOutput<typeof Issue>;

/** The codes bh's routes answer, each with its status. */
export type ErrorCode =
  // 400: the body, a parameter or a cursor is wrong; `issues` says where
  | 'invalid'
  // 404: no such row, or no such resource
  | 'not_found'
  // 409: the version is stale, or a value that must be unique is taken
  | 'conflict'
  // 500: nothing the caller can fix; the message says no more
  | 'internal';

/**
 * Every error's body, whatever its status. A client goes by `code`, never by
 * the message. An app may add codes of its own ('unauthorized', 'forbidden')
 * and type them in: ErrorBody<ErrorCode | 'unauthorized'>; a client that
 * doesn't know a code goes by the status.
 */
export interface ErrorBody<Code extends string = ErrorCode> {
  error: {
    code: Code;
    /** For people: 'item changed since you loaded it — refresh and retry'. */
    message: string;
    /** An invalid answer's: one per problem. */
    issues?: Issue[];
  };
}

/** What every error holds, its code any app's. */
export const ErrorDetail: v.GenericSchema<ErrorBody<string>['error']> = v.strictObject({
  code: v.pipe(v.string(), v.nonEmpty('an error has its code')),
  message: v.string(),
  issues: v.optional(v.array(Issue)),
});

/**
 * ErrorBody's schema: any app's codes, since a client goes by the status for
 * one it doesn't know.
 */
export const ErrorBody: v.GenericSchema<ErrorBody<string>> = v.strictObject({
  error: ErrorDetail,
});

/**
 * valibot's issues as an invalid answer's, one per problem: each path
 * flattened to the keys and indexes it went through, [] for the body itself.
 * A key that is neither (a Map's, a Set's) shows as its text.
 */
export function issuesOf(issues: readonly v.BaseIssue<unknown>[]): Issue[] {
  return issues.map((issue) => {
    const path = (issue.path ?? []).map(({ key }) => {
      return typeof key === 'string' || typeof key === 'number' ? key : String(key);
    });
    return { path, message: issue.message };
  });
}
