import { parseBody } from './parse-body';

// Validate a query-string value against a valibot schema, 400 on a bad one —
// the same contract as parseBody, which is body-agnostic. Aliased rather than
// reimplemented so the two can't drift; named separately so call sites read
// true.
export const parseQuery = parseBody;
