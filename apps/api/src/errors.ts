export class HttpError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

// A unique-key clash (a project key, a field key, an option value already in
// use) is the client's to fix, so it answers 409, not 500. drizzle wraps the
// postgres error in a DrizzleQueryError and keeps it on `.cause`, so both are
// checked, as run-command's collision checks do.
export function uniqueViolation(err: unknown): HttpError | null {
  for (const e of [err, (err as { cause?: unknown } | undefined)?.cause]) {
    const pg = e as { code?: string; detail?: string } | undefined;
    if (pg?.code === '23505') return new HttpError(409, conflictMessage(pg.detail));
  }
  return null;
}

// postgres says `Key (scheme_id, key)=(1, status) already exists.`; the
// `*_id` columns only scope the key, so that reads `key "status" is already
// taken`. A detail that doesn't split cleanly is passed on whole.
function conflictMessage(detail: string | undefined): string {
  const match = /^Key \((.+)\)=\((.*)\) already exists\.?$/.exec(detail ?? '');
  if (!match) return detail ?? 'that already exists';
  const columns = match[1]!.split(', ');
  const values = match[2]!.split(', ');
  if (columns.length !== values.length) return detail!;
  const pairs = columns.map((column, i) => [column, values[i]!] as const);
  const named = pairs.filter(([column]) => !column.endsWith('_id'));
  const shown = named.length > 0 ? named : pairs;
  return `${shown.map(([column, value]) => `${column} "${value}"`).join(', ')} is already taken`;
}
