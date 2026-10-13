import { useState } from 'react';
import {
  defineForm,
  defineRegistry,
  Form,
  FormProvider,
  useFieldDraft,
  useFieldValue,
  useStandaloneForm,
} from '@bh/form';
import { baseInputs, baseLayouts, Button, FieldWrapper, RootWrapper } from '@bh/ui';

const registry = defineRegistry({
  inputs: baseInputs,
  layouts: baseLayouts,
  field: { Component: FieldWrapper },
  root: { Component: RootWrapper },
});

// Its fields commit on Enter and on leaving, so a draft can be seen.
const profile = defineForm(registry).build(
  (b) => {
    return [b.text({ name: 'name', label: 'Name', defaultValue: 'Ana Lima', config: {} })];
  },
  { commit: 'leave' },
);

export function DraftCommittedSubmitted() {
  return (
    <FormProvider registry={registry}>
      <Profile />
    </FormProvider>
  );
}

function Profile() {
  const [submitted, setSubmitted] = useState('Ana Lima');
  const api = useStandaloneForm({
    form: profile,
    onSubmit: (values) => setSubmitted(String(values.name)),
  });
  return (
    <div className="flex w-full max-w-480 flex-col gap-16">
      <Form formApi={api}>
        <States submitted={submitted} />
      </Form>
      <div className="border-gray-6 flex items-center gap-12 border-t-1 pt-12">
        <Button
          variant="solid"
          // A draft is worth saving too: Save commits it first.
          disabled={!api.isDirty && !api.hasDrafts}
          loading={api.isSubmitting}
          onClick={() => void api.submit()}
        >
          Save
        </Button>
        <span className="text-12/17 text-gray-11 font-sans">
          {api.isDirty ? 'Unsaved changes' : 'No changes'}
        </span>
      </div>
    </div>
  );
}

// Inside <Form>, so it can read the field's draft and its committed value.
function States({ submitted }: { submitted: string }) {
  const states = [
    { label: 'Draft', value: useFieldDraft<string>('name') },
    { label: 'Committed', value: useFieldValue<string>('name') },
    { label: 'Submitted', value: submitted },
  ];
  return (
    <dl className="mt-12 grid grid-cols-3 gap-8">
      {states.map((state) => {
        return (
          <div key={state.label} className="bg-gray-3 rounded-6 flex min-w-0 flex-col gap-4 p-8">
            <dt className="text-11/13 text-gray-11 font-sans">{state.label}</dt>
            <dd className="text-12/17 text-gray-12 truncate font-mono">{state.value}</dd>
          </div>
        );
      })}
    </dl>
  );
}
