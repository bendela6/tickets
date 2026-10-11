import { StatusDot } from '@bh/ui';

export function States() {
  return (
    <div className="text-13 text-gray-12 flex flex-col gap-8">
      <span className="flex items-center gap-8">
        <StatusDot state="active" />
        Lisbon server
      </span>
      <span className="flex items-center gap-8">
        <StatusDot state="resting" />
        Porto server
      </span>
    </div>
  );
}
