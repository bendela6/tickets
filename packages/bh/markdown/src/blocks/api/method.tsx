import { Pill, type Tone } from '@bh/ui';
import type { HttpMethod } from './schema';

/** Reading is the accent, creating succeeds, changing warns, deleting is dangerous. */
const TONE: Record<HttpMethod, Tone> = {
  GET: 'primary',
  POST: 'success',
  PUT: 'warning',
  PATCH: 'warning',
  DELETE: 'danger',
};

/** The verb as a pill, one width for all five, so the paths beside it line up. */
export function Method({ method }: { method: HttpMethod }) {
  return (
    <Pill
      label={method}
      tone={TONE[method]}
      size="sm"
      data-tone={TONE[method]}
      className="min-w-56 justify-center font-mono"
    />
  );
}
