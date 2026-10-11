import { useState } from 'react';
import { Pill } from '@bh/ui';

const FRUITS = ['Apples', 'Pears', 'Plums'];

export function Toggles() {
  const [chosen, setChosen] = useState<string[]>(['Pears']);

  const toggle = (fruit: string) => {
    setChosen((held) => {
      return held.includes(fruit) ? held.filter((one) => one !== fruit) : [...held, fruit];
    });
  };

  return (
    <div className="flex items-center gap-8">
      {FRUITS.map((fruit) => {
        const on = chosen.includes(fruit);
        return (
          <Pill
            key={fruit}
            label={fruit}
            tone={on ? 'primary' : 'neutral'}
            variant={on ? 'solid' : 'subtle'}
            pressed={on}
            onClick={() => toggle(fruit)}
          />
        );
      })}
      <Pill label="Figs" disabled onClick={() => toggle('Figs')} />
    </div>
  );
}
