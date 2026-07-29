import { useState } from 'react';
import { FieldWrapper } from './field-wrapper';
import { JsonInput } from './inputs/json/json-input';
import { MultiSelectInput } from './inputs/multi-select/multi-select-input';
import { NumberFormInput } from './inputs/number/number-input';
import { SelectInput } from './inputs/select/select-input';
import { TextInput } from './inputs/text/text-input';
import { TextareaInput } from './inputs/textarea/textarea-input';
import { ToggleInput } from './inputs/toggle/toggle-input';
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
  const [num, setNum] = useState<number | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [multi, setMulti] = useState<string[]>([]);
  const [on, setOn] = useState(false);
  const [json, setJson] = useState('{ "a": 1 }');
  return (
    <CardLayout props={{ title: 'New ticket', description: 'Every registered input' }}>
      <FieldWrapper name="title" label="Title" required touched={false} loading={false}>
        <TextInput {...shared} name="title" config={{ placeholder: 'Short summary' }} value={text} onChange={setText} />
      </FieldWrapper>
      <FieldWrapper name="body" label="Description" required={false} touched={false} loading={false}>
        <TextareaInput {...shared} name="body" config={{ rows: 3 }} value="" onChange={noop} />
      </FieldWrapper>
      <FieldWrapper name="estimate" label="Estimate" required={false} touched={false} loading={false}
        description="Rounded to whole hours">
        <NumberFormInput {...shared} name="estimate" config={{ min: 0, max: 40, suffix: 'hours' }} value={num} onChange={setNum} />
      </FieldWrapper>
      <FieldWrapper name="priority" label="Priority" required={false} touched={false} loading={false}>
        <SelectInput {...shared} name="priority" config={{ options: OPTIONS }} value={sel} onChange={setSel} />
      </FieldWrapper>
      <FieldWrapper name="labels" label="Labels" required={false} touched={false} loading={false}>
        <MultiSelectInput {...shared} name="labels" config={{ options: OPTIONS }} value={multi} onChange={setMulti} />
      </FieldWrapper>
      <FieldWrapper name="notify" label="Notify" required={false} touched={false} loading={false}>
        <ToggleInput {...shared} name="notify" config={{ label: 'Email me on change' }} value={on} onChange={setOn} />
      </FieldWrapper>
      <GroupLayout props={{ title: 'Advanced' }}>
        <FieldWrapper name="payload" label="Payload" required={false} touched={false} loading={false}>
          <JsonInput {...shared} name="payload" config={{ rows: 4 }} value={json} onChange={setJson} />
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
      <Stack gap={4} className="w-96">
        <FieldWrapper name="a" label="With description" required={false} touched={false} loading={false}
          description="Shown until an error replaces it">
          <TextInput {...shared} name="a" config={{}} value="" onChange={noop} />
        </FieldWrapper>
        <FieldWrapper name="b" label="Touched with error" required touched loading={false} error="Required">
          <TextInput {...shared} name="b" config={{}} value="" onChange={noop} error="Required" />
        </FieldWrapper>
      </Stack>
    ),
  },
  {
    name: 'Invalid JSON',
    render: () => (
      <div className="w-96">
        <JsonInput {...shared} name="j" config={{ rows: 4 }} value="{ nope" onChange={noop} />
      </div>
    ),
  },
];
