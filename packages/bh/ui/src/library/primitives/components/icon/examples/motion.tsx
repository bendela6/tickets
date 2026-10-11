import { Icon } from '@bh/ui';

export function Motion() {
  return (
    <div className="flex items-center gap-16">
      <Icon name="circle-half" tone="blue" size="lg" animate="spin" />
      <Icon name="diamond" tone="orange" size="lg" animate="pulse" />
    </div>
  );
}
