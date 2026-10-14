import * as v from 'valibot';
import { ErrorDetail, type ErrorBody, type ErrorCode } from './errors';
import { FieldMeta } from './types';
import { FieldValue, Row } from './values';

// The resource contract's actions: a resource's operations beyond create,
// update and delete (deploying a stack, pausing a torrent, re-running a
// crawl), in one shape like everything else, as valibot schemas first, their
// types inferred from them so the two can't drift (Job and ActionResult, which
// take an app's error codes, are typed by hand):
//
//   POST /api/<resource>/:id/actions/<name>   ActionInput → ActionResult   on a row
//   POST /api/<resource>/actions/<name>       ActionInput → ActionResult   on the resource
//   GET  /api/jobs/:id                                    → { job: Job }   one that runs long
//
// - An action that runs at once answers 200 with the row as it is after it,
//   as a write does; one on the whole resource answers 204, with no body.
// - An action that runs long answers 202 with the job to follow,
//   { job: { id, status } }, and GET /api/jobs/:id answers it again until it
//   is done or failed: 200 { job } whatever the job's status, since the job's
//   failure is its own, not the request's; 404 not_found for a job there
//   isn't.
// - Its input is checked like a write's: a field it doesn't take, a required
//   one missing or a value of the wrong kind answers `invalid`. An unknown
//   action, or a row that isn't there, answers `not_found`. Its errors are
//   ErrorBody's.
// - An `Idempotency-Key` header (a uuid) makes it safe to repeat, as it does
//   a write.

/**
 * One of a resource's actions, as its metadata lists it
 * (ResourceMeta.actions), so a screen offers it, and builds its form, without
 * app code.
 */
export const ActionMeta = v.strictObject({
  /**
   * 'deploy': its path segment after /actions/; unique in its resource, a
   * word.
   */
  name: v.pipe(
    v.string(),
    v.regex(/^[A-Za-z][\w-]*$/, 'an action is named by a word, as its path segment'),
  ),
  /** 'Deploy' */
  label: v.string(),
  /**
   * What it acts on: one row, at /api/<resource>/:id/actions/<name>; or the
   * whole resource, at /api/<resource>/actions/<name>.
   */
  on: v.picklist(['row', 'resource']),
  /**
   * What it takes, as fields, so a form is built from them as for a create:
   * each field's `write.required` and `write.default` say what the input must
   * hold and what it gets when left out. [] → it takes nothing.
   */
  input: v.array(FieldMeta),
  /**
   * It runs long: it answers 202 with a Job to follow instead of the row, so
   * a screen shows its progress rather than waiting on the request.
   */
  long: v.boolean(),
});
export type ActionMeta = v.InferOutput<typeof ActionMeta>;

/**
 * An action's body: its input's values, by field key, as a create's are. {}
 * under `values` for an action that takes nothing.
 */
export const ActionInput = v.strictObject({ values: v.record(v.string(), FieldValue) });
export type ActionInput = v.InferOutput<typeof ActionInput>;

/**
 * A long action's run, as POST answers it and GET /api/jobs/:id answers it
 * again: queued, then running, then done or failed. A job that is done or
 * failed stays so.
 */
export type Job<Code extends string = ErrorCode> =
  // waiting for its turn, or under way
  | { id: string; status: 'queued' | 'running' }
  // finished: with the row as it is after it, for an action on a row
  | { id: string; status: 'done'; row?: Row }
  // stopped on an error, in ErrorBody's shape, so a client shows it as it
  // shows any other; nothing more will happen
  | { id: string; status: 'failed'; error: ErrorBody<Code>['error'] };

const jobId = v.pipe(v.string(), v.nonEmpty('a job has its id'));

/** Job's schema: any app's error codes, as ErrorBody's is. */
export const Job: v.GenericSchema<Job<string>> = v.variant('status', [
  v.strictObject({ id: jobId, status: v.picklist(['queued', 'running']) }),
  v.strictObject({ id: jobId, status: v.literal('done'), row: v.optional(Row) }),
  v.strictObject({ id: jobId, status: v.literal('failed'), error: ErrorDetail }),
]);

/** Where a job is: queued, running, done or failed. */
export type JobStatus = Job['status'];

/**
 * What an action answers: the row as it is after it (200), for one on a row
 * that runs at once; or the job to follow (202), for one that runs long. One
 * on the whole resource that runs at once answers 204, with no body. Which of
 * the two comes is the action's `long`, and the status says it too.
 */
export type ActionResult<Code extends string = ErrorCode> = Row | { job: Job<Code> };

/** ActionResult's schema: a job to follow, or else the row. */
export const ActionResult: v.GenericSchema<ActionResult<string>> = v.union([
  v.strictObject({ job: Job }),
  Row,
]);
