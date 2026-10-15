import * as v from 'valibot';
import { ErrorBody, type ErrorCode, type Issue } from '../errors';

// What the client throws when a route answers an error: the contract's one
// shape (ErrorBody), with the status it came with. A client goes by `code`,
// never by the message; by the status for a code it doesn't know.

/** A code from a status, for an answer that isn't an ErrorBody: a proxy's 502, a page of HTML. */
function codeOf(status: number): ErrorCode {
  switch (status) {
    case 400:
      return 'invalid';
    case 404:
      return 'not_found';
    case 409:
      return 'conflict';
    default:
      return 'internal';
  }
}

/**
 * A route's error answer: its status, and its ErrorBody's code, message and
 * issues. `Code` takes an app's own codes, as ErrorBody's does:
 * ResourceRequestError<ErrorCode | 'unauthorized'>.
 */
export class ResourceRequestError<Code extends string = ErrorCode> extends Error {
  override readonly name = 'ResourceRequestError';
  /** The HTTP status: 400, 404, 409, 500… */
  readonly status: number;
  /** What went wrong, as the contract names it: 'invalid', 'not_found', 'conflict', 'internal'. */
  readonly code: Code;
  /** An invalid answer's problems, each at its path in the body; [] for any other. */
  readonly issues: Issue[];

  constructor(status: number, error: ErrorBody<Code>['error']) {
    super(error.message);
    this.status = status;
    this.code = error.code;
    this.issues = error.issues ?? [];
  }

  /**
   * The error a failed answer carries: its ErrorBody as it is, or, for a body
   * out of that shape, a code from its status and the status's text.
   */
  static from<Code extends string = ErrorCode>(
    status: number,
    statusText: string,
    body: unknown,
  ): ResourceRequestError<Code> {
    const parsed = v.safeParse(ErrorBody, body);
    if (parsed.success) {
      return new ResourceRequestError(status, parsed.output.error as ErrorBody<Code>['error']);
    }
    const message = `${String(status)} ${statusText}`.trim();
    return new ResourceRequestError(status, { code: codeOf(status) as Code, message });
  }
}
