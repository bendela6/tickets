import { Button, Row } from '@bh/ui';

export function Justify() {
  return (
    <div className="flex w-384 flex-col gap-12">
      <Row justify="start" gap={2}>
        <Button size="sm">Save</Button>
        <Button size="sm" variant="ghost">
          Cancel
        </Button>
      </Row>
      <Row justify="end" gap={2}>
        <Button size="sm">Save</Button>
        <Button size="sm" variant="ghost">
          Cancel
        </Button>
      </Row>
      <Row justify="between">
        <span className="text-13/19 text-gray-11">3 files</span>
        <Button size="sm">Upload</Button>
      </Row>
    </div>
  );
}
