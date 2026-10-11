import { useState } from 'react';
import { Checkbox } from '@bh/ui';

const FRUITS = ['Apple', 'Banana', 'Cherry'];

export function Indeterminate() {
  const [chosen, setChosen] = useState(['Apple']);
  const all = chosen.length === FRUITS.length;
  return (
    <div className="flex flex-col gap-8">
      <Checkbox
        label="All fruits"
        value={all}
        indeterminate={chosen.length > 0 && !all}
        onChange={(next) => setChosen(next ? FRUITS : [])}
      />
      {FRUITS.map((fruit) => {
        return (
          <Checkbox
            key={fruit}
            label={fruit}
            className="ml-24"
            value={chosen.includes(fruit)}
            onChange={(next) => {
              setChosen(next ? [...chosen, fruit] : chosen.filter((item) => item !== fruit));
            }}
          />
        );
      })}
    </div>
  );
}
