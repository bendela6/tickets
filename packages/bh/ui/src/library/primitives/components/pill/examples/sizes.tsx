import { Pill } from '@bh/ui';

export function Sizes() {
  return (
    <div className="flex items-center gap-8">
      <Pill label="Extra small" tone="blue" size="xs" icon="circle" />
      <Pill label="Small" tone="blue" size="sm" icon="circle" />
      <Pill label="Medium" tone="blue" size="md" icon="circle" />
      <Pill label="Large" tone="blue" size="lg" icon="circle" />
    </div>
  );
}
