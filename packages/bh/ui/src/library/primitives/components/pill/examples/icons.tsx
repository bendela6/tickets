import { Icon, Pill } from '@bh/ui';

export function Icons() {
  return (
    <div className="flex items-center gap-8">
      <Pill label="Draft" icon="circle" />
      <Pill label="Saving" tone="blue" icon={<Icon name="circle-half" animate="spin" />} />
      <Pill label="Saved" tone="success" icon="circle-check" />
    </div>
  );
}
