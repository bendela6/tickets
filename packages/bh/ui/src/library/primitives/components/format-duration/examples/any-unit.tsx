import { Figure, Figures, formatDuration } from '@bh/ui';

export function AnyUnit() {
  return (
    <div className="grid w-480 grid-cols-2 gap-16">
      <Figures title="Minutes, the default">
        <Figure label="0" value={formatDuration(0)} />
        <Figure label="45" value={formatDuration(45)} />
        <Figure label="150" value={formatDuration(150)} />
        <Figure label="1,590" value={formatDuration(1590)} />
      </Figures>
      <Figures title="Milliseconds">
        <Figure label="840" value={formatDuration(840, { unit: 'ms' })} />
        <Figure label="2,900" value={formatDuration(2900, { unit: 'ms' })} />
        <Figure label="86,000" value={formatDuration(86_000, { unit: 'ms' })} />
        <Figure label="7,529,000" value={formatDuration(7_529_000, { unit: 'ms' })} />
      </Figures>
    </div>
  );
}
