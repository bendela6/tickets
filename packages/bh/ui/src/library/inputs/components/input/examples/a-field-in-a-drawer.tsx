import { useId, useState } from 'react';
import { Button, Drawer, FieldLabel, Input } from '@bh/ui';

export function AFieldInADrawer() {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [city, setCity] = useState('Lisbon');
  const [saves, setSaves] = useState(0);
  return (
    <div className="flex flex-col items-start gap-8">
      <Button onClick={() => setOpen(true)}>Edit the city</Button>
      <p className="text-12/17 text-gray-11 font-sans">
        Saved <span className="text-gray-12 font-mono">{city}</span>, {saves}{' '}
        {saves === 1 ? 'time' : 'times'}
      </p>
      <Drawer open={open} onOpenChange={setOpen} label="City">
        <div className="flex flex-col gap-4 p-16">
          <FieldLabel htmlFor={id}>City</FieldLabel>
          <Input
            id={id}
            value={city}
            commit="leave"
            onChange={(next) => {
              setCity(next);
              setSaves((count) => count + 1);
            }}
          />
        </div>
      </Drawer>
    </div>
  );
}
