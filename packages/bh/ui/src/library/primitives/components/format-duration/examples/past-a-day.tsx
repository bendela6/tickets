import { Figure, Figures, formatDuration } from '@bh/ui';

const HOUR = 3_600_000;

export function PastADay() {
  return (
    <div className="w-320">
      <Figures>
        <Figure
          label="In hours"
          note="unit: 'ms'"
          value={formatDuration(76 * HOUR, { unit: 'ms' })}
        />
        <Figure
          label="In days"
          note="days: true"
          value={formatDuration(76 * HOUR, { unit: 'ms', days: true })}
        />
        <Figure
          label="Under a day"
          note="days: true"
          value={formatDuration(20 * HOUR, { unit: 'ms', days: true })}
        />
      </Figures>
    </div>
  );
}
