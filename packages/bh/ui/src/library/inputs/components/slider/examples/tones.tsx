import { useState } from 'react';
import { Slider } from '@bh/ui';

export function Tones() {
  const [red, setRed] = useState(70);
  const [green, setGreen] = useState(45);
  const [blue, setBlue] = useState(20);
  return (
    <div className="flex w-256 flex-col gap-16">
      <Slider label="Red" tone="red" value={red} onChange={setRed} />
      <Slider label="Green" tone="green" value={green} onChange={setGreen} />
      <Slider label="Blue" tone="blue" value={blue} onChange={setBlue} />
    </div>
  );
}
