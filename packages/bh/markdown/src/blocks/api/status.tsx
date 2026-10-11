import { Pill, type Tone } from '@bh/ui';

/** The first digit picks the tone: 2xx succeeds, 3xx is the accent, 4xx warns, 5xx is danger. */
const TONE: Partial<Record<string, Tone>> = {
  '2': 'success',
  '3': 'primary',
  '4': 'warning',
  '5': 'danger',
};

/** A response's status as a pill, toned by its class; a 1xx stays neutral. */
export function Status({ status }: { status: number }) {
  const tone = TONE[String(status).charAt(0)] ?? 'neutral';
  return <Pill label={status} tone={tone} size="sm" data-tone={tone} className="font-mono" />;
}
