import { Meter } from '@bh/ui';

export function MarksAndATone() {
  return (
    <div className="w-360">
      <Meter
        label="Disk used"
        showLabel={false}
        fraction={0.71}
        tone="primary"
        marks={[
          { at: 0.85, label: 'Alert line, 300 GB free' },
          { at: 0.95, label: 'Floor, 100 GB free' },
        ]}
        caption="1.1 TB free of 2 TB · alert at 300 GB · floor at 100 GB"
      />
    </div>
  );
}
