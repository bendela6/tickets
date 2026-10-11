import { useState } from 'react';
import { defineForm, defineRegistry, Form, FormProvider } from '@bh/form';
import { baseInputs, baseLayouts, FieldWrapper, FormButton, RootWrapper } from '@bh/ui';

const registry = defineRegistry({
  inputs: baseInputs,
  layouts: baseLayouts,
  field: { Component: FieldWrapper },
  root: { Component: RootWrapper },
  action: { Component: FormButton },
});

const contact = defineForm(registry).build((b) => {
  return [
    b.text({
      name: 'name',
      label: 'Name',
      config: {},
    }),
    b.radio({
      name: 'reach',
      label: 'Reach me by',
      defaultValue: 'email',
      config: {
        options: [
          { value: 'email', label: 'Email' },
          { value: 'phone', label: 'Phone' },
        ],
      },
    }),
    b.text({
      name: 'email',
      label: 'Email',
      when: { field: 'reach', eq: 'email' },
      config: { placeholder: 'name@example.com' },
    }),
    b.text({
      name: 'phone',
      label: 'Phone',
      when: { field: 'reach', eq: 'phone' },
      config: {},
    }),
    b.actions({}, [b.submit({ label: 'Send' })]),
  ];
});

export function Contact() {
  const [sent, setSent] = useState<Record<string, unknown>>();
  return (
    <FormProvider registry={registry}>
      <div className="flex w-full max-w-360 flex-col gap-12">
        <Form form={contact} onSubmit={setSent} />
        {sent ? <pre className="text-12 text-gray-11 font-mono">{JSON.stringify(sent)}</pre> : null}
      </div>
    </FormProvider>
  );
}
