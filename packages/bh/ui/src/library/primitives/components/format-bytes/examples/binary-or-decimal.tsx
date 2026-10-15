import { Figure, Figures, formatBytes } from '@bh/ui';

const SIZES = [512, 1_536, 248_000, 67_108_864, 2_252_000_000];

export function BinaryOrDecimal() {
  return (
    <div className="grid w-480 grid-cols-2 gap-16">
      <Figures title="Binary">
        {SIZES.map((bytes) => {
          return (
            <Figure key={bytes} label={bytes.toLocaleString('en-US')} value={formatBytes(bytes)} />
          );
        })}
      </Figures>
      <Figures title="Decimal">
        {SIZES.map((bytes) => {
          return (
            <Figure
              key={bytes}
              label={bytes.toLocaleString('en-US')}
              value={formatBytes(bytes, { units: 'decimal' })}
            />
          );
        })}
      </Figures>
    </div>
  );
}
