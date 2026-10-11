import { Pill } from '@bh/ui';

export function ShapesAndCounts() {
  return (
    <div className="flex items-center gap-8">
      <Pill label="Square" tone="purple" />
      <Pill label="Round" tone="purple" shape="round" />
      <Pill label="Apples" shape="round" trailing={<span>12</span>} />
    </div>
  );
}
