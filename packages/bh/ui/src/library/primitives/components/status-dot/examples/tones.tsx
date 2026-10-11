import { StatusDot } from '@bh/ui';

export function Tones() {
  return (
    <div className="flex items-center gap-12">
      <StatusDot state="active" />
      <StatusDot state="active" tone="warning" />
      <StatusDot state="active" tone="danger" />
      <StatusDot state="active" tone="blue" />
      <StatusDot state="resting" tone="blue" />
    </div>
  );
}
