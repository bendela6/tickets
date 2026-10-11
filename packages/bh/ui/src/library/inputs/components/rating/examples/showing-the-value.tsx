import { useState } from 'react';
import { Rating } from '@bh/ui';

export function ShowingTheValue() {
  const [rated, setRated] = useState(4);
  const [unrated, setUnrated] = useState(0);
  return (
    <div className="flex flex-col gap-12">
      <Rating label="Taste" value={rated} onChange={setRated} showValue />
      <Rating label="Price" value={unrated} onChange={setUnrated} showValue />
    </div>
  );
}
