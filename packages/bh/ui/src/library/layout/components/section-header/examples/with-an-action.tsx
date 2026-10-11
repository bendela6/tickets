import { Button, SectionHeader } from '@bh/ui';

export function WithAnAction() {
  return (
    <SectionHeader
      title="Links"
      count={<span className="text-gray-9 font-mono">3</span>}
      action={
        <Button size="sm" variant="ghost">
          Add link
        </Button>
      }
    />
  );
}
