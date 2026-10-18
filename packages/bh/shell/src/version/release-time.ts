// A release's time as the version line shows it: `17 Oct 2026, 14:32`, in the
// viewer's time zone, with the year and a 24-hour clock.

/** `17 Oct 2026, 14:32`; an em dash for an empty or unreadable date. */
export function formatReleaseTime(iso: string, timeZone?: string): string {
  const date = new Date(iso);
  if (iso === '' || Number.isNaN(date.getTime())) {
    return '—';
  }
  const parts = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone,
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => {
    return parts.find((p) => p.type === type)?.value ?? '';
  };
  return `${part('day')} ${part('month')} ${part('year')}, ${part('hour')}:${part('minute')}`;
}
