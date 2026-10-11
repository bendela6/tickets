import { useState } from 'react';
import { JsonViewer } from '@bh/ui';

export function Editing() {
  const [basket, setBasket] = useState<unknown>({
    owner: 'Name',
    fruits: [
      { name: 'Apples', count: 4 },
      { name: 'Pears', count: 2 },
    ],
    delivered: false,
  });
  return <JsonViewer value={basket} onChange={setBasket} label="basket.json" maxHeight={360} />;
}
