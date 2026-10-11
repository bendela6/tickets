import { useState } from 'react';
import { Rating } from '@bh/ui';

export function ScaleLength() {
  const [three, setThree] = useState(2);
  const [ten, setTen] = useState(7);
  return (
    <div className="flex flex-col gap-12">
      <Rating label="Confidence" max={3} value={three} onChange={setThree} showValue />
      <Rating label="Score" max={10} value={ten} onChange={setTen} showValue />
    </div>
  );
}
