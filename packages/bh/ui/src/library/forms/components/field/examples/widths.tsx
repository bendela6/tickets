import { useState } from 'react';
import { Field, Input } from '@bh/ui';

export function Widths() {
  const [host, setHost] = useState('files.example.com');
  const [port, setPort] = useState('8080');
  return (
    <div className="flex flex-wrap gap-12">
      <Field id="widths-host" label="Address" className="w-320 max-w-full">
        <Input id="widths-host" value={host} onChange={setHost} className="font-mono" />
      </Field>
      <Field id="widths-port" label="Port" className="w-96">
        <Input
          id="widths-port"
          inputMode="numeric"
          value={port}
          onChange={setPort}
          className="font-mono"
        />
      </Field>
    </div>
  );
}
