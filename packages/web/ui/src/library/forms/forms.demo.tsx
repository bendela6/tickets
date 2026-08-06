import { useState } from 'react';
import { FieldWrapper } from './field-wrapper';
import { CheckboxField } from './inputs/checkbox/checkbox-field';
import { DateField } from './inputs/date/date-field';
import { JsonField } from './inputs/json/json-field';
import { MultiSelectField } from './inputs/multi-select/multi-select-field';
import { NumberField } from './inputs/number/number-field';
import { RadioField } from './inputs/radio/radio-field';
import { SelectField } from './inputs/select/select-field';
import { SliderField } from './inputs/slider/slider-field';
import { TextField } from './inputs/text/text-field';
import { TextAreaField } from './inputs/textarea/textarea-field';
import { ToggleField } from './inputs/toggle/toggle-field';
import { CardLayout, GroupLayout } from './layouts';
import { Stack } from '../layout/components/stack';

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
  const [agreed, setAgreed] = useState(false);
  const [kind, setKind] = useState('med');
  const [due, setDue] = useState<string | null>(null);
  const [weight, setWeight] = useState(50);
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
      <FieldWrapper name="due" label="Due" required={false} touched={false} loading={false}>
        <DateField {...shared} name="due" config={{ placeholder: 'Pick a day' }} value={due} onChange={setDue} />
      </FieldWrapper>
      <FieldWrapper name="kind" label="Kind" required={false} touched={false} loading={false}>
        {/* The legend the primitive renders is sr-only, so naming the group here
            does not duplicate the caption above it. */}
        <RadioField {...shared} name="kind" config={{ options: OPTIONS, label: 'Kind' }} value={kind} onChange={setKind} />
      </FieldWrapper>
      <FieldWrapper name="weight" label="Weight" required={false} touched={false} loading={false}>
        <SliderField {...shared} name="weight" config={{ min: 0, max: 100, step: 5, label: 'Weight', valueText: `${weight}%` }} value={weight} onChange={setWeight} />
      </FieldWrapper>
      <FieldWrapper name="notify" label="Notify" required={false} touched={false} loading={false}>
        <ToggleField {...shared} name="notify" config={{ label: 'Email me on change' }} value={on} onChange={setOn} />
      </FieldWrapper>
      {/* No caption: a checkbox's sentence IS its label, and a wrapper caption
          above it would say the same thing twice. */}
      <FieldWrapper name="agreed" required={false} touched={false} loading={false}>
        <CheckboxField {...shared} name="agreed" config={{ label: 'Apply to sub-tasks too' }} value={agreed} onChange={setAgreed} />
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
    // The claim every field makes: it knows when it is invalid, and says so in
    // the control itself rather than only in the message underneath. There is
    // no `invalid` prop anywhere — each adapter turns `error` into
    // `tone="danger"`, so this is also what proves the tone reaches the
    // bordered fields and the marks alike.
    name: 'Error reaches the control, not just the message',
    render: () => (
      <Stack gap={4} className="w-384">
        <FieldWrapper name="e1" label="Text" required touched loading={false} error="Required">
          <TextField {...shared} name="e1" config={{}} value="" onChange={noop} error="Required" />
        </FieldWrapper>
        <FieldWrapper name="e2" label="Select" required touched loading={false} error="Pick one">
          <SelectField {...shared} name="e2" config={{ options: OPTIONS }} value={null} onChange={noop} error="Pick one" />
        </FieldWrapper>
        <FieldWrapper name="e3" label="Due" required touched loading={false} error="Date is in the past">
          <DateField {...shared} name="e3" config={{}} value={null} onChange={noop} error="Date is in the past" />
        </FieldWrapper>
        <FieldWrapper name="e4" label="Kind" required touched loading={false} error="Choose a kind">
          <RadioField {...shared} name="e4" config={{ options: OPTIONS, label: 'Kind' }} value="" onChange={noop} error="Choose a kind" />
        </FieldWrapper>
        <FieldWrapper name="e5" label="Weight" required touched loading={false} error="Out of range">
          <SliderField {...shared} name="e5" config={{ min: 0, max: 100, label: 'Weight' }} value={50} onChange={noop} error="Out of range" />
        </FieldWrapper>
        <FieldWrapper name="e6" required touched loading={false} error="You must agree">
          <CheckboxField {...shared} name="e6" config={{ label: 'Apply to sub-tasks too' }} value={false} onChange={noop} error="You must agree" />
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
