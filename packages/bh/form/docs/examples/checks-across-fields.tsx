import { useState } from 'react';
import * as v from 'valibot';
import { defineForm, defineRegistry, Form, FormProvider } from '@bh/form';
import { baseInputs, baseLayouts, FieldError, FieldWrapper, FormButton, RootWrapper } from '@bh/ui';

const registry = defineRegistry({
  inputs: baseInputs,
  layouts: baseLayouts,
  field: { Component: FieldWrapper },
  root: { Component: RootWrapper },
  action: { Component: FormButton },
});

const rules = v.pipe(
  v.object({ email: v.string(), phone: v.string(), password: v.string(), repeat: v.string() }),
  // Names no one field: the form-level error.
  v.check((x) => Boolean(x.email || x.phone), 'Give an email or a phone number.'),
  // Forwarded to one field: shown on it.
  v.forward(
    v.check((x) => x.password === x.repeat, 'The two passwords differ.'),
    ['repeat'],
  ),
);

const account = defineForm(registry).build(
  (b) => {
    return [
      b.text({
        name: 'email',
        label: 'Email',
        config: {},
      }),
      b.text({
        name: 'phone',
        label: 'Phone',
        config: {},
      }),
      b.password({
        name: 'password',
        label: 'Password',
        config: {},
      }),
      b.password({
        name: 'repeat',
        label: 'Repeat it',
        config: {},
      }),
      b.actions({}, [b.submit({ label: 'Create' })]),
    ];
  },
  { schema: rules },
);

export function ChecksAcrossFields() {
  const [sent, setSent] = useState<Record<string, unknown>>();
  return (
    <FormProvider registry={registry}>
      <div className="flex w-full max-w-360 flex-col gap-12">
        <Form
          form={account}
          onSubmit={setSent}
          renderFormError={(message) => <FieldError>{message}</FieldError>}
        />
        {sent ? <pre className="text-12 text-gray-11 font-mono">{JSON.stringify(sent)}</pre> : null}
      </div>
    </FormProvider>
  );
}
