import { useState } from 'react';
import * as v from 'valibot';
import { defineForm, defineRegistry, Form, FormProvider } from '@bh/form';
import { baseInputs, baseLayouts, FieldWrapper, FormButton, RootWrapper } from '@bh/ui';

const registry = defineRegistry({
  inputs: baseInputs,
  layouts: baseLayouts,
  field: { Component: FieldWrapper },
  root: { Component: RootWrapper },
  action: { Component: FormButton },
});

// The builder takes no `validate`: a field gets one as a key of its node.
const booking = defineForm(registry).build((b) => {
  return [
    {
      ...b.text({
        name: 'email',
        label: 'Email',
        required: true,
        config: {},
      }),
      validate: v.pipe(v.string(), v.nonEmpty('Enter an email.'), v.email('That is not an email.')),
    },
    {
      ...b.number({
        name: 'seats',
        label: 'Seats',
        required: true,
        config: { min: 1, max: 8 },
      }),
      validate: v.pipe(
        v.number('Enter how many.'),
        v.integer('Whole seats only.'),
        v.minValue(1, 'At least one.'),
        v.maxValue(8, 'Eight at most.'),
      ),
    },
    b.actions({}, [b.submit({ label: 'Book' })]),
  ];
});

export function FieldChecks() {
  const [sent, setSent] = useState<Record<string, unknown>>();
  return (
    <FormProvider registry={registry}>
      <div className="flex w-full max-w-360 flex-col gap-12">
        <Form form={booking} onSubmit={setSent} />
        {sent ? <pre className="text-12 text-gray-11 font-mono">{JSON.stringify(sent)}</pre> : null}
      </div>
    </FormProvider>
  );
}
