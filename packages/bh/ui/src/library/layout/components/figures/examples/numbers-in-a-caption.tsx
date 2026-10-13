import { Num } from '@bh/ui';

export function NumbersInACaption() {
  return (
    <p className="text-11/15 text-gray-11 w-360">
      <Num>6.1 GB</Num> used of <Num>16 GB</Num> · <Num>9.4 GB</Num> available
    </p>
  );
}
