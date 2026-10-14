import { Button } from '@bh/ui';

export function IconOnlyInARow() {
  return (
    <div className="flex items-center gap-2">
      <Button variant="ghost" tone="neutral" size="xs" icon="arrow-up" label="Move up" disabled />
      <Button variant="ghost" tone="neutral" size="xs" icon="arrow-down" label="Move down" />
      <Button variant="ghost" tone="danger" size="xs" icon="trash" label="Remove" />
    </div>
  );
}
