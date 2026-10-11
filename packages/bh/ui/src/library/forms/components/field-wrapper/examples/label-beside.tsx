import { useState } from 'react';
import { FieldWrapper, Input } from '@bh/ui';

export function LabelBeside() {
  const [narrow, setNarrow] = useState('');
  const [wide, setWide] = useState('');
  return (
    <div className="flex flex-col gap-24">
      <div className="w-320">
        <FieldWrapper name="narrow" label="Name" required={false} touched={false} loading={false}>
          <Input id="narrow" value={narrow} onChange={setNarrow} />
        </FieldWrapper>
      </div>
      <div className="w-560">
        <FieldWrapper name="wide" label="Name" required={false} touched={false} loading={false}>
          <Input id="wide" value={wide} onChange={setWide} />
        </FieldWrapper>
      </div>
    </div>
  );
}
