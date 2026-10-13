import { Meter } from '@bh/ui';

export function NamedShares() {
  return (
    <div className="flex w-360 flex-col gap-16">
      <Meter
        label="CPU"
        fraction={0.23}
        caption={
          <>
            load <span className="text-gray-12 font-mono tabular-nums">1.20 · 0.94 · 0.71</span>{' '}
            over 1, 5 and 15 min
          </>
        }
      />
      <Meter
        label="Memory"
        fraction={0.84}
        caption={
          <>
            <span className="text-gray-12 font-mono tabular-nums">13.4 GB</span> used of{' '}
            <span className="text-gray-12 font-mono tabular-nums">16 GB</span>
          </>
        }
      />
      <Meter label="Disk" fraction={0.93} caption="Past 90 %, the bar turns red." />
    </div>
  );
}
