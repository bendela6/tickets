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

const delivery = defineForm(registry).build((b) => {
  return [
    b.segmented({
      name: 'method',
      label: 'Delivery',
      defaultValue: 'pickup',
      config: {
        options: [
          { value: 'pickup', label: 'Pickup' },
          { value: 'courier', label: 'Courier' },
          { value: 'post', label: 'Post' },
        ],
      },
    }),
    // The card, and everything in it, shows for courier and post.
    b.card({ title: 'Address', when: { field: 'method', in: ['courier', 'post'] } }, [
      b.text({
        name: 'street',
        label: 'Street',
        config: {},
      }),
      b.text({
        name: 'city',
        label: 'City',
        config: {},
      }),
      b.toggle({
        name: 'intercom',
        label: 'Intercom',
        when: { field: 'method', eq: 'courier' },
        config: { label: 'Has an intercom' },
      }),
      b.text({
        name: 'code',
        label: 'Intercom code',
        when: {
          all: [
            { field: 'method', eq: 'courier' },
            { field: 'intercom', truthy: true },
          ],
        },
        config: {},
      }),
    ]),
    b.actions({}, [b.submit({ label: 'Submit' })]),
  ];
});

export function Delivery() {
  const [sent, setSent] = useState<Record<string, unknown>>();
  return (
    <FormProvider registry={registry}>
      <div className="flex w-full max-w-400 flex-col gap-12">
        <Form form={delivery} onSubmit={setSent} />
        {sent ? <pre className="text-12 text-gray-11 font-mono">{JSON.stringify(sent)}</pre> : null}
      </div>
    </FormProvider>
  );
}
