import { useState } from 'react';
import { Disclosure, Field, Input } from '@bh/ui';

export function Sections() {
  const [width, setWidth] = useState('1280');
  const [quality, setQuality] = useState('85');
  return (
    <div className="flex w-480 max-w-full flex-col">
      <Disclosure title="Size" summary={`${width} pixels wide`} rule defaultOpen>
        <Field
          id="sections-width"
          label="Width"
          hint="In pixels; the height follows."
          className="w-160"
        >
          <Input id="sections-width" inputMode="numeric" value={width} onChange={setWidth} />
        </Field>
      </Disclosure>
      <Disclosure title="Quality" summary={`${quality} of 100`} rule>
        <Field id="sections-quality" label="Quality" className="w-160">
          <Input id="sections-quality" inputMode="numeric" value={quality} onChange={setQuality} />
        </Field>
      </Disclosure>
      <Disclosure title="Metadata" summary="Kept: the date, the camera, the place" rule>
        <p className="text-13/19 text-gray-11">Every field the file came with is kept.</p>
      </Disclosure>
    </div>
  );
}
