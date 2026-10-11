import { useState } from 'react';
import * as v from 'valibot';
import { defineRegistry, Form, FormProvider } from '@bh/form';
import { schemaToFormConfig } from '@bh/form/valibot';
import { baseInputs, baseLayouts, Button, FieldWrapper, RootWrapper } from '@bh/ui';

const registry = defineRegistry({
  inputs: baseInputs,
  layouts: baseLayouts,
  field: { Component: FieldWrapper },
  root: { Component: RootWrapper },
});

const Member = v.object({
  name: v.pipe(v.string(), v.title('Name'), v.nonEmpty('Enter a name.')),
  email: v.pipe(v.string(), v.title('Email'), v.email('That is not an email.')),
  plan: v.pipe(v.picklist(['free', 'team', 'studio'], 'Pick a plan.'), v.title('Plan')),
  seats: v.nullish(v.pipe(v.number(), v.title('Seats'), v.minValue(1, 'At least one.'))),
  labels: v.pipe(v.array(v.string()), v.title('Labels')),
  notes: v.optional(
    v.pipe(
      v.string(),
      v.title('Notes'),
      v.description('Seen by the team only.'),
      v.metadata({ input: 'textarea' }),
    ),
  ),
});

const member = schemaToFormConfig(Member);

export function FromASchema() {
  const [sent, setSent] = useState<Record<string, unknown>>();
  return (
    <FormProvider registry={registry}>
      <div className="flex w-full max-w-360 flex-col gap-12">
        <Form form={member} onSubmit={setSent}>
          <div className="mt-16">
            <Button type="submit" variant="solid">
              Add
            </Button>
          </div>
        </Form>
        {sent ? <pre className="text-12 text-gray-11 font-mono">{JSON.stringify(sent)}</pre> : null}
      </div>
    </FormProvider>
  );
}
