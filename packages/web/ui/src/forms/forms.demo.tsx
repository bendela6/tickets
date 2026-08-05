import { useState } from 'react';
import { FieldWrapper } from './field-wrapper';
import { JsonField } from './inputs/json/json-field';
import { MultiSelectField } from './inputs/multi-select/multi-select-field';
import { NumberField } from './inputs/number/number-field';
import { SelectField } from './inputs/select/select-field';
import { TextField } from './inputs/text/text-field';
import { TextAreaField } from './inputs/textarea/textarea-field';
import { ToggleField } from './inputs/toggle/toggle-field';
import { CardLayout, GroupLayout } from './layouts';
import { Stack } from '../components/stack';

export const meta = { title: 'Form inputs', group: 'Forms', size: 'md' };

const OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'med', label: 'Medium' },
  { value: 'high', label: 'High' },
];

const noop = () => {};
const shared = { loading: false, onBlur: noop, disabled: false };

function Demo() {
  const [text, setText] = useState('');
  const [body, setBody] = useState('');
  const [num, setNum] = useState<number | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [multi, setMulti] = useState<string[]>([]);
  const [on, setOn] = useState(false);
  const [json, setJson] = useState('{ "a": 1 }');
  return (
    <CardLayout props={{ title: 'New ticket', description: 'Every registered input' }}>
      <FieldWrapper name="title" label="Title" required touched={false} loading={false}>
        <TextField {...shared} name="title" config={{ placeholder: 'Short summary' }} value={text} onChange={setText} />
      </FieldWrapper>
      <FieldWrapper name="body" label="Description" required={false} touched={false} loading={false}>
        <TextAreaField {...shared} name="body" config={{ rows: 3 }} value={body} onChange={setBody} />
      </FieldWrapper>
      <FieldWrapper name="estimate" label="Estimate" required={false} touched={false} loading={false}
        description="Rounded to whole hours">
        <NumberField {...shared} name="estimate" config={{ min: 0, max: 40, suffix: 'hours' }} value={num} onChange={setNum} />
      </FieldWrapper>
      <FieldWrapper name="priority" label="Priority" required={false} touched={false} loading={false}>
        <SelectField {...shared} name="priority" config={{ options: OPTIONS }} value={sel} onChange={setSel} />
      </FieldWrapper>
      <FieldWrapper name="labels" label="Labels" required={false} touched={false} loading={false}>
        <MultiSelectField {...shared} name="labels" config={{ options: OPTIONS }} value={multi} onChange={setMulti} />
      </FieldWrapper>
      <FieldWrapper name="notify" label="Notify" required={false} touched={false} loading={false}>
        <ToggleField {...shared} name="notify" config={{ label: 'Email me on change' }} value={on} onChange={setOn} />
      </FieldWrapper>
      <GroupLayout props={{ title: 'Advanced' }}>
        <FieldWrapper name="payload" label="Payload" required={false} touched={false} loading={false}>
          <JsonField {...shared} name="payload" config={{ rows: 4 }} value={json} onChange={setJson} />
        </FieldWrapper>
      </GroupLayout>
    </CardLayout>
  );
}

export const states = [
  { name: 'All inputs', render: () => <Demo /> },
  {
    name: 'Error and description',
    render: () => (
      <Stack gap={4} className="w-384">
        <FieldWrapper name="a" label="With description" required={false} touched={false} loading={false}
          description="Shown until an error replaces it">
          <TextField {...shared} name="a" config={{}} value="" onChange={noop} />
        </FieldWrapper>
        <FieldWrapper name="b" label="Touched with error" required touched loading={false} error="Required">
          <TextField {...shared} name="b" config={{}} value="" onChange={noop} error="Required" />
        </FieldWrapper>
      </Stack>
    ),
  },
  {
    name: 'Invalid JSON',
    render: () => (
      <div className="w-384">
        <JsonField {...shared} name="j" config={{ rows: 4 }} value="{ nope" onChange={noop} />
      </div>
    ),
  },
];
