import { useState } from 'react';
import { Card, Icon } from '@bh/ui';

export function ButtonCard() {
  const [made, setMade] = useState(0);
  return (
    <div className="grid w-320 grid-cols-2 gap-8">
      <Card asChild interactive padding={4}>
        <button type="button" onClick={() => setMade(made + 1)}>
          <Icon name="plus" size="lg" className="text-gray-11" />
          <span className="text-13/19 font-600 text-gray-12 mt-8 block">New folder</span>
          <span className="text-12/17 text-gray-11 block">{made} made</span>
        </button>
      </Card>
      <Card asChild interactive padding={4}>
        <button type="button" onClick={() => setMade(made + 1)}>
          <Icon name="file" size="lg" className="text-gray-11" />
          <span className="text-13/19 font-600 text-gray-12 mt-8 block">New file</span>
          <span className="text-12/17 text-gray-11 block">Empty, untitled</span>
        </button>
      </Card>
    </div>
  );
}
