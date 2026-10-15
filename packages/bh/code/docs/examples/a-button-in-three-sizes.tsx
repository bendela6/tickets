import { useState } from 'react';
import { ExamplePanel } from '@bh/code';
import { Button, SegmentedControl, type ButtonSize } from '@bh/ui';

const SIZES = [
  { value: 'sm', label: 'Small' },
  { value: 'md', label: 'Medium' },
  { value: 'lg', label: 'Large' },
];

export function AButtonInThreeSizes() {
  const [size, setSize] = useState<ButtonSize>('md');
  // The code says what the result draws: the app writes both.
  const code = `<Button variant="solid" size="${size}">\n  Save the shelf\n</Button>`;
  return (
    <ExamplePanel
      title="Save the shelf"
      code={code}
      mode="split"
      height={120}
      result={
        <Button variant="solid" size={size}>
          Save the shelf
        </Button>
      }
      actions={
        <SegmentedControl
          size="xs"
          label="Save the shelf: size"
          options={SIZES}
          value={size}
          onChange={(next) => setSize(next as ButtonSize)}
        />
      }
    />
  );
}
