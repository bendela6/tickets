import { Button } from '@bh/ui';

export function IconOnly() {
  return (
    <div className="flex items-center gap-8">
      <Button icon="ellipsis" label="More actions" size="xs" />
      <Button icon="ellipsis" label="More actions" size="sm" />
      <Button icon="ellipsis" label="More actions" size="md" />
      <Button icon="ellipsis" label="More actions" size="lg" />
    </div>
  );
}
