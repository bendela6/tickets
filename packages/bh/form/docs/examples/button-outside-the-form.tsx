import { useState } from 'react';
import { defineForm, defineRegistry, Form, FormProvider, useStandaloneForm } from '@bh/form';
import { baseInputs, baseLayouts, Button, FieldWrapper, RootWrapper } from '@bh/ui';

const registry = defineRegistry({
  inputs: baseInputs,
  layouts: baseLayouts,
  field: { Component: FieldWrapper },
  root: { Component: RootWrapper },
});

const settings = defineForm(registry).build((b) => {
  return [
    b.text({
      name: 'name',
      label: 'Name',
      defaultValue: 'Studio',
      config: {},
    }),
    b.select({
      name: 'zone',
      label: 'Time zone',
      defaultValue: 'utc',
      config: {
        options: [
          { value: 'utc', label: 'UTC' },
          { value: 'tbilisi', label: 'Tbilisi (UTC+4)' },
          { value: 'lisbon', label: 'Lisbon (UTC+0/+1)' },
        ],
      },
    }),
    b.toggle({
      name: 'listed',
      label: 'Listed',
      config: { label: 'Listed' },
    }),
  ];
});

export function ButtonOutsideTheForm() {
  return (
    <FormProvider registry={registry}>
      <SettingsPanel />
    </FormProvider>
  );
}

// Under the provider, so the hook finds the registry as the form does.
function SettingsPanel() {
  const [saved, setSaved] = useState<Record<string, unknown>>();
  const api = useStandaloneForm({ form: settings, onSubmit: setSaved });
  return (
    <div className="flex w-full max-w-400 flex-col gap-16">
      <Form formApi={api} />
      <div className="border-gray-6 flex items-center gap-8 border-t-1 pt-12">
        <span className="text-12/17 text-gray-11 flex-1 font-sans">
          {api.isDirty ? 'Unsaved changes' : 'No changes'}
        </span>
        <Button variant="ghost" disabled={!api.isDirty} onClick={() => api.reset()}>
          Reset
        </Button>
        <Button
          variant="solid"
          disabled={!api.isDirty}
          loading={api.isSubmitting}
          onClick={() => void api.submit()}
        >
          Save
        </Button>
      </div>
      {saved ? <pre className="text-12 text-gray-11 font-mono">{JSON.stringify(saved)}</pre> : null}
    </div>
  );
}
