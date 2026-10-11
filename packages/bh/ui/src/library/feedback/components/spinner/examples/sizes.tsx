import { Spinner } from '@bh/ui';

export function Sizes() {
  return (
    <div className="flex items-center gap-16">
      <Spinner size="xs" tone="primary" />
      <Spinner size="md" tone="primary" />
      <Spinner size="xl" tone="primary" />
      <Spinner size="2xl" tone="primary" />
    </div>
  );
}
