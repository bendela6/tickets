import { Figure, Figures, formatDateTime } from '@bh/ui';

const AT = '2026-07-13T09:05:30Z';

export function DateAndTime() {
  return (
    <div className="w-400">
      <Figures>
        <Figure label="Your zone" note="no timeZone" value={formatDateTime(AT)} />
        <Figure
          label="UTC"
          note="timeZone: 'UTC'"
          value={formatDateTime(AT, { timeZone: 'UTC' })}
        />
        <Figure
          label="New York"
          note="timeZone: 'America/New_York'"
          value={formatDateTime(AT, { timeZone: 'America/New_York' })}
        />
        <Figure
          label="With seconds"
          note="seconds: true"
          value={formatDateTime(AT, { timeZone: 'UTC', seconds: true })}
        />
      </Figures>
    </div>
  );
}
