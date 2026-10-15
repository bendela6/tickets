import type { ErrorBody, ErrorCode, Issue } from '@bh/resource';

// The errors a served resource answers, each an ErrorBody at its status. A
// source throws one to say what went wrong (refuse, notFound, conflict);
// anything else it throws answers internal, and the server logs it.

const STATUS: Readonly<Record<ErrorCode, number>> = {
  invalid: 400,
  not_found: 404,
  conflict: 409,
  internal: 500,
};

/** An answer other than the operation's: an ErrorBody at its status. */
export class ResourceError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly issues: Issue[] | undefined;

  constructor(code: ErrorCode, message: string, issues?: Issue[]) {
    super(message);
    this.name = 'ResourceError';
    this.code = code;
    this.status = STATUS[code];
    this.issues = issues;
  }

  /** What the route answers. */
  get body(): ErrorBody {
    const issues = this.issues ? { issues: this.issues } : {};
    return { error: { code: this.code, message: this.message, ...issues } };
  }
}

/** Refuses a request the source can't serve as asked: 400 invalid, at `path` in its body. */
export function refuse(message: string, path: (string | number)[] = []): never {
  throw new ResourceError('invalid', message, [{ path, message }]);
}

/** There's no such row: 404 not_found. */
export function notFound(message = 'there is no such row'): never {
  throw new ResourceError('not_found', message);
}

/** The row changed since it was read, or a value that must be unique is taken: 409 conflict. */
export function conflict(message = 'the row changed since it was read: read it again'): never {
  throw new ResourceError('conflict', message);
}
