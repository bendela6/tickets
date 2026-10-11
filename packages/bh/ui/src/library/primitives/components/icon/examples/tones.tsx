import { Icon } from '@bh/ui';

export function Tones() {
  return (
    <div className="flex flex-col gap-8">
      <span className="text-13 text-gray-11 flex items-center gap-6">
        <Icon name="file" />
        report.pdf
      </span>
      <div className="flex items-center gap-12">
        <Icon name="circle-check" tone="success" />
        <Icon name="triangle-alert" tone="warning" />
        <Icon name="circle-x" tone="danger" />
        <Icon name="circle-info" tone="blue" />
      </div>
    </div>
  );
}
